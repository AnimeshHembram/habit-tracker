"""Daily Habit Tracker - entry point.

Run with:  python run.py
Then open http://127.0.0.1:5000 in your browser.

Your data is stored locally in the `instance/` folder next to this file -
nothing leaves your machine.
"""
import threading
import webbrowser

from app import create_app

HOST = "127.0.0.1"
PORT = 5000


def _open_browser():
    webbrowser.open(f"http://{HOST}:{PORT}")


if __name__ == "__main__":
    app = create_app()
    threading.Timer(1.0, _open_browser).start()
    app.run(host=HOST, port=PORT, debug=False)
