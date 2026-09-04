// ---------- Live TIME / DATE | DAY ----------

const timeEl = document.getElementById("timeDisplay");
const dateEl = document.getElementById("dateDisplay");

function pad(n) {
  return n.toString().padStart(2, "0");
}

function updateClock() {
  const now = new Date();

  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  timeEl.textContent = `${hours}:${minutes}:${seconds}`;

  const dateStr = now.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const dayStr = now.toLocaleDateString(undefined, { weekday: "long" });
  dateEl.textContent = `${dateStr}  |  ${dayStr}`;
}

updateClock();
setInterval(updateClock, 1000);

// ---------- Theme toggle ----------

const themeBtn = document.getElementById("themeBtn");
const root = document.documentElement;

// Sun/moon icons are two stacked SVGs crossfaded purely via CSS off the
// data-theme attribute (see .theme-icon rules in style.css) — no more
// innerHTML swap, so the swap itself can animate smoothly.
function applyTheme(theme) {
  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }
  localStorage.setItem("habitTrackerTheme", theme);
}

const savedTheme = localStorage.getItem("habitTrackerTheme") || "light";
applyTheme(savedTheme);

themeBtn.addEventListener("click", () => {
  const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
});

// ---------- View switching (Dashboard <-> Today <-> Analytics <-> Focus <-> Habits) ----------

const mainTopbar = document.querySelector(".topbar");
const topbarDivider = document.querySelector(".topbar-divider");
const dashboardMain = document.querySelector(".dashboard");
const todayView = document.getElementById("todayView");
const analyticsView = document.getElementById("analyticsView");
const focusView = document.getElementById("focusView");
const habitsView = document.getElementById("habitsView");
const menuBtn = document.getElementById("menuBtn");
const closeHabitsBtn = document.getElementById("closeHabitsBtn");
const habitNameInput = document.getElementById("habitNameInput");
const clockBlock = document.querySelector(".clock-block");

let activeTab = "dashboard";

// Replays the fadeIn every time the Dashboard tab is (re)entered — removing
// the classes first, then forcing a reflow, is what lets a CSS animation
// restart instead of staying a no-op on a class it already has.
function playDashboardFadeIn() {
  clockBlock.classList.remove("animate__animated", "animate__fadeIn");
  void clockBlock.offsetWidth;
  clockBlock.classList.add("animate__animated", "animate__fadeIn");
}

function applyTab(tab) {
  activeTab = tab;
  dashboardMain.hidden = tab !== "dashboard";
  todayView.hidden = tab !== "today";
  analyticsView.hidden = tab !== "analytics";
  focusView.hidden = tab !== "focus";
  if (tab === "dashboard") playDashboardFadeIn();
  if (tab === "today") renderTodayView();
  if (tab === "analytics") renderAnalytics();
  if (tab === "focus") {
    renderFocusTimer();
    renderFocusControls();
    renderFocusHistory();
  }
}

// Sliding nav underline: a single bar measured against the currently
// active .nav-link's own position/width, instead of each link owning its
// own border. Recalculated on tab change, on resize, and once the web font
// has finished loading (Inter can shift text metrics after swap-in).
const navUnderlineEl = document.getElementById("navUnderline");

function updateNavUnderline() {
  const activeLink = document.querySelector(".nav-link.active");
  if (!activeLink || !navUnderlineEl) return;
  navUnderlineEl.style.width = `${activeLink.offsetWidth}px`;
  navUnderlineEl.style.transform = `translateX(${activeLink.offsetLeft}px)`;
}

function goToTab(tab) {
  document.querySelectorAll(".nav-link").forEach((l) => l.classList.toggle("active", l.dataset.tab === tab));
  updateNavUnderline();
  applyTab(tab);
}

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    goToTab(link.dataset.tab);
  });
});

updateNavUnderline();
window.addEventListener("resize", updateNavUnderline);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(updateNavUnderline);
}

const MENU_MORPH_MS = 260;

function showHabits() {
  menuBtn.classList.add("is-open");
  setTimeout(() => {
    mainTopbar.hidden = true;
    topbarDivider.hidden = true;
    dashboardMain.hidden = true;
    todayView.hidden = true;
    analyticsView.hidden = true;
    focusView.hidden = true;
    habitsView.hidden = false;
    habitNameInput.focus();
  }, MENU_MORPH_MS);
}

function showDashboard() {
  habitsView.hidden = true;
  mainTopbar.hidden = false;
  topbarDivider.hidden = false;
  menuBtn.classList.remove("is-open");
  applyTab(activeTab);
  updateNavUnderline();
}

// X -> hamburger morph plays first, then the panel swap happens after the
// CSS transition has had time to run (same delayed-hide pattern as
// showHabits() above), so the icon shape-change is actually visible.
function closeHabits() {
  closeHabitsBtn.classList.add("is-closing");
  setTimeout(() => {
    showDashboard();
    closeHabitsBtn.classList.remove("is-closing");
  }, MENU_MORPH_MS);
}

menuBtn.addEventListener("click", showHabits);
closeHabitsBtn.addEventListener("click", closeHabits);

// ---------- Habits: state + persistence ----------

const PRESET_COLORS = [
  "#F0464F", // red
  "#F5893D", // orange
  "#F4C430", // yellow
  "#3BB273", // green
  "#1FB6A4", // teal
  "#3D8BFD", // blue
  "#9B6BF2", // purple
  "#E4488B", // pink
];

// habits/completions/focusHistory start empty and are populated once by
// initAppData() below, which fetches everything from the backend
// (/api/state) on load — see the bottom of this file. save*() functions
// persist back to the server instead of localStorage.
let habits = [];
let selectedColor = PRESET_COLORS[0];

