"use strict";

// Macro Component, Reason, and Operator Processing Logic
// Standalone module: no dependency on tb-node-starter.

function toNumberMaybe(v) {
  if (v === null || v === undefined) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

function normalizeComponent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const normalized = {
    component_number: raw.component_number ?? raw.componentNumber ?? raw.code ?? "",
    component_name: raw.component_name ?? raw.componentName ?? raw.name ?? "",
    cycle_time: toNumberMaybe(raw.cycle_time ?? raw.cycleTime),
    handling_time: toNumberMaybe(raw.handling_time ?? raw.handlingTime),
    setup_time: toNumberMaybe(raw.setup_time ?? raw.setupTime),
    factorval: toNumberMaybe(raw.factorval ?? raw.factorVal),
    factor: raw.factor ?? "",
    operation_number: raw.operation_number ?? raw.operationNumber ?? "",
    sequences: Array.isArray(raw.sequences) ? raw.sequences : [],
  };
  return normalized;
}

function normalizeComponents(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const c = normalizeComponent(item);
    if (c && c.component_number !== "") out.push(c);
  }
  return out;
}

function pickTime(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function parseTimeToDate(baseDate, timeStr, dayOffset) {
  const parts = String(timeStr).split(":");
  const hh = Number(parts[0] || 0);
  const mm = Number(parts[1] || 0);
  const ss = Number(parts[2] || 0);
  const d = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hh,
    mm,
    ss,
    0
  );
  if (dayOffset) d.setDate(d.getDate() + dayOffset);
  return d;
}

function buildShiftIntervalsForDay(shifts, baseDate) {
  const intervals = [];
  for (const s of shifts) {
    const startTime = pickTime(s, ["start_time", "startTime", "start"]);
    const endTime = pickTime(s, ["end_time", "endTime", "end"]);
    if (!startTime || !endTime) continue;
    const startDay = Number(s.start_day || s.startDay || 1) - 1;
    const endDay = Number(s.end_day || s.endDay || 1) - 1;
    const start = parseTimeToDate(baseDate, startTime, startDay);
    let end = parseTimeToDate(baseDate, endTime, endDay);
    if (end <= start) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
    intervals.push({ start, end, raw: s });
  }
  return intervals;
}

