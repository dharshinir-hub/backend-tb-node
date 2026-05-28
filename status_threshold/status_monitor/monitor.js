"use strict";

// Machine Status Monitor — WebSocket-based (event-driven)
// Monitors a single ThingsBoard instance (TB1)
//
// Status categories:
//   0/1/2 → Idle    4/5 → Alarm    3 → Running    100 → Disconnect

const WebSocket = require("ws");
const axios = require("axios");
const https = require("https");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const TB_BASE_URL = process.env.TB_BASE_URL;
const TB_USERNAME = process.env.TB_USERNAME;
const TB_PASSWORD = process.env.TB_PASSWORD;
const TB_INSECURE_TLS = String(process.env.TB_INSECURE_TLS || "") === "1";
const TB_INSTANCE = process.env.TB_INSTANCE || "TB1";

const WS_BASE = TB_BASE_URL.replace(/^http/, "ws");

const httpsAgent = new https.Agent({ rejectUnauthorized: !TB_INSECURE_TLS, maxSockets: 100 });
httpsAgent.setMaxListeners(100);
const axiosTb = axios.create({ httpsAgent });

let token = null;

// deviceId → state object
const deviceState = new Map();
let cmdIdCounter = 1;

const CAT = { IDLE: "IDLE", RUNNING: "RUNNING", ALARM: "ALARM", DISCONNECT: "DISCONNECT" };
const ALERT_CATS = new Set([CAT.IDLE, CAT.ALARM, CAT.DISCONNECT]);