function saveHabits() {
  fetch("/api/habits", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(habits),
  }).catch((err) => console.error("Failed to save habits to server:", err));
}

// ---------- Completions: state + persistence ----------
//
// Shape: { "YYYY-MM-DD": { "<habitId>": true, ... }, ... } — a date key is
// only present once at least one habit has been checked off that day.

let completions = {};

function saveCompletions() {
  fetch("/api/completions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(completions),
  }).catch((err) => console.error("Failed to save completions to server:", err));
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isHabitDone(habitId, date) {
  const day = completions[dateKey(date)];
  return !!(day && day[habitId]);
}

function setHabitDone(habitId, date, done) {
  const key = dateKey(date);
  if (done) {
    if (!completions[key]) completions[key] = {};
    completions[key][habitId] = true;
  } else if (completions[key]) {
    delete completions[key][habitId];
    if (Object.keys(completions[key]).length === 0) delete completions[key];
  }
  saveCompletions();
}

// ---------- Color row ----------

const colorRow = document.getElementById("colorRow");

function renderColorRow() {
  colorRow.innerHTML = "";

  PRESET_COLORS.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch" + (color === selectedColor ? " selected" : "");
    swatch.style.background = color;
    swatch.setAttribute("aria-label", `Select color ${color}`);
    swatch.addEventListener("click", () => {
      selectedColor = color;
      renderColorRow();
    });
    colorRow.appendChild(swatch);
  });

  const customLabel = document.createElement("label");
  customLabel.className = "color-swatch-custom";
  customLabel.title = "Custom color";
  customLabel.textContent = "+";
  const customInput = document.createElement("input");
  customInput.type = "color";
  customInput.value = selectedColor;
  customInput.addEventListener("input", (e) => {
    selectedColor = e.target.value;
    renderColorRow();
  });
  customLabel.appendChild(customInput);
  colorRow.appendChild(customLabel);
}

// ---------- Habit list ----------

const habitListEl = document.getElementById("habitList");
const emptyState = document.getElementById("emptyState");
const habitCountEl = document.getElementById("habitCount");

// Tracks the id of a habit just added via the form, so renderHabits() can
// fade in only that one row (animate__fadeIn) instead of replaying the
// animation on every existing row during a full re-render.
let newlyAddedHabitId = null;

// ---------- Daily habit reminders + notifications ----------
//
// Each habit optionally carries a reminderTime ("HH:MM", 24hr, from a native
// time input) and a lastNotifiedDate guard so a match only fires once a day.
// Only one reminder popover is open at a time, closed by an outside click or
// Escape — same pattern as the date/year pickers elsewhere in this file.

let openReminderPopover = null;

function closeOpenReminderPopover() {
  if (openReminderPopover) {
    openReminderPopover.hidden = true;
    openReminderPopover = null;
  }
}

document.addEventListener("click", (e) => {
  if (!openReminderPopover) return;
  if (openReminderPopover.contains(e.target) || e.target.closest(".habit-reminder-btn")) return;
  closeOpenReminderPopover();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeOpenReminderPopover();
});

function requestNotificationPermissionIfNeeded() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

// Runs periodically while the tab is open and compares each habit's saved
// reminder time against the current clock, in the same 24hr HH:MM shape.
// There's no service worker here, so reminders only fire while this tab is
// actually open — a known limitation of a static, backend-less app.
function checkReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const today = dateKey(now);
  let changed = false;

  habits.forEach((habit) => {
    if (!habit.reminderTime || habit.reminderTime !== currentTime) return;
    if (habit.lastNotifiedDate === today) return;
    try {
      new Notification("Habit reminder", {
        body: `Time for "${habit.name}" (${habit.reminderTime})`,
        tag: `habit-${habit.id}-${today}`,
      });
    } catch {
      // Notifications can be unavailable/blocked in some environments —
      // fail silently rather than break the rest of the app.
    }
    habit.lastNotifiedDate = today;
    changed = true;
  });

  if (changed) saveHabits();
}

setInterval(checkReminders, 20000);

// ---------- Drag-to-reorder ----------

let draggedId = null;

function clearDragOverStyles() {
  document.querySelectorAll(".habit-row").forEach((row) => {
    row.classList.remove("drag-over-top", "drag-over-bottom");
  });
}

function reorderHabits(fromId, targetId, before) {
  const fromIndex = habits.findIndex((h) => h.id === fromId);
  if (fromIndex === -1) return;
  const [moved] = habits.splice(fromIndex, 1);

  const targetIndex = habits.findIndex((h) => h.id === targetId);
  const insertAt = targetIndex === -1 ? habits.length : before ? targetIndex : targetIndex + 1;
  habits.splice(insertAt, 0, moved);

  saveHabits();
  renderHabits();
}

// Dropping in empty space below the last row appends to the end.
habitListEl.addEventListener("dragover", (e) => {
  if (!draggedId || e.target !== habitListEl) return;
  e.preventDefault();
});

habitListEl.addEventListener("drop", (e) => {
  if (!draggedId || e.target !== habitListEl) return;
  e.preventDefault();
  const fromIndex = habits.findIndex((h) => h.id === draggedId);
  if (fromIndex === -1) return;
  const [moved] = habits.splice(fromIndex, 1);
  habits.push(moved);
  saveHabits();
  renderHabits();
});

