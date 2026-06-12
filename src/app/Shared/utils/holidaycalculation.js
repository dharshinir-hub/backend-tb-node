import dayjs from 'dayjs';
export const TWENTY_HOURS_SECONDS = 20 * 3600;



export function timeToSeconds(timeStr = '00:00:00') {
    const [h = 0, m = 0, s = 0] = String(timeStr).split(':').map(Number);
    return h * 3600 + m * 60 + s;
}

export function getShiftTimes(shiftList, shiftNo, date) {
    if (!Array.isArray(shiftList) || shiftList.length === 0 || !date) {
        return { from: null, to: null };
    }

    const baseDate = dayjs(date).format('YYYY-MM-DD');
    const byOffset = (base, dayVal) =>
        dayjs(base).add(Number(dayVal) - 1, 'day').format('YYYY-MM-DD');

    if (shiftNo === 'allshift' || shiftNo === 'all shift') {
        const sorted = [...shiftList].sort((a, b) => Number(a.shift_no) - Number(b.shift_no));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        if (!first || !last) return { from: null, to: null };
        return {
            from: new Date(`${byOffset(baseDate, first.start_day)}T${first.start_time}`).getTime(),
            to: new Date(`${byOffset(baseDate, last.end_day)}T${last.end_time}`).getTime(),
        };
    }

    const sd = shiftList.find((s) => String(s.shift_no) === String(shiftNo));
    if (!sd) return { from: null, to: null };
    return {
        from: new Date(`${byOffset(baseDate, sd.start_day)}T${sd.start_time}`).getTime(),
        to: new Date(`${byOffset(baseDate, sd.end_day)}T${sd.end_time}`).getTime(),
    };
}


export function buildShiftTimeRanges(shifts, shiftNo, startDate, endDate) {
    const ranges = [];
    let day = dayjs(startDate).startOf('day');
    const lastDay = dayjs(endDate).startOf('day');
    const shiftNos = shiftNo === 'allshift'
        ? shifts.map((s) => String(s.shift_no))
        : [String(shiftNo)];

    while (!day.isAfter(lastDay)) {
        for (const sNo of shiftNos) {
            const t = getShiftTimes(shifts, sNo, day);
            if (t.from && t.to) {
                ranges.push({ shiftNo: sNo, date: day.format('YYYY-MM-DD'), ...t });
            }
        }
        day = day.add(1, 'day');
    }
    return ranges;
}

// Resolve a break time-of-day ("HH:mm:ss") to the absolute epoch-ms that falls
// inside the given shift window [shiftFrom, shiftTo]. Tries the shift's start
// day and the following days so overnight shifts (start_day < end_day) place
// their breaks on the correct calendar date. Returns null if none fits.
function placeTimeWithinShift(baseDate, timeStr, shiftFrom, shiftTo) {
    for (let offset = 0; offset <= 2; offset++) {
        const day = dayjs(baseDate).add(offset, 'day').format('YYYY-MM-DD');
        const t = new Date(`${day}T${timeStr}`).getTime();
        if (t >= shiftFrom && t <= shiftTo) return t;
    }
    return null;
}

// Build the absolute [from, to] break windows for a single shift on the date
// implied by its resolved shift window. Reads break_details (start_time /
// end_time) off the shift record. Windows are clamped to the shift window.
export function getBreakWindowsForShift(shiftData, shiftFrom, shiftTo) {
    if (!shiftData || !Array.isArray(shiftData.break_details) || !shiftFrom || !shiftTo) {
        return [];
    }
    const baseDate = dayjs(shiftFrom).format('YYYY-MM-DD');
    const windows = [];
    for (const brk of shiftData.break_details) {
        if (!brk?.start_time || !brk?.end_time) continue;
        const from = placeTimeWithinShift(baseDate, brk.start_time, shiftFrom, shiftTo);
        let to = placeTimeWithinShift(baseDate, brk.end_time, shiftFrom, shiftTo);
        if (from == null || to == null) continue;
        if (to <= from) to += 24 * 3600 * 1000; // break end past midnight within shift
        windows.push({ from, to: Math.min(to, shiftTo) });
    }
    return windows;
}

// Keep only telemetry points whose ts falls inside [from, to). Non-array values
// pass through untouched. End boundary is exclusive (to - 1).
export function filterByShift(data, from, to) {
    if (!data) return null;
    const result = {};
    for (const key of Object.keys(data)) {
        result[key] = Array.isArray(data[key])
            ? data[key].filter((p) => {
                const ts = Number(p.ts);
                return ts >= from && ts <= to - 1;
            })
            : data[key];
    }
    return result;
}

