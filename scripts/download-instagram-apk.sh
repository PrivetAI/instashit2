#!/bin/bash

# Создать директорию для APK
mkdir -p apks

# Скачать Instagram APK (используем стабильную версию)
# Альтернативные источники:
# - APKMirror: https://www.apkmirror.com/apk/instagram/instagram-instagram/
# - APKPure: https://apkpure.com/instagram/com.instagram.android

echo "Downloading Instagram APK..."

# Вариант 1: Прямая ссылка (может устареть)
# wget -O apks/instagram.apk "https://download.apkpure.com/b/APK/com.instagram.android?version=latest"

# Вариант 2: Использование APK downloader API
# curl -o apks/instagram.apk "https://api.apk-downloader.com/download?package=com.instagram.android"

# Вариант 3: Ручная загрузка
echo "Please download Instagram APK manually from:"
echo "1. Go to https://www.apkmirror.com/apk/instagram/instagram-instagram/"
echo "2. Download the latest version (ARM64 or x86_64 depending on emulator)"
echo "3. Save as ./apks/instagram.apk"

# Проверить наличие файла
if [ -f "apks/instagram.apk" ]; then
    echo "Instagram APK found!"
    ls -la apks/
else
    echo "Instagram APK not found. Please download manually."
fi