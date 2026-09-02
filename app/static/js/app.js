/* Daily Habit Tracker - frontend logic. Vanilla JS, no build step. */

const state = {
  habits: [],
  editingHabitId: null,
};

// ---------- API helpers ----------

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ---------- profile ----------

async function loadProfile() {
  const profile = await api("/api/profile");
  document.getElementById("display-name").textContent = profile.display_name;
  document.documentElement.style.setProperty("--accent", profile.accent_color);
  if (profile.background_color) {
    document.documentElement.style.setProperty("--bg-primary", profile.background_color);
  }
  const img = document.getElementById("avatar-img");
  const placeholder = document.getElementById("avatar-placeholder");
  if (profile.photo_url) {
    img.src = profile.photo_url;
    img.hidden = false;
    placeholder.hidden = true;
  } else {
    img.hidden = true;
    placeholder.hidden = false;
  }

  document.getElementById("settings-name").value = profile.display_name;
  document.getElementById("settings-accent").value = profile.accent_color;
  document.getElementById("settings-bg").value = profile.background_color || "#0d1117";
}

// ---------- habits + today ----------

async function loadHabits() {
  state.habits = await api("/api/habits");
  renderHabits();
  renderScore();
}

function renderScore() {
  const dueToday = state.habits.filter((h) => h.due_today);
  const doneToday = dueToday.filter((h) => h.completed_today);
  document.getElementById("score-badge").textContent = `${doneToday.length} / ${dueToday.length}`;
}

function renderHabits() {
  const grid = document.getElementById("habit-grid");
  const empty = document.getElementById("empty-state");
  const dueToday = state.habits.filter((h) => h.due_today);

  grid.innerHTML = "";
  empty.hidden = dueToday.length > 0;

  for (const habit of dueToday) {
    const card = document.createElement("div");
    card.className = "habit-card";

    const tag = document.createElement("div");
    tag.className = "habit-color-tag";
    tag.style.background = habit.color;
    card.appendChild(tag);

    const check = document.createElement("button");
    check.className = "habit-check" + (habit.completed_today ? " checked" : "");
    check.style.background = habit.completed_today ? habit.color : "transparent";
    check.textContent = habit.completed_today ? "✓" : "";
    check.addEventListener("click", () => toggleHabit(habit));
    card.appendChild(check);

    const main = document.createElement("div");
    main.className = "habit-main";
    const name = document.createElement("div");
    name.className = "habit-name";
    name.textContent = habit.name;
    name.title = habit.name;
    const meta = document.createElement("div");
    meta.className = "habit-meta";
    meta.textContent = habit.category;
    main.appendChild(name);
    main.appendChild(meta);
    card.appendChild(main);

    const streak = document.createElement("div");
    streak.className = "habit-streak";
    streak.textContent = habit.current_streak > 0 ? `🔥 ${habit.current_streak}` : "—";
    card.appendChild(streak);

    const cardActions = document.createElement("div");
    cardActions.className = "habit-card-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "habit-action-btn";
    editBtn.title = "Edit habit";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openHabitModal(habit);
    });
    cardActions.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "habit-action-btn habit-action-danger";
    deleteBtn.title = "Delete habit";
    deleteBtn.textContent = "🗑";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteHabit(habit);
    });
    cardActions.appendChild(deleteBtn);

    card.appendChild(cardActions);

    grid.appendChild(card);
  }
}

async function deleteHabit(habit) {
  if (!confirm(`Delete "${habit.name}"? This also removes its history.`)) return;
  await api(`/api/habits/${habit.id}`, { method: "DELETE" });
  await loadHabits();
  await loadHeatmap();
}

async function toggleHabit(habit) {
  await api(`/api/habits/${habit.id}/toggle`, {
    method: "POST",
    body: JSON.stringify({ completed: !habit.completed_today }),
  });
  await loadHabits();
  await loadHeatmap();
}

// ---------- heatmap ----------

async function loadHeatmap() {
  const data = await api("/api/heatmap?weeks=26");
  const container = document.getElementById("heatmap");
  container.innerHTML = "";
  for (const day of data.days) {
    const cell = document.createElement("div");
    cell.className = "heatmap-day tier-" + day.tier;
    cell.title = `${day.date}: ${day.done}/${day.due} done`;
    container.appendChild(cell);
  }
}

// ---------- add / edit habit modal ----------

