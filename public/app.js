const materialIcons = {
  Plastic: '<path d="M8 3.5h8l1 3H7l1-3.5Z"/><path d="M7 7h10l-.8 13h-8.4L7 7Z"/><path d="m10 11 4 5m0-5-4 5"/>',
  Paper: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4m-9 4h6m-6 3h6m-6 3h4"/>',
  Glass: '<path d="M8 3.5h8l-.8 5.2-1.6 1.5v8.3l2.3 1.5H8.1l2.3-1.5v-8.3L8.8 8.7 8 3.5Z"/><path d="M9 7h6"/>',
  Metal: '<path d="M5 6.5h14v14H5z"/><path d="M8 3.5h8v3H8zM8 10.5h8m-8 3h8m-8 3h5"/>',
  Organic: '<path d="M19.5 4c-8.5.2-14 3.8-14 9.7 0 2.8 1.8 4.8 4.6 4.8 5.9 0 9.4-5.1 9.4-14.5Z"/><path d="M4.5 21c3-5 6.6-8.2 12-11"/>',
  Electronics: '<rect x="5" y="4" width="14" height="13" rx="1.5"/><path d="M8 20h8m-4-3v3m-4-12h8m-8 3h5"/>',
  General: '<path d="M7 3.5h10l1 3.5H6l1-3.5Z"/><path d="M5.5 7h13l-1 13.5h-11L5.5 7Z"/><path d="M9 10.5v6M15 10.5v6"/>'
};

const state = { materials: [], overview: null, toastTimer: null };
const $ = (selector) => document.querySelector(selector);
const modal = $("#modal-backdrop");
const STATIC_MODE = window.location.hostname.endsWith(".github.io") ||
  new URLSearchParams(window.location.search).get("storage") === "browser";
const BROWSER_DATA_KEY = "remint-data-v1";

const BROWSER_MATERIALS = [
  { name: "Plastic", color: "#e7a83e", co2PerKg: 1.8, valuePerKg: 0.32, tip: "Rinse bottles and containers; check the recycling symbol." },
  { name: "Paper", color: "#4b8f71", co2PerKg: 0.9, valuePerKg: 0.18, tip: "Keep it dry and remove food-soiled or wax-coated pieces." },
  { name: "Glass", color: "#5680c2", co2PerKg: 0.3, valuePerKg: 0.08, tip: "Empty jars and bottles. Broken glass needs special handling." },
  { name: "Metal", color: "#8a70bd", co2PerKg: 2.1, valuePerKg: 0.75, tip: "Rinse cans and separate batteries for a specialist drop-off." },
  { name: "Organic", color: "#60945b", co2PerKg: 1.2, valuePerKg: 0.12, tip: "Compost fruit and vegetable scraps; avoid meat unless accepted locally." },
  { name: "Electronics", color: "#498d92", co2PerKg: 3.2, valuePerKg: 0.45, tip: "Never put electronics in household bins; use an e-waste collection point." },
  { name: "General", color: "#8a8c88", co2PerKg: 0, valuePerKg: 0, tip: "If it cannot be reused or recycled locally, place it in general waste." }
];

function iconMarkup(material) {
  return `<span class="material-icon" style="color:${material.color};background:${material.color}18"><svg viewBox="0 0 24 24" aria-hidden="true">${materialIcons[material.name] || materialIcons.General}</svg></span>`;
}

function formatWeight(weight) {
  return `${Number(weight).toFixed(Number(weight) % 1 === 0 ? 0 : 1)} kg`;
}

function formatDate(value) {
  const date = new Date(value);
  if (date.toDateString() === new Date().toDateString()) return "Today";
  if (date.toDateString() === new Date(Date.now() - 86400000).toDateString()) return "Yesterday";
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("visible"), 3300);
}

async function request(url, options) {
  if (STATIC_MODE) return requestBrowserStorage(url, options);
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function getBrowserData() {
  const stored = localStorage.getItem(BROWSER_DATA_KEY);
  if (stored) {
    const data = JSON.parse(stored);
    if (!Array.isArray(data.items) || !Array.isArray(data.pickups)) {
      throw new Error("Saved browser data is invalid. Clear this site's storage to reset the demo.");
    }
    return data;
  }
  const offsetDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  };
  const data = {
    items: [
      { id: crypto.randomUUID(), material: "Paper", weightKg: 1.2, createdAt: offsetDate(-2) },
      { id: crypto.randomUUID(), material: "Plastic", weightKg: 0.8, createdAt: offsetDate(-1) },
      { id: crypto.randomUUID(), material: "Organic", weightKg: 2.1, createdAt: offsetDate(0) }
    ],
    pickups: []
  };
  localStorage.setItem(BROWSER_DATA_KEY, JSON.stringify(data));
  return data;
}

