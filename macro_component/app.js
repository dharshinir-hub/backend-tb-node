"use strict";

// Macro Component/Reason/Operator processor - MQTT Event-Driven
// Subscribes to MQTT topic and processes events in real-time

const axios = require("axios");
const https = require("https");
const mqtt = require("mqtt");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
  MacroComponentProcessor,
  MacroReasonProcessor,
  MacroOperatorProcessor
} = require("./index");

const TB_BASE_URL = process.env.TB_BASE_URL;
const TB_USERNAME = process.env.TB_USERNAME;
const TB_PASSWORD = process.env.TB_PASSWORD;
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://yantra24x7.cloud:1884";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "test/#";  // Use wildcard to capture device name
const DEBUG = String(process.env.MACRO_DEBUG || "") === "1";
const TB_INSECURE_TLS = String(process.env.TB_INSECURE_TLS || "") === "1";

if (!TB_BASE_URL || !TB_USERNAME || !TB_PASSWORD) {
  console.error(
    "Missing config. Set TB_BASE_URL, TB_USERNAME, and TB_PASSWORD in tb-code/.env"
  );
  process.exit(1);
}

const axiosTb = axios.create(
  TB_INSECURE_TLS
    ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
    : {}
);

async function login() {
  const url = `${TB_BASE_URL}/api/auth/login`;
  const payload = { username: TB_USERNAME, password: TB_PASSWORD };
  const res = await axiosTb.post(url, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data.token;
}

async function listCustomersPage(jwt, page) {
  const url = `${TB_BASE_URL}/api/customers`;
  const res = await axiosTb.get(url, {
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
  const url = `${TB_BASE_URL}/api/customer/${customerId}/devices`;
  const res = await axiosTb.get(url, {
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
  const url = `${TB_BASE_URL}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes`;
  const res = await axiosTb.get(url, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
    params: { keys: "allShift,component,reason,alloperator" },
  });
  return res.data;
}

function roundToSecond(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n)) return n;
  return Math.round(n / 1000) * 1000;
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

async function getRoutecards(jwt, deviceId, startTs, endTs) {
  const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
  const res = await axiosTb.get(url, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
    params: {
      keys: "route_card",
      startTs,
      endTs,
      limit: 1000,
      useStrictDataTypes: false,
    },
  });
  const list = res.data?.route_card || [];
  return Array.isArray(list) ? list : [];
}

async function getReasonIds(jwt, deviceId, startTs, endTs) {
  const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
  const res = await axiosTb.get(url, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
    params: {
      keys: "idle_reason",
      startTs,
      endTs,
      limit: 1000,
      useStrictDataTypes: false,
    },
  });
  const list = res.data?.idle_reason || [];
  return Array.isArray(list) ? list : [];
}

async function getOperatorIds(jwt, deviceId, startTs, endTs) {
  const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
  const res = await axiosTb.get(url, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
    params: {
      keys: "operator_id",
      startTs,
      endTs,
      limit: 1000,
      useStrictDataTypes: false,
    },
  });
  const list = res.data?.operator_id || [];
  return Array.isArray(list) ? list : [];
}

async function getMachineStatus(jwt, deviceId, limit = 10) {
  const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
  const now = Date.now();
  const startTs = now - (24 * 60 * 60 * 1000); // Last 24 hours of data

  const res = await axiosTb.get(url, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
    params: {
      keys: "machine_status",
      startTs,
      endTs: now,
      limit,
      useStrictDataTypes: false,
    },
  });
  const list = res.data?.machine_status || [];
  return Array.isArray(list) ? list : [];
}

async function getLatestLiveComponent(jwt, deviceId) {
  const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
  const res = await axiosTb.get(url, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
    params: {
      keys: "live_component",
      limit: 1,
      useStrictDataTypes: false,
    },
  });
  const list = res.data?.live_component || [];
  if (!Array.isArray(list) || list.length === 0) return null;
  const item = list[0];
  let value = item?.value;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  return { ts: Number(item.ts), value };
}

async function getLatestLiveReason(jwt, deviceId) {
  const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
  const res = await axiosTb.get(url, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
    params: {
      keys: "live_reason",
      limit: 1,
      useStrictDataTypes: false,
    },
  });
  const list = res.data?.live_reason || [];
  if (!Array.isArray(list) || list.length === 0) return null;
  const item = list[0];
  let value = item?.value;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  return { ts: Number(item.ts), value };
}

