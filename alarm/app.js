"use strict";

// Alarm processor - MQTT Event-Driven
// Subscribes to MQTT and turns machine_status (4/5) + "alarms" into live_alarm.

const axios = require("axios");
const https = require("https");
const mqtt = require("mqtt");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { AlarmProcessor, parseAlarmsTelemetry } = require("./index");

const TB_BASE_URL = process.env.TB_BASE_URL;
const TB_USERNAME = process.env.TB_USERNAME;
const TB_PASSWORD = process.env.TB_PASSWORD;
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://yantra24x7.cloud:1884";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "test/#";
const DEBUG = String(process.env.MACRO_DEBUG || "") === "1";
const TB_INSECURE_TLS = String(process.env.TB_INSECURE_TLS || "") === "1";
const ALARMS_LIMIT = Number(process.env.ALARMS_LIMIT || 20);

if (!TB_BASE_URL || !TB_USERNAME || !TB_PASSWORD) {
  console.error("Missing config. Set TB_BASE_URL, TB_USERNAME, and TB_PASSWORD in tb-code/.env");
  process.exit(1);
}

const axiosTb = axios.create(
  TB_INSECURE_TLS ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) } : {}
);

async function login() {
  const url = `${TB_BASE_URL}/api/auth/login`;
  const res = await axiosTb.post(
    url,
    { username: TB_USERNAME, password: TB_PASSWORD },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data.token;
}

async function listCustomersPage(jwt, page) {
  const res = await axiosTb.get(`${TB_BASE_URL}/api/customers`, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
    params: { pageSize: 100, page },
  });
  return res.data;
}

async function listAllCustomers(jwt) {
  const customers = [];
  let page = 0;
  while (true) {
    const pageData = await listCustomersPage(jwt, page);
    customers.push(...(pageData.data || []));
    if (!pageData.hasNext) break;
    page += 1;
  }
  return customers;
}

async function listDevicesPage(jwt, customerId, page) {
  const res = await axiosTb.get(`${TB_BASE_URL}/api/customer/${customerId}/devices`, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
    params: { pageSize: 100, page },
  });
  return res.data;
}

async function listAllDevicesForCustomer(jwt, customerId) {
  const devices = [];
  let page = 0;
  while (true) {
    const pageData = await listDevicesPage(jwt, customerId, page);
    devices.push(...(pageData.data || []));
    if (!pageData.hasNext) break;
    page += 1;
  }
  return devices;
}

async function getCustomerAttributes(jwt, customerId) {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes`,
    {
      headers: { "X-Authorization": `Bearer ${jwt}` },
      params: { keys: "allShift" },
    }
  );
  return res.data;
}

function parseAttr(attributes, key) {
  if (!Array.isArray(attributes)) return null;
  const entry = attributes.find((a) => a.key === key);
  if (!entry) return null;
  const value = entry.value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

// Fetch the last N "alarms" telemetry entries for open-time matching.
async function getAlarmsTelemetry(jwt, deviceId, limit = ALARMS_LIMIT) {
  const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
  const now = Date.now();
  const res = await axiosTb.get(url, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
    params: {
      keys: "alarms",
      startTs: now - 7 * 24 * 60 * 60 * 1000, // last 7 days window
      endTs: now,
      limit,
      useStrictDataTypes: false,
    },
  });
  const list = res.data?.alarms || [];
  return parseAlarmsTelemetry(Array.isArray(list) ? list : []);
}

async function getLatestLiveAlarm(jwt, deviceId) {
  const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
  const res = await axiosTb.get(url, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
    params: { keys: "live_alarm", limit: 1, useStrictDataTypes: false },
  });
  const list = res.data?.live_alarm || [];
  if (!Array.isArray(list) || list.length === 0) return null;
  let value = list[0]?.value;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  return { ts: Number(list[0].ts), value };
}

async function postTelemetry(jwt, deviceId, records) {
  if (!records.length) return;
  const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/timeseries/TELEMETRY`;
  if (DEBUG) {
    records.forEach((r, i) => {
      const a = r.values?.live_alarm;
      if (a) {
        console.log(
          `  [${i}] ts=${r.ts} msg="${a.alarm_message}" num=${a.alarm_number} start=${a.alarm_start} end=${a.alarm_end} dur=${a.alarm_duration}`
        );
      }
    });
  }
  await axiosTb.post(url, records, { headers: { "X-Authorization": `Bearer ${jwt}` } });
}