function saveBrowserData(data) {
  localStorage.setItem(BROWSER_DATA_KEY, JSON.stringify(data));
}

function getBrowserOverview(data) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekItems = data.items.filter((item) => new Date(item.createdAt) >= weekStart);
  const totalKg = data.items.reduce((sum, item) => sum + item.weightKg, 0);
  const recoveredKg = data.items.reduce((sum, item) => sum + (item.material === "General" ? 0 : item.weightKg), 0);
  const co2Kg = data.items.reduce((sum, item) => sum + item.weightKg * BROWSER_MATERIALS.find((material) => material.name === item.material).co2PerKg, 0);
  const value = data.items.reduce((sum, item) => sum + item.weightKg * BROWSER_MATERIALS.find((material) => material.name === item.material).valuePerKg, 0);
  const byMaterial = BROWSER_MATERIALS.map((material) => ({
    name: material.name,
    color: material.color,
    weightKg: data.items.filter((item) => item.material === material.name).reduce((sum, item) => sum + item.weightKg, 0)
  })).filter((material) => material.weightKg > 0);
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return {
      label: date.toLocaleDateString("en", { weekday: "short" }),
      weightKg: weekItems.filter((item) => new Date(item.createdAt).toDateString() === date.toDateString())
        .reduce((sum, item) => sum + item.weightKg, 0)
    };
  });
  return {
    totalKg: Math.round(totalKg * 100) / 100,
    recoveredKg: Math.round(recoveredKg * 100) / 100,
    recoveryRate: totalKg ? Math.round((recoveredKg / totalKg) * 100) : 0,
    co2Kg: Math.round(co2Kg * 100) / 100,
    value: Math.round(value * 100) / 100,
    itemCount: data.items.length,
    pickupCount: data.pickups.length,
    byMaterial,
    daily,
    recentItems: [...data.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    nextPickup: [...data.pickups]
      .filter((pickup) => pickup.status === "Scheduled" && new Date(`${pickup.date}T23:59:59`) >= now)
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null
  };
}

async function requestBrowserStorage(url, options = {}) {
  const pathname = new URL(url, window.location.href).pathname;
  const body = options.body ? JSON.parse(options.body) : {};
  if (pathname.endsWith("/api/materials") && !options.method) return BROWSER_MATERIALS;
  const data = getBrowserData();
  if (pathname.endsWith("/api/overview") && !options.method) return getBrowserOverview(data);
  if (pathname.endsWith("/api/items") && options.method === "POST") {
    const weightKg = Number(body.weightKg);
    if (!BROWSER_MATERIALS.some((material) => material.name === body.material)) throw new Error("Choose a listed waste type.");
    if (!Number.isFinite(weightKg) || weightKg < 0.05 || weightKg > 1000) throw new Error("Weight must be between 0.05 kg and 1,000 kg.");
    const item = { id: crypto.randomUUID(), material: body.material, weightKg: Math.round(weightKg * 100) / 100, createdAt: new Date().toISOString() };
    data.items.push(item);
    saveBrowserData(data);
    return item;
  }
  if (pathname.endsWith("/api/pickups") && options.method === "POST") {
    if (typeof body.address !== "string" || body.address.trim().length < 5 || body.address.trim().length > 160) throw new Error("Enter an address between 5 and 160 characters.");
    if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new Error("Choose a valid pickup date.");
    const [year, month, day] = body.date.split("-").map(Number);
    const requestedDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedDate.getFullYear() !== year || requestedDate.getMonth() !== month - 1 || requestedDate.getDate() !== day || requestedDate < today) {
      throw new Error("Choose a valid future pickup date.");
    }
    if (!["Morning", "Afternoon"].includes(body.timeSlot)) throw new Error("Choose a morning or afternoon time slot.");
    if (!Array.isArray(body.materials) || body.materials.length === 0 ||
        body.materials.some((material) => !BROWSER_MATERIALS.some((entry) => entry.name === material) || material === "General")) {
      throw new Error("Choose at least one recyclable material for collection.");
    }
    const pickup = {
      id: crypto.randomUUID(),
      address: body.address.trim(),
      date: body.date,
      timeSlot: body.timeSlot,
      materials: [...new Set(body.materials)],
      status: "Scheduled",
      createdAt: new Date().toISOString()
    };
    data.pickups.push(pickup);
    saveBrowserData(data);
    return pickup;
  }
  throw new Error("This action is not available in the browser-only version.");
}

