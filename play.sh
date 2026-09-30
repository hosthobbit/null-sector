#!/usr/bin/env bash
# Start NULL SECTOR and open it in the browser.
cd "$(dirname "$0")"
PORT=8420
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  node server.js $PORT >/tmp/null-sector.log 2>&1 &
  sleep 0.7
fi
xdg-open "http://localhost:$PORT/" >/dev/null 2>&1 || echo "Open http://localhost:$PORT/ in your browser"
