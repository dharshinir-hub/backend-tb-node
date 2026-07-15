"use strict";

// Test script to trigger idle alert and verify email/web notifications
// Run with: node test-email-alert.js

const axios = require("axios");
const https = require("https");
const path = require("path");
const nodemailer = require("nodemailer");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const TB_BASE_URL = process.env.TB_BASE_URL;
const TB_USERNAME = process.env.TB_USERNAME;
const TB_PASSWORD = process.env.TB_PASSWORD;
const TB_INSECURE_TLS = String(process.env.TB_INSECURE_TLS || "") === "1";
const TB_INSTANCE = process.env.TB_INSTANCE || "TB1";

const CUSTOMER_ID_CONFIG = (process.env.customer_id || "").trim();
const EMAIL_FROM = process.env.email_from || "";
const EMAIL_PASS = process.env.email_pass || "";
const EMAIL_TO_RAW = process.env.email_to || "";
const EMAIL_TO_LIST = EMAIL_TO_RAW.split(",").map(e => e.trim()).filter(e => e.length > 0);
const SMART_SERVER_ENABLED = TB_BASE_URL && TB_BASE_URL.includes("smart.yantra");

const httpsAgent = new https.Agent({ rejectUnauthorized: !TB_INSECURE_TLS, maxSockets: 100 });
const axiosTb = axios.create({ httpsAgent });

let token = null;
let emailTransporter = null;

if (SMART_SERVER_ENABLED && EMAIL_FROM && EMAIL_PASS && EMAIL_TO_LIST.length > 0) {
  emailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_FROM, pass: EMAIL_PASS },
  });
}

function ts() { return new Date().toISOString(); }

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
  console.log(`[${ts()}] ✓ Logged in to ThingsBoard`);
}

function auth(extra = {}) {
  return { "X-Authorization": `Bearer ${token}`, ...extra };
}

function shouldSendEmailForCustomer(customerId) {
  if (!SMART_SERVER_ENABLED || !emailTransporter || !CUSTOMER_ID_CONFIG) return false;
  if (CUSTOMER_ID_CONFIG.toLowerCase() === "all") return true;
  const configuredCustomerIds = CUSTOMER_ID_CONFIG.split(",").map(c => c.trim());
  return configuredCustomerIds.includes(customerId);
}

async function sendEmail(subject, body) {
  if (!emailTransporter || !EMAIL_TO_LIST.length) return;
  try {
    const toList = EMAIL_TO_LIST.join(", ");
    await emailTransporter.sendMail({
      from: EMAIL_FROM,
      to: toList,
      subject,
      html: body,
    });
    console.log(`[${ts()}] ✓ EMAIL SENT to ${EMAIL_TO_LIST.length} recipient(s) — "${subject}"`);
    return true;
  } catch (err) {
    console.error(`[${ts()}] ✗ EMAIL ERROR:`, err.message);
    return false;
  }
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
  if (!userIds.length) {
    console.warn(`[${ts()}] ✗ No Admin/Super Admin users found`);
    return false;
  }

  let targetId = null;
  try {
    const tRes = await axiosTb.post(
      `${TB_BASE_URL}/api/notification/target`,
      {
        name: `__test_sm_${Date.now()}__`,
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
          name: `test-sm-notif-${Date.now()}`,
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
    console.log(`[${ts()}] ✓ WEB NOTIFICATION SENT — "${subject}" to ${userIds.length} user(s)`);
    return true;
  } catch (err) {
    console.error(`[${ts()}] ✗ WEB NOTIFICATION ERROR:`, err.response?.data?.message || err.message);
    return false;
  } finally {
    if (targetId) {
      axiosTb.delete(`${TB_BASE_URL}/api/notification/target/${targetId}`, { headers: auth() }).catch(() => {});
    }
  }
}

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

async function getDeviceLatestStatus(deviceId) {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=machine_status&limit=1&useStrictDataTypes=false`,
    { headers: auth() }
  );
  const list = res.data?.machine_status || [];
  if (list.length) {
    return { ts: Number(list[0].ts), value: list[0].value };
  }
  return null;
}

async function triggerTestAlert() {
  if (!TB_BASE_URL || !TB_USERNAME || !TB_PASSWORD) {
    console.error(`✗ Missing TB_BASE_URL / TB_USERNAME / TB_PASSWORD in .env`);
    process.exit(1);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   TEST: Email Alert & Web Notification");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("[CONFIG CHECK]");
  console.log(`  TB_BASE_URL: ${TB_BASE_URL}`);
  console.log(`  SMART_SERVER_ENABLED: ${SMART_SERVER_ENABLED}`);
  console.log(`  EMAIL_FROM: ${EMAIL_FROM || "Not set"}`);
  console.log(`  EMAIL_TO: ${EMAIL_TO || "Not set"}`);
  console.log(`  CUSTOMER_NAME_CONFIG: ${CUSTOMER_NAME_CONFIG || "Not set"}`);
  console.log(`  Email Transporter: ${emailTransporter ? "✓ Ready" : "✗ Not ready"}\n`);

  await login();

  const customers = await getAllCustomers();
  console.log(`[CUSTOMERS] Found ${customers.length} customer(s)\n`);

  for (const customer of customers) {
    const customerId = customer.id?.id;
    if (!customerId) continue;

    const devices = await getCustomerDevices(customerId);
    console.log(`[${customer.title}] ${devices.length} device(s)`);

    for (const device of devices) {
      const deviceId = device.id?.id;
      if (!deviceId) continue;

      const status = await getDeviceLatestStatus(deviceId);
      if (!status) {
        console.log(`  ✗ ${device.name} — no machine_status data`);
        continue;
      }

      const statusValue = Number(status.value);
      let statusName = "UNKNOWN";
      if (statusValue === 0 || statusValue === 1 || statusValue === 2) statusName = "IDLE";
      else if (statusValue === 3) statusName = "RUNNING";
      else if (statusValue === 4 || statusValue === 5) statusName = "ALARM";
      else if (statusValue === 100) statusName = "DISCONNECT";

      console.log(`  Device: ${device.name}`);
      console.log(`    Last Status: ${statusName} (value: ${statusValue})`);
      console.log(`    Time: ${new Date(status.ts).toISOString()}`);

      // Test IDLE alert
      if (statusValue === 0 || statusValue === 1 || statusValue === 2) {
        console.log(`    → Testing IDLE alert...\n`);

        const subject = "Machine Idle";
        const body = `Machine – "${device.name}" is Idle for more than 30 seconds`;
        const emailBody = `<p>Machine <strong>"${device.name}"</strong> is Idle for more than 30 seconds</p><p>Test triggered at ${new Date().toLocaleTimeString()}</p>`;

        // Send web notification
        const webSent = await sendNotification(customerId, subject, body, "info", "#F59E0B");

        // Send email if customer is configured
        const shouldEmail = shouldSendEmailForCustomer(customerId);
        console.log(`    Email eligible for customer "${customer.title}": ${shouldEmail ? "✓ Yes" : "✗ No"}`);
        if (shouldEmail) {
          await sendEmail(subject, emailBody);
        } else {
          console.log(`    (Configured recipients: ${EMAIL_TO_LIST.join(", ")})`);
        }
      } else {
        console.log(`    → Skipped (not in IDLE state. Test with IDLE device.)\n`);
      }
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   ✓ Test Complete");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  process.exit(0);
}

triggerTestAlert().catch((err) => {
  console.error(`[${ts()}] ✗ FATAL:`, err.message);
  process.exit(1);
});
