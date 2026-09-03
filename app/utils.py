"""Pure helper functions: streaks, completion rates, calendar math, heatmap tiers."""
from datetime import date, timedelta
from typing import Set, Tuple

from app.models import Habit, DAILY


def due_dates_between(habit: Habit, start: date, end: date):
    """Yield every date between start..end (inclusive) that this habit is due on."""
    d = start
    while d <= end:
        if habit.frequency == DAILY or d.weekday() in habit.weekdays:
            yield d
        d += timedelta(days=1)


def compute_streaks(habit: Habit, completed_dates: Set[str], today: date = None) -> Tuple[int, int]:
    """Return (current_streak, longest_streak) counted in units of 'due occurrences'.

    A streak continues as long as every date the habit was DUE has a completion.
    A due date that hasn't happened yet (in the future) doesn't break anything.
    """
    today = today or date.today()
    if not completed_dates:
        return 0, 0

    earliest = date.fromisoformat(min(completed_dates))
    all_due = list(due_dates_between(habit, earliest, today))
    if not all_due:
        return 0, 0

    longest = 0
    running = 0
    for d in all_due:
        if d.isoformat() in completed_dates:
            running += 1
            longest = max(longest, running)
        else:
            running = 0

    current = 0
    for d in reversed(all_due):
        if d > today:
            continue
        if d.isoformat() in completed_dates:
            current += 1
        else:
            if d == today:
                continue  # today can still be pending without breaking the streak
            break
    return current, longest


def completion_rate(habit: Habit, completed_dates: Set[str], days: int = 30, today: date = None) -> float:
    today = today or date.today()
    start = today - timedelta(days=days - 1)
    due = list(due_dates_between(habit, start, today))
    if not due:
        return 0.0
    done = sum(1 for d in due if d.isoformat() in completed_dates)
    return round(100 * done / len(due), 1)


def week_start(d: date) -> date:
    """Monday of the week containing d."""
    return d - timedelta(days=d.weekday())


def daterange(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


# ---------- heatmap day tiering ----------
# Each day is scored as (habits completed that day) / (habits due that day).
# Four tiers, matching the spec: blank (nothing done), light green (some
# done - "consistent"), dark green (most done - "high productive"), and
# blue (everything done - "full score").
TIER_NONE = "none"
TIER_LIGHT = "light"
TIER_DARK = "dark"
TIER_FULL = "full"

# Tunable thresholds: ratio must be STRICTLY GREATER to reach the next tier.
LIGHT_THRESHOLD = 0.0   # > 0% -> at least light
DARK_THRESHOLD = 0.59   # > 59% -> dark green


def day_tier(done: int, due: int) -> str:
    if due <= 0 or done <= 0:
        return TIER_NONE
    ratio = done / due
    if ratio >= 1.0:
        return TIER_FULL
    if ratio > DARK_THRESHOLD:
        return TIER_DARK
    if ratio > LIGHT_THRESHOLD:
        return TIER_LIGHT
    return TIER_NONE
