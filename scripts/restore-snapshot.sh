
# ===== restore-snapshot.sh =====
#!/bin/bash
set -euo pipefail

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

SNAPSHOT_FILE="${SNAPSHOT_FILE:-/snapshots/emulator.tar.gz}"

if [ ! -f "$SNAPSHOT_FILE" ]; then
  log "No snapshot file found at $SNAPSHOT_FILE"
  exit 0
fi

log "Restoring snapshot from $SNAPSHOT_FILE..."

# Без сохранения старых владельцев/прав (они чаще мешают)
tar -xzf "$SNAPSHOT_FILE" -C / --no-same-owner --no-same-permissions

# Починить владельцев для пользователя, под которым крутится эмулятор/Х-вещи
if id androidusr >/dev/null 2>&1; then
  log "Fixing ownership for androidusr..."
  chown -R androidusr:androidusr /home/androidusr/.android 2>/dev/null || true
  # SDK часто пишет кеши/инсталляции — пусть будет доступен пользователю
  chown -R androidusr:androidusr /opt/android-sdk 2>/dev/null || true
else
  log "WARNING: user 'androidusr' not found; skip chown"
fi

# Если архив содержит только /root/.android, а домашняя папка пуста — переместим
if [ -d /root/.android ] && [ ! -d /home/androidusr/.android ]; then
  log "Archive restored root/.android but /home/androidusr/.android missing → move/copy"
  if mv /root/.android /home/androidusr/.android 2>/dev/null; then
    log "Moved root/.android -> /home/androidusr/.android"
  else
    cp -a /root/.android /home/androidusr/.android || true
  fi
  chown -R androidusr:androidusr /home/androidusr/.android 2>/dev/null || true
fi

# Мягко поправим права на AVD
if [ -d /home/androidusr/.android ]; then
  chmod -R u+rwX,go+rX /home/androidusr/.android || true
fi

log "Restore complete"

# Диагностика: покажем содержимое AVD после рестора
if [ -d /home/androidusr/.android/avd ]; then
  log "AVD list after restore:"
  ls -la /home/androidusr/.android/avd || true
else
  log "WARNING: /home/androidusr/.android/avd not found after restore"
fi
