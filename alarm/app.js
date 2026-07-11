"use strict";

// Alarm processor - MQTT Event-Driven
// Subscribes to MQTT and turns machine_status (4/5) + "alarms" into live_alarm.

const axios = require("axios");
const https = require("https");
const mqtt = require("mqtt");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { AlarmProcessor, parseAlarmsTelemetry, parseSeparateAlarmKeys } = require("./index");

const TB_BASE_URL = process.env.TB_BASE_URL;
const TB_USERNAME = process.env.TB_USERNAME;
const TB_PASSWORD = process.env.TB_PASSWORD;
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://yantra24x7.cloud:1884";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "test/#";
const DEBUG = String(process.env.MACRO_DEBUG || "") === "1";
const TB_INSECURE_TLS = String(process.env.TB_INSECURE_TLS || "") === "1";
const ALARMS_LIMIT = Number(process.env.ALARMS_LIMIT || 20);
// Customer IDs to EXCLUDE — no live_alarm is written or mirrored for their devices.
const ALARM_SKIP_CUSTOMERS = new Set(
  String(process.env.ALARM_SKIP_CUSTOMERS || "").split(",").map((s) => s.trim()).filter(Boolean)
);

// --- live_alarm -> device-alarm MQTT redirect ---
// Every live_alarm we post to ThingsBoard is also mirrored onto a second MQTT
// broker on the device's alarm topic, matching:
//   mosquitto_pub -q 1 -h yantra24x7.cloud -p 1885 \
//     -t machine/<deviceName>/alarm -i "<deviceName>" -m '{"live_alarm":{...}}'
const STATUS_MQTT_URL = process.env.STATUS_MQTT_URL || "mqtt://yantra24x7.cloud:1885";
const STATUS_REDIRECT = String(process.env.STATUS_REDIRECT || "1") !== "0"; // on by default

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
      // Accept both the `alarms` array AND separate alarm_message/_number/_type keys.
      keys: "alarms,alarm_message,alarm_number,alarm_type",
      startTs: now - 7 * 24 * 60 * 60 * 1000, // last 7 days window
      endTs: now,
      limit,
      useStrictDataTypes: false,
    },
  });
  const data = res.data || {};
  const fromAlarms = parseAlarmsTelemetry(Array.isArray(data.alarms) ? data.alarms : []);
  const fromSeparate = parseSeparateAlarmKeys({
    alarm_message: data.alarm_message,
    alarm_number: data.alarm_number,
    alarm_type: data.alarm_type,
  });
  return [...fromAlarms, ...fromSeparate];
}

// Build an array of raw alarm objects from a values bag that may carry an
// `alarms` array AND/OR separate alarm_message/alarm_number/alarm_type keys.
// Returns null when neither form is present.
function extractAlarmObjs(values) {
  if (!values || typeof values !== "object") return null;
  const objs = [];
  // (a) `alarms` array form — items may be plain objects, telemetry {ts,value},
  //     or JSON strings.
  if (Array.isArray(values.alarms)) {
    for (const raw of values.alarms) {
      const v = raw && raw.value !== undefined ? raw.value : raw;
      if (typeof v === "string") {
        try {
          const p = JSON.parse(v);
          (Array.isArray(p) ? p : [p]).forEach((o) => o && typeof o === "object" && objs.push(o));
        } catch {
          /* ignore unparseable */
        }
      } else if (v && typeof v === "object") {
        objs.push(v);
      }
    }
  }
  // (b) separate flat keys form.
  if (
    values.alarm_message !== undefined ||
    values.alarm_number !== undefined ||
    values.alarm_type !== undefined
  ) {
    const o = {};
    if (values.alarm_message !== undefined) o.alarm_message = values.alarm_message;
    if (values.alarm_number !== undefined) o.alarm_number = values.alarm_number;
    if (values.alarm_type !== undefined) o.alarm_type = values.alarm_type;
    objs.push(o);
  }
  return objs.length ? objs : null;
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

  // Mirror each posted live_alarm onto the device-alarm MQTT broker (best-effort;
  // never lets a redirect failure affect the TB write above).
  if (STATUS_REDIRECT) {
    const deviceName = deviceIdToName.get(deviceId);
    const liveAlarms = records
      .map((r) => r?.values?.live_alarm)
      .filter((v) => v !== undefined && v !== null);
    if (deviceName && liveAlarms.length) {
      await publishLiveAlarmStatuses(deviceName, liveAlarms);
    } else if (!deviceName && DEBUG) {
      console.log(`[alarm MQTT] no deviceName cached for ${deviceId}; skip redirect`);
    }
  }
}