function renderHabits() {
  habitCountEl.textContent = `${habits.length} habit${habits.length === 1 ? "" : "s"}`;
  emptyState.hidden = habits.length > 0;
  habitListEl.innerHTML = "";

  habits.forEach((habit) => {
    const li = document.createElement("li");
    li.className = "habit-row";
    if (habit.id === newlyAddedHabitId) {
      li.className += " animate__animated animate__fadeIn";
    }
    li.draggable = true;
    li.dataset.id = habit.id;

    li.addEventListener("dragstart", (e) => {
      draggedId = habit.id;
      li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", habit.id);
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
      clearDragOverStyles();
      draggedId = null;
    });

    li.addEventListener("dragover", (e) => {
      if (!draggedId || draggedId === habit.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = li.getBoundingClientRect();
      const before = e.clientY - rect.top < rect.height / 2;
      clearDragOverStyles();
      li.classList.add(before ? "drag-over-top" : "drag-over-bottom");
    });

    li.addEventListener("drop", (e) => {
      e.preventDefault();
      const before = li.classList.contains("drag-over-top");
      clearDragOverStyles();
      if (!draggedId || draggedId === habit.id) return;
      reorderHabits(draggedId, habit.id, before);
    });

    const handle = document.createElement("span");
    handle.className = "habit-handle";
    handle.setAttribute("aria-hidden", "true");
    handle.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <circle cx="9" cy="6" r="1.4"></circle><circle cx="15" cy="6" r="1.4"></circle>
      <circle cx="9" cy="12" r="1.4"></circle><circle cx="15" cy="12" r="1.4"></circle>
      <circle cx="9" cy="18" r="1.4"></circle><circle cx="15" cy="18" r="1.4"></circle>
    </svg>`;
    li.appendChild(handle);

    const dotLabel = document.createElement("label");
    dotLabel.className = "habit-dot";
    dotLabel.style.background = habit.color;
    dotLabel.title = "Change color";
    const dotInput = document.createElement("input");
    dotInput.type = "color";
    dotInput.value = habit.color;
    dotInput.addEventListener("input", (e) => {
      habit.color = e.target.value;
      saveHabits();
      renderHabits();
    });
    dotLabel.appendChild(dotInput);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "habit-name";
    nameInput.value = habit.name;
    nameInput.maxLength = 60;
    nameInput.addEventListener("change", () => {
      const trimmed = nameInput.value.trim();
      habit.name = trimmed || habit.name;
      nameInput.value = habit.name;
      saveHabits();
    });

    // Reminder: a small bell button that shows the saved time (24hr) once
    // set, and opens a popover to set/change/clear it. Uses two plain
    // hour/minute <select> dropdowns styled to match the app instead of a
    // native <input type="time"> — that control renders as the browser's
    // own (often dark, always unstyled) time-wheel widget, which clashes
    // badly with the app's own minimal light/dark theme. Popover is a
    // sibling of the button (not nested inside it) since a button can't
    // validly contain another button.
    const reminderWrap = document.createElement("div");
    reminderWrap.className = "habit-reminder-wrap";

    const reminderBtn = document.createElement("button");
    reminderBtn.type = "button";
    reminderBtn.className = "habit-reminder-btn" + (habit.reminderTime ? " has-reminder" : "");
    reminderBtn.setAttribute(
      "aria-label",
      habit.reminderTime ? `Reminder set for ${habit.reminderTime}` : "Set daily reminder"
    );
    reminderBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      ${habit.reminderTime ? `<span class="habit-reminder-time">${habit.reminderTime}</span>` : ""}
    `;

    const reminderPopover = document.createElement("div");
    reminderPopover.className = "reminder-popover";
    reminderPopover.hidden = true;

    const timeFields = document.createElement("div");
    timeFields.className = "reminder-time-fields";

    const hourSelect = document.createElement("select");
    hourSelect.className = "reminder-time-select reminder-hour-select";
    hourSelect.setAttribute("aria-label", "Hour");
    for (let h = 0; h < 24; h++) {
      const opt = document.createElement("option");
      opt.value = pad(h);
      opt.textContent = pad(h);
      hourSelect.appendChild(opt);
    }

    const timeColon = document.createElement("span");
    timeColon.className = "reminder-time-colon";
    timeColon.textContent = ":";

    const minuteSelect = document.createElement("select");
    minuteSelect.className = "reminder-time-select reminder-minute-select";
    minuteSelect.setAttribute("aria-label", "Minute");
    for (let m = 0; m < 60; m++) {
      const opt = document.createElement("option");
      opt.value = pad(m);
      opt.textContent = pad(m);
      minuteSelect.appendChild(opt);
    }

    function setTimeFields(value) {
      const [h, m] = (value || "").split(":");
      hourSelect.value = h || "00";
      minuteSelect.value = m || "00";
    }
    setTimeFields(habit.reminderTime);

    timeFields.appendChild(hourSelect);
    timeFields.appendChild(timeColon);
    timeFields.appendChild(minuteSelect);

    const reminderActions = document.createElement("div");
    reminderActions.className = "reminder-popover-actions";

    const reminderSaveBtn = document.createElement("button");
    reminderSaveBtn.type = "button";
    reminderSaveBtn.className = "reminder-save-btn";
    reminderSaveBtn.textContent = "Save";

    const reminderClearBtn = document.createElement("button");
    reminderClearBtn.type = "button";
    reminderClearBtn.className = "reminder-clear-btn";
    reminderClearBtn.textContent = "Remove";
    reminderClearBtn.hidden = !habit.reminderTime;

    reminderBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasHidden = reminderPopover.hidden;
      closeOpenReminderPopover();
      if (wasHidden) {
        setTimeFields(habit.reminderTime);
        reminderClearBtn.hidden = !habit.reminderTime;
        reminderPopover.hidden = false;
        openReminderPopover = reminderPopover;
        hourSelect.focus();
      }
    });

    reminderSaveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      habit.reminderTime = `${hourSelect.value}:${minuteSelect.value}`;
      delete habit.lastNotifiedDate;
      saveHabits();
      requestNotificationPermissionIfNeeded();
      openReminderPopover = null;
      renderHabits();
    });

    reminderClearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      delete habit.reminderTime;
      delete habit.lastNotifiedDate;
      saveHabits();
      openReminderPopover = null;
      renderHabits();
    });

    reminderActions.appendChild(reminderSaveBtn);
    reminderActions.appendChild(reminderClearBtn);
    reminderPopover.appendChild(timeFields);
    reminderPopover.appendChild(reminderActions);
    reminderWrap.appendChild(reminderBtn);
    reminderWrap.appendChild(reminderPopover);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "habit-delete";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", `Delete ${habit.name}`);
    deleteBtn.addEventListener("click", () => {
      habits = habits.filter((h) => h.id !== habit.id);
      saveHabits();
      renderHabits();
    });

    li.appendChild(dotLabel);
    li.appendChild(nameInput);
    li.appendChild(reminderWrap);
    li.appendChild(deleteBtn);
    habitListEl.appendChild(li);
  });

  newlyAddedHabitId = null;
}