function dayStartLocal(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function splitByShifts(startTs, endTs, shifts) {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return [];
  if (endTs <= startTs) return [];
  if (!Array.isArray(shifts) || shifts.length === 0) {
    return [{ start: startTs, end: endTs }];
  }

  const boundaries = [];
  const startDay = dayStartLocal(startTs);
  const endDay = dayStartLocal(endTs);

  // Include one extra day on each side to cover overnight shifts.
  const day = new Date(startDay.getTime() - 24 * 60 * 60 * 1000);
  const lastDay = new Date(endDay.getTime() + 24 * 60 * 60 * 1000);

  for (let d = new Date(day); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const intervals = buildShiftIntervalsForDay(shifts, d);
    for (const i of intervals) {
      const s = i.start.getTime();
      const e = i.end.getTime();
      if (s > startTs && s < endTs) boundaries.push(s);
      if (e > startTs && e < endTs) boundaries.push(e);
    }
  }

  boundaries.sort((a, b) => a - b);
  const segments = [];
  let cursor = startTs;
  for (const b of boundaries) {
    if (b > cursor) {
      segments.push({ start: cursor, end: b });
      cursor = b;
    }
  }
  if (cursor < endTs) segments.push({ start: cursor, end: endTs });
  return segments;
}

function buildLiveComponent(component, startTs, endTs, wasShiftEnd = false) {
  // Build sequences array from component data, preserving nested balloon_seq
  let sequences = [];
  if (Array.isArray(component.sequences)) {
    sequences = component.sequences
      .filter(seq => seq && typeof seq === "object")
      .map(seq => {
        const s = {
          sequence: String(seq.sequence || ""),
          touch_time: String(seq.touch_time || "00:00:00")
        };
        // Preserve nested balloon_seq if present
        if (Array.isArray(seq.balloon_seq)) {
          s.balloon_seq = seq.balloon_seq
            .filter(bs => bs && typeof bs === "object")
            .map(bs => ({
              sequence: String(bs.sequence || ""),
              touch_time: String(bs.touch_time || "00:00:00")
            }));
        }
        return s;
      });
  }

  return {
    name: component.component_name || "",
    code: component.component_number || "",
    start_time: startTs,
    end_time: endTs ?? 0,
    duration: endTs ? Math.round((endTs - startTs) / 1000) : 0,
    cycle_time: component.cycle_time || "00:00:00",
    handling_time: component.handling_time || "00:00:00",
    setup_time: component.setup_time || "00:00:00",
    factorval: component.factorval ?? 0,
    factor: component.factor || "",
    operation_number: component.operation_number || "",
    sequences: sequences,
    _wasShiftEnd: wasShiftEnd,
  };
}

function componentFromLiveComponent(lc) {
  if (!lc || typeof lc !== "object") return null;
  return {
    component_name: lc.name ?? "",
    component_number: lc.code ?? "",
    cycle_time: lc.cycle_time,
    handling_time: lc.handling_time,
    setup_time: lc.setup_time,
    factorval: lc.factorval,
    factor: lc.factor,
    operation_number: lc.operation_number,
  };
}

function toTelemetryRecord(liveComponent) {
  return {
    ts: liveComponent.start_time,
    values: {
      live_component: liveComponent,
    },
  };
}

function findComponentByNumber(components, routecardValue) {
  if (!routecardValue) return null;
  const key = String(routecardValue);
  return components.find((c) => String(c.component_number) === key) || null;
}

class MacroComponentProcessor {
  constructor(options = {}) {
    this.components = normalizeComponents(options.components || []);
    this.shifts = Array.isArray(options.shifts) ? options.shifts : [];
    this.current = null;
    this.pendingEvents = []; // Events from timer callbacks
    this.shiftEndTimer = null; // Timeout ID for shift-end trigger
  }

  setComponents(components) {
    this.components = normalizeComponents(components);
  }

  setShifts(shifts) {
    this.shifts = Array.isArray(shifts) ? shifts : [];
  }

  handleRoutecard(routecard) {
    const ts = Number(routecard?.ts);
    const value = routecard?.value ?? routecard?.routecard_id ?? "";
    const events = [];

    // Cancel any existing shift-end timer (new event means we reschedule)
    if (this.shiftEndTimer) {
      clearTimeout(this.shiftEndTimer);
      this.shiftEndTimer = null;
    }

    if (this.current && Number.isFinite(ts) && ts > this.current.startTs) {
      // Close previous record directly at the new route_card ts (no shift splitting)
      const lc = buildLiveComponent(
        this.current.component,
        this.current.startTs,
        ts,
        false
      );
      events.push(toTelemetryRecord(lc));
      this.current = null;
    }

    const comp = findComponentByNumber(this.components, value);

    // If component NOT found and there's an open record, close it
    if (!comp && Number.isFinite(ts) && this.current) {
      const lc = buildLiveComponent(
        this.current.component,
        this.current.startTs,
        ts,
        false
      );
      events.push(toTelemetryRecord(lc));
      this.current = null;
    }
    // If component found, create new open record
    else if (comp && Number.isFinite(ts)) {
      const shiftEnd = this.findShiftEndTime(ts, this.shifts);
      const open = buildLiveComponent(comp, ts, shiftEnd, false);  // Open record: end_time = shift_end
      events.push(toTelemetryRecord(open));
      this.current = {
        component: comp,
        startTs: ts,
        value: String(value),
        shiftEnd: shiftEnd,
        wasClosedAtShiftEnd: false
      };
      // Schedule timer to trigger at shift end
      this.scheduleShiftEndTimer();
    }

    return events;
  }

  findShiftEndTime(ts, shifts) {
    const d = new Date(ts);
    // Build intervals across the PREVIOUS, current AND next day so an overnight
    // shift (e.g. 20:00->08:00, end_day=2) that STARTED the previous day still
    // covers this day's early-morning hours. Return the end of the interval that
    // CONTAINS ts; if ts is in a gap, the end of the next interval to start.
    const prev = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    const intervals = [
      ...buildShiftIntervalsForDay(shifts, prev),
      ...buildShiftIntervalsForDay(shifts, d),
      ...buildShiftIntervalsForDay(shifts, next),
    ].sort((a, b) => a.start.getTime() - b.start.getTime());
    for (const interval of intervals) {
      if (ts >= interval.start.getTime() && ts < interval.end.getTime()) {
        return interval.end.getTime();
      }
    }
    for (const interval of intervals) {
      if (interval.start.getTime() > ts) return interval.end.getTime();
    }
    return ts + 8 * 60 * 60 * 1000;
  }

  scheduleShiftEndTimer() {
    if (!this.current || !Number.isFinite(this.current.shiftEnd)) return;

    const now = Date.now();
    const timeUntilShiftEnd = this.current.shiftEnd - now;

    if (timeUntilShiftEnd > 0) {
      this.shiftEndTimer = setTimeout(() => {
        this.onShiftEndTimer();
      }, timeUntilShiftEnd);
    }
  }

  onShiftEndTimer() {
    if (!this.current) return;

    // Close current record at shift end
    const closedRecord = buildLiveComponent(
      this.current.component,
      this.current.startTs,
      this.current.shiftEnd,
      true // _wasShiftEnd = true
    );
    this.pendingEvents.push(toTelemetryRecord(closedRecord));

    // Create new open record for next shift
    const newShiftEnd = this.findShiftEndTime(this.current.shiftEnd, this.shifts);
    const newOpenRecord = buildLiveComponent(
      this.current.component,
      this.current.shiftEnd,
      newShiftEnd,
      true // Mark as boundary
    );
    this.pendingEvents.push(toTelemetryRecord(newOpenRecord));

    // Update current to new shift
    this.current = {
      component: this.current.component,
      startTs: this.current.shiftEnd,
      value: this.current.value,
      shiftEnd: newShiftEnd,
      wasClosedAtShiftEnd: true
    };

    // Schedule timer for next shift end
    this.scheduleShiftEndTimer();
  }

  getPendingEvents() {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  clearPendingEvents() {
    this.pendingEvents = [];
    if (this.shiftEndTimer) {
      clearTimeout(this.shiftEndTimer);
      this.shiftEndTimer = null;
    }
  }

  rollover(nowTs) {
    const ts = Number(nowTs);
    if (!this.current || !Number.isFinite(ts) || ts <= this.current.startTs) {
      return [];
    }
    const segments = splitByShifts(this.current.startTs, ts, this.shifts);
    if (segments.length <= 1) return [];

    const events = [];
    // Close all completed segments
    for (let i = 0; i < segments.length - 1; i += 1) {
      const seg = segments[i];
      const lc = buildLiveComponent(
        this.current.component,
        seg.start,
        seg.end,
        true // Mark as shift-end boundary
      );
      events.push(toTelemetryRecord(lc));
    }

    // Open new segment at shift boundary (boundary record)
    const last = segments[segments.length - 1];
    if (last.start !== this.current.startTs) {
      const nextShiftEnd = this.findShiftEndTime(last.start, this.shifts);
      const open = buildLiveComponent(
        this.current.component,
        last.start,
        nextShiftEnd,
        true // Mark as shift-end boundary record
      );
      events.push(toTelemetryRecord(open));
      this.current.startTs = last.start;
      this.current.shiftEnd = nextShiftEnd;
      this.current.wasClosedAtShiftEnd = true; // Mark that this was created by shift end
    }
    return events;
  }

  restoreCurrent(liveComponent) {
    if (!liveComponent || typeof liveComponent !== "object") return false;
    const endTime = Number(liveComponent.end_time || 0);
    if (endTime > 0) return false;
    const startTs = Number(liveComponent.start_time);
    if (!Number.isFinite(startTs)) return false;
    const comp = componentFromLiveComponent(liveComponent);
    if (!comp || !comp.component_number) return false;
    this.current = { component: comp, startTs, value: String(comp.component_number) };
    return true;
  }

  closeCurrent(endTs) {
    const ts = Number(endTs);
    if (!this.current || !Number.isFinite(ts) || ts <= this.current.startTs) {
      return [];
    }
    const segments = splitByShifts(this.current.startTs, ts, this.shifts);
    const events = [];
    for (const seg of segments) {
      const lc = buildLiveComponent(
        this.current.component,
        seg.start,
        seg.end
      );
      events.push(toTelemetryRecord(lc));
    }
    this.current = null;
    return events;
  }
}

function normalizeReason(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    code: raw.code ?? raw.reason_code ?? "",
    reason: raw.reason ?? raw.reason_name ?? "",
    mode: raw.mode ?? "",
    category: raw.category ?? "",
  };
}

function normalizeReasons(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const r = normalizeReason(item);
    if (r && r.code !== "") out.push(r);
  }
  return out;
}

