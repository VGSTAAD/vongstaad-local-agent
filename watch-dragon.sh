#!/bin/bash
LOG="/tmp/watch-dragon.log"
PM2="/home/mhk/.nvm/versions/node/v20.20.2/bin/pm2"

echo "$(date) Watch Dragon checking..." >> "$LOG"

# 1. Resurrect PM2 daemon if it's not running
if ! $PM2 -s ping; then
  echo "$(date) PM2 daemon is dead, resurrecting..." >> "$LOG"
  $PM2 resurrect >> "$LOG" 2>&1
  sleep 10   # give it time to start processes
fi

# 2. Restart institution-server if not online
if ! $PM2 status | grep -q "institution-server.*online"; then
  echo "$(date) institution-server is down, restarting..." >> "$LOG"
  $PM2 restart institution-server >> "$LOG" 2>&1
fi

# 3. Restart poll-worker if not online
if ! $PM2 status | grep -q "poll-worker.*online"; then
  echo "$(date) poll-worker is down, restarting..." >> "$LOG"
  $PM2 restart poll-worker >> "$LOG" 2>&1
fi
