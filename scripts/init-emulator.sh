#!/bin/bash
# Скрипт для настройки эмулятора после загрузки

set -e

log() { echo "[INIT] $(date '+%H:%M:%S') $*"; }

# Ждем полной загрузки эмулятора
wait_for_boot() {
    log "Waiting for emulator to fully boot..."
    while true; do
        if adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
            break
        fi
        sleep 2
    done
    log "Emulator booted!"
    sleep 5  # Даем UI время загрузиться
}

# Настройка языков и клавиатуры
setup_languages() {
    log "Setting up languages..."
    
    # Добавляем русский язык в систему
    adb shell settings put system system_locales "en-US,ru-RU"
    
    # Настраиваем клавиатуру для поддержки нескольких языков
    adb shell ime list -s 2>/dev/null || true
    
    # Включаем показ виртуальной клавиатуры
    adb shell settings put secure show_ime_with_hard_keyboard 1
    
    log "Languages configured"
}

# Настройка системы для Instagram
setup_for_instagram() {
    log "Configuring system for Instagram..."
    
    # Отключаем ненужные анимации для производительности
    adb shell settings put global window_animation_scale 0.5
    adb shell settings put global transition_animation_scale 0.5
    adb shell settings put global animator_duration_scale 0.5
    
    # Настраиваем разрешения для хранилища
    adb shell settings put global package_verifier_enable 0
    
    # Отключаем автообновление приложений
    adb shell settings put global auto_update_apps 0
    
    log "System configured"
}

# Установка и настройка Instagram если есть APK
install_instagram() {
    if [ -f "/apks/instagram.apk" ]; then
        log "Installing Instagram..."
        adb install -r -g "/apks/instagram.apk" 2>/dev/null || log "Instagram already installed"
        
        # Даем все разрешения
        adb shell pm grant com.instagram.android android.permission.CAMERA 2>/dev/null || true
        adb shell pm grant com.instagram.android android.permission.READ_EXTERNAL_STORAGE 2>/dev/null || true
        adb shell pm grant com.instagram.android android.permission.WRITE_EXTERNAL_STORAGE 2>/dev/null || true
        adb shell pm grant com.instagram.android android.permission.RECORD_AUDIO 2>/dev/null || true
        adb shell pm grant com.instagram.android android.permission.ACCESS_FINE_LOCATION 2>/dev/null || true
        
        log "Instagram configured"
    fi
}

# Основной процесс
main() {
    # Создаем маркер для отслеживания первого запуска
    MARKER_FILE="/home/androidusr/.android/initialized"
    
    if [ -f "$MARKER_FILE" ]; then
        log "Emulator already initialized, skipping setup"
        return 0
    fi
    
    wait_for_boot
    setup_languages
    setup_for_instagram
    install_instagram
    
    # Создаем маркер
    touch "$MARKER_FILE"
    log "Initialization complete!"
}

# Запускаем в фоне чтобы не блокировать старт
main &