function findReasonByCode(reasons, reasonValue) {
  if (!reasonValue) return null;
  const key = String(reasonValue);
  return reasons.find((r) => String(r.code) === key) || null;
}

function buildLiveReason(reason, idleStart, idleEnd, wasShiftEnd = false) {
  return {
    name: reason.reason,
    code: reason.code,
    mode: reason.mode,
    category: reason.category,
    idle_start: idleStart,
    idle_end: idleEnd ?? 0,
    idle_duration: idleEnd ? Math.floor((idleEnd - idleStart) / 1000) : 0,
    _wasShiftEnd: wasShiftEnd, // Internal flag to track if closed by shift end
  };
}

function parseIdleFromMachineStatus(statusArray, reasonTs) {
  if (!Array.isArray(statusArray) || statusArray.length === 0) return reasonTs;

  const isIdle = (code) => {
    const status = Number(code);
    return status === 0 || status === 1 || status === 2;
  };

  // Array is in reverse order: [newest, ..., oldest]
  // Step 1: Check the LAST (newest) status
  const lastStatus = statusArray[0];
  const lastStatusTs = Number(lastStatus.ts);
  const lastStatusCode = lastStatus.value;

  // If last status.ts === reason_id.ts (event just arrived)
  if (lastStatusTs === reasonTs) {
    if (isIdle(lastStatusCode)) {
      // Last status is idle and matches timestamp → idle_start = last_status.ts
      return lastStatusTs;
    } else {
      // Last status is not idle → no idle period
      return reasonTs;
    }
  }

  // Step 2: If last status.ts != reason_id.ts, scan backward for idle transition
  let idleSequenceEndIdx = -1;
  for (let i = 0; i < statusArray.length; i++) {
    const code = statusArray[i].value;
    if (isIdle(code)) {
      idleSequenceEndIdx = i;  // Keep extending the idle sequence
    } else {
      // Hit non-idle, sequence ends
      break;
    }
  }

  // If no idle found, return reasonTs
  if (idleSequenceEndIdx === -1) {
    return reasonTs;
  }

  // If idle sequence extends to oldest, return oldest timestamp
  if (idleSequenceEndIdx === statusArray.length - 1) {
    return Number(statusArray[statusArray.length - 1].ts);
  }

  // Otherwise, idle started at the last index of the idle sequence
  return Number(statusArray[idleSequenceEndIdx].ts);
}

