// READ-ONLY probe. Does NOT delete or post anything.
// Lists devices for the target customer and counts source + existing live_* data
// inside the backfill window, so we can confirm scope before running the real job.
const axios = require("axios");
const https = require("https");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const TB_BASE_URL = process.env.TB_BASE_URL;
const TB_USERNAME = process.env.TB_USERNAME;
const TB_PASSWORD = process.env.TB_PASSWORD;
const TB_INSECURE_TLS = String(process.env.TB_INSECURE_TLS || "") === "1";

// ---- window (edit these two lines to target any range) ----
const START_TS = 1782585000000; // 28/06/2026 00:00:00 IST
const END_TS = Date.now();
// target customer (Surin)
const CUSTOMER_ID = process.env.BACKFILL_CUSTOMER_ID || "ca71d920-4d2a-11f1-9352-592ed2a7210c";

const axiosTb = axios.create(
  TB_INSECURE_TLS ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) } : {}
);

async function login() {
  const res = await axiosTb.post(
    `${TB_BASE_URL}/api/auth/login`,
    { username: TB_USERNAME, password: TB_PASSWORD },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data.token;
}

async function listDevices(jwt, customerId) {
  const out = [];
  let page = 0;
  while (true) {
    const res = await axiosTb.get(`${TB_BASE_URL}/api/customer/${customerId}/devices`, {
      headers: { "X-Authorization": `Bearer ${jwt}` },
      params: { pageSize: 100, page },
    });
    out.push(...(res.data?.data || []));
    if (!res.data?.hasNext) break;
    page++;
  }
  return out;
}

async function countKey(jwt, deviceId, key, startTs, endTs) {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
    {
      headers: { "X-Authorization": `Bearer ${jwt}` },
      params: { keys: key, startTs, endTs, limit: 50000, useStrictDataTypes: false },
    }
  );
  const list = res.data?.[key];
  return Array.isArray(list) ? list.length : 0;
}

(async () => {
  console.log("TB:", TB_BASE_URL, "| customer:", CUSTOMER_ID);
  console.log("Window:", new Date(START_TS).toISOString(), "->", new Date(END_TS).toISOString());
  console.log("        (START_TS=" + START_TS + ", END_TS=" + END_TS + ")\n");

  const jwt = await login();
  const devices = await listDevices(jwt, CUSTOMER_ID);
  console.log(`Devices in customer: ${devices.length}\n`);

  const SRC = ["route_card", "operator_id", "machine_status", "alarms"];
  const LIVE = ["live_component", "live_operator", "live_alarm"];

  const header = ["device", ...SRC, "|", ...LIVE].join("\t");
  console.log(header);
  console.log("-".repeat(header.length + 40));

  for (const d of devices) {
    const id = d.id?.id;
    const name = d.name;
    const counts = {};
    for (const k of [...SRC, ...LIVE]) {
      try {
        counts[k] = await countKey(jwt, id, k, START_TS, END_TS);
      } catch (e) {
        counts[k] = "ERR";
      }
    }
    console.log(
      [name, ...SRC.map((k) => counts[k]), "|", ...LIVE.map((k) => counts[k])].join("\t")
    );
  }
  process.exit(0);
})().catch((e) => {
  console.error("PROBE FAILED:", e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
