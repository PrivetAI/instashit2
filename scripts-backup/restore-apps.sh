#!/bin/bash
# Скрипт для восстановления приложений и их данных

set -e

BACKUP_DIR="./android_backup"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "No backup directory found at $BACKUP_DIR"
    exit 1
fi

echo "Waiting for emulator to be ready..."
docker exec android_emulator adb wait-for-device

echo "Restoring apps from backup..."

# Восстанавливаем каждый APK
for apk_file in "$BACKUP_DIR"/*.apk; do
    if [ -f "$apk_file" ]; then
        pkg_name=$(basename "$apk_file" .apk)
        echo "Installing $pkg_name..."
        
        # Копируем APK в контейнер
        docker cp "$apk_file" "android_emulator:/tmp/${pkg_name}.apk"
        
        # Устанавливаем
        docker exec android_emulator adb install -r "/tmp/${pkg_name}.apk" 2>/dev/null || echo "Failed to install $pkg_name"
        
        # Пытаемся восстановить данные если есть backup
        if [ -f "$BACKUP_DIR/${pkg_name}.ab" ]; then
            echo "Restoring data for $pkg_name..."
            docker cp "$BACKUP_DIR/${pkg_name}.ab" "android_emulator:/tmp/${pkg_name}.ab"
            docker exec android_emulator adb restore "/tmp/${pkg_name}.ab" 2>/dev/null || echo "Failed to restore data for $pkg_name"
        fi
    fi
done

echo "Restore completed!"
docker exec android_emulator adb shell pm list packages -3