// Latest (highest ts) point in a telemetry array, or null.
export function getLatestDataPoint(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.reduce((latest, point) =>
        (Number(point.ts) > Number(latest.ts) ? point : latest)
    );
}

// Map a raw machine_status value to one of the break_* buckets.
// 3 → run, 0/1/2 → idle, 4/5 → alarm, 100 → disconnect (matches the rest of the
// dashboard's status handling). Any other value is ignored.
function statusToBreakBucket(status) {
    if (status === 3) return 'break_run';
    if (status === 0 || status === 1 || status === 2) return 'break_idle';
    if (status === 4 || status === 5) return 'break_alarm';
    if (status === 100) return 'break_disconnect';
    return null;
}

// Turn a machine_status telemetry array into [from, to] segments. Each point's
// status holds until the next point's ts; the final point extends to rangeEnd.
// ts values are epoch-ms, matching the break windows.
function buildStatusSegments(statusPoints, rangeEnd) {
    const pts = (Array.isArray(statusPoints) ? statusPoints : [])
        .map((p) => ({ ts: Number(p.ts), status: parseInt(p.value, 10) }))
        .filter((p) => Number.isFinite(p.ts) && !Number.isNaN(p.status))
        .sort((a, b) => a.ts - b.ts);
    return pts.map((p, i) => {
        const end = pts[i + 1] ? pts[i + 1].ts : rangeEnd;
        return { status: p.status, from: p.ts, to: Math.max(p.ts, end) };
    });
}

// The run/idle/alarm/disconnect time that occurred inside each break window,
// derived directly from raw machine_status. The status segment active during a
// break is overlapped with the break window and its overlap duration (seconds)
// added to the matching bucket — 3 = run, 0/1/2 = idle, 4/5 = alarm,
// 100 = disconnect. Sums every break window passed for one device+shift+date
// and returns the break_* totals (in seconds).
export function computeBreakDurations(rawData, shiftFrom, breakWindows) {
    const acc = { break_run: 0, break_idle: 0, break_alarm: 0, break_disconnect: 0 };
    if (!rawData || !Array.isArray(breakWindows) || breakWindows.length === 0) return acc;

    // For the current (ongoing) shift a break window may lie partly or wholly in
    // the future. Clamp every overlap to "now" so a break only contributes time
    // once its start has actually arrived (and only up to the elapsed portion of
    // a break still in progress). For past shifts `now` is well beyond the
    // windows, so this clamp has no effect.
    const now = Date.now();

    // Last segment falls back to the furthest break end so a status that started
    // before the break and never changed still covers the whole window.
    const rangeEnd = breakWindows.reduce((mx, bw) => Math.max(mx, bw?.to || 0), 0);
    const segments = buildStatusSegments(rawData.machine_status, rangeEnd);
    if (!segments.length) return acc;

    for (const bw of breakWindows) {
        if (!bw || bw.to <= bw.from) continue;
        if (bw.from >= now) continue; // break not started yet → take nothing
        for (const seg of segments) {
            const start = Math.max(seg.from, bw.from);
            const end = Math.min(seg.to, bw.to, now); // never count past "now"
            if (end <= start) continue; // no overlap with this break window
            const bucket = statusToBreakBucket(seg.status);
            if (bucket) acc[bucket] += (end - start) / 1000; // ms → seconds
        }
    }
    return acc;
}


// The core rule shared by both screens: a date is an auto-detected holiday when
//   (a) run% <= 20% AND (alarm + idle + disconnect) > 20h, OR
//   (b) there is no data at all (run and downtime are both 0).
export function isAutoHoliday(runSecs, downtimeSecs, runPct) {
    const runConditionMet = runPct <= 20;
    const downtimeConditionMet = downtimeSecs > TWENTY_HOURS_SECONDS;
    const bothAreZero = runSecs === 0 && downtimeSecs === 0;
    return (runConditionMet && downtimeConditionMet) || bothAreZero;
}



// All localStorage key shapes used to persist holiday / production overrides.
export const holidayKeys = {
    manual: (cid) => `manualHolidays_${cid}`,
    auto: (cid) => `autoHolidays_${cid}`,
    production: (cid) => `manualProductionDays_${cid}`,
    shiftManual: (sNo, cid) => `manualHolidays_shift_${sNo}_${cid}`,
    shiftAuto: (sNo, cid) => `autoHolidays_shift_${sNo}_${cid}`,
    shiftProduction: (sNo, cid) => `manualProductionDays_shift_${sNo}_${cid}`,
};

