"""Flask application factory."""
import os

from flask import Flask

from app.database import HabitDB

__version__ = "1.0.0"


def create_app():
    app = Flask(__name__, instance_relative_config=True)

    # User data (the SQLite db) lives in the Flask "instance" folder - kept
    # separate from source code and out of version control.
    os.makedirs(app.instance_path, exist_ok=True)
    db_path = os.path.join(app.instance_path, "habits.db")
    app.db = HabitDB(db_path)

    upload_dir = os.path.join(app.static_folder, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    app.config["UPLOAD_FOLDER"] = upload_dir
    app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB, plenty for a profile photo

    from app.routes import bp
    app.register_blueprint(bp)

    return app
