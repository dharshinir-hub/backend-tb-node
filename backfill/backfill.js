// ============================================================================
//  STANDALONE BACKFILL  —  live_component / live_operator / live_alarm
// ----------------------------------------------------------------------------
//  Separate from the live services. Reuses the SAME processor classes so the
//  generated records are identical to what the live macro/alarm services emit.
//
//  WHAT IT DOES (per device, within [START_TS, END_TS]):
//    1. (optional) DELETE the existing live_* key in the window
//    2. Replay the source telemetry through the real processor
//    3. POST the regenerated live_* records
//
//  SAFETY:
//    * DRY RUN by default. Nothing is deleted/posted unless you pass --execute.
//    * Before deleting live_alarm it writes a JSON backup to backfill/backups/.
//
//  TO RE-RUN FOR A DIFFERENT DATE RANGE: edit START_TS / END_TS below. Nothing
//  else needs to change.
// ============================================================================

const axios = require("axios");
const https = require("https");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { MacroComponentProcessor, MacroOperatorProcessor } = require("../macro_component/index");
const { AlarmProcessor, parseAlarmsTelemetry, parseSeparateAlarmKeys } = require("../alarm/index");

// ==================== PARAMETERS — EDIT THESE ====================
const END_TS   = Date.now();                   // current ts (right now)
const START_TS = 1782585000000;                // 28/06/2026 00:00:00 IST
const CUSTOMER_ID = "ca71d920-4d2a-11f1-9352-592ed2a7210c";  // Surin

let DO_COMPONENT = true;   // regenerate live_component from route_card
let DO_OPERATOR  = true;   // regenerate live_operator  from operator_id
let DO_ALARM     = true;   // regenerate live_alarm     from machine_status (+ alarms)
// ================================================================

const EXECUTE = process.argv.includes("--execute");  // without this flag => DRY RUN
const DRY = !EXECUTE;

// Optional per-run stream overrides (don't touch the defaults above):
//   --skip-alarm        run component + operator only
//   --alarm-only        run alarm only
if (process.argv.includes("--skip-alarm")) DO_ALARM = false;
if (process.argv.includes("--alarm-only")) { DO_COMPONENT = false; DO_OPERATOR = false; DO_ALARM = true; }
if (process.argv.includes("--component-only")) { DO_COMPONENT = true; DO_OPERATOR = false; DO_ALARM = false; }
if (process.argv.includes("--operator-only")) { DO_COMPONENT = false; DO_OPERATOR = true; DO_ALARM = false; }

const TB_BASE_URL = process.env.TB_BASE_URL;
const TB_USERNAME = process.env.TB_USERNAME;
const TB_PASSWORD = process.env.TB_PASSWORD;
const TB_INSECURE_TLS = String(process.env.TB_INSECURE_TLS || "") === "1";

const axiosTb = axios.create(
  TB_INSECURE_TLS ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) } : {}
);
const H = (jwt) => ({ headers: { "X-Authorization": `Bearer ${jwt}` } });
const roundToSecond = (ts) => Math.round(Number(ts) / 1000) * 1000;

// ---------------- ThingsBoard helpers ----------------
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
      ...H(jwt), params: { pageSize: 100, page },
    });
    out.push(...(res.data?.data || []));
    if (!res.data?.hasNext) break;
    page++;
  }
  return out;
}
function parseAttr(attrs, key) {
  const e = (attrs || []).find((a) => a.key === key);
  if (!e) return null;
  try { return typeof e.value === "string" ? JSON.parse(e.value) : e.value; } catch { return null; }
}
async function getCustomerAttributes(jwt, customerId) {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes`,
    { ...H(jwt), params: { keys: "allShift,component,reason,alloperator" } }
  );
  return res.data;
}
// timeseries over [startTs,endTs], returned ASCENDING by ts
async function getSeries(jwt, deviceId, key) {
  const res = await axiosTb.get(
    `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
    { ...H(jwt), params: { keys: key, startTs: START_TS, endTs: END_TS, limit: 50000, useStrictDataTypes: false } }
  );
  const list = res.data?.[key] || [];
  return Array.isArray(list) ? [...list].sort((a, b) => a.ts - b.ts) : [];
}
async function deleteRange(jwt, deviceId, keys) {
  await axiosTb.delete(`${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/timeseries/delete`, {
    ...H(jwt),
    params: {
      keys: keys.join(","),
      deleteAllDataForKeys: false,
      startTs: START_TS,
      endTs: END_TS,
      rewriteLatestIfDeleted: true,
    },
  });
}
async function postTelemetry(jwt, deviceId, records) {
  if (!records.length) return;
  await axiosTb.post(
    `${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${deviceId}/timeseries/TELEMETRY`,
    records, H(jwt)
  );
}