class MacroReasonProcessor {
  constructor(options = {}) {
    this.reasons = normalizeReasons(options.reasons || []);
    this.shifts = Array.isArray(options.shifts) ? options.shifts : [];
    this.current = null; // { reason, idleStart, ts }
    this.pendingEvents = []; // Events from timer callbacks
    this.shiftEndTimer = null; // Timeout ID for shift-end trigger
    this.latestMachineStatus = null; // { ts, value } - keep latest status in memory
  }

  setReasons(reasons) {
    this.reasons = normalizeReasons(reasons);
  }

  setShifts(shifts) {
    this.shifts = Array.isArray(shifts) ? shifts : [];
  }

  findShiftEndTime(ts, shifts) {
    const d = new Date(ts);
    // Build intervals across the PREVIOUS, current AND next day so an overnight
    // shift (e.g. 20:00->08:00, end_day=2) that STARTED the previous day still
    // covers this day's early-morning hours. Return the end of the interval that
    // CONTAINS ts; if ts is in a gap, the end of the next interval to start.
    const prev = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    const intervals = [
      ...buildShiftIntervalsForDay(shifts, prev),
      ...buildShiftIntervalsForDay(shifts, d),
      ...buildShiftIntervalsForDay(shifts, next),
    ].sort((a, b) => a.start.getTime() - b.start.getTime());
    for (const interval of intervals) {
      if (ts >= interval.start.getTime() && ts < interval.end.getTime()) {
        return interval.end.getTime();
      }
    }
    for (const interval of intervals) {
      if (interval.start.getTime() > ts) return interval.end.getTime();
    }
    return ts + 8 * 60 * 60 * 1000;
  }