// Publish each live_alarm to `machine/<deviceName>/alarm` on the redirect MQTT
// broker, connecting as the device itself (clientId = deviceName, QoS 1) — the
// Node equivalent of the mosquitto_pub sample. One short-lived connection per
// batch; all records for the device share it so the same clientId is never
// connected twice concurrently. Never throws.
function publishLiveAlarmStatuses(deviceName, liveAlarms) {
  return new Promise((resolve) => {
    if (!STATUS_REDIRECT || !deviceName || !liveAlarms.length) return resolve();
    const topic = `machine/${deviceName}/alarm`;
    let settled = false;
    let client;
    const finish = () => {
      if (settled) return;
      settled = true;
      try { client && client.end(true); } catch {}
      resolve();
    };
    const guard = setTimeout(() => {
      console.error(`[${deviceName}] alarm MQTT publish timed out`);
      finish();
    }, 15000);
    try {
      client = mqtt.connect(STATUS_MQTT_URL, {
        clientId: deviceName, // -i "<deviceName>"
        reconnectPeriod: 0,   // fire-and-forget; do not loop on failure
        connectTimeout: 10000,
      });
    } catch (err) {
      clearTimeout(guard);
      console.error(`[${deviceName}] alarm MQTT connect failed:`, err.message);
      return finish();
    }
    client.on("connect", async () => {
      for (const la of liveAlarms) {
        const message = JSON.stringify({ live_alarm: la });
        await new Promise((res) =>
          client.publish(topic, message, { qos: 1 }, (err) => {
            if (err) console.error(`[${deviceName}] alarm MQTT publish error:`, err.message);
            else if (DEBUG) console.log(`[${deviceName}] alarm -> ${STATUS_MQTT_URL} ${topic} ${message}`);
            res();
          })
        );
      }
      clearTimeout(guard);
      finish();
    });
    client.on("error", (err) => {
      clearTimeout(guard);
      console.error(`[${deviceName}] alarm MQTT error:`, err.message);
      finish();
    });
  });
}

const deviceState = new Map(); // deviceId -> { processor }
const deviceNameToId = new Map(); // deviceName -> { deviceId, customerId }
const deviceIdToName = new Map(); // deviceId -> deviceName (for the alarm MQTT redirect)
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
        if (deviceId && deviceName) {
          deviceNameToId.set(deviceName, { deviceId, customerId });
          deviceIdToName.set(deviceId, deviceName);
        }
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
    // Skip excluded customers entirely — do not write/mirror live_alarm for them.
    if (ALARM_SKIP_CUSTOMERS.has(customerId)) {
      if (DEBUG) console.log(`[${deviceName}] customer ${customerId} excluded — skipping live_alarm`);
      return;
    }
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
        // Inline details in THIS message (alarms array OR separate keys) take
        // precedence so openAlarm matches at this exact ts instead of UNKNOWN.
        if (Array.isArray(alarmsObjs) && alarmsObjs.length > 0) {
          alarmsTelemetry = [{ ts: statusTs, objs: alarmsObjs }, ...alarmsTelemetry];
        }
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
            const alarmsObjs = extractAlarmObjs(entry?.values);
            const machineStatus = entry?.values?.machine_status;
            const payload = machineStatus !== undefined ? { machine_status: machineStatus } : null;
            if (alarmsObjs || payload) {
              await processEvent(deviceName, payload, ts, alarmsObjs);
            }
          }
          return;
        }

        // Flat form: { deviceName, ts, machine_status, alarms | alarm_message,... }
        const ts = Number(data.ts) || Date.now();
        const payload = {};
        if (data.machine_status !== undefined) payload.machine_status = data.machine_status;
        // Accepts the `alarms` array AND/OR separate alarm_message/_number/_type keys.
        const alarmsObjs = extractAlarmObjs(data);

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
