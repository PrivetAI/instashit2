#!/bin/bash

SNAPSHOT_PATH="/snapshots/emulator.tar.gz"
EMULATOR_DATA_PATH="/root/.android/avd"

if [ -f "$SNAPSHOT_PATH" ]; then
    echo "Found snapshot at $SNAPSHOT_PATH"
    echo "Extracting snapshot..."
    
    # Create directory if not exists
    mkdir -p "$EMULATOR_DATA_PATH"
    
    # Extract snapshot
    cd /
    tar -xzf "$SNAPSHOT_PATH"
    
    echo "Snapshot restored successfully"
else
    echo "No snapshot found at $SNAPSHOT_PATH"
fi