  handleReason(reasonEvent, machineStatusArray) {
    const ts = Number(reasonEvent?.ts);
    const value = reasonEvent?.value ?? reasonEvent?.reason_id ?? "";
    const events = [];

    // Cancel any existing shift-end timer (new event means we reschedule)
    if (this.shiftEndTimer) {
      clearTimeout(this.shiftEndTimer);
      this.shiftEndTimer = null;
    }

    // Close previous reason record
    if (this.current && Number.isFinite(ts) && ts > this.current.ts) {
      // Check if previous was closed at shift end
      const wasClosedAtShiftEnd = this.current.wasClosedAtShiftEnd || false;

      if (wasClosedAtShiftEnd) {
        // Previous was boundary record, close it with current ts
        const liveReason = buildLiveReason(
          this.current.reason,
          this.current.idleStart,
          ts,
          true
        );
        events.push({
          ts: this.current.idleStart,
          values: { live_reason: liveReason },
        });
      } else {
        // Previous was still open, close normally
        const liveReason = buildLiveReason(
          this.current.reason,
          this.current.idleStart,
          ts,
          false
        );
        events.push({
          ts: this.current.idleStart,
          values: { live_reason: liveReason },
        });
      }
      this.current = null;
    }


    const reason = findReasonByCode(this.reasons, value);

    if (reason && Number.isFinite(ts)) {
      // FIRST CHECK: Is the machine idle at this moment?
      // Priority: Check latest machine_status in memory FIRST (from recent MQTT event)
      // Then fall back to database array if needed

      let statusAtReasonTime = null;

      // Check if latestMachineStatus in memory is recent enough (at or before reason_id time)
      if (this.latestMachineStatus && this.latestMachineStatus.ts <= ts) {
        statusAtReasonTime = this.latestMachineStatus.value;
      } else if (machineStatusArray && machineStatusArray.length > 0) {
        // Fall back to database array if no recent in-memory status
        // Array is in reverse order (newest first), so scan from oldest backward
        for (let i = machineStatusArray.length - 1; i >= 0; i--) {
          const statusTs = Number(machineStatusArray[i]?.ts);
          const statusVal = Number(machineStatusArray[i]?.value ?? machineStatusArray[i]);
          if (statusTs <= ts) {
            statusAtReasonTime = statusVal;
            break;
          }
        }
      } else {
      }

      // Check if machine is idle (0, 1, or 2)
      const isIdle = statusAtReasonTime !== null && (statusAtReasonTime === 0 || statusAtReasonTime === 1 || statusAtReasonTime === 2);

      if (!isIdle) {
        // Machine is NOT idle, don't create a reason record
        return events; // Return empty
      }

      // Machine IS idle, proceed to create record

      // idle_start = when the IDLE SEQUENCE started (scan backwards from latest idle)
      // Find the first idle after non-idle transition
      let actualIdleStart = ts; // default to reason_id ts
      if (machineStatusArray && machineStatusArray.length > 0) {
        // Scan from newest to oldest, find where idle sequence started
        let lastIdleIdx = -1;
        for (let i = 0; i < machineStatusArray.length; i++) {
          const statusVal = Number(machineStatusArray[i]?.value ?? machineStatusArray[i]);
          if (statusVal === 0 || statusVal === 1 || statusVal === 2) {
            lastIdleIdx = i;
          } else {
            // Hit a non-idle, idle sequence ends here
            break;
          }
        }

        if (lastIdleIdx >= 0) {
          // Found idle sequence, get the ts of the FIRST idle in sequence
          const idleStartIdx = lastIdleIdx;
          const idleStartTs = Number(machineStatusArray[idleStartIdx]?.ts);
          if (Number.isFinite(idleStartTs)) {
            actualIdleStart = idleStartTs;
          }
        }
      }

      const shiftEnd = this.findShiftEndTime(ts, this.shifts);

      const open = buildLiveReason(reason, actualIdleStart, 0, false);
      events.push({
        ts: actualIdleStart,
        values: { live_reason: open },
      });
      this.current = {
        reason,
        idleStart: actualIdleStart,
        ts,
        shiftEnd,
        wasClosedAtShiftEnd: false
      };
      // Schedule timer to trigger at shift end
      this.scheduleShiftEndTimer();
    } else {
    }

    return events;
  }