// ---------- Add habit ----------

const habitForm = document.getElementById("habitForm");

habitForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = habitNameInput.value.trim();
  if (!name) return;

  const newHabitId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  habits.push({
    id: newHabitId,
    name,
    color: selectedColor,
  });

  newlyAddedHabitId = newHabitId;
  saveHabits();
  renderHabits();
  habitNameInput.value = "";
  habitNameInput.focus();
});

// renderColorRow()/renderHabits() run once habits.length. Both run for the
// first time from initAppData() at the bottom of this file, once the
// server's data has actually loaded — not here, since habits is still []
// at this point in the script.

// ---------- Today view: tap a habit to check it off for a day ----------
//
// Defaults to today, but the date heading opens a calendar (same style as
// the Analytics one) so a missed day can be ticked off after the fact.

const todayDateBtn = document.getElementById("todayDateBtn");
const todayDateLabelEl = document.getElementById("todayDateLabel");
const todayJumpBtn = document.getElementById("todayJumpBtn");
const todaySummaryEl = document.getElementById("todaySummary");
const todayListEl = document.getElementById("todayList");
const todayEmptyEl = document.getElementById("todayEmpty");
const todayDatePickerEl = document.getElementById("todayDatePicker");
const todayDatePickerGridEl = document.getElementById("todayDatePickerGrid");
const todayDatePickerLabelEl = document.getElementById("todayDatePickerLabel");
const todayDatePickerPrevBtn = document.getElementById("todayDatePickerPrev");
const todayDatePickerNextBtn = document.getElementById("todayDatePickerNext");

let todayViewDate = new Date();
let todayPickerMonth = todayViewDate.getMonth();
let todayPickerYear = todayViewDate.getFullYear();

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function renderTodayView() {
  const isToday = isSameDate(todayViewDate, new Date());

  todayDateLabelEl.textContent = todayViewDate.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
  todayJumpBtn.hidden = isToday;

  todayEmptyEl.hidden = habits.length > 0;
  todaySummaryEl.hidden = habits.length === 0;
  todayListEl.innerHTML = "";

  const doneCount = habits.filter((h) => isHabitDone(h.id, todayViewDate)).length;
  todaySummaryEl.textContent = `${doneCount}/${habits.length} done${isToday ? " today" : ""}`;

  habits.forEach((habit) => {
    const done = isHabitDone(habit.id, todayViewDate);

    const row = document.createElement("button");
    row.type = "button";
    row.className = "today-row";
    row.setAttribute("aria-pressed", String(done));

    const left = document.createElement("span");
    left.className = "today-row-left";
    left.innerHTML = `<span class="today-dot" style="background:${habit.color}"></span><span class="today-name${done ? " done" : ""}">${habit.name}</span>`;

    const check = document.createElement("span");
    check.className = "today-check" + (done ? " done" : "");
    check.style.background = done ? habit.color : "transparent";
    check.textContent = done ? "✓" : "";

    row.appendChild(left);
    row.appendChild(check);

    row.addEventListener("click", () => {
      setHabitDone(habit.id, todayViewDate, !done);
      renderTodayView();
    });

    todayListEl.appendChild(row);
  });
}

function renderTodayDatePickerGrid() {
  todayDatePickerLabelEl.textContent = `${MONTH_NAMES_FULL[todayPickerMonth]} ${todayPickerYear}`;
  todayDatePickerGridEl.innerHTML = "";

  const today = new Date();
  const todayStart = startOfDay(today);
  const cells = buildCalendarCells(todayPickerYear, todayPickerMonth);

  cells.forEach((c) => {
    const cellDate = new Date(todayPickerYear, c.month, c.day);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "date-picker-cell";
    if (c.outside) cell.classList.add("outside");
    if (isSameDate(cellDate, today)) cell.classList.add("today");
    if (isSameDate(cellDate, todayViewDate)) cell.classList.add("active");
    if (cellDate.getTime() > todayStart.getTime()) cell.classList.add("disabled");
    cell.textContent = c.day;
    cell.addEventListener("click", (e) => {
      e.stopPropagation();
      todayViewDate = cellDate;
      hideTodayDatePicker();
      renderTodayView();
    });
    todayDatePickerGridEl.appendChild(cell);
  });
}

function showTodayDatePicker() {
  todayPickerMonth = todayViewDate.getMonth();
  todayPickerYear = todayViewDate.getFullYear();
  renderTodayDatePickerGrid();
  todayDatePickerEl.hidden = false;
  todayDateBtn.setAttribute("aria-expanded", "true");
}

function hideTodayDatePicker() {
  todayDatePickerEl.hidden = true;
  todayDateBtn.setAttribute("aria-expanded", "false");
}

todayDateBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (todayDatePickerEl.hidden) {
    showTodayDatePicker();
  } else {
    hideTodayDatePicker();
  }
});

todayDatePickerPrevBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  todayPickerMonth -= 1;
  if (todayPickerMonth < 0) {
    todayPickerMonth = 11;
    todayPickerYear -= 1;
  }
  renderTodayDatePickerGrid();
});

todayDatePickerNextBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  todayPickerMonth += 1;
  if (todayPickerMonth > 11) {
    todayPickerMonth = 0;
    todayPickerYear += 1;
  }
  renderTodayDatePickerGrid();
});

todayJumpBtn.addEventListener("click", () => {
  todayViewDate = new Date();
  renderTodayView();
});

document.addEventListener("click", (e) => {
  if (todayDatePickerEl.hidden) return;
  if (todayDatePickerEl.contains(e.target) || e.target.closest("#todayDateBtn")) return;
  hideTodayDatePicker();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideTodayDatePicker();
});

// ---------- Analytics view ----------
//
// All heatmap, score, and progress numbers below are derived from real
// completion history (habitTrackerCompletions in localStorage), built up by
// checking habits off in the Today tab.

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function getYearWindow() {
  return [activeYear, activeYear - 1, activeYear - 2];
}

let activeYear = new Date().getFullYear();
let currentYearData = [];
let yearPickerStart = activeYear - 5;

const scoreHeadingEl = document.getElementById("scoreHeading");
const todayLabelEl = document.getElementById("todayLabel");
const todayLabelBtn = document.getElementById("todayLabelBtn");
const datePickerEl = document.getElementById("datePicker");
const datePickerGridEl = document.getElementById("datePickerGrid");
const datePickerLabelEl = document.getElementById("datePickerLabel");
const datePickerPrevBtn = document.getElementById("datePickerPrev");
const datePickerNextBtn = document.getElementById("datePickerNext");
const progressHeatmapGridEl = document.getElementById("progressHeatmapGrid");
const heatmapMonthsEl = document.getElementById("heatmapMonths");
const heatmapGridEl = document.getElementById("heatmapGrid");
const yearListEl = document.getElementById("yearList");
const yearArrowBtn = document.getElementById("yearArrowBtn");
const yearPickerEl = document.getElementById("yearPicker");
const yearPickerGridEl = document.getElementById("yearPickerGrid");
const yearPickerRangeEl = document.getElementById("yearPickerRange");
const yearPickerPrevBtn = document.getElementById("yearPickerPrev");
const yearPickerNextBtn = document.getElementById("yearPickerNext");
const legendRowEl = document.getElementById("legendRow");
const mostVisitedEl = document.getElementById("mostVisited");
const scoresHabitSelect = document.getElementById("scoresHabitSelect");
const progressHabitSelect = document.getElementById("progressHabitSelect");
const progressMonthSelect = document.getElementById("progressMonthSelect");
const progressCountEl = document.getElementById("progressCount");

// Tier 0 blank   — nothing done that day
// Tier 1 light green — some habits done, but not all
// Tier 2 green   — every habit done, but no focus/Pomodoro time logged
// Tier 3 blue    — every habit done AND focus/Pomodoro time logged
function tierForDay(fraction, hasFocusTime) {
  if (fraction <= 0) return 0;
  if (fraction < 1) return 1;
  return hasFocusTime ? 3 : 2;
}

// Derives each day's heatmap tier from real completion history (how many of
// today's habits were checked off that day) cross-referenced against real
// focus-timer history (habitTrackerFocusHistory) for the same date.
function computeYearData(year) {
  const total = habits.length;
  const days = [];
  for (let i = 0; i < 365; i++) {
    const date = dateForDayIndex(year, i);
    const key = dateKey(date);
    const day = completions[key];
    const doneCount = day ? habits.filter((h) => day[h.id]).length : 0;
    const fraction = total === 0 ? 0 : doneCount / total;
    const hasFocusTime = !!focusHistory[key];
    days.push(tierForDay(fraction, hasFocusTime));
  }
  return days;
}

function monthRange(monthIndex) {
  let start = 0;
  for (let i = 0; i < monthIndex; i++) start += MONTH_DAYS[i];
  return [start, start + MONTH_DAYS[monthIndex]];
}

function renderHeatmapMonths() {
  heatmapMonthsEl.innerHTML = "";
  MONTH_NAMES.forEach((name, i) => {
    const span = document.createElement("span");
    span.textContent = name;
    span.style.flex = `${MONTH_DAYS[i]} 0 0`;
    heatmapMonthsEl.appendChild(span);
  });
}

function renderHeatmapGrid(year) {
  const data = computeYearData(year);
  heatmapGridEl.innerHTML = "";
  data.forEach((tier, dayIndex) => {
    const cell = document.createElement("div");
    cell.className = "heatmap-cell";
    cell.style.background = `var(--tier${tier})`;
    cell.addEventListener("click", (e) => showDayPopover(e.currentTarget, year, dayIndex, tier));
    heatmapGridEl.appendChild(cell);
  });
  return data;
}

function renderYearList() {
  yearListEl.innerHTML = "";
  getYearWindow().forEach((year) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "year-item" + (year === activeYear ? " active" : "");
    btn.textContent = year;
    btn.addEventListener("click", () => {
      activeYear = year;
      renderAnalytics();
    });
    yearListEl.appendChild(btn);
  });
}

const TIER_LABELS = ["Missed", "Partial", "Done", "Done + Focus"];

function renderLegend(data) {
  const now = new Date();
  const currentMonthIdx = activeYear === now.getFullYear() ? now.getMonth() : 0;
  const [start, end] = monthRange(currentMonthIdx);
  const monthSlice = data.slice(start, end);

  const counts = [0, 0, 0, 0];
  monthSlice.forEach((tier) => counts[tier]++);

  legendRowEl.innerHTML = "";
  counts.forEach((count, tier) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-swatch" style="background:var(--tier${tier})"></span><span>${TIER_LABELS[tier]} · ${count}/${monthSlice.length} Days</span>`;
    legendRowEl.appendChild(item);
  });
}

