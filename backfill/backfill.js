// ============================================================================
//  STANDALONE BACKFILL  —  live_component / live_operator / live_reason
// ----------------------------------------------------------------------------
//  Separate from the live services. Reuses the SAME processor classes so the
//  generated records are identical to what the live macro service emits.
//
//  WHAT IT DOES (per device, within [START_TS, END_TS]):
//    1. (optional) DELETE the existing live_* key in the window
//    2. Replay the source telemetry through the real processor
//    3. POST the regenerated live_* records
//
//  SAFETY:
//    * DRY RUN by default. Nothing is deleted/posted unless you pass --execute.
//
//  USAGE — no file editing needed:
//    node backfill.js live_component 25/07/2026 25/07/2026 --execute
//    node backfill.js live_component,live_reason,live_operator 25/07/2026 26/07/2026 --execute
//    (dates are DD/MM/YYYY, whole day 00:00->23:59:59 IST i.e. all shifts covered)
//    node backfill.js --help    for the full flag reference (custom time-of-day, customer, etc.)
// ============================================================================

const axios = require("axios");
const https = require("https");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { MacroComponentProcessor, MacroOperatorProcessor, MacroReasonProcessor } = require("../macro_component/index");

// ==================== CLI ARGS ====================
function argVal(name) {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return undefined;
}
function parseTs(str, fallback) {
  if (str === undefined) return fallback;
  if (/^\d+$/.test(str)) return Number(str); // raw epoch ms
  const t = new Date(str).getTime();
  if (Number.isNaN(t)) {
    console.error(`Invalid --start/--end value: "${str}". Use e.g. 2026-07-27T00:00:00+05:30 or 2026-07-27`);
    process.exit(1);
  }
  return t;
}
// DD/MM/YYYY (or DD-MM-YYYY) -> ts at 00:00:00 (start) or 23:59:59.999 (end) IST, so a
// whole-day range covers every shift.
function parseDMY(str, endOfDay) {
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(str);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
  const t = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${time}+05:30`).getTime();
  return Number.isNaN(t) ? undefined : t;
}
// End date == today (IST) -> cap at the current moment instead of
// 23:59:59.999: today's last shift isn't over yet, so there's no telemetry
// beyond "now" to replay. Any other (past) end date keeps the full day,
// through its last shift's actual end.
function endDMY(str) {
  const dayStart = parseDMY(str, false);
  const dayEnd = parseDMY(str, true);
  if (dayStart === undefined || dayEnd === undefined) return dayEnd;
  const now = Date.now();
  return now >= dayStart && now <= dayEnd ? now : dayEnd;
}
const CUSTOMER_ALIASES = {
  surin: "ca71d920-4d2a-11f1-9352-592ed2a7210c",       // SURIN (main)
  surin_pune: "f853c6f0-3d3f-11f1-b077-e5ef75b0e368",  // SURIN_PUNE
};
const STREAM_ALIASES = {
  live_component: "component", component: "component",
  live_operator: "operator", operator: "operator",
  live_reason: "reason", reason: "reason",
};

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
Usage:
  node backfill.js <streams> <startDate> <endDate> [--execute] [--customer=<id>]
  node backfill.js [--start <date>] [--end <date>] [--component] [--operator] [--reason] [--execute] [--customer <id>]

  <streams>             comma list: live_component,live_operator,live_reason
                         (or short names: component,operator,reason)
  <startDate>/<endDate> DD/MM/YYYY. Whole days, 00:00:00 -> 23:59:59.999 IST (all shifts).

  --start/--end <date>  ISO date/time (2026-07-27 or 2026-07-27T00:00:00+05:30) or epoch ms.
                         Alternative to positional dates, for a custom time-of-day window.
  --customer <id>       customer UUID, or alias: ${Object.keys(CUSTOMER_ALIASES).join(", ")}. Default: surin_pune.
  --component/--operator/--reason   flag form of stream selection (default: component+operator+reason).
  --execute             actually delete + post. Without it: DRY RUN (prints counts only).

Examples:
  node backfill.js live_component 25/07/2026 25/07/2026 --execute
  node backfill.js live_component,live_reason,live_operator 25/07/2026 26/07/2026 --execute
`);
  process.exit(0);
}

// Positional form: `node backfill.js <streams> <startDate> <endDate>`. Detected when arg[0]
// isn't a flag and arg[1] looks like a DD/MM/YYYY date.
const positional = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const usingPositional = positional.length >= 3 && /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(positional[1]);
const [posStreams, posStart, posEnd] = usingPositional ? positional : [];

const END_TS   = usingPositional ? endDMY(posEnd)  : parseTs(argVal("end"), Date.now());
const START_TS = usingPositional ? parseDMY(posStart, false) : parseTs(argVal("start"), END_TS - 24 * 60 * 60 * 1000);
if (usingPositional && (START_TS === undefined || END_TS === undefined)) {
  console.error(`Invalid date "${posStart}" or "${posEnd}". Use DD/MM/YYYY, e.g. 25/07/2026`);
  process.exit(1);
}
const customerArg = argVal("customer");
const CUSTOMER_ID = customerArg ? (CUSTOMER_ALIASES[customerArg.toLowerCase()] || customerArg) : CUSTOMER_ALIASES.surin_pune;

let DO_COMPONENT, DO_OPERATOR, DO_REASON;
if (usingPositional) {
  const wanted = new Set(posStreams.split(",").map((s) => STREAM_ALIASES[s.trim()] || s.trim()));
  DO_COMPONENT = wanted.has("component");
  DO_OPERATOR  = wanted.has("operator");
  DO_REASON    = wanted.has("reason");
} else {
  const selectedStreams = ["component", "operator", "reason"].filter((s) => process.argv.includes(`--${s}`));
  DO_COMPONENT = selectedStreams.length ? selectedStreams.includes("component") : true;
  DO_OPERATOR  = selectedStreams.length ? selectedStreams.includes("operator")  : true;
  DO_REASON    = selectedStreams.length ? selectedStreams.includes("reason")    : true;
}

