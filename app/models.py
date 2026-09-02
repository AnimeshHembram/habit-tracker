"""Data models used across the app."""
from dataclasses import dataclass, field
from typing import List, Optional


DAILY = "daily"
WEEKLY = "weekly"  # specific weekdays

CATEGORIES = ["Health", "Learning", "Work", "Creative", "Mindfulness", "Other"]

# Preset accent colors habits can be tagged with (name -> hex)
COLOR_PRESETS = {
    "indigo": "#6366F1",
    "teal": "#14B8A6",
    "amber": "#F59E0B",
    "rose": "#F43F5E",
    "emerald": "#10B981",
    "sky": "#0EA5E9",
}


@dataclass
class Habit:
    id: Optional[int]
    name: str
    category: str = "Other"
    frequency: str = DAILY          # "daily" or "weekly"
    weekdays: List[int] = field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])  # 0=Mon .. 6=Sun, used when frequency == WEEKLY
    color: str = COLOR_PRESETS["indigo"]
    reminder_time: Optional[str] = None  # "HH:MM" 24h, or None for no reminder
    archived: bool = False
    created_at: str = ""

    def is_due_on(self, weekday: int) -> bool:
        """weekday: 0=Monday .. 6=Sunday"""
        if self.frequency == DAILY:
            return True
        return weekday in self.weekdays

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "category": self.category,
            "frequency": self.frequency, "weekdays": self.weekdays,
            "color": self.color, "reminder_time": self.reminder_time,
            "archived": self.archived, "created_at": self.created_at,
        }
