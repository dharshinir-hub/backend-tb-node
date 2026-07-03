// Remove producer-posted (real-message) live_alarm, KEEP the UNKNOWN ones.
// Strategy: fetch window's live_alarm, partition keep(UNKNOWN)/drop(real),
// delete the whole key in the window, then re-post ONLY the UNKNOWN rows.
// DRY RUN by default; pass --execute to apply.
const axios = require("axios"); const https = require("https"); const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const TB_BASE_URL = process.env.TB_BASE_URL, TB_USERNAME = process.env.TB_USERNAME, TB_PASSWORD = process.env.TB_PASSWORD;
const INS = String(process.env.TB_INSECURE_TLS || "") === "1";

// ============ PARAMETERS ============
const START_TS = 1782585000000;        // 28/06/2026 00:00 IST
const END_TS   = 1782805841000;        // 30/06/2026 13:20:41 IST
const CUSTOMER_ID = "ca71d920-4d2a-11f1-9352-592ed2a7210c";
// devices to clean; empty array = ALL devices in the customer
const DEVICES = ["SURIN-BFW_XTRON_3"];
// ====================================

const EXECUTE = process.argv.includes("--execute");
const ax = axios.create(INS ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) } : {});
const H = (j) => ({ headers: { "X-Authorization": `Bearer ${j}` } });

async function login() {
  return (await ax.post(`${TB_BASE_URL}/api/auth/login`, { username: TB_USERNAME, password: TB_PASSWORD })).data.token;
}
async function listDevices(j) {
  return (await ax.get(`${TB_BASE_URL}/api/customer/${CUSTOMER_ID}/devices`, { ...H(j), params: { pageSize: 100, page: 0 } })).data.data;
}
async function getLiveAlarm(j, id) {
  const r = await ax.get(`${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${id}/values/timeseries`,
    { ...H(j), params: { keys: "live_alarm", startTs: START_TS, endTs: END_TS, limit: 100000, useStrictDataTypes: false } });
  return (r.data.live_alarm || []).sort((a, b) => a.ts - b.ts);
}
async function deleteRange(j, id) {
  await ax.delete(`${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${id}/timeseries/delete`,
    { ...H(j), params: { keys: "live_alarm", deleteAllDataForKeys: false, startTs: START_TS, endTs: END_TS, rewriteLatestIfDeleted: true } });
}
async function post(j, id, records) {
  if (records.length) await ax.post(`${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${id}/timeseries/TELEMETRY`, records, H(j));
}

(async () => {
  console.log(EXECUTE ? "EXECUTE (will delete real-msg live_alarm, keep UNKNOWN)" : "DRY RUN (no changes) — pass --execute to apply");
  console.log("Window:", new Date(START_TS).toISOString(), "->", new Date(END_TS).toISOString(), "\n");
  const j = await login();
  let devs = await listDevices(j);
  if (DEVICES.length) devs = devs.filter((d) => DEVICES.includes(d.name));

  for (const d of devs) {
    const rows = await getLiveAlarm(j, d.id.id);
    const keep = [], drop = [];
    for (const e of rows) {
      let v; try { v = JSON.parse(e.value); } catch { v = {}; }
      if (v.alarm_message === "UNKNOWN") keep.push({ ts: e.ts, values: { live_alarm: v } });
      else drop.push({ ts: e.ts, msg: v.alarm_message });
    }
    console.log(`# ${d.name}: ${rows.length} rows -> KEEP(UNKNOWN)=${keep.length}, DROP(real)=${drop.length}`);
    drop.slice(0, 6).forEach((x) => console.log(`    drop ts=${x.ts} "${String(x.msg).slice(0, 40)}"`));
    if (drop.length > 6) console.log(`    ... +${drop.length - 6} more`);
    if (EXECUTE && drop.length) {
      await deleteRange(j, d.id.id);     // clear the whole window
      await post(j, d.id.id, keep);      // re-post only the UNKNOWN rows
      console.log(`    -> deleted window, re-posted ${keep.length} UNKNOWN rows`);
    }
  }
  console.log(EXECUTE ? "\nDONE." : "\nDRY RUN complete — re-run with --execute to apply.");
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.response?.status, e.response?.data || e.message); process.exit(1); });
