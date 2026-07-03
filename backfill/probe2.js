// READ-ONLY probe #2: do the source values match the masters? how many alarm episodes?
const axios = require("axios");
const https = require("https");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const TB_BASE_URL = process.env.TB_BASE_URL;
const TB_USERNAME = process.env.TB_USERNAME;
const TB_PASSWORD = process.env.TB_PASSWORD;
const TB_INSECURE_TLS = String(process.env.TB_INSECURE_TLS || "") === "1";
const START_TS = 1782585000000;
const END_TS = Date.now();
const CUSTOMER_ID = "ca71d920-4d2a-11f1-9352-592ed2a7210c";

const axiosTb = axios.create(
  TB_INSECURE_TLS ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) } : {}
);
const H = (jwt) => ({ headers: { "X-Authorization": `Bearer ${jwt}` } });

async function login() {
  const res = await axiosTb.post(`${TB_BASE_URL}/api/auth/login`,
    { username: TB_USERNAME, password: TB_PASSWORD }, { headers: { "Content-Type": "application/json" } });
  return res.data.token;
}
function parseAttr(attrs, key) {
  const e = (attrs || []).find((a) => a.key === key);
  if (!e) return null;
  try { return typeof e.value === "string" ? JSON.parse(e.value) : e.value; } catch { return null; }
}
async function custAttrs(jwt, cid) {
  const res = await axiosTb.get(`${TB_BASE_URL}/api/plugins/telemetry/CUSTOMER/${cid}/values/attributes`,
    { ...H(jwt), params: { keys: "allShift,component,reason,alloperator" } });
  return res.data;
}
async function devices(jwt, cid) {
  const res = await axiosTb.get(`${TB_BASE_URL}/api/customer/${cid}/devices`, { ...H(jwt), params: { pageSize: 100, page: 0 } });
  return res.data.data;
}
async function ts(jwt, id, key) {
  const res = await axiosTb.get(`${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${id}/values/timeseries`,
    { ...H(jwt), params: { keys: key, startTs: START_TS, endTs: END_TS, limit: 50000, useStrictDataTypes: false } });
  return res.data?.[key] || [];
}
const distinct = (arr) => [...new Set(arr.map((x) => String(x.value)))];

(async () => {
  const jwt = await login();
  const a = await custAttrs(jwt, CUSTOMER_ID);
  const component = parseAttr(a, "component") || [];
  const alloperator = parseAttr(a, "alloperator") || [];
  const allShift = parseAttr(a, "allShift") || [];

  const compCodes = component.map((c) => String(c.component_number ?? c.componentNumber ?? c.code));
  const opCodes = alloperator.map((o) => String(o.code ?? o.operator_id ?? o.operatorid));
  console.log(`MASTER: component entries=${component.length}, alloperator entries=${opCodes.length}, shifts=${allShift.length}`);
  console.log(`  component_numbers (first 20): ${compCodes.slice(0, 20).join(", ")}`);
  console.log(`  operator codes: ${opCodes.join(", ")}`);
  console.log(`  shift sample: ${JSON.stringify(allShift[0] || null)}\n`);

  const devs = await devices(jwt, CUSTOMER_ID);
  for (const d of devs) {
    const rc = await ts(jwt, d.id.id, "route_card");
    const op = await ts(jwt, d.id.id, "operator_id");
    const ms = await ts(jwt, d.id.id, "machine_status");
    if (!rc.length && !op.length && !ms.length) continue;

    const rcVals = distinct(rc);
    const opVals = distinct(op);
    const rcMatch = rcVals.filter((v) => compCodes.includes(v));
    const opMatch = opVals.filter((v) => opCodes.includes(v));
    // count alarm episodes: transitions into 4/5 from non-4/5 (chronological)
    const msAsc = [...ms].sort((x, y) => x.ts - y.ts);
    let episodes = 0, prevAlarm = false;
    const statusDist = {};
    for (const e of msAsc) {
      const c = Number(e.value);
      statusDist[c] = (statusDist[c] || 0) + 1;
      const isAlarm = c === 4 || c === 5;
      if (isAlarm && !prevAlarm) episodes++;
      prevAlarm = isAlarm;
    }
    console.log(`# ${d.name}`);
    if (rc.length) console.log(`   route_card vals=${JSON.stringify(rcVals)} -> matched in master: ${JSON.stringify(rcMatch)} (${rcMatch.length}/${rcVals.length})`);
    if (op.length) console.log(`   operator vals=${JSON.stringify(opVals)} -> matched: ${JSON.stringify(opMatch)} (${opMatch.length}/${opVals.length})`);
    if (ms.length) console.log(`   machine_status dist=${JSON.stringify(statusDist)} -> alarm episodes (4/5 entries)=${episodes}`);
    console.log("");
  }
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.response?.status, e.response?.data || e.message); process.exit(1); });
