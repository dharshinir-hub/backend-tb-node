// READ-ONLY probe #3: what do existing live_alarm rows contain? real messages or UNKNOWN?
const axios = require("axios"); const https = require("https"); const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const B = process.env.TB_BASE_URL, U = process.env.TB_USERNAME, P = process.env.TB_PASSWORD;
const INS = String(process.env.TB_INSECURE_TLS || "") === "1";
const START_TS = 1782585000000, END_TS = Date.now(), CID = "ca71d920-4d2a-11f1-9352-592ed2a7210c";
const ax = axios.create(INS ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) } : {});
const H = (j) => ({ headers: { "X-Authorization": `Bearer ${j}` } });
(async () => {
  const jwt = (await ax.post(`${B}/api/auth/login`, { username: U, password: P })).data.token;
  const devs = (await ax.get(`${B}/api/customer/${CID}/devices`, { ...H(jwt), params: { pageSize: 100, page: 0 } })).data.data;
  for (const d of devs) {
    const r = await ax.get(`${B}/api/plugins/telemetry/DEVICE/${d.id.id}/values/timeseries`,
      { ...H(jwt), params: { keys: "live_alarm", startTs: START_TS, endTs: END_TS, limit: 50000, useStrictDataTypes: false } });
    const list = r.data?.live_alarm || [];
    if (!list.length) continue;
    const msgCount = {};
    for (const e of list) {
      let v = e.value; try { v = JSON.parse(e.value); } catch {}
      const m = (v && v.alarm_message) ? v.alarm_message : "(no field)";
      msgCount[m] = (msgCount[m] || 0) + 1;
    }
    console.log(`# ${d.name}: ${list.length} live_alarm rows`);
    console.log(`   message distribution: ${JSON.stringify(msgCount)}`);
    let sample = list[0].value; try { sample = JSON.parse(list[0].value); } catch {}
    console.log(`   sample row: ${JSON.stringify(sample)}\n`);
  }
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.response?.status, e.response?.data || e.message); process.exit(1); });