function renderOverview(data) {
  state.overview = data;
  $("#recovered-value").textContent = data.recoveredKg.toFixed(1);
  $("#recovery-rate").textContent = data.recoveryRate;
  $("#co2-value").textContent = data.co2Kg.toFixed(1);
  $("#value-saved").textContent = data.value.toFixed(2);
  $("#item-count").textContent = data.itemCount;
  $("#pickup-count").textContent = data.pickupCount;

  const weeklyTotal = data.daily.reduce((sum, day) => sum + day.weightKg, 0);
  $("#week-total").textContent = `${weeklyTotal.toFixed(1)} kg`;
  const peak = Math.max(...data.daily.map((day) => day.weightKg), 0.2);
  $("#weekly-chart").innerHTML = data.daily.map((day, index) => {
    const height = Math.max(4, Math.round((day.weightKg / peak) * 70));
    const isToday = index === data.daily.length - 1;
    return `<div class="chart-day"><div class="chart-column${isToday ? " today" : ""}" style="height:${height}px" data-value="${day.weightKg.toFixed(1)} kg"></div><span>${day.label}</span></div>`;
  }).join("");

  $("#material-breakdown").innerHTML = data.byMaterial.length
    ? data.byMaterial.map((material) => `<span class="material-chip"><i style="background:${material.color}"></i>${material.name} <b>${material.weightKg.toFixed(1)} kg</b></span>`).join("")
    : '<span class="empty-list">Log your first item to see materials here.</span>';
  renderRecent(data.recentItems);
  renderNextPickup(data.nextPickup);
}

function renderRecent(items) {
  $("#recent-items").innerHTML = items.length
    ? items.map((item) => {
      const material = state.materials.find((entry) => entry.name === item.material);
      return `<div class="recent-row">${iconMarkup(material)}<div class="recent-copy"><strong>${item.material}</strong><span>${formatDate(item.createdAt)} · sorted for recovery</span></div><span class="recent-weight">${formatWeight(item.weightKg)}</span></div>`;
    }).join("")
    : '<div class="empty-list">Nothing logged yet. Sort and log your first item.</div>';
}

