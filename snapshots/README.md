# Android Emulator Snapshots

This directory stores Android emulator snapshots for quick restoration.

## Files
- `emulator.tar.gz` - Complete Android emulator state including:
  - AVD (Android Virtual Device) data
  - Instagram app data and login state
  - System settings

## Usage

### Create Snapshot
1. Make sure Android is connected in the UI
2. Click "Create Snapshot" button
3. Wait for the process to complete (may take 1-2 minutes)

### Restore Snapshot
- Happens automatically when starting the Android container if snapshot exists
- The restore script runs before the emulator starts

### Manual Commands

Create snapshot:
```bash
docker exec android_emulator sh -c "tar -czf /snapshots/emulator.tar.gz /root/.android/avd /data/data/com.instagram.android"
```

Check snapshot:
```bash
ls -lah snapshots/emulator.tar.gz
```

Delete snapshot:
```bash
rm snapshots/emulator.tar.gz
```