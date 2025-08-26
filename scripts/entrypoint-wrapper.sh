# ===== entrypoint-wrapper.sh =====
#!/bin/bash
set -Eeuo pipefail
IFS=$'\n\t'

log(){ echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# --- настройки ---
CLEAN_START="${CLEAN_START:-true}"
SNAP_DIR="${SNAP_DIR:-/snapshots}"
SNAP_FILE="${SNAP_FILE:-$SNAP_DIR/emulator.tar.gz}"
STOP_TIMEOUT="${STOP_TIMEOUT:-55}"   # сколько ждать мягкого гашения
# -----------------

# ищем оригинальный init из образа budtmo/docker-android
find_orig_init() {
  for p in \
    "/home/androidusr/docker-android/mixins/scripts/run.sh" \
    "/home/androidusr/docker-android/scripts/run.sh" \
    "/home/androidusr/docker-android/run.sh" \
    "/entrypoint.sh"
  do
    if [ -x "$p" ]; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

ORIG_INIT="$(find_orig_init)" || { log "ERROR: original init script not found"; exit 1; }

restore_if_needed() {
  if [ "$CLEAN_START" != "true" ] && [ -f "$SNAP_FILE" ]; then
    log "Found snapshot at $SNAP_FILE, restoring into / ..."
    if tar -xzf "$SNAP_FILE" -C / --no-same-owner --no-same-permissions; then
      log "Restore complete"

      # КРИТИЧЕСКО: права и владельцы
      if id androidusr >/dev/null 2>&1; then
        chown -R androidusr:androidusr /home/androidusr/.android 2>/dev/null || true
        chown -R androidusr:androidusr /opt/android-sdk 2>/dev/null || true
        chmod -R u+rwX,go+rX /home/androidusr/.android 2>/dev/null || true
      fi

      # Если распаковался /root/.android, а /home/androidusr/.android отсутствует — переместим
      if [ -d /root/.android ] && [ ! -d /home/androidusr/.android ]; then
        log "Found /root/.android after restore; moving to /home/androidusr/.android for emulator user"
        mkdir -p /home/androidusr
        if mv /root/.android /home/androidusr/.android 2>/dev/null; then
          log "Moved /root/.android -> /home/androidusr/.android"
        else
          log "mv failed, trying cp -a ..."
          cp -a /root/.android /home/androidusr/.android || true
        fi
        chown -R androidusr:androidusr /home/androidusr/.android 2>/dev/null || true
        chmod -R u+rwX,go+rX /home/androidusr/.android 2>/dev/null || true
      fi

      # Небольшая диагностика
      ls -la /home/androidusr/.android/avd 2>/dev/null || true
    else
      rc=$?
      log "WARNING: restore failed with code $rc (continue without restore)"
    fi
  else
    if [ "$CLEAN_START" = "true" ]; then
      log "CLEAN_START=true -> skip restore"
    else
      log "No snapshot file at $SNAP_FILE -> fresh start"
    fi
  fi
}


save_if_possible() {
  if [ "$CLEAN_START" = "true" ]; then
    log "CLEAN_START=true -> skip save"
    return 0
  fi
  local saver=""
  for s in "/scripts/save-snapshot.sh" "/save-snapshot.sh"; do
    if [ -x "$s" ]; then saver="$s"; break; fi
  done
  if [ -z "$saver" ]; then
    log "WARNING: snapshot saver script not found at /scripts/save-snapshot.sh or /save-snapshot.sh"
    return 1
  fi
  log "Saving snapshot via $saver ..."
  if "$saver"; then
    log "Snapshot saved successfully"
  else
    rc=$?
    log "WARNING: snapshot save failed with code $rc"
    return $rc
  fi
}

# подготовка
mkdir -p /var/log/supervisor || true
SHUTTING_DOWN=0
CHILD_PID=0

term_handler() {
  if [ "$SHUTTING_DOWN" -eq 1 ]; then
    log "Shutdown already in progress, ignore extra signal"
    return
  fi
  SHUTTING_DOWN=1
  log "Signal received → stopping original init (PID $CHILD_PID) gracefully..."

  if [ "$CHILD_PID" -ne 0 ] && kill -0 "$CHILD_PID" 2>/dev/null; then
    kill -TERM "$CHILD_PID" 2>/dev/null || true
    for i in $(seq 1 "$STOP_TIMEOUT"); do
      if ! kill -0 "$CHILD_PID" 2>/dev/null; then
        log "Original init exited"
        CHILD_PID=0
        break
      fi
      sleep 1
      if (( i % 5 == 0 )); then
        log "Waiting original init to exit... ($i/$STOP_TIMEOUT)"
      fi
    done
    if [ "$CHILD_PID" -ne 0 ]; then
      log "Original init still running → KILL"
      kill -KILL "$CHILD_PID" 2>/dev/null || true
      wait "$CHILD_PID" 2>/dev/null || true
      CHILD_PID=0
    fi
  fi

  # сохраняем снапшот только при нормальном завершении по сигналу
  save_if_possible || true
  log "Graceful shutdown complete"
  exit 0
}

trap 'term_handler' SIGTERM SIGINT SIGHUP

log "CLEAN_START=$CLEAN_START"
restore_if_needed

log "Starting original init in foreground: $ORIG_INIT"
"$ORIG_INIT" &
CHILD_PID=$!
log "Original init PID=$CHILD_PID"

# ждём завершения дочернего процесса
set +e
wait "$CHILD_PID"
EXIT_CODE=$?
set -e

if [ "$SHUTTING_DOWN" -eq 0 ]; then
  log "Original init exited with code $EXIT_CODE (no shutdown signal) → NOT saving snapshot, exiting"
  exit "$EXIT_CODE"
fi

exit 0

