// utils/utilizationCalculations.js

import { telemetrykeydata } from "../../Services/app/operatorservice";


/**
 * Fetch raw utilization data for devices within a time range
 */
export const fetchUtilizationData = async (devices, fromEpoch, toEpoch) => {
  if (!fromEpoch || !toEpoch || devices.length === 0) return {};

  const results = {};

  await Promise.all(
    devices.map(async (device) => {
      try {
        const data = await telemetrykeydata(
          device.id.id,
          "DEVICE",
          ["utilization", "live_operator", "live_component"],
          fromEpoch,
          toEpoch
        );

        const values = data?.utilization || [];

        if (!Array.isArray(values) || values.length === 0) {
          results[device.id.id] = { utilizationValues: [] };
          return;
        }

        const utilizationArray = values.map((point) => {
          let val = 0;
          if (point?.value !== undefined && point?.value !== null) {
            try {
              val = parseInt(point.value, 10) || 0;
            } catch (err) {
              console.error(`Error parsing utilization for ${device.name}`, err);
            }
          }
          return { ts: point.ts, value: val };
        });

        const operatorValues = (data?.live_operator || []).map((pt) => ({
          ts: pt.ts,
          value: pt.value ? JSON.parse(pt.value) : {},
        }));

        const componentValues = (data?.live_component || []).map((pt) => ({
          ts: pt.ts,
          value: pt.value ? JSON.parse(pt.value) : {},
        }));

        results[device.id.id] = {
          utilizationValues: utilizationArray,
          operatorValues,
          componentValues,
          machineName: device?.name
        };

      } catch (error) {
        console.error("Error fetching utilization data for", device.name, error);
        results[device.id.id] = { utilizationValues: [] };
      }
    })
  );

  return results;
};

/**
 * Process shift-wise utilization data from raw utilization data
 */
export const processShiftWiseUtilization = (utilizationData, shifts) => {
  if (!utilizationData || Object.keys(utilizationData).length === 0 || !shifts) return {};

  const results = {};
  const shiftTimestamps = {};

  Object.keys(utilizationData).forEach((machineId) => {
    const utilizationArray = utilizationData[machineId]?.utilizationValues || [];
    results[machineId] = {};
    shiftTimestamps[machineId] = {};

    utilizationArray.forEach((point) => {
      const ts = Number(point.ts);
      const value = Number(point.value) || 0;
      const pointDate = new Date(ts);
      
      shifts.forEach((shift, idx) => {
        const [shHour, shMin, shSec] = shift.start_time.split(":").map(Number);
        const [enHour, enMin, enSec] = shift.end_time.split(":").map(Number);
        
        const testShift = (baseDate) => {
          const shiftStart = new Date(baseDate);
          shiftStart.setHours(shHour, shMin, shSec, 0);
          let shiftEnd = new Date(baseDate);
          shiftEnd.setHours(enHour, enMin, enSec, 0);
          
          if (shiftEnd <= shiftStart) {
            shiftEnd.setDate(shiftEnd.getDate() + 1);
          }
          
          if (ts >= shiftStart.getTime() && ts < shiftEnd.getTime()) {
            const dateKey = shiftStart.toISOString().split("T")[0];
            if (!results[machineId][dateKey]) {
              results[machineId][dateKey] = {};
              shiftTimestamps[machineId][dateKey] = {};
              shifts.forEach((_, i) => {
                results[machineId][dateKey][`Shift ${i + 1}`] = null;
                shiftTimestamps[machineId][dateKey][`Shift ${i + 1}`] = null;
              });
            }
            
            const slotKey = `Shift ${idx + 1}`;
            const existingTs = shiftTimestamps[machineId][dateKey][slotKey];
            if (existingTs === null || ts > existingTs) {
              results[machineId][dateKey][slotKey] = value;
              shiftTimestamps[machineId][dateKey][slotKey] = ts;
            }
          }
        };

        // Test for both today and yesterday (for overnight shifts)
        if (enHour > shHour || (enHour === shHour && enMin > shMin) || 
            (enHour === shHour && enMin === shMin && enSec > shSec)) {
          testShift(pointDate);
        } else {
          const yesterday = new Date(pointDate);
          yesterday.setDate(yesterday.getDate() - 1);
          testShift(yesterday);
          testShift(pointDate);
        }
      });
    });
  });

  // Fill null values with 0
  Object.keys(results).forEach((mId) => {
    Object.keys(results[mId]).forEach((dateKey) => {
      Object.keys(results[mId][dateKey]).forEach((shiftKey) => {
        if (results[mId][dateKey][shiftKey] === null) {
          results[mId][dateKey][shiftKey] = 0;
        }
      });
    });
  });

  return results;
};

/**
 * Calculate daily averages from shift-wise data
 */
export const getDailyUtilizationAverages = (shiftWiseData) => {
  const averages = {};
  Object.keys(shiftWiseData).forEach((machineId) => {
    averages[machineId] = {};
    Object.keys(shiftWiseData[machineId]).forEach((dateKey) => {
      const shifts = shiftWiseData[machineId][dateKey];
      const shiftValues = Object.values(shifts);
      const avg = shiftValues.reduce((sum, v) => sum + v, 0) / shiftValues.length;
      averages[machineId][dateKey] = Math.round(avg);
    });
  });
  return averages;
};

/**
 * Main function to get average utilization data for selected time range
 */
export const getAverageUtilizationForRange = async (devices, shifts, fromEpoch, toEpoch) => {
  try {
    const rawData = await fetchUtilizationData(devices, fromEpoch, toEpoch);

    const utilData = {};
    Object.keys(rawData).forEach((deviceId) => {
      utilData[deviceId] = rawData[deviceId].utilizationValues || [];
    });

    const shiftWiseData = processShiftWiseUtilization(rawData, shifts);

    const avgData = getDailyUtilizationAverages(shiftWiseData);

    return {
      avgData,        
      shiftWiseData, 
      utilData: rawData, 
    };

  } catch (error) {
    console.error("Error getting average utilization data:", error);
    return {
      avgData: {},
      shiftWiseData: {},
      utilData: {},
    };
  }
};