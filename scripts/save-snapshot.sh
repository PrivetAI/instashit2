
# ===== save-snapshot.sh =====
#!/bin/bash
set -euo pipefail

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

SNAP_DIR="${SNAP_DIR:-/snapshots}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SNAPSHOT_NAME="emulator_${TIMESTAMP}.tar.gz"
SNAPSHOT_PATH="${SNAP_DIR}/${SNAPSHOT_NAME}"
LINK_PATH="${SNAP_DIR}/emulator.tar.gz"

# Что сохраняем (без бинарников эмулятора!)
CANDIDATES=(
  /home/androidusr/.android/avd
  /root/.android/avd
  /opt/android-sdk/licenses
  /opt/android-sdk/platform-tools
  /opt/android-sdk/platforms
  /opt/android-sdk/system-images
  /opt/android-sdk/build-tools
)

mkdir -p "$SNAP_DIR"

# --- New: подготовка единообразного источника для snap (если AVD только в /root)
if [ ! -d /home/androidusr/.android ] && [ -d /root/.android ]; then
  log "Preparing consistent snapshot: copying /root/.android -> /home/androidusr/.android"
  mkdir -p /home/androidusr
  if cp -a /root/.android /home/androidusr/.android; then
    chown -R androidusr:androidusr /home/androidusr/.android 2>/dev/null || true
    log "Copied /root/.android -> /home/androidusr/.android"
  else
    log "Warning: failed to copy /root/.android -> /home/androidusr/.android (continuing)"
  fi
fi
# --- end new

LISTFILE=$(mktemp)
trap 'rm -f "$LISTFILE"' EXIT

log "Checking snapshot candidates..."
for p in "${CANDIDATES[@]}"; do
  if [ -e "$p" ]; then
    echo "${p#/}" >> "$LISTFILE"
    size=$(du -sh "$p" 2>/dev/null | cut -f1 || echo "unknown")
    log " Found: $p (size: $size)"
  else
    log " Not found: $p"
  fi
done

if [ ! -s "$LISTFILE" ]; then
  log "ERROR: No snapshot candidates found. Nothing to save."
  exit 2
fi

log "Creating snapshot: $SNAPSHOT_PATH"
# Никаких спец-владельцев: просто упаковываем выбранные пути
tar -czf "$SNAPSHOT_PATH" -C / -T "$LISTFILE" --warning=no-file-changed || \
  log "WARNING: tar returned non-zero exit code (may be harmless)"

if [ ! -f "$SNAPSHOT_PATH" ]; then
  log "ERROR: Snapshot file was not created!"
  exit 1
fi

snapshot_size=$(ls -lh "$SNAPSHOT_PATH" | awk '{print $5}')
log "Snapshot file created: $SNAPSHOT_PATH (size: $snapshot_size)"

# "Последний" снапшот — обычной копией (без симлинков через volume)
cp -f "$SNAPSHOT_PATH" "$LINK_PATH"

# Чистим, оставляем 3 последних
log "Cleaning up old snapshots..."
cd "$SNAP_DIR"
ls -t emulator_*.tar.gz 2>/dev/null | tail -n +4 | while read -r old; do
  log " Removing old snapshot: $old"
  rm -f "$old"
done

log "Snapshot save complete!"
log "Latest snapshot: $LINK_PATH"

