#!/bin/bash
# Полное восстановление данных приложений через adb

set -e

BACKUP_DIR="./android_full_backup"

log() { echo "[RESTORE] $(date '+%H:%M:%S') $*"; }

if [ ! -d "$BACKUP_DIR" ]; then
    log "No backup directory found at $BACKUP_DIR"
    exit 1
fi

log "Starting full restore..."

# Ждем готовности эмулятора
docker exec android_emulator adb wait-for-device
docker exec android_emulator adb shell "while [ \"\$(getprop sys.boot_completed)\" != \"1\" ]; do sleep 1; done"
sleep 5

# Включаем root доступ
docker exec android_emulator adb root
sleep 2

# Восстанавливаем Instagram с данными
restore_instagram_data() {
    log "Restoring Instagram with auth data..."
    
    # Устанавливаем APK если есть
    if [ -f "$BACKUP_DIR/instagram.apk" ]; then
        docker cp "$BACKUP_DIR/instagram.apk" android_emulator:/tmp/
        docker exec android_emulator adb install -r /tmp/instagram.apk 2>/dev/null || log "Instagram already installed"
        sleep 2
    fi
    
    # Восстанавливаем данные с авторизацией
    if [ -f "$BACKUP_DIR/instagram_data.tar.gz" ]; then
        log "Restoring Instagram data..."
        
        # Копируем архив в контейнер
        docker cp "$BACKUP_DIR/instagram_data.tar.gz" android_emulator:/tmp/
        
        # Останавливаем приложение
        docker exec android_emulator adb shell "am force-stop com.instagram.android"
        
        # Копируем в sdcard и распаковываем
        docker exec android_emulator adb push /tmp/instagram_data.tar.gz /sdcard/instagram_data.tar.gz
        
        # Удаляем старые данные и восстанавливаем новые
        docker exec android_emulator adb shell "
            cd /data/data
            rm -rf com.instagram.android
            tar -xzf /sdcard/instagram_data.tar.gz
            chown -R \$(stat -c %u:%g .) com.instagram.android
            chmod -R 700 com.instagram.android
            rm /sdcard/instagram_data.tar.gz
        "
        
        log "Instagram data restored with authorization"
    fi
}

# Восстанавливаем системные настройки
restore_system_settings() {
    log "Restoring system settings..."
    
    if [ -f "$BACKUP_DIR/system_settings.txt" ]; then
        docker cp "$BACKUP_DIR/system_settings.txt" android_emulator:/tmp/
        docker exec android_emulator adb push /tmp/system_settings.txt /sdcard/system_settings.txt
        
        # Восстанавливаем язык
        docker exec android_emulator adb shell "
            locale=\$(grep 'system_locales' /sdcard/system_settings.txt | cut -d'=' -f2)
            if [ ! -z \"\$locale\" ]; then
                settings put system system_locales \"\$locale\"
            fi
            settings put secure show_ime_with_hard_keyboard 1
        " 2>/dev/null || true
        
        log "Settings restored"
    fi
}

# Альтернативное восстановление через userdata образ
restore_full_userdata() {
    if [ -f "$BACKUP_DIR/userdata.qcow2" ]; then
        log "Found full userdata backup, restoring..."
        
        # Останавливаем эмулятор если нужно заменить образ
        read -p "This will replace ALL emulator data. Continue? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker exec android_emulator adb emu kill 2>/dev/null || true
            sleep 2
            
            # Копируем образ обратно
            docker cp "$BACKUP_DIR/userdata.qcow2" android_emulator:/home/androidusr/emulator/userdata-qemu.img.qcow2
            
            log "Userdata image restored. Please restart the container."
            exit 0
        fi
    fi
}

# Спрашиваем какой метод использовать
echo "Choose restore method:"
echo "1. Restore Instagram data only (keeps other apps)"
echo "2. Full userdata restore (replaces everything)"
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        restore_system_settings
        restore_instagram_data
        ;;
    2)
        restore_full_userdata
        ;;
    *)
        log "Invalid choice"
        exit 1
        ;;
esac

log "Restore completed!"
log "Please wait 10-15 seconds for Instagram to reload data"