function classifyStatus(value) {
  const v = Number(value);
  if (v === 0 || v === 1 || v === 2) return CAT.IDLE;
  if (v === 3) return CAT.RUNNING;
  if (v === 4 || v === 5) return CAT.ALARM;
  if (v === 100) return CAT.DISCONNECT;
  return null;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function login() {
  const res = await axiosTb.post(
    `${TB_BASE_URL}/api/auth/login`,
    { username: TB_USERNAME, password: TB_PASSWORD },
    { headers: { "Content-Type": "application/json" } }
  );
  token = res.data.token;
}

function auth(extra = {}) {
  return { "X-Authorization": `Bearer ${token}`, ...extra };
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function ts() { return new Date().toISOString(); }

// ── ThingsBoard REST ───────────────────────────────────────────────────────────

async function getAllCustomers() {
  let all = [], page = 0;
  while (true) {
    const res = await axiosTb.get(
      `${TB_BASE_URL}/api/customers?pageSize=100&page=${page}`,
      { headers: auth() }
    );
    all = all.concat(res.data.data || []);
    if (!res.data.hasNext) break;
    page++;
  }
  return all;
}

async function getCustomerAttrs(customerId) {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes`,
    { headers: auth() }
  );
  return res.data || [];
}

async function getCustomerDevices(customerId) {
  let all = [], page = 0;
  while (true) {
    const res = await axiosTb.get(
      `${TB_BASE_URL}/api/customer/${customerId}/devices?pageSize=100&page=${page}`,
      { headers: auth() }
    );
    all = all.concat(res.data.data || []);
    if (!res.data.hasNext) break;
    page++;
  }
  return all;
}

async function getDeviceServerAttrs(deviceId) {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`,
    { headers: auth() }
  );
  return res.data || [];
}

async function getAdminUsers(customerId) {
  let all = [], page = 0;
  while (true) {
    const res = await axiosTb.get(
      `${TB_BASE_URL}/api/customer/${customerId}/users?pageSize=100&page=${page}`,
      { headers: auth() }
    );
    all = all.concat(res.data.data || []);
    if (!res.data.hasNext) break;
    page++;
  }
  return all.filter((u) => {
    const parsed = safeJsonParse(u.additionalInfo?.description || "");
    const mode = (parsed?.mode || "").trim();
    return mode === "Admin" || mode === "Super Admin";
  });
}

async function sendNotification(customerId, subject, body, icon, iconColor) {
  const admins = await getAdminUsers(customerId);
  const userIds = admins.map((u) => u.id?.id).filter(Boolean);
  if (!userIds.length) { console.warn(`  [${TB_INSTANCE}] No Admin/Super Admin users found.`); return; }

  let targetId = null;
  try {
    const tRes = await axiosTb.post(
      `${TB_BASE_URL}/api/notification/target`,
      {
        name: `__sm_${Date.now()}__`,
        configuration: {
          type: "PLATFORM_USERS",
          usersFilter: { type: "USER_LIST", usersIds: userIds },
        },
      },
      { headers: auth({ "Content-Type": "application/json" }) }
    );
    targetId = tRes.data.id.id;

    await axiosTb.post(
      `${TB_BASE_URL}/api/notification/request`,
      {
        targets: [targetId],
        template: {
          name: `sm-notif-${Date.now()}`,
          notificationType: "GENERAL",
          configuration: {
            deliveryMethodsTemplates: {
              WEB: {
                method: "WEB",
                enabled: true,
                subject,
                body,
                additionalConfig: {
                  icon: { enabled: true, icon, color: iconColor },
                },
              },
            },
          },
        },
      },
      { headers: auth({ "Content-Type": "application/json" }) }
    );
    console.log(`  [${TB_INSTANCE}] Notification → "${subject}" sent to ${userIds.length} user(s)`);
  } catch (err) {
    console.error(`  [${TB_INSTANCE}] Notification error:`, err.response?.data?.message || err.message);
  } finally {
    if (targetId) {
      axiosTb.delete(`${TB_BASE_URL}/api/notification/target/${targetId}`, { headers: auth() }).catch(() => {});
    }
  }
}

// ── Threshold parsing ─────────────────────────────────────────────────────────

function parseThresholdMs(attrValue) {
  if (attrValue == null) return null;
  let obj = attrValue;
  if (typeof obj === "string") obj = safeJsonParse(obj);
  if (!obj || typeof obj !== "object") return null;
  if ((obj.mode || "").toLowerCase() !== "enabled") return null;
  const sec = Number(obj.threshold);
  if (!isFinite(sec) || sec <= 0) return null;
  return sec * 1000;
}

// ── Shift helpers ─────────────────────────────────────────────────────────────

function parseShiftTime(raw) {
  const [h = 0, m = 0, s = 0] = String(raw || "").split(":").map(Number);
  return (h * 3600 + m * 60 + s) * 1000;
}

function getShiftStartMs(allShift, timeMs) {
  if (!Array.isArray(allShift) || allShift.length === 0) return null;

  const dayStart = new Date(timeMs);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();

  for (const shift of allShift) {
    const startField = shift.start_time ?? shift.start ?? "";
    const endField   = shift.end_time   ?? shift.end   ?? "";

    const shiftStartMs = dayStartMs + parseShiftTime(startField);
    let   shiftEndMs   = dayStartMs + parseShiftTime(endField);
    if (shiftEndMs <= shiftStartMs) shiftEndMs += 86400000;

    if (timeMs >= shiftStartMs && timeMs < shiftEndMs) return shiftStartMs;
  }
  return null;
}

function isWithinShift(allShift, eventTimeMs, triggerTimeMs) {
  if (!Array.isArray(allShift) || allShift.length === 0) return true;

  const dayStart = new Date(eventTimeMs);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();

  for (const shift of allShift) {
    const startField = shift.start_time ?? shift.start ?? "";
    const endField   = shift.end_time   ?? shift.end   ?? "";

    const shiftStartMs = dayStartMs + parseShiftTime(startField);
    let   shiftEndMs   = dayStartMs + parseShiftTime(endField);
    if (shiftEndMs <= shiftStartMs) shiftEndMs += 86400000;

    if (eventTimeMs >= shiftStartMs && eventTimeMs < shiftEndMs) {
      return triggerTimeMs <= shiftEndMs;
    }
  }

  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMs(ms) {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec} seconds`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec ? `${min} min ${sec} sec` : `${min} minutes`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin ? `${hr} hr ${remMin} min` : `${hr} hours`;
}

// ── Alert / Resolution config ─────────────────────────────────────────────────

const ALERT_CFG = {
  [CAT.IDLE]:       { subject: "Machine Idle",       body: (n, t, time) => `Machine – "${n}" is Idle for more than ${t} (at ${time})`,        icon: "info",    color: "#F59E0B" },
  [CAT.ALARM]:      { subject: "Machine Alarm",      body: (n, t, time) => `Machine – "${n}" alarm active for more than ${t} (at ${time})`,   icon: "warning", color: "#DC2626" },
  [CAT.DISCONNECT]: { subject: "Machine Disconnect", body: (n, t, time) => `Machine – "${n}" disconnected for more than ${t} (at ${time})`,   icon: "warning", color: "#B91C1C" },
};

const RESOLVE_CFG = {
  [CAT.IDLE]:       { subject: "Machine Idle Resolved",       body: (n) => `Machine – "${n}" idle condition resolved. Machine is running`,   icon: "check", color: "#16A34A" },
  [CAT.ALARM]:      { subject: "Machine Alarm Resolved",      body: (n) => `Machine – "${n}" alarm resolved. Machine is ready for operation`, icon: "check", color: "#16A34A" },
  [CAT.DISCONNECT]: { subject: "Machine Disconnect Resolved", body: (n) => `Machine – "${n}" disconnection resolved`,                        icon: "check", color: "#16A34A" },
};

// ── Alert fire ────────────────────────────────────────────────────────────────

async function fireAlert(deviceId) {
  const state = deviceState.get(deviceId);
  if (!state) return;
  state.timer = null;

  const category = state.pendingCategory;
  if (!category || !ALERT_CATS.has(category)) return;
  if (state.alertSent === category) return;

  const cfg = ALERT_CFG[category];
  const thresholdMs =
    category === CAT.IDLE       ? state.idleThresholdMs :
    category === CAT.ALARM      ? state.alarmThresholdMs :
    category === CAT.DISCONNECT ? state.disconnectThresholdMs : null;
  const thresholdStr = thresholdMs ? formatMs(thresholdMs) : "";

  console.log(`[${ts()}] [${TB_INSTANCE}] ALERT — ${state.customerTitle}/${state.name}: ${cfg.subject}`);
  state.alertSent = category;

  const fireTime = new Date().toLocaleTimeString();
  await sendNotification(state.customerId, cfg.subject, cfg.body(state.name, thresholdStr, fireTime), cfg.icon, cfg.color);
}

// ── Resolution ────────────────────────────────────────────────────────────────

async function sendResolution(deviceId, prevCategory, newCategory) {
  const state = deviceState.get(deviceId);
  if (!state || !prevCategory || !ALERT_CATS.has(prevCategory)) return;
  if (state.alertSent !== prevCategory) return;

  if (prevCategory === CAT.IDLE && newCategory !== CAT.RUNNING) return;

  const cfg = RESOLVE_CFG[prevCategory];
  console.log(`[${ts()}] [${TB_INSTANCE}] RESOLVED — ${state.customerTitle}/${state.name}: ${cfg.subject}`);
  state.alertSent = null;

  await sendNotification(state.customerId, cfg.subject, cfg.body(state.name), cfg.icon, cfg.color);
}

// ── Core status handler ───────────────────────────────────────────────────────

async function onMachineStatus(deviceId, value, eventTs) {
  const state = deviceState.get(deviceId);
  if (!state) return;

  const category = classifyStatus(value);
  if (!category) return;

  try {
    const [custAttrs, devAttrs] = await Promise.all([
      getCustomerAttrs(state.customerId),
      getDeviceServerAttrs(deviceId),
    ]);

    const allShiftAttr = custAttrs.find((a) => a.key === "allShift");
    let raw = allShiftAttr ? allShiftAttr.value : null;
    if (typeof raw === "string") raw = safeJsonParse(raw);
    if (typeof raw === "string") raw = safeJsonParse(raw);
    state.allShift = Array.isArray(raw) ? raw : [];

    const attrMap = Object.fromEntries(devAttrs.map((a) => [a.key, a.value]));
    state.idleThresholdMs       = parseThresholdMs(attrMap.idle_threshold)       ?? state.idleThresholdMs;
    state.alarmThresholdMs      = parseThresholdMs(attrMap.alarm_threshold)      ?? state.alarmThresholdMs;
    state.disconnectThresholdMs = parseThresholdMs(attrMap.disconnect_threshold) ?? state.disconnectThresholdMs;
  } catch { }

  const prevCategory = state.currentCategory;

  if (category === prevCategory) {
    const newShiftStart = getShiftStartMs(state.allShift, eventTs);
    const prevShiftStart = getShiftStartMs(state.allShift, state.categoryEnteredTs || 0);

    console.log(`[${ts()}] [${TB_INSTANCE}] ${state.name} SAME-CAT(${category})`);

    if (!newShiftStart) {
      console.log(`  → skipped: event not in any defined shift`);
      return;
    }

    if (prevShiftStart === newShiftStart) {
      console.log(`  → skipped: same shift as previous entry`);
      return;
    }

    console.log(`  → NEW SHIFT detected, restarting timer`);
    state.alertSent = null;
  }

  if (state.timer) { clearTimeout(state.timer); state.timer = null; }
  state.pendingCategory = null;
  state.currentCategory = category;
  state.categoryEnteredTs = eventTs;

  if (category !== prevCategory && prevCategory) await sendResolution(deviceId, prevCategory, category);

  if (category === CAT.RUNNING) {
    console.log(`[${ts()}] [${TB_INSTANCE}] ${state.customerTitle}/${state.name}: RUNNING (no alert)`);
    return;
  }

  const thresholdMs =
    category === CAT.IDLE       ? state.idleThresholdMs :
    category === CAT.ALARM      ? state.alarmThresholdMs :
    category === CAT.DISCONNECT ? state.disconnectThresholdMs : null;

  if (!thresholdMs) {
    console.log(`[${ts()}] [${TB_INSTANCE}] ${state.customerTitle}/${state.name}: ${category} — no threshold configured`);
    return;
  }

  const triggerTs = eventTs + thresholdMs;

  if (!isWithinShift(state.allShift, eventTs, triggerTs)) {
    console.log(`[${ts()}] [${TB_INSTANCE}] ${state.name}: ${category} — alert skipped (crosses shift boundary)`);
    return;
  }

  const delay = Math.max(0, triggerTs - Date.now());
  state.pendingCategory = category;
  state.timer = setTimeout(() => fireAlert(deviceId), delay);
  console.log(`[${ts()}] [${TB_INSTANCE}] ${state.customerTitle}/${state.name}: ${category} — alert fires in ${Math.round(delay / 1000)}s`);
}

// ── Startup timer seeding ─────────────────────────────────────────────────────

function initDeviceTimers() {
  const now = Date.now();
  for (const [deviceId, state] of deviceState.entries()) {
    if (state.lastKnownTs === null || state.lastKnownValue === null) continue;

    const category = classifyStatus(state.lastKnownValue);
    if (!category || category === CAT.RUNNING) continue;

    const thresholdMs =
      category === CAT.IDLE       ? state.idleThresholdMs :
      category === CAT.ALARM      ? state.alarmThresholdMs :
      category === CAT.DISCONNECT ? state.disconnectThresholdMs : null;

    if (!thresholdMs) continue;

    state.currentCategory = category;
    state.categoryEnteredTs = state.lastKnownTs;

    const triggerTs = state.lastKnownTs + thresholdMs;

    if (!isWithinShift(state.allShift, state.lastKnownTs, triggerTs)) {
      console.log(`  [${state.name}] ${category} — startup alert skipped (crosses shift boundary)`);
      continue;
    }

    const remaining = triggerTs - now;
    if (remaining <= 0) {
      console.log(`  [${state.name}] ${category} already past threshold — alerting now.`);
      state.pendingCategory = category;
      fireAlert(deviceId);
    } else {
      console.log(`  [${state.name}] ${category} — alert in ${Math.round(remaining / 1000)}s`);
      state.pendingCategory = category;
      state.timer = setTimeout(() => fireAlert(deviceId), remaining);
    }
  }
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

function subscribeDevices(ws, allDevices) {
  const cmds = allDevices
    .filter((d) => deviceState.has(d.deviceId))
    .map((d) => {
      const state = deviceState.get(d.deviceId);
      return {
        entityType: "DEVICE",
        entityId: d.deviceId,
        cmdId: state.cmdId,
        keys: "machine_status",
        startTs: Date.now() - 1000,
        timeWindow: 86400000,
      };
    });

  if (cmds.length) {
    ws.send(JSON.stringify({ tsSubCmds: cmds }));
    console.log(`[${TB_INSTANCE}] Subscribed to ${cmds.length} device(s) via WebSocket (machine_status).`);
  }
}

function connectWebSocket(allDevices) {
  const wsUrl = `${WS_BASE}/api/ws/plugins/telemetry?token=${token}`;
  const ws = new WebSocket(wsUrl, { rejectUnauthorized: !TB_INSECURE_TLS });

  ws.on("open", () => {
    console.log(`[${TB_INSTANCE}] WebSocket connected.`);
    subscribeDevices(ws, allDevices);
    initDeviceTimers();
  });

  ws.on("message", (raw) => {
    const msg = safeJsonParse(raw.toString());
    if (!msg || !msg.data) return;

    for (const [deviceId, state] of deviceState.entries()) {
      if (msg.subscriptionId !== state.cmdId) continue;

      const entries = msg.data?.machine_status;
      if (!Array.isArray(entries) || entries.length === 0) break;

      const newEntries = entries
        .map(([t, v]) => [Number(t), v])
        .filter(([t]) => !state.lastKnownTs || t > state.lastKnownTs)
        .sort((a, b) => a[0] - b[0]);

      for (const [eventTs, val] of newEntries) {
        state.lastKnownTs = eventTs;
        state.lastKnownValue = val;
        onMachineStatus(deviceId, val, eventTs);
      }
      break;
    }
  });

  ws.on("close", () => {
    console.warn(`[${TB_INSTANCE}] WebSocket closed. Reconnecting in 5s...`);
    setTimeout(() => reconnect(allDevices), 5000);
  });

  ws.on("error", (err) => console.error(`[${TB_INSTANCE}] WebSocket error:`, err.message));

  return ws;
}

async function reconnect(allDevices) {
  try {
    await login();
    connectWebSocket(allDevices);
  } catch (err) {
    console.error(`[${TB_INSTANCE}] Reconnect failed:`, err.message, "Retrying in 10s...");
    setTimeout(() => reconnect(allDevices), 10000);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!TB_BASE_URL || !TB_USERNAME || !TB_PASSWORD) {
    console.error(`[${TB_INSTANCE}] Missing TB_BASE_URL / TB_USERNAME / TB_PASSWORD in .env`);
    process.exit(1);
  }

  await login();
  console.log(`[${TB_INSTANCE}] Logged in. Loading customers and devices...`);

  const customers = await getAllCustomers();
  const allDevices = [];

  for (const customer of customers) {
    const customerId = customer.id?.id;
    if (!customerId) continue;

    const attrs = await getCustomerAttrs(customerId);

    const allShiftAttr = attrs.find((a) => a.key === "allShift");
    let allShift = [];
    if (allShiftAttr) {
      const raw = allShiftAttr.value;
      allShift = (typeof raw === "string" ? safeJsonParse(raw) : raw) || [];
    }

    const devices = await getCustomerDevices(customerId);

    for (const d of devices) {
      const deviceId = d.id?.id;
      if (!deviceId) continue;

      const devAttrs = await getDeviceServerAttrs(deviceId);
      const attrMap = Object.fromEntries(devAttrs.map((a) => [a.key, a.value]));

      const idleThresholdMs       = parseThresholdMs(attrMap.idle_threshold);
      const alarmThresholdMs      = parseThresholdMs(attrMap.alarm_threshold);
      const disconnectThresholdMs = parseThresholdMs(attrMap.disconnect_threshold);

      if (!idleThresholdMs && !alarmThresholdMs && !disconnectThresholdMs) continue;

      const cmdId = cmdIdCounter++;

      let lastKnownTs = null;
      let lastKnownValue = null;
      try {
        const msRes = await axiosTb.get(
          `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=machine_status&limit=1&useStrictDataTypes=false`,
          { headers: auth() }
        );
        const list = msRes.data?.machine_status || [];
        if (list.length) {
          lastKnownTs = Number(list[0].ts);
          lastKnownValue = list[0].value;
        }
      } catch { }

      deviceState.set(deviceId, {
        cmdId,
        name: d.name,
        customerId,
        customerTitle: customer.title,
        allShift,
        idleThresholdMs,
        alarmThresholdMs,
        disconnectThresholdMs,
        currentCategory: null,
        pendingCategory: null,
        alertSent: null,
        timer: null,
        lastKnownTs,
        lastKnownValue,
        categoryEnteredTs: null,
      });

      allDevices.push({ deviceId });
      console.log(
        `  [${customer.title}] ${d.name} — ` +
        `idle:${idleThresholdMs ? idleThresholdMs / 1000 + "s" : "-"} ` +
        `alarm:${alarmThresholdMs ? alarmThresholdMs / 1000 + "s" : "-"} ` +
        `disconnect:${disconnectThresholdMs ? disconnectThresholdMs / 1000 + "s" : "-"}`
      );
    }
  }

  if (!allDevices.length) {
    console.error(`[${TB_INSTANCE}] No devices with thresholds found. Exiting.`);
    process.exit(1);
  }

  console.log(`\n[${TB_INSTANCE}] Total devices monitored: ${allDevices.length}`);
  console.log(`[${TB_INSTANCE}] Waiting for machine_status events via WebSocket...\n`);
  connectWebSocket(allDevices);
}

main().catch((err) => {
  console.error(`[${TB_INSTANCE}] Fatal:`, err.message);
  process.exit(1);
});
