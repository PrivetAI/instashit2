#!/bin/bash
# Скрипт для сохранения установленных приложений и их данных

set -e

BACKUP_DIR="./android_backup"
mkdir -p "$BACKUP_DIR"

echo "Waiting for emulator to be ready..."
docker exec android_emulator adb wait-for-device

echo "Creating backup of installed apps..."

# 1. Сохраняем список установленных пакетов
docker exec android_emulator adb shell pm list packages -3 > "$BACKUP_DIR/packages.txt"

# 2. Извлекаем APK файлы установленных приложений
while IFS= read -r package; do
    pkg_name=${package#package:}
    echo "Backing up $pkg_name..."
    
    # Получаем путь к APK
    apk_path=$(docker exec android_emulator adb shell pm path "$pkg_name" | cut -d: -f2 | tr -d '\r')
    
    if [ ! -z "$apk_path" ]; then
        # Извлекаем APK
        docker exec android_emulator adb pull "$apk_path" "/tmp/${pkg_name}.apk" 2>/dev/null || true
        docker cp "android_emulator:/tmp/${pkg_name}.apk" "$BACKUP_DIR/${pkg_name}.apk" 2>/dev/null || true
        
        # Пытаемся сохранить данные приложения (работает не для всех)
        docker exec android_emulator adb backup -f "/tmp/${pkg_name}.ab" -noapk "$pkg_name" 2>/dev/null || true
        docker cp "android_emulator:/tmp/${pkg_name}.ab" "$BACKUP_DIR/${pkg_name}.ab" 2>/dev/null || true
    fi
done < <(cat "$BACKUP_DIR/packages.txt" | grep -v com.android)

echo "Backup completed in $BACKUP_DIR"
ls -la "$BACKUP_DIR"