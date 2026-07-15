"use strict";

// Check machine_status telemetry from ThingsBoard
// Run with: node check-machine-status.js

const axios = require("axios");
const https = require("https");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const TB_BASE_URL = process.env.TB_BASE_URL;
const TB_USERNAME = process.env.TB_USERNAME;
const TB_PASSWORD = process.env.TB_PASSWORD;
const TB_INSECURE_TLS = String(process.env.TB_INSECURE_TLS || "") === "1";

const httpsAgent = new https.Agent({ rejectUnauthorized: !TB_INSECURE_TLS });
const axiosTb = axios.create({ httpsAgent });

let token = null;

async function login() {
  try {
    const res = await axiosTb.post(
      `${TB_BASE_URL}/api/auth/login`,
      { username: TB_USERNAME, password: TB_PASSWORD },
      { headers: { "Content-Type": "application/json" } }
    );
    token = res.data.token;
    console.log("✓ Logged in to ThingsBoard\n");
  } catch (err) {
    console.error("✗ Login failed:", err.message);
    process.exit(1);
  }
}

function auth(extra = {}) {
  return { "X-Authorization": `Bearer ${token}`, ...extra };
}

async function getCustomers() {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/customers?pageSize=1000`,
    { headers: auth() }
  );
  return res.data.data || [];
}

async function getDevices(customerId) {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/customer/${customerId}/devices?pageSize=1000`,
    { headers: auth() }
  );
  return res.data.data || [];
}

async function getMachineStatus(deviceId, limit = 100) {
  try {
    const res = await axiosTb.get(
      `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=machine_status&limit=${limit}`,
      { headers: auth() }
    );
    return res.data?.machine_status || [];
  } catch (err) {
    console.error("Error fetching machine_status:", err.response?.data?.message || err.message);
    console.error("Full error:", err.message);
    return [];
  }
}

function formatStatus(val) {
  if (val === 0 || val === 1 || val === 2) return "IDLE";
  if (val === 3) return "RUNNING";
  if (val === 4 || val === 5) return "ALARM";
  if (val === 100) return "DISCONNECT";
  return "UNKNOWN";
}

function timeAgo(ts) {
  const now = Date.now();
  const ago = now - ts;

  if (ago < 0) return "in future";
  if (ago < 1000) return "just now";
  if (ago < 60000) return Math.round(ago / 1000) + " seconds ago";
  if (ago < 3600000) return Math.round(ago / 60000) + " minutes ago";
  if (ago < 86400000) return Math.round(ago / 3600000) + " hours ago";
  return Math.round(ago / 86400000) + " days ago";
}

async function checkStatus() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   ThingsBoard Machine Status Check");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await login();

  const customers = await getCustomers();
  const precicraft = customers.find(c => c.title === "Precicraft CNC Works");

  if (!precicraft) {
    console.error("✗ Customer 'Precicraft CNC Works' not found!");
    process.exit(1);
  }

  const devices = await getDevices(precicraft.id?.id);
  const pcwVmc02 = devices.find(d => d.name === "PCW-VMC-02");

  if (!pcwVmc02) {
    console.error("✗ Device 'PCW-VMC-02' not found!");
    process.exit(1);
  }

  console.log(`Customer: ${precicraft.title}`);
  console.log(`Device: ${pcwVmc02.name}`);
  console.log(`Device ID: ${pcwVmc02.id?.id}\n`);

  const statusList = await getMachineStatus(pcwVmc02.id?.id, 50);

  if (!statusList.length) {
    console.log("❌ No machine_status telemetry found!\n");
    console.log("This means the device is NOT sending telemetry to ThingsBoard.");
    console.log("Check if:");
    console.log("  1. Device is powered on");
    console.log("  2. Device has network connectivity");
    console.log("  3. Device is configured to send machine_status");
    console.log("  4. MQTT/HTTP connection to ThingsBoard is working\n");
    process.exit(0);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Recent machine_status History (last 50 events):");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const now = Date.now();
  statusList.forEach((entry, idx) => {
    const ts = Number(entry.ts);
    const val = entry.value;
    const status = formatStatus(val);
    const ago = timeAgo(ts);
    const timestamp = new Date(ts).toISOString();

    const color =
      status === "IDLE" ? "🔵" :
      status === "RUNNING" ? "🟢" :
      status === "ALARM" ? "🔴" :
      status === "DISCONNECT" ? "⚫" : "⚪";

    console.log(`  ${idx + 1}. ${color} ${status.padEnd(10)} (${val})`);
    console.log(`     Time: ${timestamp}`);
    console.log(`     Age:  ${ago}\n`);
  });

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const latestTs = Number(statusList[0].ts);
  const latestStatus = statusList[0].value;
  const latestStatusName = formatStatus(latestStatus);
  const minutesAgo = Math.round((now - latestTs) / 60000);

  console.log("\n📊 Summary:");
  console.log(`  Latest Status: ${latestStatusName} (${latestStatus})`);
  console.log(`  Last Update: ${minutesAgo} minutes ago`);

  if (minutesAgo > 60) {
    console.log(`\n❌ WARNING: No telemetry for ${minutesAgo} minutes!`);
    console.log("  The device is NOT actively sending updates to ThingsBoard.");
    console.log("  This is why alerts are not firing.\n");
  } else if (minutesAgo > 5) {
    console.log(`\n⚠️  Telemetry is slow (${minutesAgo} min gap)`);
    console.log("  Check device connectivity.\n");
  } else {
    console.log(`\n✓ Device is actively sending telemetry (${minutesAgo} min ago)\n`);
  }

  process.exit(0);
}

checkStatus().catch(err => {
  console.error("✗ ERROR:", err.message);
  process.exit(1);
});
