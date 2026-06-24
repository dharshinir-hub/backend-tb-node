"use strict";

// Alarm processing logic.
// Standalone module: no dependency on tb-node-starter or macro_component.
//
// Concept
// -------
// machine_status === 4 or 5  => machine is in ALARM.
// Any other status (0,1,2,3,100,...) => machine left the alarm.
//
// When an alarm OPENS (first 4/5 with no open alarm) we try to match the
// status timestamp against the device's "alarms" telemetry (last 20). If a
// matching alarm object is found we use its message/number; otherwise we post
// an UNKNOWN live_alarm that stays open until the real "alarms" message
// arrives over MQTT and overwrites it.
//
// A live_alarm record:
//   {
//     alarm_message, alarm_number, alarm_type, alarm_status,
//     alarm_start,  // epoch ms
//     alarm_end,    // epoch ms when closed, else "-"
//     alarm_duration // integer seconds when closed, else "-"
//   }
// Every record is posted at ts === alarm_start, so re-posts overwrite in place.

const ALARM_STATUSES = new Set([4, 5]);

function roundToSecond(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n)) return n;
  return Math.round(n / 1000) * 1000;
}

// ---------------------------------------------------------------------------
// Shift helpers (duplicated from macro_component so this module is standalone)
// ---------------------------------------------------------------------------
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

function findShiftEndTime(ts, shifts) {
  const d = new Date(ts);
  const intervals = buildShiftIntervalsForDay(shifts, d);
  for (const interval of intervals) {
    const startMs = interval.start.getTime();
    const endMs = interval.end.getTime();
    if (ts >= startMs && ts < endMs) {
      return endMs;
    }
  }
  // Check previous day's overnight shift that may still cover ts
  const prevDay = new Date(d.getTime() - 24 * 60 * 60 * 1000);
  const prevIntervals = buildShiftIntervalsForDay(shifts, prevDay);
  for (const interval of prevIntervals) {
    const startMs = interval.start.getTime();
    const endMs = interval.end.getTime();
    if (ts >= startMs && ts < endMs) {
      return endMs;
    }
  }
  // Fall back to next shift start, else +8h
  const nextDay = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  const nextIntervals = buildShiftIntervalsForDay(shifts, nextDay);
  return nextIntervals.length > 0 ? nextIntervals[0].end.getTime() : ts + 8 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Alarm telemetry parsing
// ---------------------------------------------------------------------------
// The "alarms" telemetry key looks like:
//   [{ ts, value: "[]" }, { ts, value: "[{\"alarmNumber\":...}]" }]
// Returns [{ ts, objs: [ {alarmNumber, message, timestamp, severity} ] }]
function parseAlarmsTelemetry(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const ts = Number(entry?.ts);
    let value = entry?.value;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        value = null;
      }
    }
    const objs = Array.isArray(value) ? value.filter((o) => o && typeof o === "object") : [];
    out.push({ ts, objs });
  }
  return out;
}

// Normalize a raw alarm object (from telemetry or MQTT) to message/number/type.
function normalizeAlarmObject(obj) {
  if (!obj || typeof obj !== "object") return null;
  const message = obj.message ?? obj.alarm_message ?? "";
  const number = obj.alarmNumber ?? obj.alarm_number ?? obj.number ?? "";
  const type = obj.severity ?? obj.alarm_type ?? obj.type ?? "";
  if (!message && !number) return null;
  return {
    message: String(message || "").trim() || "UNKNOWN",
    number: number !== "" ? String(number) : "-",
    type: type !== "" ? String(type) : "-",
  };
}

