#!/usr/bin/env python3
"""
Rayx Acces - access (registration) key generator.

Double-click this file (or run `python createkey.py`) to create an access key.
The window stays open: press ENTER to create another key, or close the window
when you're done.

Advanced (optional):
    python createkey.py list                 List all keys + status
    python createkey.py revoke RAYX-REG-...  Delete an unused key
"""

import os
import sys
import secrets
import sqlite3
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(ROOT, "server", "data")
DB_PATH = os.path.join(DB_DIR, "ryzexauth.db")

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous 0/O/1/I


def connect():
    os.makedirs(DB_DIR, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=5)
    con.execute("PRAGMA journal_mode=WAL;")
    con.execute("PRAGMA busy_timeout=5000;")
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS register_keys (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            key_value  TEXT UNIQUE NOT NULL,
            used       INTEGER NOT NULL DEFAULT 0,
            used_by    TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            used_at    TEXT
        );
        """
    )
    con.commit()
    return con


def _segment(n=5):
    return "".join(secrets.choice(ALPHABET) for _ in range(n))


def create_key(con):
    while True:
        key = f"RAYX-REG-{_segment()}-{_segment()}"
        if not con.execute("SELECT 1 FROM register_keys WHERE key_value = ?", (key,)).fetchone():
            break
    con.execute("INSERT INTO register_keys (key_value) VALUES (?)", (key,))
    con.commit()
    return key


def show(key):
    print(f"Access Key [{date.today().isoformat()}]")
    print(f"> {key}")
    print()


def list_keys(con):
    rows = con.execute(
        "SELECT key_value, used, used_by FROM register_keys ORDER BY id DESC"
    ).fetchall()
    if not rows:
        print("No access keys yet.")
        return
    for key_value, is_used, used_by in rows:
        state = f"USED by {used_by}" if is_used else "OPEN"
        print(f"{key_value}   [{state}]")


def revoke(con, key):
    key = key.strip().upper()
    row = con.execute("SELECT used FROM register_keys WHERE key_value = ?", (key,)).fetchone()
    if not row:
        print(f"No such key: {key}")
    elif row[0]:
        print(f"Key {key} is already used and cannot be revoked.")
    else:
        con.execute("DELETE FROM register_keys WHERE key_value = ?", (key,))
        con.commit()
        print(f"Revoked {key}")


def main():
    args = sys.argv[1:]
    con = connect()
    try:
        if args and args[0] in ("-h", "--help", "help"):
            print(__doc__)
            return
        if args and args[0] == "list":
            list_keys(con)
            input("\nPress ENTER to exit...")
            return
        if args and args[0] == "revoke":
            revoke(con, args[1] if len(args) > 1 else "")
            input("\nPress ENTER to exit...")
            return

        # Default: create one key, then keep the window open for more.
        show(create_key(con))
        while True:
            try:
                input()  # ENTER = another key, close window = exit
            except (EOFError, KeyboardInterrupt):
                break
            show(create_key(con))
    finally:
        con.close()


if __name__ == "__main__":
    main()
