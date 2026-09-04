# Habit Tracker

A minimalist daily habit tracker: a GitHub-style completion heatmap, a Pomodoro-style focus timer, daily reminders with browser notifications, and a light/dark theme — all backed by a small Node/Express server so your data survives restarts and isn't tied to one browser tab.

No account, no cloud service — everything is stored in a plain JSON file on your own machine.

## Running it locally

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone <this-repo-url>
cd <repo-folder>
npm install
npm start
```

Then open **http://localhost:3000** in your browser. That's it — the same command starts both the backend and serves the frontend.

Your data is saved to `data/store.json`, created automatically on first run. That folder is git-ignored, so cloning the repo never brings someone else's habit data with it, and your own data survives stopping and restarting the server.

## Features

- **Dashboard** — a live clock and date.
- **Today** — check habits off for today, or backfill a missed day from the date picker.
- **Analytics** — a full-year completion heatmap with four tiers (nothing done, partial, everything done, and everything done *plus* logged focus time), a running score, most-visited habits, and a per-habit progress view.
- **Focus** — a configurable Pomodoro-style work/break timer with history.
- **Habits panel** — add, reorder (drag and drop), recolor, rename, and delete habits, and set a daily reminder time per habit (24-hour format) that triggers a browser notification.
- Light/dark theme with animated transitions throughout.

## Tech

- **Frontend:** vanilla HTML/CSS/JS — no framework, no build step, no dependencies.
- **Backend:** Node.js + Express, serving the frontend and a small REST API (`/api/state`, plus a `PUT` endpoint per data collection).
- **Storage:** a local `data/store.json` file, read/written by the server on each change. No database engine required.

## Project structure

```
index.html          Frontend markup
css/style.css        Styles (light + dark theme)
js/script.js          Frontend logic — calls the API below instead of localStorage
server.js            Express server + REST API
data/store.json      Created automatically — your habit data (git-ignored)
```

## A known limitation

Habit reminders fire via the browser's Notification API while this tab is open. There's no service worker or push subscription here, so a reminder won't fire if the tab (or the server) isn't running at that moment — a fair scope cut for a single-user, run-on-your-own-machine project like this one.