// ---------------- replay helpers ----------------
// Walk shift boundaries up to `ts` (reproduces the live shift-end timer), capped.
function flushRollover(proc, ts, sink) {
  for (let i = 0; i < 100000; i++) {
    const r = proc.rollover(ts);
    if (!r || !r.length) break;
    sink.push(...r);
  }
  if (typeof proc.getPendingEvents === "function") sink.push(...proc.getPendingEvents());
}
// Collapse to one record per (key, ts) keeping the LAST emission (final state),
// matching the live "post overwrites in place" semantics.
function dedupeByTs(records, key) {
  const m = new Map();
  for (const r of records) {
    if (!r || !r.values || r.values[key] === undefined) continue;
    m.set(r.ts, r);
  }
  return [...m.values()].sort((a, b) => a.ts - b.ts);
}

// ---------------- per-stream replays ----------------
function replayComponent(events, components, shifts) {
  const proc = new MacroComponentProcessor({ components, shifts });
  const out = [];
  for (const ev of events) {
    const ts = Number(ev.ts);   // EXACT route_card ts — no rounding (start_time === route_card ts)
    flushRollover(proc, ts, out);
    out.push(...proc.handleRoutecard({ value: ev.value, ts }));
  }
  flushRollover(proc, END_TS, out);
  return dedupeByTs(out, "live_component");
}
function replayOperator(events, operators, shifts) {
  const proc = new MacroOperatorProcessor({ operators, shifts });
  const out = [];
  for (const ev of events) {
    const ts = Number(ev.ts);   // EXACT operator_id ts — no rounding
    flushRollover(proc, ts, out);
    out.push(...proc.handleOperator({ value: ev.value, ts }));
  }
  flushRollover(proc, END_TS, out);
  return dedupeByTs(out, "live_operator");
}
function replayAlarm(msEvents, alarmsParsed, shifts) {
  const proc = new AlarmProcessor({ shifts });
  const out = [];
  for (const ev of msEvents) {
    const ts = Number(ev.ts);  // alarms use EXACT ts (no rounding)
    flushRollover(proc, ts, out);
    out.push(...proc.handleMachineStatus({ value: Number(ev.value), ts }, alarmsParsed));
  }
  flushRollover(proc, END_TS, out);
  return dedupeByTs(out, "live_alarm");
}

