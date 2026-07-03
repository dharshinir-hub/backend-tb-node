"use strict";

// ============================================================================
//  live_alarm -> MQTT BRIDGE
// ----------------------------------------------------------------------------
//  Publishes to machine/<deviceName>/alarm on the 1885 broker the live_alarm
//  records that OUR alarm container did NOT write — i.e. the ones posted
//  straight to ThingsBoard by MTLinki/FANUC agents (ATECH/SMC, etc.), which
//  never flow through our container and so never hit the redirect.
//
//  HOW:
//    * Every POLL_MS, one entitiesQuery call fetches the LATEST live_alarm +
//      name for every device.
//    * Records that carry `_wasShiftEnd` are OURS (already mirrored by the
//      alarm container's redirect) -> skipped.
//    * For the rest, we publish once per state change:
//        - open   (alarm_end == "-")        -> send once
//        - closed (alarm_end has a value)   -> send once
//      Dedup key per device = `alarm_start|alarm_end`; an unchanged state is
//      never re-sent.
//    * Startup: currently-OPEN external alarms are announced once; already
//      CLOSED historical ones are seeded silently (no backlog spam on restart).
// ============================================================================

const axios = require("axios");
const https = require("https");
const mqtt = require("mqtt");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const TB_BASE_URL = process.env.TB_BASE_URL;
const TB_USERNAME = process.env.TB_USERNAME;
const TB_PASSWORD = process.env.TB_PASSWORD;
const TB_INSECURE_TLS = String(process.env.TB_INSECURE_TLS || "") === "1";
const STATUS_MQTT_URL = process.env.STATUS_MQTT_URL || "mqtt://yantra24x7.cloud:1885";
const POLL_MS = Number(process.env.BRIDGE_POLL_MS || 5000);
const DRY_RUN = String(process.env.BRIDGE_DRY_RUN || "") === "1";
const DEBUG = String(process.env.MACRO_DEBUG || "") === "1";

if (!TB_BASE_URL || !TB_USERNAME || !TB_PASSWORD) {
  console.error("Missing config. Set TB_BASE_URL, TB_USERNAME, TB_PASSWORD in ../.env");
  process.exit(1);
}

const axiosTb = axios.create(
  TB_INSECURE_TLS ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) } : {}
);

let jwt = null;
async function login() {
  const res = await axiosTb.post(
    `${TB_BASE_URL}/api/auth/login`,
    { username: TB_USERNAME, password: TB_PASSWORD },
    { headers: { "Content-Type": "application/json" } }
  );
  jwt = res.data.token;
}
async function ensureJwt() {
  if (!jwt) await login();
  return jwt;
}

// One entitiesQuery per page -> [{ name, ts, value }] for the latest live_alarm.
async function fetchLatestLiveAlarms() {
  const out = [];
  let page = 0;
  while (true) {
    const body = {
      entityFilter: { type: "entityType", entityType: "DEVICE" },
      pageLink: { pageSize: 1000, page },
      entityFields: [{ type: "ENTITY_FIELD", key: "name" }],
      latestValues: [{ type: "TIME_SERIES", key: "live_alarm" }],
    };
    const res = await axiosTb.post(`${TB_BASE_URL}/api/entitiesQuery/find`, body, {
      headers: { "X-Authorization": `Bearer ${await ensureJwt()}` },
    });
    const data = res.data?.data || [];
    for (const d of data) {
      const name = d.latest?.ENTITY_FIELD?.name?.value;
      const la = d.latest?.TIME_SERIES?.live_alarm;
      if (name && la && la.value) out.push({ name, ts: Number(la.ts), value: la.value });
    }
    if (!res.data?.hasNext) break;
    page += 1;
  }
  return out;
}

// Persistent publisher connection (own clientId; never clashes with a device).
let mqttClient = null;
function connectMqtt() {
  mqttClient = mqtt.connect(STATUS_MQTT_URL, {
    clientId: "alarm-bridge",
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });
  mqttClient.on("connect", () => console.log(`✓ bridge connected to ${STATUS_MQTT_URL}`));
  mqttClient.on("error", (e) => console.error("bridge MQTT error:", e.message));
  mqttClient.on("reconnect", () => DEBUG && console.log("bridge MQTT reconnecting..."));
}

function publishAlarm(deviceName, liveAlarm) {
  const topic = `machine/${deviceName}/alarm`;
  const payload = JSON.stringify({ live_alarm: liveAlarm });
  if (DRY_RUN) {
    console.log(`[DRY] would publish -> ${topic} ${payload}`);
    return;
  }
  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) console.error(`[${deviceName}] bridge publish error:`, err.message);
    else if (DEBUG) console.log(`[${deviceName}] bridge -> ${topic} ${payload}`);
  });
}

// deviceName -> last published `alarm_start|alarm_end` signature.
const lastSent = new Map();
let seeded = false;

async function pollOnce() {
  let rows;
  try {
    rows = await fetchLatestLiveAlarms();
  } catch (e) {
    if (e.response?.status === 401) jwt = null; // force re-login next cycle
    console.error("[BRIDGE] fetch error:", e.response?.status || e.message);
    return;
  }

  let published = 0;
  for (const r of rows) {
    let v;
    try {
      v = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
    } catch {
      continue;
    }
    if (!v || typeof v !== "object") continue;

    // OURS (alarm container) -> already mirrored via the redirect. Skip.
    if (Object.prototype.hasOwnProperty.call(v, "_wasShiftEnd")) continue;

    // Normalize an open alarm's end to "-".
    const end = v.alarm_end === undefined || v.alarm_end === null || v.alarm_end === "" ? "-" : v.alarm_end;
    v.alarm_end = end;
    const sig = `${v.alarm_start}|${end}`;

    if (lastSent.get(r.name) === sig) continue; // unchanged -> skip

    // On first cycle, seed already-CLOSED alarms silently (no restart backlog);
    // still announce currently-OPEN ones once.
    if (!seeded && end !== "-") {
      lastSent.set(r.name, sig);
      continue;
    }

    publishAlarm(r.name, v);
    lastSent.set(r.name, sig);
    published += 1;
  }
  seeded = true;
  if (published || DEBUG) {
    console.log(`[BRIDGE] cycle: ${rows.length} devices scanned, ${published} published`);
  }
}

async function main() {
  console.log(
    `🔗 live_alarm -> MQTT bridge starting  poll=${POLL_MS}ms  ${DRY_RUN ? "DRY RUN" : "LIVE"}  -> ${STATUS_MQTT_URL}`
  );
  await login();
  if (!DRY_RUN) connectMqtt();
  const tick = async () => {
    try {
      await pollOnce();
    } catch (e) {
      console.error("[BRIDGE] tick error:", e.message);
    }
    setTimeout(tick, POLL_MS);
  };
  tick();
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
