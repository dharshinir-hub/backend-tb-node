import { telemetrykeydata } from "../../Services/app/operatorservice";
import dayjs from "dayjs";


export async function fetchPartsShiftWiseByDate({
  machineIds = [],
  shifts = [],
  fromEpoch,
  toEpoch,
  getShiftTimes,
}) {
  if (!machineIds.length || !Array.isArray(shifts) || !fromEpoch || !toEpoch) {
    return [];
  }

  console.log("📅 Range:", {
    from: dayjs(fromEpoch).format("YYYY-MM-DD HH:mm:ss"),
    to: dayjs(toEpoch).format("YYYY-MM-DD HH:mm:ss"),
  });


  const telemetryKeys = ["targetparts", "totalparts"];
  const telemetryCache = new Map();
  const results = [];

  const getLatest = (arr) =>
    Array.isArray(arr) && arr.length
      ? arr.reduce((a, b) => (a.ts > b.ts ? a : b))
      : null;

/** 🔹 Build all shift windows between fromEpoch–toEpoch */
const buildShiftWindows = (fromEpoch, toEpoch) => {
  const windows = [];
  let current = new Date(fromEpoch);

  while (current.getTime() < toEpoch) {
    for (const s of shifts) {
      const { from, to } = getShiftTimes(shifts, String(s.shift_no), current);
      if (!from || !to) continue;
      if (to < fromEpoch || from > toEpoch) continue;

      const adjustedTo = Math.min(to - 1, toEpoch);

      windows.push({
        shiftNo: String(s.shift_no),
        from: Math.max(from, fromEpoch),
        to: adjustedTo,
      });
    }
    current.setDate(current.getDate() + 1);
  }

  return windows.sort((a, b) => a.from - b.from);
};


  const shiftWindows = buildShiftWindows(fromEpoch, toEpoch);
  shiftWindows.forEach((w) =>
    console.log(
      `  ▶️ Shift ${w.shiftNo}: ${dayjs(w.from).format("MMM DD HH:mm")} → ${dayjs(
        w.to
      ).format("MMM DD HH:mm")}`
    )
  );

  /** 🧠 Cache + fetch once per machine */
  async function getTelemetryCached(deviceId, from, to) {
    const key = `${deviceId}_${from}_${to}`;
    if (telemetryCache.has(key)) return telemetryCache.get(key);

    const data = await telemetrykeydata(deviceId, "DEVICE", telemetryKeys, from, to);

    if (data) {
      console.log(`   ↳ targetparts: ${data.targetparts?.length || 0}, totalparts: ${data.totalparts?.length || 0}`);
    } else {
      console.warn(`   ⚠️ No telemetry data for ${deviceId}`);
    }

    telemetryCache.set(key, data);
    return data;
  }

  const telemetryMap = new Map();
  await Promise.all(
    machineIds.map(async (machineId) => {
      const data = await getTelemetryCached(machineId, fromEpoch, toEpoch);
      telemetryMap.set(machineId, data);
    })
  );


  for (const window of shiftWindows) {
    const { shiftNo, from, to } = window;
    let totalTarget = 0;
    let totalShots = 0;

    for (const machineId of machineIds) {
      const machineData = telemetryMap.get(machineId);
      if (!machineData) continue;

      const targetPoints = (machineData?.targetparts || []).filter(
        (p) => p.ts >= from && p.ts <= to
      );
      const totalPoints = (machineData?.totalparts || []).filter(
        (p) => p.ts >= from && p.ts <= to
      );

      const latestTarget = getLatest(targetPoints);
      const latestTotal = getLatest(totalPoints);

      const targetVal = latestTarget ? parseFloat(latestTarget.value) || 0 : 0;
      let shotsVal = 0;

      if (latestTotal?.value) {
        try {
          const parsed = JSON.parse(latestTotal.value);
          console.log(parsed , 'parsed')
          shotsVal = parsed.totalshots || 0;
        } catch (e) {
          console.error(`Error parsing totalparts for ${machineId}`, e);
        }
      }

      totalTarget += targetVal;
      totalShots += shotsVal;
    }

    results.push({
      date: dayjs(from).format("YYYY-MM-DD"),
      shift: shiftNo,
      target: totalTarget,
      totalshots: totalShots,
    });
  }
  console.log("🏁 Final Shift-Wise Results:", results);
  return results;
}

/* ✅ Summary + Aggregation Helpers (unchanged)                       */
export function getSummaryStats(data = []) {
  const todayStr = dayjs().format("YYYY-MM-DD");
  const yesterdayStr = dayjs().subtract(1, "day").format("YYYY-MM-DD");

  const today = dayjs();
  const dayOfWeek = today.day();

  const weekStart = today
    .subtract(dayOfWeek === 0 ? 6 : dayOfWeek - 1, "day")
    .startOf("day");

  const monthStart = today.startOf("month");

  const aggregate = (arr) => {
    const target = arr.reduce((a, b) => a + b.target, 0);
    const total = arr.reduce((a, b) => a + b.totalshots, 0);
    const difference = total - target;
    const performance = target ? Math.round((total / target) * 100) : 0;
    return { target, total, difference, performance };
  };

  return {
    today: aggregate(data.filter(d => d.date === todayStr)),
    yesterday: aggregate(data.filter(d => d.date === yesterdayStr)),

    // ✅ Monday → today
    week: aggregate(
      data.filter(d => {
        const date = dayjs(d.date);
        return (
          date.isSame(weekStart, "day") ||
          date.isAfter(weekStart, "day")
        );
      })
    ),

    month: aggregate(
      data.filter(d => {
        const date = dayjs(d.date);
        return (
          date.isSame(monthStart, "day") ||
          date.isAfter(monthStart, "day")
        );
      })
    ),
  };
}

/* ✅ Summary + Aggregation Helpers (unchanged)                       */
export function getDayWiseData(data = []) {
  const grouped = {};
  data.forEach((d) => {
    if (!grouped[d.date]) grouped[d.date] = { target: 0, total: 0 };
    grouped[d.date].target += d.target;
    grouped[d.date].total += d.totalshots;
  });
  return Object.keys(grouped)
    .sort()
    .map((date) => {
      const { target, total } = grouped[date];
      const difference = total - target;
      const performance = target ? Math.round((total / target) * 100) : 0;
      return { date, target, total, difference, performance };
    });
}

export function getMonthWiseData(data = []) {
  const grouped = {};
  data.forEach((d) => {
    const month = dayjs(d.date).format("YYYY-MM");
    if (!grouped[month]) grouped[month] = { target: 0, total: 0 };
    grouped[month].target += d.target;
    grouped[month].total += d.totalshots;
  });
  return Object.keys(grouped)
    .sort()
    .map((month) => {
      const { target, total } = grouped[month];
      const difference = total - target;
      const performance = target ? Math.round((total / target) * 100) : 0;
      return { month, target, total, difference, performance };
    });
}

export async function getPartsReport({ machineIds, shifts, fromEpoch, toEpoch, getShiftTimes }) {
  const shiftData = await fetchPartsShiftWiseByDate({ machineIds, shifts, fromEpoch, toEpoch, getShiftTimes });
  const summary = getSummaryStats(shiftData);
  const dayWise = getDayWiseData(shiftData);
  const monthWise = getMonthWiseData(shiftData);
  return { shiftData, summary, dayWise, monthWise };
}