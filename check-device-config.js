"use strict";

// Check device threshold configuration
// Run with: node check-device-config.js

const axios = require("axios");
const https = require("https");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const TB_BASE_URL = process.env.TB_BASE_URL;
const TB_USERNAME = process.env.TB_USERNAME;
const TB_PASSWORD = process.env.TB_PASSWORD;
const TB_INSECURE_TLS = String(process.env.TB_INSECURE_TLS || "") === "1";

const httpsAgent = new https.Agent({ rejectUnauthorized: !TB_INSECURE_TLS, maxSockets: 100 });
const axiosTb = axios.create({ httpsAgent });

let token = null;

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

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

async function getCustomerByName(customerName) {
  let page = 0;
  while (true) {
    const res = await axiosTb.get(
      `${TB_BASE_URL}/api/customers?pageSize=100&page=${page}`,
      { headers: auth() }
    );
    const found = res.data.data?.find(c => c.title === customerName);
    if (found) return found;
    if (!res.data.hasNext) break;
    page++;
  }
  return null;
}

async function getCustomerDeviceByName(customerId, deviceName) {
  let page = 0;
  while (true) {
    const res = await axiosTb.get(
      `${TB_BASE_URL}/api/customer/${customerId}/devices?pageSize=100&page=${page}`,
      { headers: auth() }
    );
    const found = res.data.data?.find(d => d.name === deviceName);
    if (found) return found;
    if (!res.data.hasNext) break;
    page++;
  }
  return null;
}

async function getDeviceServerAttrs(deviceId) {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`,
    { headers: auth() }
  );
  return res.data || [];
}

async function getCustomerAttrs(customerId) {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes`,
    { headers: auth() }
  );
  return res.data || [];
}

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

async function checkConfig() {
  await login();
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   Device Configuration Check");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const customer = await getCustomerByName("Precicraft CNC Works");
  if (!customer) {
    console.error("✗ Customer 'Precicraft CNC Works' not found!");
    process.exit(1);
  }

  console.log(`[${customer.title}]\n`);

  const customerId = customer.id?.id;
  const custAttrs = await getCustomerAttrs(customerId);
  console.log("Customer Attributes:");
  custAttrs.forEach(attr => {
    console.log(`  ${attr.key}: ${JSON.stringify(attr.value)}`);
  });
  console.log();

  const device = await getCustomerDeviceByName(customerId, "PCW-VMC-02");
  if (!device) {
    console.error("✗ Device 'PCW-VMC-02' not found!");
    process.exit(1);
  }

  console.log(`Device: ${device.name}`);
  console.log(`Device ID: ${device.id?.id}\n`);

  const deviceId = device.id?.id;
  const devAttrs = await getDeviceServerAttrs(deviceId);

  console.log("Device Thresholds:");
  const attrMap = Object.fromEntries(devAttrs.map(a => [a.key, a.value]));

  const idleMs = parseThresholdMs(attrMap.idle_threshold);
  const alarmMs = parseThresholdMs(attrMap.alarm_threshold);
  const disconnectMs = parseThresholdMs(attrMap.disconnect_threshold);

  console.log(`  idle_threshold:       ${idleMs ? formatMs(idleMs) + ` (${idleMs/1000}s)` : "NOT SET"}`);
  console.log(`  alarm_threshold:      ${alarmMs ? formatMs(alarmMs) + ` (${alarmMs/1000}s)` : "NOT SET"}`);
  console.log(`  disconnect_threshold: ${disconnectMs ? formatMs(disconnectMs) + ` (${disconnectMs/1000}s)` : "NOT SET"}`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (!idleMs && !alarmMs && !disconnectMs) {
    console.error("\n✗ ERROR: No thresholds are configured!");
    console.error("  The device will NOT generate any alerts.");
    console.error("\n  To fix: Set idle_threshold, alarm_threshold, and/or disconnect_threshold");
    console.error("          as SERVER_SCOPE attributes on the device.\n");
  } else {
    console.log("\n✓ Thresholds configured correctly!\n");
  }

  process.exit(0);
}

checkConfig().catch(err => {
  console.error("✗ ERROR:", err.message);
  process.exit(1);
});