function openHabitModal(habit) {
  state.editingHabitId = habit ? habit.id : null;
  document.getElementById("habit-modal-title").textContent = habit ? "Edit habit" : "New habit";
  document.getElementById("habit-name").value = habit ? habit.name : "";
  document.getElementById("habit-category").value = habit ? habit.category : "Other";

  const freq = habit ? habit.frequency : "daily";
  document.querySelector(`input[name="freq"][value="${freq}"]`).checked = true;
  const weekdays = habit ? habit.weekdays : [0, 1, 2, 3, 4, 5, 6];
  document.querySelectorAll(".wd").forEach((cb) => {
    cb.checked = weekdays.includes(Number(cb.value));
  });
  updateWeekdayRowState();

  const selectedColor = habit ? habit.color : "#6366F1";
  document.querySelectorAll(".color-swatch").forEach((sw) => {
    sw.classList.toggle("selected", sw.dataset.color.toLowerCase() === selectedColor.toLowerCase());
  });
  if (![...document.querySelectorAll(".color-swatch")].some((sw) => sw.classList.contains("selected"))) {
    document.querySelector(".color-swatch").classList.add("selected");
  }

  document.getElementById("habit-modal-overlay").hidden = false;
}

function closeHabitModal() {
  document.getElementById("habit-modal-overlay").hidden = true;
  state.editingHabitId = null;
}

function updateWeekdayRowState() {
  const isWeekly = document.querySelector('input[name="freq"]:checked').value === "weekly";
  document.getElementById("weekday-row").style.opacity = isWeekly ? "1" : "0.4";
  document.querySelectorAll(".wd").forEach((cb) => (cb.disabled = !isWeekly));
}

async function saveHabitFromModal() {
  const name = document.getElementById("habit-name").value.trim();
  if (!name) return;
  const category = document.getElementById("habit-category").value;
  const frequency = document.querySelector('input[name="freq"]:checked').value;
  const weekdays = [...document.querySelectorAll(".wd:checked")].map((cb) => Number(cb.value));
  const selectedSwatch = document.querySelector(".color-swatch.selected");
  const color = selectedSwatch ? selectedSwatch.dataset.color : "#6366F1";

  const payload = { name, category, frequency, weekdays, color };

  if (state.editingHabitId) {
    await api(`/api/habits/${state.editingHabitId}`, { method: "PUT", body: JSON.stringify(payload) });
  } else {
    await api("/api/habits", { method: "POST", body: JSON.stringify(payload) });
  }
  closeHabitModal();
  await loadHabits();
  await loadHeatmap();
}

// ---------- settings modal ----------

function openSettingsModal() {
  document.getElementById("settings-modal-overlay").hidden = false;
}
function closeSettingsModal() {
  document.getElementById("settings-modal-overlay").hidden = true;
}

async function saveSettings() {
  const display_name = document.getElementById("settings-name").value.trim() || "Your Name";
  const accent_color = document.getElementById("settings-accent").value;
  const background_color = document.getElementById("settings-bg").value;
  await api("/api/profile", {
    method: "POST",
    body: JSON.stringify({ display_name, accent_color, background_color }),
  });
  closeSettingsModal();
  await loadProfile();
  await loadHabits();
}

async function uploadPhoto(file) {
  const formData = new FormData();
  formData.append("photo", file);
  const res = await fetch("/api/profile/photo", { method: "POST", body: formData });
  if (!res.ok) return;
  await loadProfile();
}

// ---------- wiring ----------

function wireEvents() {
  document.getElementById("add-habit-btn").addEventListener("click", () => openHabitModal(null));
  document.getElementById("habit-cancel-btn").addEventListener("click", closeHabitModal);
  document.getElementById("habit-save-btn").addEventListener("click", saveHabitFromModal);
  document.querySelectorAll('input[name="freq"]').forEach((r) => r.addEventListener("change", updateWeekdayRowState));
  document.querySelectorAll(".color-swatch").forEach((sw) =>
    sw.addEventListener("click", () => {
      document.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("selected"));
      sw.classList.add("selected");
    })
  );

  document.getElementById("settings-btn").addEventListener("click", openSettingsModal);
  document.getElementById("settings-cancel-btn").addEventListener("click", closeSettingsModal);
  document.getElementById("settings-save-btn").addEventListener("click", saveSettings);
  document.getElementById("settings-bg-reset").addEventListener("click", () => {
    document.getElementById("settings-bg").value = "#0d1117";
  });

  document.getElementById("avatar-btn").addEventListener("click", () => document.getElementById("photo-input").click());
  document.getElementById("photo-input").addEventListener("change", (e) => {
    if (e.target.files[0]) uploadPhoto(e.target.files[0]);
  });

  // close modals on overlay click (but not when clicking inside the modal box)
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.hidden = true;
    });
  });
}

async function init() {
  wireEvents();
  await loadProfile();
  await loadHabits();
  await loadHeatmap();
}

document.addEventListener("DOMContentLoaded", init);