function renderScoreHeading(data) {
  const total = data.filter((tier) => tier > 0).length;
  scoreHeadingEl.textContent = `Score ${total}/365`;
}

// checkedDate: the date currently shown/highlighted (defaults to today).
// Lets people click the date and pick a past day to check on the heatmap.
let checkedDate = null;

function formatCheckedDate(date) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" }).toLowerCase();
  const day = pad(date.getDate());
  const month = date.toLocaleDateString(undefined, { month: "short" });
  return `${weekday}/${day} ${month}`;
}

function renderTodayLabel() {
  const date = checkedDate || new Date();
  todayLabelEl.textContent = formatCheckedDate(date);
}

function dayOfYearIndex(date) {
  let idx = 0;
  for (let i = 0; i < date.getMonth(); i++) idx += MONTH_DAYS[i];
  idx += date.getDate() - 1;
  return idx;
}

function highlightCheckedDate() {
  Array.from(heatmapGridEl.children).forEach((cell) => cell.classList.remove("checked-cell"));
  if (!checkedDate || checkedDate.getFullYear() !== activeYear) return;
  const idx = dayOfYearIndex(checkedDate);
  const cell = heatmapGridEl.children[idx];
  if (cell) cell.classList.add("checked-cell");
}

let datePickerMonth = new Date().getMonth();
let datePickerYear = new Date().getFullYear();

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Builds a whole-weeks grid of {day, outside, month} cells for a month
// calendar: outside-month leading/trailing days included, month may run
// outside 0-11 (JS Date normalizes that on construction). Shared by every
// date-picker in the app.
function buildCalendarCells(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const prevMonthDays = daysInMonth(year, month - 1);

  const cells = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, outside: true, month: month - 1 });
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, outside: false, month });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay++, outside: true, month: month + 1 });
  }
  return cells;
}

function selectDate(date) {
  checkedDate = date;
  activeYear = date.getFullYear();
  hideDatePicker();
  renderAnalytics();

  const idx = dayOfYearIndex(checkedDate);
  const cell = heatmapGridEl.children[idx];
  if (cell) showDayPopover(cell, activeYear, idx, currentYearData[idx]);
}

function renderDatePickerGrid() {
  datePickerLabelEl.textContent = `${MONTH_NAMES_FULL[datePickerMonth]} ${datePickerYear}`;
  datePickerGridEl.innerHTML = "";

  const today = new Date();
  const cells = buildCalendarCells(datePickerYear, datePickerMonth);

  cells.forEach((c) => {
    const cellDate = new Date(datePickerYear, c.month, c.day);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "date-picker-cell";
    if (c.outside) cell.classList.add("outside");
    if (isSameDate(cellDate, today)) cell.classList.add("today");
    if (checkedDate && isSameDate(cellDate, checkedDate)) cell.classList.add("active");
    cell.textContent = c.day;
    cell.addEventListener("click", (e) => {
      e.stopPropagation();
      selectDate(cellDate);
    });
    datePickerGridEl.appendChild(cell);
  });
}

function showDatePicker() {
  const base = checkedDate || new Date();
  datePickerMonth = base.getMonth();
  datePickerYear = base.getFullYear();
  renderDatePickerGrid();
  datePickerEl.hidden = false;
  todayLabelBtn.setAttribute("aria-expanded", "true");
}

function hideDatePicker() {
  datePickerEl.hidden = true;
  todayLabelBtn.setAttribute("aria-expanded", "false");
}

todayLabelBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (datePickerEl.hidden) {
    showDatePicker();
  } else {
    hideDatePicker();
  }
});

datePickerPrevBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  datePickerMonth -= 1;
  if (datePickerMonth < 0) {
    datePickerMonth = 11;
    datePickerYear -= 1;
  }
  renderDatePickerGrid();
});

datePickerNextBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  datePickerMonth += 1;
  if (datePickerMonth > 11) {
    datePickerMonth = 0;
    datePickerYear += 1;
  }
  renderDatePickerGrid();
});

document.addEventListener("click", (e) => {
  if (datePickerEl.hidden) return;
  if (datePickerEl.contains(e.target) || e.target.closest("#todayLabelBtn")) return;
  hideDatePicker();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideDatePicker();
});

function renderMostVisited() {
  mostVisitedEl.innerHTML = "";
  if (habits.length === 0) {
    mostVisitedEl.innerHTML =
      '<span style="color:var(--text-muted); font-size:13px;">No habits yet — add some from the habits panel</span>';
    return;
  }
  habits.slice(0, 3).forEach((habit) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = habit.name;
    mostVisitedEl.appendChild(pill);
  });
}

function populateHabitSelect(selectEl) {
  const previousValue = selectEl.value;
  selectEl.innerHTML = "";

  if (habits.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No habits yet";
    selectEl.appendChild(opt);
    selectEl.disabled = true;
    return;
  }

  selectEl.disabled = false;
  habits.forEach((habit) => {
    const opt = document.createElement("option");
    opt.value = habit.id;
    opt.textContent = habit.name;
    selectEl.appendChild(opt);
  });
  if (habits.some((h) => h.id === previousValue)) {
    selectEl.value = previousValue;
  }
}

function renderScoresDropdown() {
  populateHabitSelect(scoresHabitSelect);
  populateHabitSelect(progressHabitSelect);
}

function ensureProgressMonthOptions() {
  if (progressMonthSelect.options.length > 0) return;
  const currentMonthIdx = new Date().getMonth();
  MONTH_NAMES_FULL.forEach((name, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = name;
    if (i === currentMonthIdx) opt.selected = true;
    progressMonthSelect.appendChild(opt);
  });
  progressMonthSelect.addEventListener("change", updateProgressCount);
}

