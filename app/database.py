"""SQLite persistence layer for habits, daily completion logs, and app settings.

Everything is stored locally in a single .db file - no accounts, no cloud,
no network calls. This keeps the app simple, fast, and privacy-friendly.

Access is serialized behind a lock since Flask's dev server (and some
production servers) can dispatch requests on more than one thread.
"""
import csv
import json
import sqlite3
import threading
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

from app.models import Habit, DAILY, WEEKLY


SCHEMA = """
CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    frequency TEXT NOT NULL DEFAULT 'daily',
    weekdays TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
    color TEXT NOT NULL DEFAULT '#6366F1',
    reminder_time TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    log_date TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 1,
    UNIQUE(habit_id, log_date),
    FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_logs_habit_date ON logs(habit_id, log_date);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""

DEFAULT_SETTINGS = {
    "display_name": "Your Name",
    "photo_filename": "",
    "accent_color": "#3FB950",   # GitHub-green accent by default
    "background_color": "",      # empty = use theme default
}


class HabitDB:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._lock = threading.RLock()
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    # ---------- habits ----------

    def add_habit(self, habit: Habit) -> int:
        with self._lock:
            cur = self.conn.execute(
                """INSERT INTO habits (name, category, frequency, weekdays, color, reminder_time, archived, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    habit.name, habit.category, habit.frequency, json.dumps(habit.weekdays),
                    habit.color, habit.reminder_time, int(habit.archived),
                    habit.created_at or datetime.now().isoformat(timespec="seconds"),
                ),
            )
            self.conn.commit()
            return cur.lastrowid

    def update_habit(self, habit: Habit) -> None:
        with self._lock:
            self.conn.execute(
                """UPDATE habits SET name=?, category=?, frequency=?, weekdays=?, color=?, reminder_time=?, archived=?
                   WHERE id=?""",
                (
                    habit.name, habit.category, habit.frequency, json.dumps(habit.weekdays),
                    habit.color, habit.reminder_time, int(habit.archived), habit.id,
                ),
            )
            self.conn.commit()

    def delete_habit(self, habit_id: int) -> None:
        with self._lock:
            self.conn.execute("DELETE FROM habits WHERE id=?", (habit_id,))
            self.conn.commit()

    def set_archived(self, habit_id: int, archived: bool) -> None:
        with self._lock:
            self.conn.execute("UPDATE habits SET archived=? WHERE id=?", (int(archived), habit_id))
            self.conn.commit()

    def get_habits(self, include_archived: bool = False) -> List[Habit]:
        with self._lock:
            query = "SELECT * FROM habits"
            if not include_archived:
                query += " WHERE archived=0"
            query += " ORDER BY created_at ASC"
            rows = self.conn.execute(query).fetchall()
            return [self._row_to_habit(r) for r in rows]

    def get_habit(self, habit_id: int) -> Optional[Habit]:
        with self._lock:
            row = self.conn.execute("SELECT * FROM habits WHERE id=?", (habit_id,)).fetchone()
            return self._row_to_habit(row) if row else None

    @staticmethod
    def _row_to_habit(row: sqlite3.Row) -> Habit:
        return Habit(
            id=row["id"], name=row["name"], category=row["category"], frequency=row["frequency"],
            weekdays=json.loads(row["weekdays"]), color=row["color"], reminder_time=row["reminder_time"],
            archived=bool(row["archived"]), created_at=row["created_at"],
        )

    # ---------- logs ----------

    def set_completed(self, habit_id: int, log_date: date, completed: bool) -> None:
        with self._lock:
            d = log_date.isoformat()
            if completed:
                self.conn.execute(
                    """INSERT INTO logs (habit_id, log_date, completed) VALUES (?, ?, 1)
                       ON CONFLICT(habit_id, log_date) DO UPDATE SET completed=1""",
                    (habit_id, d),
                )
            else:
                self.conn.execute("DELETE FROM logs WHERE habit_id=? AND log_date=?", (habit_id, d))
            self.conn.commit()

    def is_completed(self, habit_id: int, log_date: date) -> bool:
        with self._lock:
            row = self.conn.execute(
                "SELECT 1 FROM logs WHERE habit_id=? AND log_date=? AND completed=1",
                (habit_id, log_date.isoformat()),
            ).fetchone()
            return row is not None

    def get_completed_dates(self, habit_id: int) -> set:
        with self._lock:
            rows = self.conn.execute(
                "SELECT log_date FROM logs WHERE habit_id=? AND completed=1", (habit_id,)
            ).fetchall()
            return {r["log_date"] for r in rows}

    def get_completions_on(self, log_date: date) -> set:
        with self._lock:
            rows = self.conn.execute(
                "SELECT habit_id FROM logs WHERE log_date=? AND completed=1", (log_date.isoformat(),)
            ).fetchall()
            return {r["habit_id"] for r in rows}

    # ---------- settings (profile: name, photo, colors) ----------

    def get_setting(self, key: str) -> str:
        with self._lock:
            row = self.conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
            if row is not None:
                return row["value"]
            return DEFAULT_SETTINGS.get(key, "")

    def get_all_settings(self) -> dict:
        result = dict(DEFAULT_SETTINGS)
        with self._lock:
            rows = self.conn.execute("SELECT key, value FROM settings").fetchall()
        for r in rows:
            result[r["key"]] = r["value"]
        return result

    def set_setting(self, key: str, value: str) -> None:
        with self._lock:
            self.conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, value),
            )
            self.conn.commit()

    # ---------- export / import ----------

    def export_json(self, path: str) -> None:
        habits = self.get_habits(include_archived=True)
        data = {"habits": [h.to_dict() for h in habits], "logs": [], "settings": self.get_all_settings()}
        with self._lock:
            rows = self.conn.execute("SELECT habit_id, log_date, completed FROM logs").fetchall()
        data["logs"] = [{"habit_id": r["habit_id"], "date": r["log_date"], "completed": bool(r["completed"])} for r in rows]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def export_csv(self, path: str) -> None:
        with self._lock:
            rows = self.conn.execute(
                """SELECT h.name as habit, l.log_date as date, l.completed
                   FROM logs l JOIN habits h ON h.id = l.habit_id
                   ORDER BY l.log_date ASC"""
            ).fetchall()
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["habit", "date", "completed"])
            for r in rows:
                writer.writerow([r["habit"], r["date"], bool(r["completed"])])

    def close(self):
        with self._lock:
            self.conn.close()
