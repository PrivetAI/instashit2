#!/bin/bash
set -e

echo "Waiting for emulator to be ready..."
adb wait-for-device

echo "Installing Instagram APK..."
adb install -r /apks/instagram.apk

echo "Instagram APK installed."
