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
const themeIcon = document.getElementById("themeIcon");
const root = document.documentElement;

const MOON_PATH = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"></path>`;
const SUN_PATH = `
  <circle cx="12" cy="12" r="4"></circle>
  <line x1="12" y1="2" x2="12" y2="4"></line>
  <line x1="12" y1="20" x2="12" y2="22"></line>
  <line x1="4.2" y1="4.2" x2="5.6" y2="5.6"></line>
  <line x1="18.4" y1="18.4" x2="19.8" y2="19.8"></line>
  <line x1="2" y1="12" x2="4" y2="12"></line>
  <line x1="20" y1="12" x2="22" y2="12"></line>
  <line x1="4.2" y1="19.8" x2="5.6" y2="18.4"></line>
  <line x1="18.4" y1="5.6" x2="19.8" y2="4.2"></line>
`;

function applyTheme(theme) {
  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
    themeIcon.innerHTML = MOON_PATH;
  } else {
    root.removeAttribute("data-theme");
    themeIcon.innerHTML = SUN_PATH;
  }
  localStorage.setItem("habitTrackerTheme", theme);
}

const savedTheme = localStorage.getItem("habitTrackerTheme") || "light";
applyTheme(savedTheme);

themeBtn.addEventListener("click", () => {
  const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
});

// ---------- View switching (Dashboard <-> Analytics <-> Habits) ----------

const mainTopbar = document.querySelector(".topbar");
const topbarDivider = document.querySelector(".topbar-divider");
const dashboardMain = document.querySelector(".dashboard");
const analyticsView = document.getElementById("analyticsView");
const habitsView = document.getElementById("habitsView");
const menuBtn = document.getElementById("menuBtn");
const addBtn = document.getElementById("addBtn");
const closeHabitsBtn = document.getElementById("closeHabitsBtn");
const addBtn2 = document.getElementById("addBtn2");
const habitNameInput = document.getElementById("habitNameInput");

let activeTab = "dashboard";

function applyTab(tab) {
  activeTab = tab;
  dashboardMain.hidden = tab !== "dashboard";
  analyticsView.hidden = tab !== "analytics";
  if (tab === "analytics") renderAnalytics();
}

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
    applyTab(link.dataset.tab);
  });
});

function showHabits() {
  mainTopbar.hidden = true;
  topbarDivider.hidden = true;
  dashboardMain.hidden = true;
  analyticsView.hidden = true;
  habitsView.hidden = false;
  habitNameInput.focus();
}

function showDashboard() {
  habitsView.hidden = true;
  mainTopbar.hidden = false;
  topbarDivider.hidden = false;
  applyTab(activeTab);
}

menuBtn.addEventListener("click", showHabits);
addBtn.addEventListener("click", showHabits);
closeHabitsBtn.addEventListener("click", showDashboard);
addBtn2.addEventListener("click", () => habitNameInput.focus());

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

let habits = loadHabits();
let selectedColor = PRESET_COLORS[0];

function loadHabits() {
  try {
    return JSON.parse(localStorage.getItem("habitTrackerHabits")) || [];
  } catch {
    return [];
  }
}

function saveHabits() {
  localStorage.setItem("habitTrackerHabits", JSON.stringify(habits));
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
    li.appendChild(deleteBtn);
    habitListEl.appendChild(li);
  });
}

// ---------- Add habit ----------

const habitForm = document.getElementById("habitForm");

habitForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = habitNameInput.value.trim();
  if (!name) return;

  habits.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    color: selectedColor,
  });

  saveHabits();
  renderHabits();
  habitNameInput.value = "";
  habitNameInput.focus();
});

renderColorRow();
renderHabits();

// ---------- Analytics view ----------
//
// NOTE: there's no daily habit-completion tracking mechanic built yet (no
// "mark done today" action), so every number below is seeded placeholder
// data — stable per year, not random noise — standing in for what will
// come from real completion history once that's built.

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const YEARS = [2026, 2025, 2024];

let activeYear = new Date().getFullYear();
let currentYearData = [];

const scoreHeadingEl = document.getElementById("scoreHeading");
const todayLabelEl = document.getElementById("todayLabel");
const progressHeatmapGridEl = document.getElementById("progressHeatmapGrid");
const heatmapMonthsEl = document.getElementById("heatmapMonths");
const heatmapGridEl = document.getElementById("heatmapGrid");
const yearListEl = document.getElementById("yearList");
const legendRowEl = document.getElementById("legendRow");
const mostVisitedEl = document.getElementById("mostVisited");
const scoresHabitSelect = document.getElementById("scoresHabitSelect");
const progressMonthSelect = document.getElementById("progressMonthSelect");
const progressCountEl = document.getElementById("progressCount");

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedTier(rand) {
  const r = rand();
  if (r < 0.72) return 0;
  if (r < 0.87) return 1;
  if (r < 0.97) return 2;
  return 3;
}

function generateYearData(year) {
  const rand = mulberry32(year);
  const days = [];
  for (let i = 0; i < 365; i++) days.push(weightedTier(rand));
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
  const data = generateYearData(year);
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
  YEARS.forEach((year) => {
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
    item.innerHTML = `<span class="legend-swatch" style="background:var(--tier${tier})"></span><span>${count}/${monthSlice.length} Days</span>`;
    legendRowEl.appendChild(item);
  });
}

function renderScoreHeading(data) {
  const total = data.filter((tier) => tier > 0).length;
  scoreHeadingEl.textContent = `Score ${total}/365`;
}

function renderTodayLabel() {
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: "short" }).toLowerCase();
  const day = pad(now.getDate());
  const month = now.toLocaleDateString(undefined, { month: "short" });
  todayLabelEl.textContent = `${weekday}/${day} ${month}`;
}

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

function renderScoresDropdown() {
  const previousValue = scoresHabitSelect.value;
  scoresHabitSelect.innerHTML = "";

  if (habits.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No habits yet";
    scoresHabitSelect.appendChild(opt);
    scoresHabitSelect.disabled = true;
    return;
  }

  scoresHabitSelect.disabled = false;
  habits.forEach((habit) => {
    const opt = document.createElement("option");
    opt.value = habit.id;
    opt.textContent = habit.name;
    scoresHabitSelect.appendChild(opt);
  });
  if (habits.some((h) => h.id === previousValue)) {
    scoresHabitSelect.value = previousValue;
  }
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
  renderMostVisited();
  renderScoresDropdown();
  ensureProgressMonthOptions();
  updateProgressCount();
}

// ---------- Day detail popover (click a heatmap cell to inspect that day) ----------
//
// Placeholder: which habits were "done" that day is derived deterministically
// from the same seeded tier value, not real completion history (there isn't
// one yet). Stable per day, so revisiting a date shows the same answer.

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

function habitsDoneForDay(year, dayIndex, tier, habitNames) {
  const names = habitNames.length > 0 ? habitNames : ["Reading", "Workout", "Coding"];
  const rand = mulberry32(year * 400 + dayIndex);
  const doneFraction = [0, 0.4, 0.75, 1][tier];
  return names
    .map((name) => ({ name, done: rand() < doneFraction }))
    .sort((a, b) => Number(b.done) - Number(a.done));
}

function showDayPopover(cellEl, year, dayIndex, tier) {
  const date = dateForDayIndex(year, dayIndex);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  dayPopoverDateEl.textContent = dateStr;

  const list = habitsDoneForDay(year, dayIndex, tier, habits.map((h) => h.name));
  const doneCount = list.filter((h) => h.done).length;
  dayPopoverSummaryEl.textContent =
    tier === 0 ? "Nothing logged this day" : `${doneCount}/${list.length} habits done`;

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