const deviceState = new Map(); // deviceId -> { processor }
const deviceNameToId = new Map(); // deviceName -> { deviceId, customerId }
let cachedToken = null;
let mqttClient = null;

async function ensureToken() {
  if (!cachedToken) cachedToken = await login();
  return cachedToken;
}

async function initializeDeviceCache() {
  try {
    const token = await ensureToken();
    const customers = await listAllCustomers(token);
    for (const customer of customers) {
      const customerId = customer.id?.id;
      if (!customerId) continue;
      const devices = await listAllDevicesForCustomer(token, customerId);
      for (const device of devices) {
        const deviceId = device.id?.id;
        const deviceName = device.name;
        if (deviceId && deviceName) deviceNameToId.set(deviceName, { deviceId, customerId });
      }
    }
    console.log(`[INIT] Cached ${deviceNameToId.size} devices`);
  } catch (err) {
    console.error("Error initializing device cache:", err.message);
  }
}

async function ensureState(token, deviceId, customerId) {
  let state = deviceState.get(deviceId);
  if (!state) {
    const custAttrs = await getCustomerAttributes(token, customerId);
    const allShift = parseAttr(custAttrs, "allShift") || [];
    state = { processor: new AlarmProcessor({ shifts: allShift }) };
    // Restore an open episode from DB if the service restarted mid-alarm.
    const latest = await getLatestLiveAlarm(token, deviceId);
    if (latest && state.processor.restoreOpen(latest.value)) {
      console.log(`[INIT] Restored open alarm for ${deviceId}, start=${latest.value.alarm_start}`);
    }
    deviceState.set(deviceId, state);
  } else {
    const custAttrs = await getCustomerAttributes(token, customerId);
    const allShift = parseAttr(custAttrs, "allShift") || [];
    state.processor.setShifts(allShift);
  }
  return state;
}

// payload: flat object with machine_status and/or alarms, plus ts.
// alarmsObjs: array of raw alarm objects (from the alarms MQTT envelope), or null.
async function processEvent(deviceName, payload, ts, alarmsObjs) {
  try {
    const token = await ensureToken();
    const deviceInfo = deviceNameToId.get(deviceName);
    if (!deviceInfo) {
      if (DEBUG) console.log(`[${deviceName}] Device not found in cache`);
      return;
    }
    const { deviceId, customerId } = deviceInfo;
    const state = await ensureState(token, deviceId, customerId);
    const out = [];

    // ALARMS message (from "alarms" key / timeseries envelope) -> overwrite.
    if (Array.isArray(alarmsObjs) && alarmsObjs.length > 0) {
      if (DEBUG) console.log(`[${deviceName}] alarms message ts=${ts}: ${JSON.stringify(alarmsObjs)}`);
      out.push(...state.processor.handleAlarms(alarmsObjs, ts));
    }

    // MACHINE_STATUS -> open/close/split alarm episodes.
    if (payload && payload.machine_status !== undefined) {
      const statusTs = Number(ts);
      const code = Number(payload.machine_status);
      if (DEBUG) console.log(`[${deviceName}] machine_status=${code}, ts=${statusTs}`);
      let alarmsTelemetry = [];
      // Only need telemetry when an alarm may OPEN (4/5 with no open episode).
      if (state.processor.isAlarmStatus(code) && !state.processor.open) {
        alarmsTelemetry = await getAlarmsTelemetry(token, deviceId);
      }
      out.push(...state.processor.handleMachineStatus({ value: code, ts: statusTs }, alarmsTelemetry));
    }

    // Catch-up shift boundaries + collect timer-fired events.
    out.push(...state.processor.rollover(Date.now()));
    out.push(...state.processor.getPendingEvents());

    if (out.length) {
      console.log(`[${deviceName}] posting ${out.length} live_alarm record(s)`);
      await postTelemetry(token, deviceId, out);
    }
  } catch (err) {
    if (err.response?.status === 401) cachedToken = null;
    const msg =
      err.response?.data?.message || err.response?.data?.error || err.message || "Unknown error";
    console.error(`[${deviceName}] Error:`, msg);
  }
}

