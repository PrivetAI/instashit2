#!/bin/bash
set -euo pipefail

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

SNAP_DIR="${SNAP_DIR:-/snapshots}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SNAPSHOT_NAME="emulator_${TIMESTAMP}.tar.gz"
SNAPSHOT_PATH="${SNAP_DIR}/${SNAPSHOT_NAME}"
LINK_PATH="${SNAP_DIR}/emulator.tar.gz"

# Только необходимые директории
CANDIDATES=(
  /home/androidusr/emulator        # Основные данные эмулятора
  /home/androidusr/.android/avd    # Конфигурация AVD
  /root/.android/avd                # Резервная конфигурация
)

mkdir -p "$SNAP_DIR"

# Проверяем что есть для сохранения
log "Checking snapshot candidates..."
TOTAL_SIZE=0
for p in "${CANDIDATES[@]}"; do
  if [ -e "$p" ]; then
    size_kb=$(du -sk "$p" 2>/dev/null | cut -f1 || echo "0")
    size_human=$(du -sh "$p" 2>/dev/null | cut -f1 || echo "unknown")
    TOTAL_SIZE=$((TOTAL_SIZE + size_kb))
    log " Found: $p (size: $size_human)"
  fi
done

if [ "$TOTAL_SIZE" -lt 100 ]; then
  log "ERROR: Total size too small (${TOTAL_SIZE}KB), nothing substantial to save"
  exit 2
fi

log "Total data to backup: $((TOTAL_SIZE / 1024))MB"

# КРИТИЧНО: Создаем архив с прогрессом и проверкой
TEMP_SNAPSHOT="${SNAPSHOT_PATH}.tmp"
log "Creating snapshot: $TEMP_SNAPSHOT"

# Создаем список файлов для архивации
LISTFILE=$(mktemp)
trap 'rm -f "$LISTFILE" "$TEMP_SNAPSHOT"' EXIT

for p in "${CANDIDATES[@]}"; do
  if [ -e "$p" ]; then
    echo "${p#/}" >> "$LISTFILE"
  fi
done

# Архивируем с меньшей компрессией для скорости (gzip -1)
# и показываем прогресс через stderr
if tar --warning=no-file-changed \
       --checkpoint=1000 \
       --checkpoint-action=exec='echo "[$(date +%H:%M:%S)] Progress: %u files processed"' \
       -czf "$TEMP_SNAPSHOT" \
       -C / \
       -T "$LISTFILE" 2>&1 | while read line; do
  [[ "$line" == *"Progress:"* ]] && log "$line"
done; then
  
  # Проверяем целостность архива
  log "Verifying archive integrity..."
  if gzip -t "$TEMP_SNAPSHOT" 2>/dev/null; then
    log "Archive integrity check passed"
    
    # Синхронизируем данные на диск
    sync
    
    # Перемещаем в финальное место
    mv -f "$TEMP_SNAPSHOT" "$SNAPSHOT_PATH"
    
    # Создаем ссылку на последний снапшот
    cp -f "$SNAPSHOT_PATH" "$LINK_PATH"
    
    snapshot_size=$(ls -lh "$SNAPSHOT_PATH" | awk '{print $5}')
    log "Snapshot created successfully: $SNAPSHOT_PATH (size: $snapshot_size)"
  else
    log "ERROR: Archive integrity check failed!"
    rm -f "$TEMP_SNAPSHOT"
    exit 1
  fi
else
  log "ERROR: tar command failed"
  rm -f "$TEMP_SNAPSHOT"
  exit 1
fi

# Очистка старых снапшотов (оставляем 3)
log "Cleaning up old snapshots..."
cd "$SNAP_DIR"
ls -t emulator_*.tar.gz 2>/dev/null | tail -n +4 | while read -r old; do
  log " Removing old snapshot: $old"
  rm -f "$old"
done

# Финальная проверка
if [ -f "$LINK_PATH" ]; then
  link_size=$(ls -lh "$LINK_PATH" | awk '{print $5}')
  log "Latest snapshot available at: $LINK_PATH (size: $link_size)"
else
  log "WARNING: Failed to create link to latest snapshot"
fi

log "Snapshot save complete!"
exit 0