async function getLatestLiveOperator(jwt, deviceId) {
  const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
  const res = await axiosTb.get(url, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
    params: {
      keys: "live_operator",
      limit: 1,
      useStrictDataTypes: false,
    },
  });
  const list = res.data?.live_operator || [];
  if (!Array.isArray(list) || list.length === 0) return null;
  const item = list[0];
  let value = item?.value;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  return { ts: Number(item.ts), value };
}

async function deleteTelemetry(jwt, deviceId, key, ts) {
  // Delete a specific telemetry value at a given timestamp
  const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/timeseries/TELEMETRY?keys=${key}&startTs=${ts}&endTs=${ts}`;
  try {
    await axiosTb.delete(url, {
      headers: { "X-Authorization": `Bearer ${jwt}` },
    });
    console.log(`[TELEMETRY] Deleted ${key} at ts=${ts}`);
  } catch (err) {
    console.log(`[TELEMETRY] Delete failed for ${key} at ts=${ts}: ${err.message}`);
  }
}

async function postTelemetry(jwt, deviceId, records) {
  if (!records.length) return;
  const url = `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/timeseries/TELEMETRY`;

  // Log what we're posting for debugging
  const componentRecords = records.filter(r => r.values?.live_component);
  if (componentRecords.length > 0) {
    console.log(`[TELEMETRY] Posting ${componentRecords.length} component records:`);
    componentRecords.forEach((r, idx) => {
      const lc = r.values.live_component;
      console.log(`  [${idx}] ts=${r.ts}, code=${lc.code}, start=${lc.start_time}, end=${lc.end_time}, duration=${lc.duration}`);
    });
  }

  await axiosTb.post(url, records, {
    headers: { "X-Authorization": `Bearer ${jwt}` },
  });
}

const deviceState = new Map();
const deviceNameToId = new Map();
let cachedToken = null;
let mqttClient = null;
let isInitialized = false;

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
        }
      }
    }

    if (DEBUG) {
      console.log(`[INIT] Cached ${deviceNameToId.size} devices`);
    }
    isInitialized = true;
  } catch (err) {
    console.error("Error initializing device cache:", err.message);
  }
}

async function processEvent(deviceName, payload, ts) {
  try {
    const token = await ensureToken();
    const deviceInfo = deviceNameToId.get(deviceName);

    if (!deviceInfo) {
      if (DEBUG) console.log(`[${deviceName}] Device not found in cache`);
      return;
    }

    const { deviceId, customerId } = deviceInfo;
    const out = [];
    let state = deviceState.get(deviceId);
    const now = Date.now();

    // ROUTECARD EVENT: Fetch allShift + component
    if (payload.route_card) {
      const custAttrs = await getCustomerAttributes(token, customerId);
      const allShift = parseAttr(custAttrs, "allShift") || [];
      const component = parseAttr(custAttrs, "component") || [];
      console.log(`[${deviceName}] Fetched component attribute: ${component.length} items`)
      if (component.length > 0) {
        console.log(`[${deviceName}] First component sample: ${JSON.stringify(component[0], null, 2)}`);
      }

      if (!state) {
        state = {
          componentProcessor: new MacroComponentProcessor({ components: component, shifts: allShift }),
          reasonProcessor: new MacroReasonProcessor({ reasons: [], shifts: allShift }),
          operatorProcessor: new MacroOperatorProcessor({ operators: [], shifts: allShift }),
        };
        deviceState.set(deviceId, state);
      } else {
        state.componentProcessor.setComponents(component);
        state.componentProcessor.setShifts(allShift);
      }

      // Handle both single route_card and array of component events
      const routecardEvents = Array.isArray(payload.route_card)
        ? payload.route_card
        : [{ value: payload.route_card, ts }];

      for (const rcEvent of routecardEvents) {
        const rcTs = roundToSecond(Number(rcEvent.ts) || ts);
        const rcValue = rcEvent.value || rcEvent;
        if (DEBUG) console.log(`[${deviceName}] route_card: ${rcValue}, ts: ${rcTs}`);

        // Check if routecard matches a known component
        const { components } = state.componentProcessor;
        const comp = components.find(c => String(c.component_number) === String(rcValue));
        console.log(`[${deviceName}] [DEBUG] Component match: comp=${comp ? comp.component_number : "NOT_FOUND"}`);

        // Fetch latest record from database to check if it's open
        const latestRecord = await getLatestLiveComponent(token, deviceId);
        console.log(`[${deviceName}] [DEBUG] Latest record fetched: ${latestRecord ? `code=${latestRecord.value.code}, end_time=${latestRecord.value.end_time}, start_time=${latestRecord.value.start_time}` : "NULL"}`);

        if (latestRecord) {
          // Check if it's an open record: end_time === shift_end calculated at record's start time
          const recordShiftEnd = state.componentProcessor.findShiftEndTime(latestRecord.value.start_time, allShift);
          const isOpen = latestRecord.value.end_time === recordShiftEnd;
          console.log(`[${deviceName}] [DEBUG] recordShiftEnd=${recordShiftEnd}, isOpen=${isOpen}, !comp=${!comp}`);

          if (isOpen && !comp) {
            // Unknown routecard + open record exists → close it without creating new record
            console.log(`[${deviceName}] [CLOSE] Unknown component ${rcValue}, closing open record code=${latestRecord.value.code} with end_time=${rcTs}`);

            // Clear any pending shift-end timer events to prevent re-posting the open record
            state.componentProcessor.clearPendingEvents();
            console.log(`[${deviceName}] [CLOSE] Cleared pending shift-end timer events`);

            // Reset processor's current state so it doesn't think there's an open record
            state.componentProcessor.current = null;
            console.log(`[${deviceName}] [CLOSE] Reset processor state`);

            const closedRecord = {
              ...latestRecord.value,
              end_time: rcTs,
              duration: Math.round((rcTs - latestRecord.value.start_time) / 1000),
              _wasShiftEnd: false
            };
            console.log(`[${deviceName}] [CLOSE] Posting closed record:`, JSON.stringify(closedRecord, null, 2));
            out.push({
              ts: latestRecord.value.start_time,  // Post with original start_time
              values: { live_component: closedRecord }
            });
            continue;  // Skip handleRoutecard for unknown component
          }
        }

        const events = state.componentProcessor.handleRoutecard({ value: rcValue, ts: rcTs });
        if (DEBUG && events.length) {
          console.log(`[${deviceName}] Component output:`, JSON.stringify(events[0]?.values?.live_component, null, 2));
        }
        out.push(...events);
      }
    }

    // OPERATOR EVENT: Fetch allShift + alloperator
    if (payload.operator_id) {
      const custAttrs = await getCustomerAttributes(token, customerId);
      const allShift = parseAttr(custAttrs, "allShift") || [];
      const alloperator = parseAttr(custAttrs, "alloperator") || [];

      if (!state) {
        state = {
          componentProcessor: new MacroComponentProcessor({ components: [], shifts: allShift }),
          reasonProcessor: new MacroReasonProcessor({ reasons: [], shifts: allShift }),
          operatorProcessor: new MacroOperatorProcessor({ operators: alloperator, shifts: allShift }),
        };
        deviceState.set(deviceId, state);
      } else {
        state.operatorProcessor.setOperators(alloperator);
        state.operatorProcessor.setShifts(allShift);
      }

      // Handle both single operator_id and array of operator events
      const operatorEvents = Array.isArray(payload.operator_id)
        ? payload.operator_id
        : [{ value: payload.operator_id, ts }];

      for (const opEvent of operatorEvents) {
        const opTs = roundToSecond(Number(opEvent.ts) || ts);
        const opValue = opEvent.value || opEvent;
        if (DEBUG) console.log(`[${deviceName}] operator_id: ${opValue}, ts: ${opTs}`);

        const events = state.operatorProcessor.handleOperator({ value: opValue, ts: opTs });
        if (DEBUG && events.length) {
          console.log(`[${deviceName}] Operator output:`, JSON.stringify(events[0]?.values?.live_operator, null, 2));
        }
        console.log(`[${deviceName}] [INCOMING] operator_id=${opValue}, ts=${opTs}, currentTsInProcessor=${state.operatorProcessor.current?.ts}, events_returned=${events.length}`);
        out.push(...events);
      }
    }

    // REASON EVENT: Fetch allShift + reason + machine_status from device
    if (payload.idle_reason) {
      const custAttrs = await getCustomerAttributes(token, customerId);
      const allShift = parseAttr(custAttrs, "allShift") || [];
      const reason = parseAttr(custAttrs, "reason") || [];
      const machineStatusArray = await getMachineStatus(token, deviceId, 30);  // Increased from 10 to 30 to find transition point

      if (!state) {
        state = {
          componentProcessor: new MacroComponentProcessor({ components: [], shifts: allShift }),
          reasonProcessor: new MacroReasonProcessor({ reasons: reason, shifts: allShift }),
          operatorProcessor: new MacroOperatorProcessor({ operators: [], shifts: allShift }),
        };
        deviceState.set(deviceId, state);
      } else {
        state.reasonProcessor.setReasons(reason);
        state.reasonProcessor.setShifts(allShift);
      }

      // Handle both single idle_reason and array of reason events
      const reasonEvents = Array.isArray(payload.idle_reason)
        ? payload.idle_reason
        : [{ value: payload.idle_reason, ts }];

      for (const rEvent of reasonEvents) {
        const rTs = roundToSecond(Number(rEvent.ts) || ts);
        const rValue = rEvent.value || rEvent;
        if (DEBUG) console.log(`[${deviceName}] idle_reason: ${rValue}, ts: ${rTs}`);

        const events = state.reasonProcessor.handleReason(
          { value: rValue, ts: rTs },
          machineStatusArray
        );
        if (DEBUG && events.length) {
          console.log(`[${deviceName}] Reason output:`, JSON.stringify(events[0]?.values?.live_reason, null, 2));
        }
        out.push(...events);
      }
    }

    // MACHINE_STATUS EVENT: Save to memory + Close idle reason if machine became active
    if (payload.machine_status !== undefined) {
      if (DEBUG) console.log(`[${deviceName}] machine_status: ${payload.machine_status}, ts: ${ts}`);

      // Initialize state if not exists (machine_status might arrive before idle_reason)
      if (!state) {
        const custAttrs = await getCustomerAttributes(token, customerId);
        const allShift = parseAttr(custAttrs, "allShift") || [];
        state = {
          componentProcessor: new MacroComponentProcessor({ components: [], shifts: allShift }),
          reasonProcessor: new MacroReasonProcessor({ reasons: [], shifts: allShift }),
          operatorProcessor: new MacroOperatorProcessor({ operators: [], shifts: allShift }),
        };
        deviceState.set(deviceId, state);
      }

      // ALWAYS save latest machine_status in memory (even if no open reason record yet)
      if (state && state.reasonProcessor) {
        state.reasonProcessor.latestMachineStatus = { ts, value: Number(payload.machine_status) };
        console.log(`[MACHINE_STATUS] Saved to memory: ts=${ts}, value=${Number(payload.machine_status)}`);
      }

      // Only try to close records if there's a current open reason
      if (state && state.reasonProcessor && state.reasonProcessor.current) {
        const custAttrs = await getCustomerAttributes(token, customerId);
        const allShift = parseAttr(custAttrs, "allShift") || [];
        state.reasonProcessor.setShifts(allShift);

        // Optionally fetch machine_status for validation (not strictly needed for handleMachineStatus)
        const events = state.reasonProcessor.handleMachineStatus(
          { value: payload.machine_status, ts },
          allShift
        );
        if (DEBUG && events.length) {
          console.log(`[${deviceName}] Machine status closed reason:`, JSON.stringify(events[0]?.values?.live_reason, null, 2));
        }
        out.push(...events);
      }
    }

    // Perform shift rollovers for all processors
    if (state) {
      const componentRollovers = state.componentProcessor.rollover(now);
      const reasonRollovers = state.reasonProcessor.rollover(now);
      const operatorRollovers = state.operatorProcessor.rollover(now);
      out.push(...componentRollovers, ...reasonRollovers, ...operatorRollovers);
    }

    // Collect pending events from shift-end timers (these fire automatically at shift boundaries)
    if (state) {
      const componentPending = state.componentProcessor.getPendingEvents();
      const reasonPending = state.reasonProcessor.getPendingEvents();
      const operatorPending = state.operatorProcessor.getPendingEvents();
      if (componentPending.length > 0) {
        console.log(`[${deviceName}] [TIMER] Component shift-end triggered: ${componentPending.length} events`);
        out.push(...componentPending);
      }
      if (reasonPending.length > 0) {
        console.log(`[${deviceName}] [TIMER] Reason shift-end triggered: ${reasonPending.length} events`);
        out.push(...reasonPending);
      }
      if (operatorPending.length > 0) {
        console.log(`[${deviceName}] [TIMER] Operator shift-end triggered: ${operatorPending.length} events`);
        out.push(...operatorPending);
      }
    }

    // Post results
    if (out.length) {
      if (DEBUG) console.log(`[${deviceName}] posted ${out.length} events`);
      // Log all operator events being posted
      const operatorEvents = out.filter(e => e.values?.live_operator);
      if (operatorEvents.length > 0) {
        console.log(`[${deviceName}] [DETAIL] Operator events being posted: ${operatorEvents.length}`);
        operatorEvents.forEach((e, idx) => {
          const liveOp = e.values.live_operator;
          console.log(`  [${idx}] ts=${e.ts}, start=${liveOp.start_time}, end=${liveOp.end_time}, name=${liveOp.name}`);
        });
      }
      await postTelemetry(token, deviceId, out);
    }
  } catch (err) {
    if (err.response?.status === 401) cachedToken = null;
    const msg =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      "Unknown error";
    console.error(`[${deviceName}] Error:`, msg);
  }
}

async function connectMQTT() {
  return new Promise((resolve, reject) => {
    mqttClient = mqtt.connect(MQTT_BROKER, {
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    });

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

        // Extract device name and timestamp
        let deviceName = data.deviceName;
        let ts = roundToSecond(Number(data.ts) || Date.now());
        let payload = { ...data };

        // If deviceName not in message, try to extract from topic
        // Pattern: test/{deviceName} or test/device-name
        if (!deviceName && topic) {
          const topicParts = topic.split("/");
          if (topicParts.length >= 2) {
            // Get the last part after "test/"
            deviceName = topicParts[topicParts.length - 1];
            if (deviceName === "#" || deviceName === "test" || !deviceName.trim()) {
              deviceName = null;
            }
          }
        }

        // Remove metadata fields from payload
        delete payload.deviceName;
        delete payload.deviceType;
        delete payload.ts;

        if (DEBUG) {
          console.log(`[MQTT] Topic: ${topic}`);
          console.log(`[MQTT] Device: ${deviceName || "UNDEFINED"}`);
          console.log(`[MQTT] Payload:`, payload);
        }

        // TEMPORARY: Use "test" as default device name if not found
        // This is a workaround until MQTT rule node is properly configured
        if (!deviceName) {
          deviceName = "test";  // Default device name for testing
          if (DEBUG) console.log(`[MQTT] Using default device: ${deviceName}`);
        }

        if (deviceName && Object.keys(payload).length > 0) {
          if (DEBUG) console.log(`[MQTT] ✓ Processing for device: ${deviceName}`);
          await processEvent(deviceName, payload, ts);
        } else if (deviceName && Object.keys(payload).length === 0) {
          console.log(`[MQTT] Skipping empty payload for ${deviceName}`);
        }
      } catch (err) {
        console.error("Error processing MQTT message:", err.message);
      }
    });

    mqttClient.on("error", (err) => {
      console.error("MQTT error:", err.message);
    });

    mqttClient.on("disconnect", () => {
      console.log("Disconnected from MQTT broker");
    });
  });
}

async function main() {
  console.log("🚀 Starting Macro Processor (MQTT Event-Driven)...");
  console.log(`   MQTT Broker: ${MQTT_BROKER}`);
  console.log(`   Topic: ${MQTT_TOPIC}`);

  // Initialize device cache
  await initializeDeviceCache();

  // Connect to MQTT
  await connectMQTT();

  // Polling mechanism: Check for pending timer events every 2 seconds
  // This ensures shift-end boundary records are posted even if no MQTT event arrives
  setInterval(async () => {
    try {
      for (const [deviceId, state] of deviceState.entries()) {
        const now = Date.now();
        let out = [];

        // Collect pending events from shift-end timers
        const componentPending = state.componentProcessor.getPendingEvents();
        const reasonPending = state.reasonProcessor.getPendingEvents();
        const operatorPending = state.operatorProcessor.getPendingEvents();

        if (componentPending.length > 0 || reasonPending.length > 0 || operatorPending.length > 0) {
          if (componentPending.length > 0) {
            console.log(`[POLL] Device ${deviceId}: Component shift-end: ${componentPending.length} events`);
            out.push(...componentPending);
          }
          if (reasonPending.length > 0) {
            console.log(`[POLL] Device ${deviceId}: Reason shift-end: ${reasonPending.length} events`);
            out.push(...reasonPending);
          }
          if (operatorPending.length > 0) {
            console.log(`[POLL] Device ${deviceId}: Operator shift-end: ${operatorPending.length} events`);
            out.push(...operatorPending);
          }

          // Post any pending events
          if (out.length > 0) {
            const token = cachedToken;
            if (token) {
              console.log(`[POLL] Posting ${out.length} pending events for device ${deviceId}`);
              await postTelemetry(token, deviceId, out);
            }
          }
        }
      }
    } catch (err) {
      console.error("[POLL] Error checking pending events:", err.message);
    }
  }, 2000); // Check every 2 seconds

  console.log("✓ Service ready. Waiting for MQTT events...");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