async function connectMQTT() {
  return new Promise((resolve, reject) => {
    mqttClient = mqtt.connect(MQTT_BROKER, { reconnectPeriod: 5000, connectTimeout: 10000 });

    mqttClient.on("connect", () => {
      console.log(`✓ Connected to MQTT broker: ${MQTT_BROKER}`);
      mqttClient.subscribe(MQTT_TOPIC, (err) => {
        if (err) {
          console.error(`✗ Failed to subscribe to ${MQTT_TOPIC}:`, err);
          reject(err);
        } else {
          console.log(`✓ Subscribed to topic: ${MQTT_TOPIC}`);
          resolve();
        }
      });
    });

    mqttClient.on("message", async (topic, message) => {
      try {
        const data = JSON.parse(message.toString());

        let deviceName = data.deviceName;
        if (!deviceName && topic) {
          const parts = topic.split("/");
          const last = parts[parts.length - 1];
          if (last && last !== "#" && last !== "test" && last.trim()) deviceName = last;
        }
        if (!deviceName) deviceName = "test"; // default device for testing

        // Envelope form: { timeseries: [{ ts, values: { alarms: [...] } }], ... }
        if (Array.isArray(data.timeseries)) {
          for (const entry of data.timeseries) {
            const ts = Number(entry?.ts) || Date.now();
            const alarmsObjs = entry?.values?.alarms;
            const machineStatus = entry?.values?.machine_status;
            const payload = machineStatus !== undefined ? { machine_status: machineStatus } : null;
            if (Array.isArray(alarmsObjs) || payload) {
              await processEvent(deviceName, payload, ts, Array.isArray(alarmsObjs) ? alarmsObjs : null);
            }
          }
          return;
        }

        // Flat form: { deviceName, ts, machine_status, alarms }
        const ts = Number(data.ts) || Date.now();
        const payload = {};
        if (data.machine_status !== undefined) payload.machine_status = data.machine_status;
        // Flat "alarms" may be already-parsed objects or telemetry [{ts,value}].
        let alarmsObjs = null;
        if (Array.isArray(data.alarms)) {
          alarmsObjs = data.alarms
            .map((a) => (a && a.value !== undefined ? a.value : a))
            .flatMap((v) => {
              if (typeof v === "string") {
                try {
                  const p = JSON.parse(v);
                  return Array.isArray(p) ? p : [p];
                } catch {
                  return [];
                }
              }
              return [v];
            })
            .filter((o) => o && typeof o === "object");
        }

        if (Object.keys(payload).length === 0 && !alarmsObjs) return;
        await processEvent(deviceName, payload, ts, alarmsObjs);
      } catch (err) {
        console.error("Error processing MQTT message:", err.message);
      }
    });

    mqttClient.on("error", (err) => console.error("MQTT error:", err.message));
    mqttClient.on("disconnect", () => console.log("Disconnected from MQTT broker"));
  });
}

async function main() {
  console.log("🚨 Starting Alarm Processor (MQTT Event-Driven)...");
  console.log(`   MQTT Broker: ${MQTT_BROKER}`);
  console.log(`   Topic: ${MQTT_TOPIC}`);

  await initializeDeviceCache();
  await connectMQTT();

  // Poll for shift-end timer events so boundary records post even when idle.
  setInterval(async () => {
    try {
      for (const [deviceId, state] of deviceState.entries()) {
        const out = [];
        out.push(...state.processor.rollover(Date.now()));
        out.push(...state.processor.getPendingEvents());
        if (out.length > 0 && cachedToken) {
          console.log(`[POLL] Posting ${out.length} shift-end alarm record(s) for ${deviceId}`);
          await postTelemetry(cachedToken, deviceId, out);
        }
      }
    } catch (err) {
      console.error("[POLL] Error:", err.message);
    }
  }, 2000);

  console.log("✓ Service ready. Waiting for MQTT events...");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
