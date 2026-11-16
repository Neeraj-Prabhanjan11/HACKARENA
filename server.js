const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const MAX_BODY_BYTES = 16 * 1024;
const MATERIALS = [
  { name: "Plastic", color: "#e7a83e", co2PerKg: 1.8, valuePerKg: 0.32, tip: "Rinse bottles and containers; check the recycling symbol." },
  { name: "Paper", color: "#4b8f71", co2PerKg: 0.9, valuePerKg: 0.18, tip: "Keep it dry and remove food-soiled or wax-coated pieces." },
  { name: "Glass", color: "#5680c2", co2PerKg: 0.3, valuePerKg: 0.08, tip: "Empty jars and bottles. Broken glass needs special handling." },
  { name: "Metal", color: "#8a70bd", co2PerKg: 2.1, valuePerKg: 0.75, tip: "Rinse cans and separate batteries for a specialist drop-off." },
  { name: "Organic", color: "#60945b", co2PerKg: 1.2, valuePerKg: 0.12, tip: "Compost fruit and vegetable scraps; avoid meat unless accepted locally." },
  { name: "Electronics", color: "#498d92", co2PerKg: 3.2, valuePerKg: 0.45, tip: "Never put electronics in household bins; use an e-waste collection point." },
  { name: "General", color: "#8a8c88", co2PerKg: 0, valuePerKg: 0, tip: "If it cannot be reused or recycled locally, place it in general waste." }
];
const MATERIAL_BY_NAME = Object.fromEntries(MATERIALS.map((material) => [material.name, material]));
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function createSeedData() {
  return {
    items: [
      { id: randomUUID(), material: "Paper", weightKg: 1.2, createdAt: dateOffset(-2) },
      { id: randomUUID(), material: "Plastic", weightKg: 0.8, createdAt: dateOffset(-1) },
      { id: randomUUID(), material: "Organic", weightKg: 2.1, createdAt: dateOffset(0) }
    ],
    pickups: []
  };
}

async function loadData() {
  try {
    const data = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    if (!Array.isArray(data.items) || !Array.isArray(data.pickups)) {
      throw new Error("Stored data has an invalid shape");
    }
    return data;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const data = createSeedData();
    await saveData(data);
    return data;
  }
}

async function saveData(data) {
  await fs.writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        body = "";
        tooLarge = true;
      }
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(Object.assign(new Error("Request body is too large"), { statusCode: 413 }));
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON"), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function getOverview(data) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekItems = data.items.filter((item) => new Date(item.createdAt) >= weekStart);
  const totalKg = data.items.reduce((sum, item) => sum + item.weightKg, 0);
  const recoveredKg = data.items.reduce((sum, item) => sum + (item.material === "General" ? 0 : item.weightKg), 0);
  const co2Kg = data.items.reduce((sum, item) => sum + item.weightKg * MATERIAL_BY_NAME[item.material].co2PerKg, 0);
  const value = data.items.reduce((sum, item) => sum + item.weightKg * MATERIAL_BY_NAME[item.material].valuePerKg, 0);
  const byMaterial = MATERIALS.map((material) => ({
    name: material.name,
    color: material.color,
    weightKg: data.items.filter((item) => item.material === material.name)
      .reduce((sum, item) => sum + item.weightKg, 0)
  })).filter((material) => material.weightKg > 0);
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const dayItems = weekItems.filter((item) => new Date(item.createdAt).toDateString() === date.toDateString());
    return {
      label: date.toLocaleDateString("en", { weekday: "short" }),
      weightKg: dayItems.reduce((sum, item) => sum + item.weightKg, 0)
    };
  });

  return {
    totalKg: round(totalKg),
    recoveredKg: round(recoveredKg),
    recoveryRate: totalKg ? Math.round((recoveredKg / totalKg) * 100) : 0,
    co2Kg: round(co2Kg),
    value: round(value),
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

function round(value) {
  return Math.round(value * 100) / 100;
}

function validateItem(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Provide a material and weight.";
  const material = MATERIAL_BY_NAME[body.material];
  const weightKg = Number(body.weightKg);
  if (!material) return "Choose a listed waste type.";
  if (!Number.isFinite(weightKg) || weightKg < 0.05 || weightKg > 1000) {
    return "Weight must be between 0.05 kg and 1,000 kg.";
  }
  return null;
}

function validatePickup(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Provide pickup details.";
  if (typeof body.address !== "string" || body.address.trim().length < 5 || body.address.trim().length > 160) {
    return "Enter an address between 5 and 160 characters.";
  }
  if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return "Choose a valid pickup date.";
  }
  const [year, month, day] = body.date.split("-").map(Number);
  const requestedDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (requestedDate.getFullYear() !== year || requestedDate.getMonth() !== month - 1 ||
      requestedDate.getDate() !== day || requestedDate < today) return "Choose a valid future pickup date.";
  if (!["Morning", "Afternoon"].includes(body.timeSlot)) return "Choose a morning or afternoon time slot.";
  if (!Array.isArray(body.materials) || body.materials.length === 0 ||
      body.materials.some((material) => !MATERIAL_BY_NAME[material] || material === "General")) {
    return "Choose at least one recyclable material for collection.";
  }
  return null;
}

async function serveStatic(pathname, response) {
  const requestedPath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^[/\\]+/, "");
  const filePath = path.resolve(PUBLIC_DIR, requestedPath);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }
  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache"
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendJson(response, 404, { error: "Not found" });
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/materials" && request.method === "GET") {
        sendJson(response, 200, MATERIALS);
        return;
      }
      const data = await loadData();
      if (url.pathname === "/api/overview" && request.method === "GET") {
        sendJson(response, 200, getOverview(data));
        return;
      }
      if (url.pathname === "/api/items" && request.method === "POST") {
        const body = await readJson(request);
        const validationError = validateItem(body);
        if (validationError) {
          sendJson(response, 400, { error: validationError });
          return;
        }
        const item = {
          id: randomUUID(),
          material: body.material,
          weightKg: round(Number(body.weightKg)),
          createdAt: new Date().toISOString()
        };
        data.items.push(item);
        await saveData(data);
        sendJson(response, 201, item);
        return;
      }
      if (url.pathname === "/api/pickups" && request.method === "POST") {
        const body = await readJson(request);
        const validationError = validatePickup(body);
        if (validationError) {
          sendJson(response, 400, { error: validationError });
          return;
        }
        const pickup = {
          id: randomUUID(),
          address: body.address.trim(),
          date: body.date,
          timeSlot: body.timeSlot,
          materials: [...new Set(body.materials)],
          status: "Scheduled",
          createdAt: new Date().toISOString()
        };
        data.pickups.push(pickup);
        await saveData(data);
        sendJson(response, 201, pickup);
        return;
      }
      sendJson(response, 404, { error: "API route not found" });
      return;
    }
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    await serveStatic(url.pathname, response);
  } catch (error) {
    if (!response.headersSent) sendJson(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Something went wrong." });
    else response.destroy();
    if (!error.statusCode) console.error(error);
  }
});

server.listen(PORT, () => {
  console.log(`Remint is running at http://localhost:${PORT}`);
});