  scheduleShiftEndTimer() {
    if (!this.current || !Number.isFinite(this.current.shiftEnd)) return;

    const now = Date.now();
    const timeUntilShiftEnd = this.current.shiftEnd - now;

    if (timeUntilShiftEnd > 0) {
      this.shiftEndTimer = setTimeout(() => {
        this.onShiftEndTimer();
      }, timeUntilShiftEnd);
    }
  }

  onShiftEndTimer() {
    if (!this.current) return;

    // Close current record at shift end
    const closedRecord = buildLiveReason(
      this.current.reason,
      this.current.idleStart,
      this.current.shiftEnd,
      true // _wasShiftEnd = true
    );
    this.pendingEvents.push({
      ts: this.current.idleStart,
      values: { live_reason: closedRecord },
    });

    // Create new open record for next shift
    const newShiftEnd = this.findShiftEndTime(this.current.shiftEnd, this.shifts);
    const newOpenRecord = buildLiveReason(
      this.current.reason,
      this.current.shiftEnd,
      0, // idle_end = 0 for open records
      true // Mark as boundary
    );
    this.pendingEvents.push({
      ts: this.current.shiftEnd,
      values: { live_reason: newOpenRecord },
    });

    // Update current to new shift
    this.current = {
      reason: this.current.reason,
      idleStart: this.current.shiftEnd,
      ts: this.current.shiftEnd,
      shiftEnd: newShiftEnd,
      wasClosedAtShiftEnd: true
    };

    // Schedule timer for next shift end
    this.scheduleShiftEndTimer();
  }

  getPendingEvents() {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  handleMachineStatus(machineStatusEvent, shifts) {
    const ts = Number(machineStatusEvent?.ts);
    const statusCode = Number(machineStatusEvent?.value ?? machineStatusEvent?.machine_status ?? -1);
    const events = [];

    // Save latest machine_status in memory for future reason_id checks
    if (Number.isFinite(ts) && Number.isFinite(statusCode)) {
      this.latestMachineStatus = { ts, value: statusCode };
    }

    if (!this.current || !Number.isFinite(ts)) return events;

    const isIdle = statusCode === 0 || statusCode === 1 || statusCode === 2;
    const shiftEnd = this.findShiftEndTime(ts, shifts);
    const nextShiftStart = shiftEnd;
    const nextShiftEnd = this.findShiftEndTime(shiftEnd + 1, shifts);

    // Check if we're at or past shift boundary
    if (ts >= shiftEnd) {
      // Close current record at shift boundary
      const liveReason = buildLiveReason(
        this.current.reason,
        this.current.idleStart,
        shiftEnd,
        true
      );
      events.push({
        ts: this.current.idleStart,
        values: { live_reason: liveReason },
      });

      // If machine is still idle, create new open record for new shift
      if (isIdle) {
        const newOpen = buildLiveReason(
          this.current.reason,
          nextShiftStart,
          0,
          false
        );
        events.push({
          ts: nextShiftStart,
          values: { live_reason: newOpen },
        });
        this.current = {
          reason: this.current.reason,
          idleStart: nextShiftStart,
          ts: nextShiftStart,
          shiftEnd: nextShiftEnd,
          wasClosedAtShiftEnd: false
        };
      } else {
        this.current = null;
      }
    } else if (!isIdle) {
      // Machine became active (not idle) before shift end - close the record
      const liveReason = buildLiveReason(
        this.current.reason,
        this.current.idleStart,
        ts,
        false
      );
      events.push({
        ts: this.current.idleStart,
        values: { live_reason: liveReason },
      });
      this.current = null;
    }
    // If isIdle is true and ts < shiftEnd, do nothing (stay idle)

    return events;
  }

  rollover(nowTs) {
    const ts = Number(nowTs);
    if (!this.current || !Number.isFinite(ts) || ts <= this.current.ts) {
      return [];
    }
    const segments = splitByShifts(this.current.idleStart, ts, this.shifts);
    if (segments.length <= 1) return [];

    const events = [];
    // Close all completed segments
    for (let i = 0; i < segments.length - 1; i += 1) {
      const seg = segments[i];
      const liveReason = buildLiveReason(
        this.current.reason,
        seg.start,
        seg.end,
        true // Mark as shift-end boundary
      );
      events.push({
        ts: seg.start,
        values: { live_reason: liveReason },
      });
    }

    // Open NEW OPEN record for the last (still in-progress) segment
    const last = segments[segments.length - 1];
    if (last.start !== this.current.idleStart) {
      const newShiftEnd = this.findShiftEndTime(last.start, this.shifts);
      const newOpen = buildLiveReason(
        this.current.reason,
        last.start,
        0,  // OPEN record - idle_end = 0
        true // Mark that this was created by shift end
      );
      events.push({
        ts: last.start,
        values: { live_reason: newOpen },
      });

      this.current.idleStart = last.start;
      this.current.ts = last.start;
      this.current.shiftEnd = newShiftEnd;
      this.current.wasClosedAtShiftEnd = true; // Mark that this was created by shift end
    }

    return events;
  }
}

function normalizeOperator(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    code: raw.code ?? raw.operator_id ?? raw.operatorid ?? "",
    name: raw.name ?? raw.operatorname ?? "",
  };
}

