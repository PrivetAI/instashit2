#!/bin/bash
# Полный бэкап данных приложений через adb shell

set -e

BACKUP_DIR="./android_full_backup"
mkdir -p "$BACKUP_DIR"

log() { echo "[BACKUP] $(date '+%H:%M:%S') $*"; }

log "Starting full backup..."

# Ждем готовности эмулятора
docker exec android_emulator adb wait-for-device

# Включаем root доступ
docker exec android_emulator adb root
sleep 2

# Бэкап данных Instagram с авторизацией
backup_instagram_data() {
    log "Backing up Instagram data with auth..."
    
    # Проверяем наличие Instagram
    if docker exec android_emulator adb shell "ls /data/data/ | grep instagram" 2>/dev/null; then
        # Создаем tar архив всех данных приложения через adb shell
        docker exec android_emulator adb shell "cd /data/data && tar -czf /sdcard/instagram_data.tar.gz com.instagram.android 2>/dev/null"
        
        # Копируем на хост
        docker exec android_emulator adb pull /sdcard/instagram_data.tar.gz /tmp/instagram_data.tar.gz
        docker cp android_emulator:/tmp/instagram_data.tar.gz "$BACKUP_DIR/" 2>/dev/null || true
        
        log "Instagram data backed up"
    else
        log "Instagram not found, skipping data backup"
    fi
    
    # Сохраняем APK если установлен
    pkg_path=$(docker exec android_emulator adb shell pm path com.instagram.android 2>/dev/null | cut -d: -f2 | tr -d '\r\n')
    if [ ! -z "$pkg_path" ]; then
        docker exec android_emulator adb pull "$pkg_path" /tmp/instagram.apk 2>/dev/null
        docker cp android_emulator:/tmp/instagram.apk "$BACKUP_DIR/" 2>/dev/null || true
        log "Instagram APK backed up"
    fi
}

# Бэкап системных настроек
backup_system_settings() {
    log "Backing up system settings..."
    
    # Сохраняем настройки через adb shell
    docker exec android_emulator adb shell "settings list system > /sdcard/system_settings.txt"
    docker exec android_emulator adb shell "settings list secure > /sdcard/secure_settings.txt" 
    docker exec android_emulator adb shell "settings list global > /sdcard/global_settings.txt"
    
    # Копируем на хост
    docker exec android_emulator adb pull /sdcard/system_settings.txt /tmp/system_settings.txt
    docker exec android_emulator adb pull /sdcard/secure_settings.txt /tmp/secure_settings.txt
    docker exec android_emulator adb pull /sdcard/global_settings.txt /tmp/global_settings.txt
    
    docker cp android_emulator:/tmp/system_settings.txt "$BACKUP_DIR/" 2>/dev/null || true
    docker cp android_emulator:/tmp/secure_settings.txt "$BACKUP_DIR/" 2>/dev/null || true
    docker cp android_emulator:/tmp/global_settings.txt "$BACKUP_DIR/" 2>/dev/null || true
    
    log "Settings backed up"
}

# Альтернативный метод через полный образ data раздела
backup_full_userdata() {
    log "Creating full userdata backup..."
    
    # Находим и копируем userdata образ
    if docker exec android_emulator test -f /home/androidusr/emulator/userdata-qemu.img.qcow2; then
        docker cp android_emulator:/home/androidusr/emulator/userdata-qemu.img.qcow2 "$BACKUP_DIR/userdata.qcow2"
        log "Userdata image backed up ($(ls -lh "$BACKUP_DIR/userdata.qcow2" | awk '{print $5}'))"
    fi
}

backup_instagram_data
backup_system_settings
backup_full_userdata

log "Backup completed!"
ls -lah "$BACKUP_DIR/"