// Read a JSON string-array from localStorage into a Set, tolerating bad/missing
// values.
export function readDateSet(key) {
    try {
        return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
    } catch {
        return new Set();
    }
}

// Whole-day holiday set as the dashboard sees it: manual + auto holidays, plus
// the selected shift's per-shift holidays when a single shift is active, minus
// any production-day overrides (per-shift and whole-day).
export function buildMergedHolidaySet(customerId, selectedShift) {
    const set = new Set();
    for (const d of readDateSet(holidayKeys.manual(customerId))) set.add(d);
    for (const d of readDateSet(holidayKeys.auto(customerId))) set.add(d);

    if (selectedShift && selectedShift !== 'allshift') {
        for (const d of readDateSet(holidayKeys.shiftManual(selectedShift, customerId))) set.add(d);
        for (const d of readDateSet(holidayKeys.shiftAuto(selectedShift, customerId))) set.add(d);
        for (const d of readDateSet(holidayKeys.shiftProduction(selectedShift, customerId))) set.delete(d);
    }

    for (const d of readDateSet(holidayKeys.production(customerId))) set.delete(d);
    return set;
}

/* -------------------------------------------------------------------------- */
/* Server-side override handling (`manual_holiday` customer attribute)         */
/* -------------------------------------------------------------------------- */

// Normalize a fetched `manual_holiday` customer-attribute value into the same
// Set/Map shapes the rest of the holiday logic expects. Tolerates missing or
// malformed values. Shape stored by HolidayList:
//   { manualHolidays: [], manualProductionDays: [],
//     shiftManualHolidays: { [shiftNo]: [] }, shiftManualProductionDays: {…} }
export function parseManualHolidayAttr(val) {
    val = val || {};
    const toMap = (obj) => {
        const m = new Map();
        if (obj && typeof obj === 'object') {
            for (const k of Object.keys(obj)) m.set(String(k), new Set(obj[k] || []));
        }
        return m;
    };
    return {
        manualHolidays: new Set(val.manualHolidays || []),
        manualProductionDays: new Set(val.manualProductionDays || []),
        perShiftHol: toMap(val.shiftManualHolidays),
        perShiftProd: toMap(val.shiftManualProductionDays),
    };
}

// Whole-day holiday set, equivalent to buildMergedHolidaySet but sourcing the
// manual/production overrides from a parsed `manual_holiday` attribute (server)
// instead of localStorage. Auto-detected holidays still come from localStorage.
export function buildMergedHolidaySetFromAttr(parsed, customerId, selectedShift) {
    const set = new Set();
    for (const d of parsed.manualHolidays) set.add(d);
    for (const d of readDateSet(holidayKeys.auto(customerId))) set.add(d);

    if (selectedShift && selectedShift !== 'allshift') {
        const sNo = String(selectedShift);
        for (const d of (parsed.perShiftHol.get(sNo) || [])) set.add(d);
        for (const d of readDateSet(holidayKeys.shiftAuto(sNo, customerId))) set.add(d);
        for (const d of (parsed.perShiftProd.get(sNo) || [])) set.delete(d);
    }

    for (const d of parsed.manualProductionDays) set.delete(d);
    return set;
}

// Per-shift override maps: Map<shiftNo, Set<date>> for both holidays and
// production-day overrides.
export function loadPerShiftOverrides(shifts, customerId) {
    const perShiftHol = new Map();
    const perShiftProd = new Map();
    for (const s of shifts) {
        const sNo = String(s.shift_no);
        perShiftHol.set(sNo, readDateSet(holidayKeys.shiftManual(sNo, customerId)));
        perShiftProd.set(sNo, readDateSet(holidayKeys.shiftProduction(sNo, customerId)));
    }
    return { perShiftHol, perShiftProd };
}

// Factory for the shift-date exclusion predicate. Priority (highest first):
//   per-shift production → whole-day production → per-shift holiday → whole-day holiday
// Returns (shiftNo, dateStr) => boolean (true = excluded / treated as holiday).
export function makeShiftExclusionChecker({ perShiftHol, perShiftProd, wholeDayProd, wholeDayHol }) {
    return (shiftNo, dateStr) => {
        const sNo = String(shiftNo);
        if (perShiftProd.get(sNo)?.has(dateStr)) return false;  // shift production → include
        if (wholeDayProd.has(dateStr)) return false;            // whole-day production → include
        if (perShiftHol.get(sNo)?.has(dateStr)) return true;    // shift holiday → exclude
        return wholeDayHol.has(dateStr);                        // whole-day holiday → exclude
    };
}