function updateProgressCount() {
  const monthIdx = Number(progressMonthSelect.value);
  const [start, end] = monthRange(monthIdx);
  const slice = currentYearData.slice(start, end);
  const done = slice.filter((tier) => tier > 0).length;
  progressCountEl.textContent = `${done}/${slice.length} Days`;

  progressHeatmapGridEl.innerHTML = "";
  slice.forEach((tier, i) => {
    const dayIndex = start + i;
    const cell = document.createElement("div");
    cell.className = "heatmap-cell";
    cell.style.background = `var(--tier${tier})`;
    cell.addEventListener("click", (e) => showDayPopover(e.currentTarget, activeYear, dayIndex, tier));
    progressHeatmapGridEl.appendChild(cell);
  });
}

function renderAnalytics() {
  currentYearData = renderHeatmapGrid(activeYear);
  renderHeatmapMonths();
  renderYearList();
  renderLegend(currentYearData);
  renderScoreHeading(currentYearData);
  renderTodayLabel();
  highlightCheckedDate();
  renderMostVisited();
  renderScoresDropdown();
  ensureProgressMonthOptions();
  updateProgressCount();
}

// ---------- Day detail popover (click a heatmap cell to inspect that day) ----------
//
// Shows the real per-habit completion record for that day, read straight
// from completions.

const dayPopoverEl = document.getElementById("dayPopover");
const dayPopoverDateEl = document.getElementById("dayPopoverDate");
const dayPopoverSummaryEl = document.getElementById("dayPopoverSummary");
const dayPopoverHabitsEl = document.getElementById("dayPopoverHabits");
const dayPopoverCloseBtn = document.getElementById("dayPopoverClose");

function dateForDayIndex(year, dayIndex) {
  const d = new Date(year, 0, 1);
  d.setDate(d.getDate() + dayIndex);
  return d;
}

function habitsDoneForDay(year, dayIndex) {
  const date = dateForDayIndex(year, dayIndex);
  const day = completions[dateKey(date)];
  return habits
    .map((h) => ({ name: h.name, done: !!(day && day[h.id]) }))
    .sort((a, b) => Number(b.done) - Number(a.done));
}

function showDayPopover(cellEl, year, dayIndex) {
  const date = dateForDayIndex(year, dayIndex);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  dayPopoverDateEl.textContent = dateStr;

  const list = habitsDoneForDay(year, dayIndex);
  const doneCount = list.filter((h) => h.done).length;
  dayPopoverSummaryEl.textContent =
    list.length === 0
      ? "No habits yet"
      : doneCount === 0
        ? "Nothing logged this day"
        : `${doneCount}/${list.length} habits done`;

  dayPopoverHabitsEl.innerHTML = "";
  list.forEach(({ name, done }) => {
    const row = document.createElement("div");
    row.className = "day-popover-habit";
    row.innerHTML = `<span class="check" style="background:${done ? "var(--tier2)" : "var(--divider)"}">${done ? "✓" : ""}</span><span>${name}</span>`;
    dayPopoverHabitsEl.appendChild(row);
  });

  const rect = cellEl.getBoundingClientRect();
  dayPopoverEl.hidden = false;
  const popRect = dayPopoverEl.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - popRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - popRect.width - 8));
  let top = rect.bottom + 8;
  if (top + popRect.height > window.innerHeight - 8) {
    top = rect.top - popRect.height - 8;
  }
  dayPopoverEl.style.left = `${left}px`;
  dayPopoverEl.style.top = `${top}px`;
}

function hideDayPopover() {
  dayPopoverEl.hidden = true;
}

dayPopoverCloseBtn.addEventListener("click", hideDayPopover);
document.addEventListener("click", (e) => {
  if (dayPopoverEl.hidden) return;
  if (dayPopoverEl.contains(e.target) || e.target.closest(".heatmap-cell")) return;
  hideDayPopover();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideDayPopover();
});

function renderYearPickerGrid() {
  yearPickerRangeEl.textContent = `${yearPickerStart} - ${yearPickerStart + 11}`;
  yearPickerGridEl.innerHTML = "";
  for (let i = 0; i < 12; i++) {
    const year = yearPickerStart + i;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "year-picker-cell" + (year === activeYear ? " active" : "");
    cell.textContent = year;
    cell.addEventListener("click", () => {
      activeYear = year;
      hideYearPicker();
      renderAnalytics();
    });
    yearPickerGridEl.appendChild(cell);
  }
}

function showYearPicker() {
  yearPickerStart = activeYear - 5;
  renderYearPickerGrid();
  yearPickerEl.hidden = false;
  yearArrowBtn.setAttribute("aria-expanded", "true");
}

function hideYearPicker() {
  yearPickerEl.hidden = true;
  yearArrowBtn.setAttribute("aria-expanded", "false");
}

yearArrowBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (yearPickerEl.hidden) {
    showYearPicker();
  } else {
    hideYearPicker();
  }
});

yearPickerPrevBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  yearPickerStart -= 12;
  renderYearPickerGrid();
});

yearPickerNextBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  yearPickerStart += 12;
  renderYearPickerGrid();
});

document.addEventListener("click", (e) => {
  if (yearPickerEl.hidden) return;
  if (yearPickerEl.contains(e.target) || e.target.closest("#yearArrowBtn")) return;
  hideYearPicker();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideYearPicker();
});

// ---------- Focus view: Pomodoro timer ----------
//
// Work time (not break time) is logged to a per-day history in
// localStorage, in real seconds actually spent focused — not just
// completed 25-minute blocks — so pausing partway still counts.

