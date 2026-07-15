"use strict";

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
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/customers?pageSize=1000`,
    { headers: auth() }
  );
  return res.data.data?.find(c => c.title === customerName);
}

async function getCustomerDeviceByName(customerId, deviceName) {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/customer/${customerId}/devices?pageSize=1000`,
    { headers: auth() }
  );
  return res.data.data?.find(d => d.name === deviceName);
}

async function getDeviceStatus(deviceId) {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=machine_status&limit=10&useStrictDataTypes=false`,
    { headers: auth() }
  );
  return res.data?.machine_status || [];
}

async function checkStatus() {
  await login();
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   PCW-VMC-02 Status Timeline");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const customer = await getCustomerByName("Precicraft CNC Works");
  if (!customer) {
    console.error("✗ Customer not found!");
    process.exit(1);
  }

  const device = await getCustomerDeviceByName(customer.id?.id, "PCW-VMC-02");
  if (!device) {
    console.error("✗ Device not found!");
    process.exit(1);
  }

  const statusList = await getDeviceStatus(device.id?.id);
  const now = Date.now();

  console.log(`Device: ${device.name}`);
  console.log(`Current Time: ${new Date(now).toISOString()}\n`);
  console.log("Recent Status History (last 10 events):\n");

  statusList.forEach((entry, idx) => {
    const ts = Number(entry.ts);
    const val = entry.value;
    const ago = Math.round((now - ts) / 1000);

    let statusName = "?";
    if (val === 0 || val === 1 || val === 2) statusName = "IDLE";
    else if (val === 3) statusName = "RUNNING";
    else if (val === 4 || val === 5) statusName = "ALARM";
    else if (val === 100) statusName = "DISCONNECT";

    console.log(`  ${idx + 1}. Status: ${statusName} (${val})`);
    console.log(`     Time: ${new Date(ts).toISOString()}`);
    console.log(`     Age: ${ago} seconds ago (${Math.floor(ago / 60)} min ${ago % 60} sec)\n`);
  });

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n⚠️  IMPORTANT:");
  console.log("  • idle_threshold = 10 seconds");
  console.log("  • If device is in IDLE > 10 seconds, alert should fire");
  console.log("  • If no alert, the monitor might not be running");
  console.log("  • Check if monitor.js is actively running\n");

  process.exit(0);
}

checkStatus().catch(err => {
  console.error("✗ ERROR:", err.message);
  process.exit(1);
});