function normalizeOperators(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const op = normalizeOperator(item);
    if (op && op.code !== "") out.push(op);
  }
  return out;
}

function findOperatorByCode(operators, operatorValue) {
  if (!operatorValue) return null;
  const key = String(operatorValue);
  return operators.find((o) => String(o.code) === key) || null;
}

function buildLiveOperator(operator, startTime, endTime, wasShiftEnd = false) {
  return {
    name: operator.name,
    code: operator.code,
    start_time: startTime,
    end_time: endTime ?? 0,
    duration: endTime ? Math.floor((endTime - startTime) / 1000) : 0,
    _wasShiftEnd: wasShiftEnd, // Internal flag to track if closed by shift end
  };
}

class MacroOperatorProcessor {
  constructor(options = {}) {
    this.operators = normalizeOperators(options.operators || []);
    this.shifts = Array.isArray(options.shifts) ? options.shifts : [];
    this.current = null; // { operator, ts, shiftEnd }
    this.pendingEvents = []; // Events from timer callbacks
    this.shiftEndTimer = null; // Timeout ID for shift-end trigger
  }

  setOperators(operators) {
    this.operators = normalizeOperators(operators);
  }

  setShifts(shifts) {
    this.shifts = Array.isArray(shifts) ? shifts : [];
  }

  findShiftEndTime(ts, shifts) {
    const d = new Date(ts);
    // Build intervals across the PREVIOUS, current AND next day so an overnight
    // shift (e.g. 20:00->08:00, end_day=2) that STARTED the previous day still
    // covers this day's early-morning hours. Return the end of the interval that
    // CONTAINS ts; if ts is in a gap, the end of the next interval to start.
    const prev = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    const intervals = [
      ...buildShiftIntervalsForDay(shifts, prev),
      ...buildShiftIntervalsForDay(shifts, d),
      ...buildShiftIntervalsForDay(shifts, next),
    ].sort((a, b) => a.start.getTime() - b.start.getTime());
    for (const interval of intervals) {
      if (ts >= interval.start.getTime() && ts < interval.end.getTime()) {
        return interval.end.getTime();
      }
    }
    for (const interval of intervals) {
      if (interval.start.getTime() > ts) return interval.end.getTime();
    }
    return ts + 8 * 60 * 60 * 1000;
  }