const focusModeLabelEl = document.getElementById("focusModeLabel");
const focusTimeDisplayEl = document.getElementById("focusTimeDisplay");
const focusWorkInput = document.getElementById("focusWorkInput");
const focusBreakInput = document.getElementById("focusBreakInput");
const focusStartBtn = document.getElementById("focusStartBtn");
const focusResetBtn = document.getElementById("focusResetBtn");
const focusHistoryListEl = document.getElementById("focusHistoryList");
const focusHistoryEmptyEl = document.getElementById("focusHistoryEmpty");

let focusHistory = {};

function saveFocusHistory() {
  fetch("/api/focus-history", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(focusHistory),
  }).catch((err) => console.error("Failed to save focus history to server:", err));
}

function clampMinutes(value, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(max, Math.max(1, n));
}

let focusMode = "work"; // "work" | "break"
let focusWorkMinutes = clampMinutes(focusWorkInput.value, 180);
let focusBreakMinutes = clampMinutes(focusBreakInput.value, 60);
let focusRemainingSeconds = focusWorkMinutes * 60;
let focusRunning = false;
let focusIntervalId = null;
let focusWorkSecondsThisRun = 0;

function addFocusSeconds(seconds) {
  if (seconds <= 0) return;
  const key = dateKey(new Date());
  focusHistory[key] = (focusHistory[key] || 0) + seconds;
  saveFocusHistory();
}

function commitFocusProgress() {
  if (focusWorkSecondsThisRun > 0) {
    addFocusSeconds(focusWorkSecondsThisRun);
    focusWorkSecondsThisRun = 0;
  }
}

function renderFocusTimer() {
  const total = Math.max(0, focusRemainingSeconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  focusTimeDisplayEl.textContent = `${pad(m)}:${pad(s)}`;
  focusModeLabelEl.textContent = focusMode === "work" ? "Focus" : "Break";
  focusModeLabelEl.className = "focus-mode-label" + (focusMode === "break" ? " break" : "");
}

function renderFocusControls() {
  focusStartBtn.textContent = focusRunning ? "Pause" : "Start";
  focusWorkInput.disabled = focusRunning;
  focusBreakInput.disabled = focusRunning;
}

function formatFocusDuration(totalSeconds) {
  const totalMinutes = Math.round(totalSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function labelForDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
}

function renderFocusHistory() {
  const keys = Object.keys(focusHistory)
    .filter((k) => Math.round(focusHistory[k] / 60) > 0)
    .sort()
    .reverse();

  focusHistoryEmptyEl.hidden = keys.length > 0;
  focusHistoryListEl.innerHTML = "";

  keys.slice(0, 14).forEach((key) => {
    const row = document.createElement("div");
    row.className = "focus-history-row";
    row.innerHTML = `<span>${labelForDateKey(key)}</span><span class="focus-history-duration">${formatFocusDuration(focusHistory[key])}</span>`;
    focusHistoryListEl.appendChild(row);
  });
}

function focusTick() {
  focusRemainingSeconds -= 1;
  if (focusMode === "work") focusWorkSecondsThisRun += 1;

  if (focusRemainingSeconds <= 0) {
    commitFocusProgress();
    focusMode = focusMode === "work" ? "break" : "work";
    focusRemainingSeconds = (focusMode === "work" ? focusWorkMinutes : focusBreakMinutes) * 60;
    renderFocusHistory();
  }

  renderFocusTimer();
}

function startFocusTimer() {
  if (focusRunning) return;
  focusRunning = true;
  focusIntervalId = setInterval(focusTick, 1000);
  renderFocusControls();
}

function pauseFocusTimer() {
  if (!focusRunning) return;
  focusRunning = false;
  clearInterval(focusIntervalId);
  focusIntervalId = null;
  commitFocusProgress();
  renderFocusControls();
  renderFocusHistory();
}

function resetFocusTimer() {
  pauseFocusTimer();
  focusMode = "work";
  focusRemainingSeconds = focusWorkMinutes * 60;
  renderFocusTimer();
  renderFocusControls();
}

focusStartBtn.addEventListener("click", () => {
  if (focusRunning) {
    pauseFocusTimer();
  } else {
    startFocusTimer();
  }
});

focusResetBtn.addEventListener("click", resetFocusTimer);

focusWorkInput.addEventListener("input", () => {
  focusWorkMinutes = clampMinutes(focusWorkInput.value, 180);
  if (!focusRunning && focusMode === "work") {
    focusRemainingSeconds = focusWorkMinutes * 60;
    renderFocusTimer();
  }
});

focusBreakInput.addEventListener("input", () => {
  focusBreakMinutes = clampMinutes(focusBreakInput.value, 60);
  if (!focusRunning && focusMode === "break") {
    focusRemainingSeconds = focusBreakMinutes * 60;
    renderFocusTimer();
  }
});

// ---------- App bootstrap ----------
//
// Everything above defines functions and sets up listeners; nothing has
// been rendered yet. habits/completions/focusHistory all still hold their
// empty defaults. This is the one place that fetches the real data from the
// server and renders the app for the first time — replaces the scattered
// synchronous localStorage-backed renders this app used to do at load time.

async function initAppData() {
  try {
    const res = await fetch("/api/state");
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const state = await res.json();
    habits = Array.isArray(state.habits) ? state.habits : [];
    completions = state.completions && typeof state.completions === "object" ? state.completions : {};
    focusHistory = state.focusHistory && typeof state.focusHistory === "object" ? state.focusHistory : {};
  } catch (err) {
    console.error("Could not load data from the server — is `npm start` running? Falling back to empty state.", err);
  }

  renderColorRow();
  renderHabits();
  renderFocusTimer();
  renderFocusControls();
  renderFocusHistory();
  if (activeTab !== "dashboard") applyTab(activeTab);
}

initAppData();
