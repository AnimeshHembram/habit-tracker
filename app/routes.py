"""Page + REST API routes."""
import os
import uuid
from datetime import date, timedelta

from flask import Blueprint, current_app, jsonify, render_template, request, url_for
from werkzeug.utils import secure_filename

from app.models import Habit, CATEGORIES, COLOR_PRESETS
from app.utils import compute_streaks, completion_rate, day_tier

bp = Blueprint("main", __name__)

ALLOWED_PHOTO_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


def db():
    return current_app.db


# ---------- pages ----------

@bp.route("/")
def index():
    return render_template("index.html", categories=CATEGORIES, color_presets=COLOR_PRESETS)


@bp.route("/favicon.ico")
def favicon():
    # The page sets its own icon via a <link rel="icon"> data URI; this just
    # stops the browser's automatic /favicon.ico request from 404-ing.
    return "", 204


# ---------- habits ----------

@bp.route("/api/habits", methods=["GET"])
def list_habits():
    include_archived = request.args.get("include_archived") == "1"
    today = date.today()
    result = []
    for h in db().get_habits(include_archived=include_archived):
        completed_dates = db().get_completed_dates(h.id)
        current, longest = compute_streaks(h, completed_dates, today)
        result.append({
            **h.to_dict(),
            "due_today": h.is_due_on(today.weekday()),
            "completed_today": today.isoformat() in completed_dates,
            "current_streak": current,
            "longest_streak": longest,
            "rate_30d": completion_rate(h, completed_dates, days=30, today=today),
        })
    return jsonify(result)


@bp.route("/api/habits", methods=["POST"])
def create_habit():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    habit = Habit(
        id=None, name=name, category=data.get("category", "Other"),
        frequency=data.get("frequency", "daily"), weekdays=data.get("weekdays", [0, 1, 2, 3, 4, 5, 6]),
        color=data.get("color", COLOR_PRESETS["indigo"]), reminder_time=data.get("reminder_time"),
    )
    new_id = db().add_habit(habit)
    return jsonify({"id": new_id}), 201


@bp.route("/api/habits/<int:habit_id>", methods=["PUT"])
def update_habit(habit_id):
    habit = db().get_habit(habit_id)
    if not habit:
        return jsonify({"error": "not found"}), 404
    data = request.get_json(force=True) or {}
    habit.name = (data.get("name") or habit.name).strip()
    habit.category = data.get("category", habit.category)
    habit.frequency = data.get("frequency", habit.frequency)
    habit.weekdays = data.get("weekdays", habit.weekdays)
    habit.color = data.get("color", habit.color)
    habit.reminder_time = data.get("reminder_time", habit.reminder_time)
    db().update_habit(habit)
    return jsonify({"ok": True})


@bp.route("/api/habits/<int:habit_id>", methods=["DELETE"])
def delete_habit(habit_id):
    db().delete_habit(habit_id)
    return jsonify({"ok": True})


@bp.route("/api/habits/<int:habit_id>/archive", methods=["POST"])
def archive_habit(habit_id):
    data = request.get_json(force=True) or {}
    db().set_archived(habit_id, bool(data.get("archived", True)))
    return jsonify({"ok": True})


@bp.route("/api/habits/<int:habit_id>/toggle", methods=["POST"])
def toggle_habit(habit_id):
    data = request.get_json(force=True) or {}
    log_date = date.fromisoformat(data["date"]) if data.get("date") else date.today()
    completed = bool(data.get("completed", True))
    db().set_completed(habit_id, log_date, completed)
    return jsonify({"ok": True})


# ---------- heatmap + stats ----------

@bp.route("/api/heatmap")
def heatmap():
    weeks = int(request.args.get("weeks", 26))
    habits = db().get_habits()
    today = date.today()
    start = today - timedelta(days=today.weekday())  # this week's Monday
    start = start - timedelta(weeks=weeks - 1)

    completed_by_habit = {h.id: db().get_completed_dates(h.id) for h in habits}

    days = []
    d = start
    while d <= today:
        due = 0
        done = 0
        for h in habits:
            if h.is_due_on(d.weekday()) and h.created_at and h.created_at[:10] <= d.isoformat():
                due += 1
                if d.isoformat() in completed_by_habit.get(h.id, set()):
                    done += 1
        days.append({
            "date": d.isoformat(), "done": done, "due": due,
            "tier": day_tier(done, due),
        })
        d += timedelta(days=1)

    return jsonify({"start": start.isoformat(), "end": today.isoformat(), "days": days})


@bp.route("/api/stats")
def stats():
    habits = db().get_habits()
    today = date.today()

    last7 = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        due = sum(1 for h in habits if h.is_due_on(d.weekday()))
        done = sum(1 for h in habits if h.is_due_on(d.weekday()) and db().is_completed(h.id, d))
        last7.append({"date": d.isoformat(), "label": d.strftime("%a"), "rate": round(100 * done / due, 1) if due else 0})

    habit_stats = []
    for h in habits:
        completed = db().get_completed_dates(h.id)
        current, longest = compute_streaks(h, completed, today)
        habit_stats.append({
            "id": h.id, "name": h.name, "color": h.color,
            "current_streak": current, "longest_streak": longest,
            "rate_30d": completion_rate(h, completed, days=30, today=today),
        })

    return jsonify({"last7": last7, "habits": habit_stats})


# ---------- profile / settings ----------

@bp.route("/api/profile", methods=["GET"])
def get_profile():
    settings = db().get_all_settings()
    photo_url = url_for("static", filename=f"uploads/{settings['photo_filename']}") if settings.get("photo_filename") else None
    return jsonify({
        "display_name": settings.get("display_name", "Your Name"),
        "accent_color": settings.get("accent_color", "#3FB950"),
        "background_color": settings.get("background_color", ""),
        "photo_url": photo_url,
    })


@bp.route("/api/profile", methods=["POST"])
def update_profile():
    data = request.get_json(force=True) or {}
    if "display_name" in data:
        db().set_setting("display_name", (data["display_name"] or "Your Name").strip())
    if "accent_color" in data:
        db().set_setting("accent_color", data["accent_color"])
    if "background_color" in data:
        db().set_setting("background_color", data["background_color"])
    return jsonify({"ok": True})


@bp.route("/api/profile/photo", methods=["POST"])
def upload_photo():
    file = request.files.get("photo")
    if not file or not file.filename:
        return jsonify({"error": "no file"}), 400
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_PHOTO_EXTENSIONS:
        return jsonify({"error": "unsupported file type"}), 400

    # Remove any previous profile photo before saving the new one.
    old = db().get_setting("photo_filename")
    if old:
        old_path = os.path.join(current_app.config["UPLOAD_FOLDER"], secure_filename(old))
        if os.path.exists(old_path):
            os.remove(old_path)

    filename = secure_filename(f"profile_{uuid.uuid4().hex[:8]}.{ext}")
    file.save(os.path.join(current_app.config["UPLOAD_FOLDER"], filename))
    db().set_setting("photo_filename", filename)
    return jsonify({"ok": True, "photo_url": url_for("static", filename=f"uploads/{filename}")})
