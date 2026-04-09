import { telemetrykeydata } from "../../Services/app/operatorservice";

const RUN_STATUS = 3;
const IDLE_STATUSES = new Set([0, 1, 2]);
const DISCONNECT_STATUS = 100;
const ALARM_STATUS = 5;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseTimeToSeconds = (value) => {
  if (typeof value !== "string" || !value.includes(":")) {
    return 0;
  }

  const [hours = 0, minutes = 0, seconds = 0] = value
    .split(":")
    .map((part) => Number(part) || 0);

  return hours * 3600 + minutes * 60 + seconds;
};

const formatSecondsToTime = (totalSeconds) => {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(safeSeconds % 60).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
};

const parseTelemetryEntry = (entry) => {
  if (!entry) return null;

  const rawValue = entry.value;

  if (rawValue === undefined || rawValue === null) {
    return { ts: toNumber(entry.ts), value: null };
  }

  if (typeof rawValue === "string") {
    try {
      return {
        ts: toNumber(entry.ts),
        value: JSON.parse(rawValue),
      };
    } catch (error) {
      const numericValue = toNumber(rawValue);
      return {
        ts: toNumber(entry.ts),
        value: numericValue ?? rawValue,
      };
    }
  }

  return {
    ts: toNumber(entry.ts),
    value: rawValue,
  };
};

const buildStatusSegments = (machineStatusPoints = [], rangeEnd) => {
  const sortedPoints = machineStatusPoints
    .map(parseTelemetryEntry)
    .filter((point) => point?.ts !== null)
    .sort((a, b) => a.ts - b.ts);

  return sortedPoints.map((point, index) => {
    const nextPoint = sortedPoints[index + 1];
    const startTime = point.ts;
    const fallbackEnd = rangeEnd ?? startTime;
    const endTime = nextPoint?.ts ?? fallbackEnd;

    return {
      status: toNumber(point.value),
      start_time: startTime,
      end_time: Math.max(startTime, endTime),
    };
  });
};

const getOverlapSegment = (segmentStart, segmentEnd, windowStart, windowEnd) => {
  const start = Math.max(segmentStart, windowStart);
  const end = Math.min(segmentEnd, windowEnd);

  if (end <= start) return null;

  return {
    start_time: start,
    end_time: end,
    duration: end - start,
  };
};

const resolveComponentEndTime = (component, fallbackEndTime, pointTs) => {
  const explicitEnd = toNumber(component?.end_time);
  if (explicitEnd !== null && explicitEnd > 0) {
    return explicitEnd;
  }

  const startTime = toNumber(component?.start_time) ?? pointTs;
  const duration = toNumber(component?.duration);
  if (startTime !== null && duration !== null && duration > 0) {
    return startTime + duration * 1000;
  }

  return fallbackEndTime;
};

const getMatchingComponentDetails = (componentPoints = [], windowStart, windowEnd) => {
  let matchedComponent = null;
  let maxOverlap = 0;

  componentPoints
    .map(parseTelemetryEntry)
    .forEach((point) => {
      const component = point?.value;
      if (!component || typeof component !== "object") return;

      const componentStart = toNumber(component.start_time) ?? point.ts;
      const componentEnd = resolveComponentEndTime(component, windowEnd, point.ts);

      if (
        componentStart !== null &&
        componentEnd !== null &&
        windowStart >= componentStart &&
        windowEnd <= componentEnd
      ) {
        matchedComponent = {
          name: component.name || null,
          cycle_time: component.cycle_time || null,
          handling_time: component.handling_time || null,
          start_time: componentStart,
          end_time: componentEnd,
        };
        maxOverlap = windowEnd - windowStart;
        return;
      }

      const overlap = getOverlapSegment(
        componentStart,
        componentEnd,
        windowStart,
        windowEnd
      );

      if (overlap && overlap.duration > maxOverlap) {
        maxOverlap = overlap.duration;
        matchedComponent = {
          name: component.name || null,
          cycle_time: component.cycle_time || null,
          handling_time: component.handling_time || null,
          start_time: componentStart,
          end_time: componentEnd,
        };
      }
    });

  return matchedComponent;
};

const createWindowSummary = (partCountValue, statusSegments, componentPoints, deviceId) => {
  const startTime = toNumber(partCountValue?.start_time);
  const endTime = toNumber(partCountValue?.end_time);

  if (startTime === null || endTime === null || endTime <= startTime) {
    return null;
  }

  const runtime = [];
  const idletime = [];

  statusSegments.forEach((segment) => {
    if (segment.end_time <= startTime || segment.start_time >= endTime) {
      return;
    }

    const overlap = getOverlapSegment(
      segment.start_time,
      segment.end_time,
      startTime,
      endTime
    );

    if (!overlap) return;

    if (segment.status === RUN_STATUS) {
      runtime.push(overlap);
      return;
    }

    if (IDLE_STATUSES.has(segment.status)) {
      idletime.push(overlap);
    }
  });

  const totalRunDuration = runtime.reduce(
    (sum, item) => sum + item.duration,
    0
  );
  const totalIdleDuration = idletime.reduce(
    (sum, item) => sum + item.duration,
    0
  );
  const componentDetails = getMatchingComponentDetails(
    componentPoints,
    startTime,
    endTime
  );
  const componentCycleTime = componentDetails?.cycle_time || null;
  const componentHandlingTime = componentDetails?.handling_time || null;
  const totalCycleSeconds =
    parseTimeToSeconds(componentCycleTime) + parseTimeToSeconds(componentHandlingTime);

  return {
    device_id: deviceId,
    partscount: toNumber(partCountValue?.count ?? partCountValue?.parts_count) ?? 0,
    partscount_start_time: startTime,
    partscount_end_time: endTime,
    runtime,
    idletime,
    totalrunduration: totalRunDuration,
    totalidleduration: totalIdleDuration,
    component_name: componentDetails?.name || null,
    component_start_time: componentDetails?.start_time || null,
    component_end_time: componentDetails?.end_time || null,
    component_cycle_time: componentCycleTime,
    component_handling_time: componentHandlingTime,
    totalcycle: formatSecondsToTime(totalCycleSeconds),
  };
};

export const fetchPartsCountStatusSummary = async ({
  deviceIds = [],
  fromEpoch,
  toEpoch,
}) => {
  if (!Array.isArray(deviceIds) || deviceIds.length === 0 || !fromEpoch || !toEpoch) {
    return [];
  }

  const telemetryKeys = ["partscount_dur", "machine_status", "live_component"];

  const results = await Promise.all(
    deviceIds.map(async (deviceId) => {
      try {
        const data = await telemetrykeydata(
          deviceId,
          "DEVICE",
          telemetryKeys,
          fromEpoch,
          toEpoch
        );

        const partCountPoints = (data?.partscount_dur || [])
          .map(parseTelemetryEntry)
          .filter((point) => point?.value && typeof point.value === "object");

        const statusSegments = buildStatusSegments(data?.machine_status || [], toEpoch);
        const componentPoints = data?.live_component || [];

        return partCountPoints
          .map((point) =>
            createWindowSummary(point.value, statusSegments, componentPoints, deviceId)
          )
          .filter(Boolean);
      } catch (error) {
        console.error("Error fetching parts count telemetry for device", deviceId, error);
        return [];
      }
    })
  );

  return results.flat();
};

export {
  ALARM_STATUS,
  DISCONNECT_STATUS,
  IDLE_STATUSES,
  RUN_STATUS,
};