  handleOperator(operatorEvent) {
    const ts = Number(operatorEvent?.ts);
    const value = operatorEvent?.value ?? operatorEvent?.operator_id ?? "";
    const events = [];


    // Cancel any existing shift-end timer (new event means we reschedule)
    if (this.shiftEndTimer) {
      clearTimeout(this.shiftEndTimer);
      this.shiftEndTimer = null;
    }

    // Close previous operator record when we see a newer timestamp (event arriving newest-last)
    if (this.current && Number.isFinite(ts) && ts > this.current.ts) {
      // Check if previous was closed at shift end
      const wasClosedAtShiftEnd = this.current.wasClosedAtShiftEnd || false;

      if (wasClosedAtShiftEnd) {
        // Previous was boundary record, close it with current ts
        const liveOp = buildLiveOperator(
          this.current.operator,
          this.current.ts,
          ts,
          true
        );
        events.push({
          ts: this.current.ts,
          values: { live_operator: liveOp },
        });
      } else {
        // Previous was still open, close normally
        const liveOp = buildLiveOperator(
          this.current.operator,
          this.current.ts,
          ts,
          false
        );
        events.push({
          ts: this.current.ts,
          values: { live_operator: liveOp },
        });
      }
      this.current = null;
    } else if (this.current && Number.isFinite(ts)) {
    } else if (!this.current) {
    }

    const operator = findOperatorByCode(this.operators, value);
    if (!operator && Number.isFinite(ts) && this.current) {
      const liveOp = buildLiveOperator(this.current.operator, this.current.ts, ts, false);
      events.push({
        ts: this.current.ts,
        values: { live_operator: liveOp },
      });
      this.current = null;
    }
    else if (operator && Number.isFinite(ts)) {
      const shiftEnd = this.findShiftEndTime(ts, this.shifts);
      const open = buildLiveOperator(operator, ts, shiftEnd, false);  // Open record: end_time = shift_end
      events.push({
        ts,
        values: { live_operator: open },
      });
      this.current = {
        operator,
        ts,
        shiftEnd,
        wasClosedAtShiftEnd: false
      };

      // Schedule timer to trigger at shift end
      this.scheduleShiftEndTimer();
    } else {
    }

    return events;
  }

  scheduleShiftEndTimer() {
    if (!this.current || !Number.isFinite(this.current.shiftEnd)) return;

    const now = Date.now();
    const timeUntilShiftEnd = this.current.shiftEnd - now;

    if (timeUntilShiftEnd > 0) {
      this.shiftEndTimer = setTimeout(() => {
        this.onShiftEndTimer();
      }, timeUntilShiftEnd);
    }
  }

  onShiftEndTimer() {
    if (!this.current) {
      return;
    }

    // Close current record at shift end
    const closedRecord = buildLiveOperator(
      this.current.operator,
      this.current.ts,
      this.current.shiftEnd,
      true // _wasShiftEnd = true
    );
    this.pendingEvents.push({
      ts: this.current.ts,
      values: { live_operator: closedRecord },
    });

    // Create new open record for next shift
    const newShiftEnd = this.findShiftEndTime(this.current.shiftEnd, this.shifts);
    const newOpenRecord = buildLiveOperator(
      this.current.operator,
      this.current.shiftEnd,
      newShiftEnd,
      true // Mark as boundary
    );
    this.pendingEvents.push({
      ts: this.current.shiftEnd,
      values: { live_operator: newOpenRecord },
    });

    // Update current to new shift
    this.current = {
      operator: this.current.operator,
      ts: this.current.shiftEnd,
      shiftEnd: newShiftEnd,
      wasClosedAtShiftEnd: true
    };

    // Schedule timer for next shift end
    this.scheduleShiftEndTimer();
  }

  getPendingEvents() {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  rollover(nowTs) {
    const ts = Number(nowTs);
    if (!this.current || !Number.isFinite(ts) || ts <= this.current.ts) {
      return [];
    }
    const segments = splitByShifts(this.current.ts, ts, this.shifts);
    if (segments.length <= 1) return [];

    const events = [];
    // Close all completed segments
    for (let i = 0; i < segments.length - 1; i += 1) {
      const seg = segments[i];
      const liveOp = buildLiveOperator(
        this.current.operator,
        seg.start,
        seg.end,
        true // Mark as shift-end boundary
      );
      events.push({
        ts: seg.start,
        values: { live_operator: liveOp },
      });
    }

    // Open new segment at shift boundary (boundary record)
    const last = segments[segments.length - 1];
    if (last.start !== this.current.ts) {
      const newShiftEnd = this.findShiftEndTime(last.start, this.shifts);
      const newOpen = buildLiveOperator(
        this.current.operator,
        last.start,
        newShiftEnd,
        true // Mark as shift-end boundary record
      );
      events.push({
        ts: last.start,
        values: { live_operator: newOpen },
      });

      this.current.ts = last.start;
      this.current.shiftEnd = newShiftEnd;
      this.current.wasClosedAtShiftEnd = true; // Mark that this was created by shift end
    }

    return events;
  }
}

module.exports = {
  MacroComponentProcessor,
  MacroReasonProcessor,
  MacroOperatorProcessor,
  splitByShifts,
  normalizeComponents,
  normalizeReasons,
  normalizeOperators,
};