function backupLiveAlarm(deviceName, rows) {
  const dir = path.join(__dirname, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `live_alarm__${deviceName}__${START_TS}_${END_TS}.json`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  return file;
}

// ---------------- main ----------------
(async () => {
  console.log("============================================================");
  console.log(DRY ? "  DRY RUN  (no delete / no post)   pass --execute to apply"
                  : "  EXECUTE  (will DELETE + POST to production)");
  console.log("============================================================");
  console.log("Window:", new Date(START_TS).toISOString(), "->", new Date(END_TS).toISOString());
  console.log("Customer:", CUSTOMER_ID, "\n");

  const jwt = await login();
  const attrsRaw = await getCustomerAttributes(jwt, CUSTOMER_ID);
  const components  = parseAttr(attrsRaw, "component") || [];
  const alloperator = parseAttr(attrsRaw, "alloperator") || [];
  const allShift    = parseAttr(attrsRaw, "allShift") || [];
  console.log(`Master: components=${components.length}, operators=${alloperator.length}, shifts=${allShift.length}\n`);

  const devices = await listDevices(jwt, CUSTOMER_ID);
  const summary = [];

  for (const d of devices) {
    const id = d.id?.id, name = d.name;
    const row = { name, comp: { src: 0, gen: 0 }, op: { src: 0, gen: 0 }, al: { src: 0, gen: 0, del: 0, real: 0, unknown: 0, existReal: 0 } };

    // ---- live_component ----  (route card value may be under route_card OR routecard_id)
    if (DO_COMPONENT) {
      const rcA = await getSeries(jwt, id, "route_card");
      const rcB = await getSeries(jwt, id, "routecard_id");
      const rc = [...rcA, ...rcB].sort((a, b) => a.ts - b.ts);
      row.comp.src = rc.length;
      if (rc.length) {
        const recs = replayComponent(rc, components, allShift);
        row.comp.gen = recs.length;
        if (!DRY) {
          await deleteRange(jwt, id, ["live_component"]);
          await postTelemetry(jwt, id, recs);
        }
      }
    }

    // ---- live_operator ----
    if (DO_OPERATOR) {
      const op = await getSeries(jwt, id, "operator_id");
      row.op.src = op.length;
      if (op.length) {
        const recs = replayOperator(op, alloperator, allShift);
        row.op.gen = recs.length;
        if (!DRY) {
          await deleteRange(jwt, id, ["live_operator"]);
          await postTelemetry(jwt, id, recs);
        }
      }
    }

    // ---- live_alarm ----  (DESTRUCTIVE: backs up first)
    if (DO_ALARM) {
      const ms = await getSeries(jwt, id, "machine_status");
      row.al.src = ms.length;
      if (ms.length) {
        // Alarm details may live in the `alarms` array OR as separate flat keys
        // (alarm_message / alarm_number / alarm_type). Merge both, same as the
        // live alarm service, so real messages are recovered instead of UNKNOWN.
        const alarmsRaw = await getSeries(jwt, id, "alarms");
        const [amsg, anum, atype] = await Promise.all([
          getSeries(jwt, id, "alarm_message"),
          getSeries(jwt, id, "alarm_number"),
          getSeries(jwt, id, "alarm_type"),
        ]);
        const alarmsParsed = [
          ...parseAlarmsTelemetry(alarmsRaw),
          ...parseSeparateAlarmKeys({ alarm_message: amsg, alarm_number: anum, alarm_type: atype }),
        ];
        const recs = replayAlarm(ms, alarmsParsed, allShift);
        row.al.gen = recs.length;
        const isReal = (m) => m !== undefined && m !== null && m !== "" && m !== "UNKNOWN";
        row.al.real = recs.filter((r) => isReal(r.values?.live_alarm?.alarm_message)).length;
        row.al.unknown = row.al.gen - row.al.real;
        const existing = await getSeries(jwt, id, "live_alarm");
        row.al.del = existing.length;
        row.al.existReal = existing.filter((e) => {
          let v = e.value;
          if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = {}; } }
          return isReal(v?.alarm_message);
        }).length;
        if (existing.length) {
          const f = backupLiveAlarm(name, existing);
          console.log(`[${name}] backed up ${existing.length} live_alarm rows -> ${path.relative(process.cwd(), f)}`);
        }
        if (!DRY) {
          await deleteRange(jwt, id, ["live_alarm"]);
          await postTelemetry(jwt, id, recs);
        }
      }
    }

    summary.push(row);
  }

  console.log("\n==================== SUMMARY ====================");
  console.log("device\tcomp(src→gen)\toper(src→gen)\talarm(src→gen, del)\treal_msgs(exist→gen, UNKNOWN)");
  for (const r of summary) {
    console.log(
      `${r.name}\t${r.comp.src}→${r.comp.gen}\t\t${r.op.src}→${r.op.gen}\t\t${r.al.src}→${r.al.gen}, del ${r.al.del}\t${r.al.existReal}→${r.al.real}, unk ${r.al.unknown}`
    );
  }
  console.log(DRY ? "\nDRY RUN complete — nothing was changed. Re-run with --execute to apply."
                  : "\nEXECUTE complete — telemetry deleted + regenerated.");
  process.exit(0);
})().catch((e) => {
  console.error("BACKFILL FAILED:", e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