function renderNextPickup(pickup) {
  const container = $("#pickup-status");
  if (!pickup) {
    container.innerHTML = '<span class="empty-pickup-label">NEIGHBORHOOD PICKUP</span><h3>Give your recyclables a ride.</h3><p>Book a collection for your sorted paper, glass, plastic and more.</p><button class="secondary-button" id="schedule-button">Schedule a pickup <span>→</span></button>';
  } else {
    const date = new Date(`${pickup.date}T12:00:00`);
    const label = date.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
    container.innerHTML = `<span class="empty-pickup-label">YOUR COLLECTION IS BOOKED</span><div class="scheduled-detail"><span class="calendar-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M8 3.5v4m8-4v4M4 10h16"/></svg></span><div class="scheduled-copy"><strong>${label} · ${pickup.timeSlot}</strong><span>${pickup.materials.join(", ")}</span></div></div><div class="scheduled-address">${escapeHtml(pickup.address)}</div>`;
  }
  $("#schedule-button")?.addEventListener("click", openPickupModal);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function renderGuide(filter = "") {
  const search = filter.trim().toLowerCase();
  const matches = state.materials.filter((material) => material.name.toLowerCase().includes(search) || material.tip.toLowerCase().includes(search));
  $("#guide-list").innerHTML = matches.map((material) =>
    `<div class="guide-item">${iconMarkup(material)}<div><strong>${material.name}</strong><small>${material.tip}</small></div><button data-log-material="${material.name}">Log</button></div>`
  ).join("") || '<div class="empty-list">No matches. Try another material.</div>';
  $("#guide-list").querySelectorAll("[data-log-material]").forEach((button) => {
    button.addEventListener("click", () => openItemModal(button.dataset.logMaterial));
  });
}

function openModal(form) {
  $("#item-form").hidden = form !== "item";
  $("#pickup-form").hidden = form !== "pickup";
  $("#modal-eyebrow").textContent = form === "item" ? "YOUR CIRCULAR ROUTINE" : "NEIGHBORHOOD COLLECTION";
  $("#modal-title").textContent = form === "item" ? "Log a sorted item" : "Schedule a pickup";
  $("#modal-description").textContent = form === "item"
    ? "Track what you diverted and see its impact add up."
    : "Choose what is ready and we’ll arrange a convenient collection.";
  $("#form-error").textContent = "";
  $("#pickup-error").textContent = "";
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  (form === "item" ? $("#item-material") : $("#pickup-address")).focus();
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}

function openItemModal(materialName) {
  $("#item-material").value = materialName || state.materials[0]?.name || "";
  updateMaterialTip();
  $("#item-weight").value = "";
  openModal("item");
}

function updateMaterialTip() {
  const selected = state.materials.find((material) => material.name === $("#item-material").value);
  $("#material-tip").textContent = selected?.tip || "";
}

function openPickupModal() {
  $("#pickup-address").value = "";
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const minDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  $("#pickup-date").min = minDate;
  $("#pickup-date").value = minDate;
  $("#pickup-material-options").innerHTML = state.materials.filter((material) => material.name !== "General")
    .map((material) => `<label><input type="checkbox" value="${material.name}">${material.name}</label>`).join("");
  openModal("pickup");
}

async function refreshOverview() {
  renderOverview(await request("./api/overview"));
}

async function init() {
  try {
    [state.materials] = await Promise.all([request("./api/materials")]);
    $("#item-material").innerHTML = state.materials
      .map((material) => `<option value="${material.name}">${material.name}</option>`).join("");
    $("#pickup-material-options").innerHTML = state.materials.filter((material) => material.name !== "General")
      .map((material) => `<label><input type="checkbox" value="${material.name}">${material.name}</label>`).join("");
    renderGuide();
    await refreshOverview();
    $("#today-label").textContent = new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
    if (new URLSearchParams(window.location.search).get("action") === "log") {
      window.history.replaceState(null, "", "/#sorting");
      openItemModal();
    }
  } catch (error) {
    showToast(`Could not load your dashboard: ${error.message}`, true);
  }
}

$("#item-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#modal-submit");
  button.disabled = true;
  $("#form-error").textContent = "";
  try {
    const item = await request("./api/items", {
      method: "POST",
      body: JSON.stringify({ material: $("#item-material").value, weightKg: $("#item-weight").value })
    });
    closeModal();
    await refreshOverview();
    showToast(`${item.material} added — your impact is growing.`);
  } catch (error) {
    $("#form-error").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$("#pickup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#pickup-form button[type=submit]");
  button.disabled = true;
  $("#pickup-error").textContent = "";
  try {
    const materials = [...$("#pickup-material-options").querySelectorAll("input:checked")].map((input) => input.value);
    await request("./api/pickups", {
      method: "POST",
      body: JSON.stringify({
        address: $("#pickup-address").value,
        date: $("#pickup-date").value,
        timeSlot: $("#pickup-slot").value,
        materials
      })
    });
    closeModal();
    await refreshOverview();
    showToast("Pickup requested. Your sorted materials are on their way.");
  } catch (error) {
    $("#pickup-error").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$("#item-material").addEventListener("change", updateMaterialTip);
$("#guide-search").addEventListener("input", (event) => renderGuide(event.target.value));
$("#log-top-button").addEventListener("click", () => openItemModal());
$("#guide-log-button").addEventListener("click", () => openItemModal());
$("#schedule-button").addEventListener("click", openPickupModal);
$("#pickup-link").addEventListener("click", openPickupModal);
$("#all-items-link").addEventListener("click", () => {
  document.querySelector(".recent-panel").scrollIntoView({ behavior: "smooth", block: "center" });
  showToast(`${state.overview?.itemCount ?? 0} items logged by your household.`);
});
$("#modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeModal();
  if (event.key === "/" && modal.hidden && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    $("#guide-search").focus();
  }
});
$("#menu-button").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((nav) => nav.classList.remove("active"));
    link.classList.add("active");
    $("#sidebar").classList.remove("open");
  });
});

init();
