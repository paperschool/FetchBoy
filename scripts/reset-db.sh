#!/bin/bash
# Reset the FetchBoy SQLite database.
# Usage: yarn db:reset

DB_DIR="$HOME/Library/Application Support/com.fetchboy.app"
DB_FILE="$DB_DIR/fetch-boy.db"

if [ ! -f "$DB_FILE" ]; then
  echo "No database found at: $DB_FILE"
  exit 0
fi

echo "Deleting: $DB_FILE"
rm -f "$DB_FILE" "$DB_FILE-wal" "$DB_FILE-shm"
echo "Database reset. Restart the app to recreate it with fresh migrations and sample data."