// Find an alarm object in the telemetry whose ts EXACTLY matches the given ts.
// (The producer emits the "alarms" telemetry with the same ts as the
// machine_status 5 / alarm_start, so the match is exact — no rounding.)
// Returns the normalized alarm or null.
function findAlarmByTs(alarmsTelemetry, ts) {
  if (!Array.isArray(alarmsTelemetry)) return null;
  const target = Number(ts);
  for (const entry of alarmsTelemetry) {
    if (Number(entry.ts) !== target) continue;
    for (const obj of entry.objs) {
      const norm = normalizeAlarmObject(obj);
      if (norm) return norm;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// live_alarm builders
// ---------------------------------------------------------------------------
function buildLiveAlarm(a) {
  const closed = Number.isFinite(Number(a.end));
  return {
    alarm_message: a.message ?? "UNKNOWN",
    alarm_number: a.number ?? "-",
    alarm_type: a.type ?? "-",
    alarm_status: a.status ?? "-",
    alarm_start: a.start,
    alarm_end: closed ? Number(a.end) : "-",
    alarm_duration: closed ? Math.max(0, Math.floor((Number(a.end) - a.start) / 1000)) : "-",
    _wasShiftEnd: a.wasShiftEnd || false,
  };
}

function toRecord(liveAlarm) {
  return { ts: liveAlarm.alarm_start, values: { live_alarm: liveAlarm } };
}

// ---------------------------------------------------------------------------
// AlarmProcessor
// ---------------------------------------------------------------------------
class AlarmProcessor {
  constructor(options = {}) {
    this.shifts = Array.isArray(options.shifts) ? options.shifts : [];
    // Current open alarm segment, or null.
    //   { start, message, number, type, status, shiftEnd, wasShiftEnd }
    this.open = null;
    // The ORIGINAL start ts of the current alarm episode. An "alarms" message
    // is attributed to this episode only when its ts === episodeStart. This is
    // also the ts the producer stamps on the "alarms" telemetry, so it links a
    // late alarm message back to the alarm that opened the episode (even across
    // shift boundaries). Reset whenever a brand-new episode opens.
    this.episodeStart = null;
    // Closed segments of the current episode (from shift-boundary splits or the
    // final close). Kept so a late "alarms" message can fill them in too.
    //   { start, end, status, wasShiftEnd }
    this.episodeClosedSegments = [];
    this.pendingEvents = [];
    this.shiftEndTimer = null;
  }

  setShifts(shifts) {
    this.shifts = Array.isArray(shifts) ? shifts : [];
  }

  isAlarmStatus(code) {
    return ALARM_STATUSES.has(Number(code));
  }

  // -------------------------------------------------------------------------
  // machine_status driven
  // -------------------------------------------------------------------------
  // alarmsTelemetry: parsed array from parseAlarmsTelemetry() (last ~20).
  handleMachineStatus(event, alarmsTelemetry) {
    // Use the exact event timestamp so alarm_start === machine_status ts.
    const ts = Number(event?.ts);
    const code = Number(event?.value ?? event?.machine_status);
    const events = [];
    if (!Number.isFinite(ts) || !Number.isFinite(code)) return events;

    this.clearShiftEndTimer();

    if (this.isAlarmStatus(code)) {
      if (!this.open) {
        // OPEN a new alarm episode.
        events.push(...this.openAlarm(ts, alarmsTelemetry));
      } else if (ts >= this.open.shiftEnd) {
        // Repeated alarm status that lands on/after a shift boundary:
        // close the running segment at the shift end and reopen for the new
        // shift, carrying the same alarm message forward.
        events.push(...this.splitAtShiftEnd(this.open.shiftEnd));
      }
      // else: same ongoing alarm, nothing to emit.
      this.scheduleShiftEndTimer();
    } else {
      // Non-alarm status closes the open episode.
      if (this.open) {
        events.push(...this.closeAlarm(ts));
      }
    }

    return events;
  }

  openAlarm(ts, alarmsTelemetry) {
    const match = findAlarmByTs(alarmsTelemetry, ts);
    const shiftEnd = findShiftEndTime(ts, this.shifts);
    // Brand-new episode: reset episode tracking.
    this.episodeStart = ts;
    this.episodeClosedSegments = [];
    this.open = {
      start: ts,
      message: match ? match.message : "UNKNOWN",
      number: match ? match.number : "-",
      type: match ? match.type : "-",
      status: "-",
      shiftEnd,
      wasShiftEnd: false,
    };
    return [toRecord(buildLiveAlarm({ ...this.open, end: undefined }))];
  }

  closeAlarm(endTs) {
    const seg = this.open;
    const live = buildLiveAlarm({ ...seg, end: endTs });
    // Remember the closed segment so a late alarms message (ts === episodeStart)
    // can still fill it in. Kept until the next episode opens.
    this.episodeClosedSegments.push({
      start: seg.start,
      end: endTs,
      status: seg.status,
      wasShiftEnd: seg.wasShiftEnd,
    });
    this.open = null;
    this.clearShiftEndTimer();
    return [toRecord(live)];
  }

  // Close the running segment at shiftEnd and reopen a fresh segment for the
  // next shift carrying the same alarm details. Used by both the live status
  // path and the shift-end timer.
  splitAtShiftEnd(shiftEnd) {
    if (!this.open) return [];
    const events = [];
    const seg = this.open;

    // Close current segment at the boundary.
    events.push(toRecord(buildLiveAlarm({ ...seg, end: shiftEnd, wasShiftEnd: true })));
    this.episodeClosedSegments.push({
      start: seg.start,
      end: shiftEnd,
      status: seg.status,
      wasShiftEnd: true,
    });

    // Reopen for the new shift.
    const nextShiftEnd = findShiftEndTime(shiftEnd, this.shifts);
    this.open = {
      start: shiftEnd,
      message: seg.message,
      number: seg.number,
      type: seg.type,
      status: seg.status,
      shiftEnd: nextShiftEnd,
      wasShiftEnd: true,
    };
    events.push(toRecord(buildLiveAlarm({ ...this.open, end: undefined })));
    return events;
  }

  // -------------------------------------------------------------------------
  // "alarms" MQTT message driven
  // -------------------------------------------------------------------------
  // objs:     array of raw alarm objects, e.g. [{ alarmNumber, message, severity }]
  // alarmsTs: the ts stamped on the "alarms" telemetry. The message is applied
  //           ONLY to the episode whose original start === alarmsTs, so an
  //           alarm can never leak onto an unrelated earlier/later episode.
  handleAlarms(objs, alarmsTs) {
    const events = [];
    let norm = null;
    if (Array.isArray(objs)) {
      for (const o of objs) {
        norm = normalizeAlarmObject(o);
        if (norm) break;
      }
    }
    if (!norm) return events;

    // Only attribute this alarm to the current episode if the ts matches its
    // original start. No match => ignore (do not overwrite anything).
    if (this.episodeStart === null || Number(alarmsTs) !== Number(this.episodeStart)) {
      return events;
    }

    // Overwrite the open segment (if any) of this episode.
    if (this.open) {
      this.open.message = norm.message;
      this.open.number = norm.number;
      this.open.type = norm.type;
      events.push(toRecord(buildLiveAlarm({ ...this.open, end: undefined })));
    }

    // Fill every closed segment of this episode (handles cross-shift carry).
    for (const seg of this.episodeClosedSegments) {
      seg.message = norm.message;
      seg.number = norm.number;
      seg.type = norm.type;
      events.push(
        toRecord(
          buildLiveAlarm({
            start: seg.start,
            end: seg.end,
            message: norm.message,
            number: norm.number,
            type: norm.type,
            status: seg.status,
            wasShiftEnd: seg.wasShiftEnd,
          })
        )
      );
    }

    return events;
  }

  // -------------------------------------------------------------------------
  // Shift-end timer + rollover (mirrors macro_component processors)
  // -------------------------------------------------------------------------
  scheduleShiftEndTimer() {
    if (!this.open || !Number.isFinite(this.open.shiftEnd)) return;
    const timeUntil = this.open.shiftEnd - Date.now();
    if (timeUntil > 0) {
      this.shiftEndTimer = setTimeout(() => this.onShiftEndTimer(), timeUntil);
    }
  }

  clearShiftEndTimer() {
    if (this.shiftEndTimer) {
      clearTimeout(this.shiftEndTimer);
      this.shiftEndTimer = null;
    }
  }

  onShiftEndTimer() {
    if (!this.open) return;
    const events = this.splitAtShiftEnd(this.open.shiftEnd);
    this.pendingEvents.push(...events);
    this.scheduleShiftEndTimer();
  }

  getPendingEvents() {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  // Catch-up if no MQTT event fired exactly at the boundary.
  rollover(nowTs) {
    const ts = Number(nowTs);
    if (!this.open || !Number.isFinite(ts)) return [];
    const events = [];
    // Walk forward across any boundaries already crossed.
    while (this.open && ts >= this.open.shiftEnd) {
      events.push(...this.splitAtShiftEnd(this.open.shiftEnd));
    }
    return events;
  }

  // -------------------------------------------------------------------------
  // Restore an open episode from a persisted live_alarm (on restart).
  // -------------------------------------------------------------------------
  restoreOpen(liveAlarm) {
    if (!liveAlarm || typeof liveAlarm !== "object") return false;
    if (liveAlarm.alarm_end !== "-" && liveAlarm.alarm_end !== undefined && liveAlarm.alarm_end !== null) {
      return false; // already closed
    }
    const start = Number(liveAlarm.alarm_start);
    if (!Number.isFinite(start)) return false;
    this.open = {
      start,
      message: liveAlarm.alarm_message ?? "UNKNOWN",
      number: liveAlarm.alarm_number ?? "-",
      type: liveAlarm.alarm_type ?? "-",
      status: liveAlarm.alarm_status ?? "-",
      shiftEnd: findShiftEndTime(start, this.shifts),
      wasShiftEnd: false,
    };
    // Best-effort: treat the restored open record's start as the episode start.
    this.episodeStart = start;
    this.episodeClosedSegments = [];
    return true;
  }
}

module.exports = {
  AlarmProcessor,
  parseAlarmsTelemetry,
  normalizeAlarmObject,
  findAlarmByTs,
  findShiftEndTime,
  buildLiveAlarm,
  ALARM_STATUSES,
};