const EXECUTE = process.argv.includes("--execute");  // without this flag => DRY RUN
const DRY = !EXECUTE;

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
    // The live MQTT processor rounds its message timestamp to whole seconds.
    // Match that behavior so a later live update overwrites the same row.
    const ts = roundToSecond(ev.ts);
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
    // Keep timestamps identical to the live MQTT processor (see above).
    const ts = roundToSecond(ev.ts);
    flushRollover(proc, ts, out);
    out.push(...proc.handleOperator({ value: ev.value, ts }));
  }
  flushRollover(proc, END_TS, out);
  return dedupeByTs(out, "live_operator");
}
// Newest-first window of up to `limit` machine_status readings at/before `ts`,
// mirroring what the live service's getMachineStatus() would have returned.
function buildStatusWindow(msEventsAsc, ts, limit) {
  const window = [];
  for (let i = msEventsAsc.length - 1; i >= 0; i--) {
    if (msEventsAsc[i].ts <= ts) {
      window.push(msEventsAsc[i]);
      if (window.length >= limit) break;
    }
  }
  return window;
}

function replayReason(reasonEvents, msEventsRaw, reasons, shifts) {
  const proc = new MacroReasonProcessor({ reasons, shifts });
  const out = [];
  const msEvents = [...msEventsRaw]
    .map((e) => ({ ts: Number(e.ts), value: Number(e.value) }))
    .sort((a, b) => a.ts - b.ts);

  // Reason (idle_reason/reason_id) and machine_status must be replayed in true
  // chronological order — reason records only open/close relative to the
  // machine's idle state at that exact moment.
  const timeline = [
    ...reasonEvents.map((e) => ({ type: "reason", ts: roundToSecond(Number(e.ts)), value: e.value })), // idle_reason/reason_id round to the second, like the live service
    ...msEvents.map((e) => ({ type: "status", ts: e.ts, value: e.value })), // machine_status uses EXACT ts (no rounding)
  ].sort((a, b) => a.ts - b.ts);

  for (const ev of timeline) {
    flushRollover(proc, ev.ts, out);
    if (ev.type === "status") {
      out.push(...proc.handleMachineStatus({ value: ev.value, ts: ev.ts }, shifts));
    } else {
      const statusWindow = buildStatusWindow(msEvents, ev.ts, 30);
      out.push(...proc.handleReason({ value: ev.value, ts: ev.ts }, statusWindow));
    }
  }
  flushRollover(proc, END_TS, out);
  return dedupeByTs(out, "live_reason");
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
  const reasonsMaster = parseAttr(attrsRaw, "reason") || [];
  console.log(`Master: components=${components.length}, operators=${alloperator.length}, shifts=${allShift.length}, reasons=${reasonsMaster.length}\n`);

  const devices = await listDevices(jwt, CUSTOMER_ID);
  const summary = [];

  for (const d of devices) {
    const id = d.id?.id, name = d.name;
    const row = { name, comp: { src: 0, gen: 0 }, op: { src: 0, gen: 0 }, reason: { src: 0, gen: 0 } };

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
          if (recs.length) {
            await deleteRange(jwt, id, ["live_component"]);
            await postTelemetry(jwt, id, recs);
          } else {
            console.log(`[${name}] SKIPPED live_component delete: ${rc.length} source events but 0 regenerated (would have wiped existing data with nothing) — investigate before forcing.`);
          }
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
          if (recs.length) {
            await deleteRange(jwt, id, ["live_operator"]);
            await postTelemetry(jwt, id, recs);
          } else {
            console.log(`[${name}] SKIPPED live_operator delete: ${op.length} source events but 0 regenerated (would have wiped existing data with nothing) — investigate before forcing.`);
          }
        }
      }
    }

    // ---- live_reason ----  (idle_reason OR reason_id, depending on machine, + machine_status for idle-window context)
    if (DO_REASON) {
      const idleA = await getSeries(jwt, id, "idle_reason");
      const idleB = await getSeries(jwt, id, "reason_id");
      const reasonEvents = [...idleA, ...idleB].sort((a, b) => a.ts - b.ts);
      row.reason.src = reasonEvents.length;
      if (reasonEvents.length) {
        const ms = await getSeries(jwt, id, "machine_status");
        const recs = replayReason(reasonEvents, ms, reasonsMaster, allShift);
        row.reason.gen = recs.length;
        if (!DRY) {
          if (recs.length) {
            await deleteRange(jwt, id, ["live_reason"]);
            await postTelemetry(jwt, id, recs);
          } else {
            console.log(`[${name}] SKIPPED live_reason delete: ${reasonEvents.length} source events but 0 regenerated (machine wasn't idle at any of them, or would have wiped existing data with nothing) — investigate before forcing.`);
          }
        }
      }
    }

    summary.push(row);
  }

  console.log("\n==================== SUMMARY ====================");
  console.log("device\tcomp(src→gen)\toper(src→gen)\treason(src→gen)");
  for (const r of summary) {
    console.log(
      `${r.name}\t${r.comp.src}→${r.comp.gen}\t\t${r.op.src}→${r.op.gen}\t\t${r.reason.src}→${r.reason.gen}`
    );
  }
  console.log(DRY ? "\nDRY RUN complete — nothing was changed. Re-run with --execute to apply."
                  : "\nEXECUTE complete — telemetry deleted + regenerated.");
  process.exit(0);
})().catch((e) => {
  console.error("BACKFILL FAILED:", e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
