import React, { useEffect, useState, useRef } from 'react';
import dayjs from 'dayjs';
import { useNavigate, useLocation } from "react-router-dom";

import {
  cleanCustomerId,
  telemetrylatestdata,
  getCustomerName
} from '../../Services/app/companyservice';
import { getOperatorDetails, Loginapi, startTokenAutoRefresh, stopTokenAutoRefresh } from '../../Services/app/loginservice';
import { customerbasedshift, customerbaseddevices, telemetrykeydata } from '../../Services/app/operatorservice';
import { FaRegClock, FaRegCalendarAlt } from "react-icons/fa";
import FiscalWeek from '../../Shared/Pages/fiscalweek/fiscalweek';
import { FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, Tooltip } from '@mui/material';
import Swal from 'sweetalert2';
import { MdPowerSettingsNew } from 'react-icons/md';



const OeeTv = () => {
  const [newToken, setNewToken] = useState(localStorage.getItem("token1"));
  console.log('Token ', newToken);
  const location = useLocation();

  const [customerId1, setCustomerId1] = useState(null);
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const [shifts, setShifts] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [fiscalWeekNumber, setFiscalWeekNumber] = useState(0);
  const [customerTitle, setCustomerTitle] = useState("");
  const baseUrl = window._env_.SERVER_URL;
  const GRAFANA_URL = window._env_.GRAFANA_URL;
  const customerId = localStorage.getItem('CustomerID');
  const [machineGroups, setMachineGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(localStorage.getItem("selectedGroup") || "All");
  const navigate = useNavigate();
  const filteredDevices =
    !selectedGroup || selectedGroup === "All"
      ? devices
      : devices.filter((d) =>
        machineGroups
          .find((g) => g.name === selectedGroup)
          ?.machines.includes(d.name)
      );

  const fetchMachineGroups = async () => {
    try {
      const key = 'machinegroups';
      const data = await customerbasedshift(customerId || customerId1, key);
      const allMachineGroups = data[0]?.value || [];
      setMachineGroups(allMachineGroups);
      console.log("✅ Machine Groups:", allMachineGroups);
    } catch (error) {
      console.error("Error fetching machine groups:", error);
      setMachineGroups([]);
    }
  };

  useEffect(() => {
    const storedGroup = localStorage.getItem("selectedGroup");
    if (storedGroup) {
      setSelectedGroup(storedGroup);
    }
  }, []);

  // ✅ Watch token changes in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const latestToken = localStorage.getItem("token1"); // ✅ use token1 consistently
      if (latestToken && latestToken !== newToken) {
        setNewToken(latestToken);
        console.log("🔄 Token updated:", latestToken);
      }
    };

    // Case 1: token updated in another tab
    window.addEventListener("storage", handleStorageChange);

    // Case 2: token updated in same tab by refresh API
    const interval = setInterval(handleStorageChange, 5000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [newToken]);


  const getCustomerIdFromPath = () => {
    if (location.pathname === "/Zx9R2tLmN7wQvB1cF4kH5oPjU6yE3aDgT8sK0qWl~1rMnOp") {
      return window._env_.CUSTOMER_ID;
    } if (location.pathname === "/pmi-oee-dashboard") {
      return window._env_.CUSTOMER_ID;
    } else if (location.pathname === "/Ze9R2tLmN7wQvB2cF4kH2oPjU1yE0aDgT4sK2qWl~3rMnOp") {
      return window._env_.MARKS_CUSTOMER_ID;
    }
    return null;
  };

  // ✅ login and set customerId1
  useEffect(() => {
    const allowedPaths = [
      "/Zx9R2tLmN7wQvB1cF4kH5oPjU6yE3aDgT8sK0qWl~1rMnOp",
      "/o",
      "/Ze9R2tLmN7wQvB2cF4kH2oPjU1yE0aDgT4sK2qWl~3rMnOp",
      "/pmi-oee-dashboard"
    ];

    if (!allowedPaths.includes(location.pathname)) {
      return;
    }

    const init = async () => {
      try {
        const secondUsername = window._env_.TENANT_GMAIL;
        const secondPassword = window._env_.TENANT_PASSWORD;
        const secondResponse = await Loginapi(secondUsername, secondPassword);
        localStorage.setItem("email1", secondUsername);
        localStorage.setItem("token1", secondResponse.token); // ✅ write to token1
        localStorage.setItem("refreshToken1", secondResponse.refreshToken);
        localStorage.setItem("Companyname1", secondResponse.Companyname);
        localStorage.setItem("role_name1", secondResponse.Role);
        const newCustomerId = getCustomerIdFromPath();
        if (newCustomerId) {
          setCustomerId1(newCustomerId);
          localStorage.setItem("customerId1", newCustomerId);
        }

        startTokenAutoRefresh();
      } catch (err) {
        console.error("Init failed", err);
      }
    };
    init();
    const storedToken1 = localStorage.getItem("token1");
    console.log(" token1 from localStorage:", storedToken1);
    setNewToken(storedToken1);
  }, [location.pathname]);

  const convertShiftToEpoch = (date, start, end) => {
    let startTime = dayjs(`${date.format("YYYY-MM-DD")} ${start}`);
    let endTime = dayjs(`${date.format("YYYY-MM-DD")} ${end}`);

    if (endTime.isBefore(startTime)) {
      endTime = endTime.add(1, "day"); // overnight shift
    }

    return { from: startTime.valueOf(), to: endTime.valueOf() };
  };

  const getCurrentShift = (shiftList) => {
    const now = dayjs();

    for (const s of shiftList) {
      // ✅ Check today
      let { from, to } = convertShiftToEpoch(now, s.start_time, s.end_time);
      if (now.valueOf() >= from && now.valueOf() < to) {
        return { ...s, from, to };
      }

      // ✅ Also check yesterday (for overnight shifts)
      let { from: fromY, to: toY } = convertShiftToEpoch(
        now.subtract(1, "day"),
        s.start_time,
        s.end_time
      );
      if (now.valueOf() >= fromY && now.valueOf() < toY) {
        return { ...s, from: fromY, to: toY };
      }
    }

    return null;
  };

  // Fetch shifts
  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId || customerId1, "allShift");
      const shiftList = result[0]?.value || [];
      setShifts(shiftList);

      const activeShift = getCurrentShift(shiftList);
      setCurrentShift(activeShift);
    } catch (err) {
      console.error("Failed to fetch shifts", err);
    }
  };



  const formatCountdown = (ms) => {
    if (ms <= 0) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const updateShift = () => {
    if (!shifts || shifts.length === 0) return;
    const active = getCurrentShift(shifts);
    setCurrentShift(active);
  };

  useEffect(() => {
    updateShift(); // find active shift on mount
    const shiftChecker = setInterval(updateShift, 60 * 1000); // recheck every minute
    return () => clearInterval(shiftChecker);
  }, [shifts]);

  useEffect(() => {
    if (!currentShift) return;

    const timer = setInterval(() => {
      const remaining = currentShift.to - dayjs().valueOf();
      setCountdown(formatCountdown(remaining));

      if (remaining <= 0) {
        clearInterval(timer);
        updateShift(); // move to next shift
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentShift]);

  // After you set currentShift
  useEffect(() => {
    if (currentShift) {
      setFrom(currentShift.from);
      setTo(currentShift.to);
    }
  }, [currentShift]);

  // Fetch devices
  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId || customerId1, 100, 0);
      const devicesList = result?.data?.data || result?.data || [];
      setDevices(devicesList);

      const nameIdMap = devicesList.reduce((acc, device) => {
        if (device?.name && device?.id?.id) {
          acc[device.name] = device.id.id;
        }
        return acc;
      }, {});
      setDeviceNameIdJson(nameIdMap);
    } catch (err) {
      console.error("❌ Failed to fetch devices", err);
    }
  };

  useEffect(() => {
    if (customerId || customerId1) {
      fetchShifts();
      fetchDevices();
      fetchMachineGroups();
    }
  }, [customerId, customerId1]);



  let LAST_WEEK_FROM_EPOCH;
  let LAST_WEEK_TO_EPOCH;


  function setLastWeekEpoch(shifts) {
    if (!Array.isArray(shifts) || shifts.length === 0) return;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const lastMonday = new Date(now);
    const diffToMonday = (dayOfWeek + 6) % 7;
    lastMonday.setDate(now.getDate() - diffToMonday - 7);
    lastMonday.setHours(0, 0, 0, 0);
    let minStart = Infinity;
    for (const shift of shifts) {
      const [h, m, s] = shift.start_time.split(":").map(Number);
      const total = h * 3600 + m * 60 + s;
      if (total < minStart) minStart = total;
    }
    let maxEnd = -Infinity;
    for (const shift of shifts) {
      const [h, m, s] = shift.end_time.split(":").map(Number);
      const total = h * 3600 + m * 60 + s;
      if (total <= minStart) {
        maxEnd = Math.max(maxEnd, total + 24 * 3600);
      } else {
        maxEnd = Math.max(maxEnd, total);
      }
    }
    const lastWeekStart = new Date(lastMonday);
    lastWeekStart.setHours(
      Math.floor(minStart / 3600),
      Math.floor((minStart % 3600) / 60),
      minStart % 60,
      0
    );
    const lastWeekEnd = new Date(lastMonday);
    lastWeekEnd.setDate(lastMonday.getDate() + 7);
    lastWeekEnd.setHours(
      Math.floor(maxEnd / 3600) % 24,
      Math.floor((maxEnd % 3600) / 60),
      maxEnd % 60,
      0
    );
    LAST_WEEK_FROM_EPOCH = lastWeekStart.getTime();
    LAST_WEEK_TO_EPOCH = lastWeekEnd.getTime();
  }
  setLastWeekEpoch(shifts);
  console.log("From:", LAST_WEEK_FROM_EPOCH);
  console.log("To:", LAST_WEEK_TO_EPOCH);

  let THIS_WEEK_FROM_EPOCH;
  let THIS_WEEK_TO_EPOCH;

  function setThisWeekEpoch(shifts) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    let weekStart, weekEnd;
    if (shifts && shifts.length >= 1) {
      const firstShift = shifts[0];
      const lastShift = shifts[shifts.length - 1];
      weekStart = new Date(now);
      const diffToMonday = ((dayOfWeek + 6) % 7);
      weekStart.setDate(now.getDate() - diffToMonday);
      const [startH, startM, startS] = firstShift.start_time.split(":").map(Number);
      weekStart.setHours(startH, startM, startS, 0);
      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const [endH, endM, endS] = lastShift.end_time.split(":").map(Number);
      weekEnd.setHours(endH, endM, endS, 0);
    } else {
      weekStart = new Date(now);
      const diffToMonday = ((dayOfWeek + 6) % 7);
      weekStart.setDate(now.getDate() - diffToMonday);
      weekStart.setHours(0, 0, 0, 0);
      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
    }

    THIS_WEEK_FROM_EPOCH = weekStart.getTime();
    THIS_WEEK_TO_EPOCH = weekEnd.getTime();

    console.log("This week From:", new Date(THIS_WEEK_FROM_EPOCH));
    console.log("This week To:", new Date(THIS_WEEK_TO_EPOCH));
  }

  setThisWeekEpoch(shifts);

  console.log("This week To:", THIS_WEEK_TO_EPOCH);

  let monfrom = null;
  let monto = null;

  if (!shifts || shifts.length === 0) {
    console.error("Shifts array is empty or undefined!");
  } else {
    const lastShiftEnd = shifts[shifts.length - 1].end_time;

    function parseTime(timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return { hours, minutes };
    }

    // Calculate tomorrow's last shift end (to include today fully)
    const end = new Date();
    end.setDate(end.getDate() + 1); // move to tomorrow
    const endTime = parseTime(lastShiftEnd);
    end.setHours(endTime.hours, endTime.minutes, 0, 0);

    // Calculate 30 days before that
    const start = new Date(end);
    start.setDate(start.getDate() - 30);

    monfrom = start.getTime();
    monto = end.getTime();

    console.log("Last shift end time:", lastShiftEnd);
    console.log("Last 30 days From:", monfrom, "->", start);
    console.log("Last 30 days To:", monto, "->", end);
  }

  const [oeeData, setOEEData] = useState({});

  useEffect(() => {
    const fetchOEEData = async () => {
      if (!monfrom || !monto || devices.length === 0) return;

      const results = {};

      await Promise.all(
        devices.map(async (device) => {
          try {
            const data = await telemetrykeydata(
              device.id.id,
              "DEVICE",
              "oee",
              monfrom,
              monto
            );

            const values = data?.oee || [];
            if (!Array.isArray(values) || values.length === 0) {
              results[device.id.id] = { oeeValues: [] };
              console.log(`Machine: ${device.name} → No OEE data`);
              return;
            }

            // ✅ Collect all values (last 30 days)
            const oeeArray = values.map((point) => {
              let val = 0;
              if (point?.value !== undefined && point?.value !== null) {
                try {
                  val = parseInt(point.value, 10) || 0;
                } catch (err) {
                  console.error(`Error parsing OEE for ${device.name}`, err);
                }
              }
              return { ts: point.ts, value: val };
            });

            results[device.id.id] = { oeeValues: oeeArray };

            console.log(
              `Machine: ${device.name} → Collected ${oeeArray.length} OEE values`
            );

          } catch (error) {
            console.error("Error fetching OEE data for", device.name, error);
            results[device.id.id] = { oeeValues: [] };
          }
        })
      );

      setOEEData(results);
    };

    fetchOEEData();
  }, [devices, monfrom, monto]);

  console.log('Oee data', oeeData);



  const [shiftWiseOEEByDate, setShiftWiseOEEByDate] = useState({});
  const [avgData, setAvgData] = useState({});


  useEffect(() => {
    if (!oeeData || Object.keys(oeeData).length === 0 || !shifts) return;
    const results = {};
    const shiftTimestamps = {};
    Object.keys(oeeData).forEach((machineId) => {
      const oeeArray = oeeData[machineId]?.oeeValues || [];
      results[machineId] = {};
      shiftTimestamps[machineId] = {};
      oeeArray.forEach((point) => {
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
          if (enHour > shHour || (enHour === shHour && enMin > shMin) || (enHour === shHour && enMin === shMin && enSec > shSec)) {
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
    Object.keys(results).forEach((mId) => {
      Object.keys(results[mId]).forEach((dateKey) => {
        Object.keys(results[mId][dateKey]).forEach((shiftKey) => {
          if (results[mId][dateKey][shiftKey] === null) {
            results[mId][dateKey][shiftKey] = 0;
          }
        });
      });
    });
    setShiftWiseOEEByDate(results);
  }, [oeeData, shifts]);


  console.log('Shift Wise OEE data', shiftWiseOEEByDate);


  // this is for calculating daily average using shift length
  // const getDailyAveragesOnly = (shiftWiseData) => {
  //   const averages = {};
  //   Object.keys(shiftWiseData).forEach((machineId) => {
  //     averages[machineId] = {};
  //     Object.keys(shiftWiseData[machineId]).forEach((dateKey) => {
  //       const shifts = shiftWiseData[machineId][dateKey];
  //       const shiftValues = Object.values(shifts);
  //       const avg =
  //         shiftValues.reduce((sum, v) => sum + v, 0) / shiftValues.length;
  //       averages[machineId][dateKey] = Math.round(avg);
  //     });
  //   });

  //   return averages;
  // };

  // this is for calculating daily average using non-zero shift values
  const getDailyAveragesOnly = (shiftWiseData) => {
    const averages = {};
    Object.keys(shiftWiseData).forEach((machineId) => {
      averages[machineId] = {};
      Object.keys(shiftWiseData[machineId]).forEach((dateKey) => {
        const shifts = shiftWiseData[machineId][dateKey];
        const shiftValues = Object.values(shifts);
        const nonZeroValues = shiftValues.filter(v => v !== 0 && v !== null && v !== undefined);
        if (nonZeroValues.length === 0) {
          averages[machineId][dateKey] = 0;
          return;
        }
        const sum = nonZeroValues.reduce((sum, v) => sum + v, 0);
        const avg = sum / nonZeroValues.length;
        averages[machineId][dateKey] = Math.round(avg);
      });
    });
    return averages;
  };


  useEffect(() => {
    if (Object.keys(shiftWiseOEEByDate).length === 0) return;
    const avgResult = getDailyAveragesOnly(shiftWiseOEEByDate);
    setAvgData(avgResult);
  }, [shiftWiseOEEByDate]);


  const getFiscalWeekForDate = (date, fiscalYearStartMonth = 1) => {
    let year = dayjs(date).year();
    let fiscalStart = dayjs(`${year}-${String(fiscalYearStartMonth).padStart(2, "0")}-01`);
    if (dayjs(date).isBefore(fiscalStart)) {
      fiscalStart = fiscalStart.subtract(1, "year");
    }
    const fiscalStartDay = fiscalStart.day();
    const alignedFiscalStart = fiscalStart.subtract((fiscalStartDay + 6) % 7, "day");
    const diffDays = dayjs(date).diff(alignedFiscalStart, "day");
    return Math.floor(diffDays / 7) + 1;
  };

  console.log('Avg Oee Data', avgData);

  const fiscalWeekMap = {};

  Object.keys(avgData).forEach((shiftId) => {
    Object.keys(avgData[shiftId]).forEach((date) => {
      if (dayjs(date).day() === 1) {
        fiscalWeekMap[date] = getFiscalWeekForDate(date, 1);
      }
    });
  });

  const deviceWiseData = Object.fromEntries(
    Object.entries(avgData).map(([deviceId, deviceData]) => {
      const formatted = Object.entries(deviceData).map(([date, value]) => ({
        date,
        value
      }));
      return [deviceId, formatted];
    })
  );
  console.log(deviceWiseData);

  function getWeekShiftWiseOEE(shiftWiseOEEByDate, shifts, fromEpoch, toEpoch) {
    const result = {};

    for (const machineId in shiftWiseOEEByDate) {
      const machineData = shiftWiseOEEByDate[machineId];
      result[machineId] = {};

      for (const dateStr in machineData) {
        const shiftData = machineData[dateStr];
        const baseDate = new Date(dateStr);

        shifts.forEach((shift) => {
          const [shHour, shMin, shSec] = shift.start_time.split(':').map(Number);
          const [enHour, enMin, enSec] = shift.end_time.split(':').map(Number);

          let shiftStart = new Date(baseDate);
          shiftStart.setHours(shHour, shMin, shSec, 0);

          let shiftEnd = new Date(baseDate);
          shiftEnd.setHours(enHour, enMin, enSec, 0);

          if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

          if (shiftEnd.getTime() > fromEpoch && shiftStart.getTime() < toEpoch) {
            const allZero = Object.values(shiftData).every(v => Number(v) === 0);
            if (!allZero) {
              result[machineId][dateStr] = shiftData;
            }
          }
        });
      }
    }

    return result;
  }

  const lastWeekShiftWiseOEE = getWeekShiftWiseOEE(
    shiftWiseOEEByDate,
    shifts,
    LAST_WEEK_FROM_EPOCH,
    LAST_WEEK_TO_EPOCH
  );

  const currentWeekShiftWiseOEE = getWeekShiftWiseOEE(
    shiftWiseOEEByDate,
    shifts,
    THIS_WEEK_FROM_EPOCH,
    THIS_WEEK_TO_EPOCH
  );

  console.log('Last week shift wise oee', lastWeekShiftWiseOEE);
  console.log('current week shift wise oee', currentWeekShiftWiseOEE);

  let THIS_MONTH_FROM_EPOCH;
  let THIS_MONTH_TO_EPOCH;

  function setThisMonthEpoch(shifts) {
    const now = new Date();
    let monthStart, monthEnd;

    if (shifts && shifts.length >= 1) {
      const firstShift = shifts[0];
      const lastShift = shifts[shifts.length - 1];

      // --- Start of month ---
      monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [startH, startM, startS] = firstShift.start_time.split(":").map(Number);
      monthStart.setHours(startH, startM, startS, 0);

      // --- End of month ---
      monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const [endH, endM, endS] = lastShift.end_time.split(":").map(Number);
      monthEnd.setHours(endH, endM, endS, 0);

      // ✅ handle overnight shift (e.g., ends next day like 06:00 AM)
      const [firstH] = firstShift.start_time.split(":").map(Number);
      if (endH <= firstH) {
        monthEnd.setDate(monthEnd.getDate() + 1);
      }
    } else {
      // --- Fallback: full month 00:00 → 23:59:59 ---
      monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);

      monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
    }

    THIS_MONTH_FROM_EPOCH = monthStart.getTime();
    THIS_MONTH_TO_EPOCH = monthEnd.getTime();

    console.log("This month From:", new Date(THIS_MONTH_FROM_EPOCH), THIS_MONTH_FROM_EPOCH);
    console.log("This month To:", new Date(THIS_MONTH_TO_EPOCH), THIS_MONTH_TO_EPOCH);
  }

  setThisMonthEpoch(shifts);

  const buildGrafanaUrl = (device) => {
    if (!device?.id?.id) return "";

    const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
    const cleanedId = cleanCustomerId(customerId) || cleanCustomerId(customerId1);

    const deviceAvgData = deviceWiseData[device.id.id] || {};
    const avgOeeJson = encodeURIComponent(JSON.stringify(deviceAvgData));


    const lastWeekOeeForDevice = lastWeekShiftWiseOEE[device.id.id] || {};
    const lastWeekOeeJson = encodeURIComponent(JSON.stringify(lastWeekOeeForDevice));

    const currentWeekOeeForDevice = currentWeekShiftWiseOEE[device.id.id] || {};
    const currentWeekOeeJson = encodeURIComponent(JSON.stringify(currentWeekOeeForDevice));

    const fiscalWeekMapJson = encodeURIComponent(JSON.stringify(fiscalWeekMap));

    const url = `${GRAFANA_URL}d/bf81ddlobtypsc/oee-dashboard-new?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=DEVICE&var-device_id=${device.id.id}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&var-prefrom=${LAST_WEEK_FROM_EPOCH}&var-preto=${LAST_WEEK_TO_EPOCH}&var-curfrom=${THIS_WEEK_FROM_EPOCH}&var-curto=${THIS_WEEK_TO_EPOCH}&var-curMonthStart=${THIS_MONTH_FROM_EPOCH}&var-curMonthEnd=${THIS_MONTH_TO_EPOCH}&var-avgOee=${avgOeeJson}&var-shiftOEE=${lastWeekOeeJson}&var-fiscalweek=${fiscalWeekNumber}&var-curWeekOee=${currentWeekOeeJson}&var-fiscalmonth=${fiscalWeekMapJson}&kiosk&theme=light&refresh=20s`;

    console.log("🔗 Grafana Iframe URL:", url);

    return url;
  };


  useEffect(() => {
    if (!shifts || shifts.length === 0) return;
    let refreshTimers = [];
    const scheduleShiftRefreshes = () => {
      const now = dayjs();
      refreshTimers.forEach((t) => clearTimeout(t));
      refreshTimers = [];
      shifts.forEach((shift) => {
        if (!shift.end_time) return;
        const [h, m, s] = shift.end_time.split(":").map(Number);
        let endTime = dayjs().hour(h).minute(m).second(s);
        if (endTime.isBefore(now)) {
          endTime = endTime.add(1, "day");
        }
        const delay = endTime.diff(now, "millisecond");
        if (delay > 0) {
          console.log(
            `⏳ Scheduling refresh for Shift ${shift.shift_no || "?"
            } at ${endTime.format("YYYY-MM-DD HH:mm:ss")}, in ${Math.round(
              delay / 1000 / 60
            )} minutes`
          );
          const timer = setTimeout(() => {
            console.log(
              `🔄 Auto-refreshing at shift ${shift.shift_no || "?"
              } end → ${shift.end_time}`
            );
            // window.location.reload();
          }, delay);
          refreshTimers.push(timer);
        }
      });
    };
    scheduleShiftRefreshes();
    const now = dayjs();
    const nextMidnight = now.add(1, "day").startOf("day");
    const msUntilMidnight = nextMidnight.diff(now, "millisecond");
    const midnightTimer = setTimeout(() => {
      scheduleShiftRefreshes();
      setInterval(scheduleShiftRefreshes, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    return () => {
      refreshTimers.forEach((t) => clearTimeout(t));
      clearTimeout(midnightTimer);
    };
  }, [shifts]);


  const date = dayjs().format("MMM D, YYYY");

  const contentRef = useRef(null);

  const [autoScroll, setAutoScroll] = useState(() => {
    const saved = localStorage.getItem("autoScroll");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const firstLoad = useRef(true);

  useEffect(() => {
    localStorage.setItem("autoScroll", JSON.stringify(autoScroll));
  }, [autoScroll]);

  const [scrollDelay, setScrollDelay] = useState(15000);

  useEffect(() => {
    const customerTitle = localStorage.getItem('customerTitle') || '';
    setCustomerTitle(customerTitle);
  }, []);

  useEffect(() => {
    const fetchDelay = async () => {
      try {
        const scrollDuration = await customerbasedshift(
          customerId || customerId1,
          "oeeScrollDuration"
        );
        const delayValue = Number(scrollDuration[0]?.value);
        if (!isNaN(delayValue) && delayValue > 0) {
          setScrollDelay(delayValue * 1000);
        }
        console.log("Scroll delay set to:", delayValue, "seconds");
      } catch (err) {
        console.error("Failed to fetch scroll delay:", err);
      }
    };
    fetchDelay();
  }, [customerId, customerId1]);


  useEffect(() => {
    if (!contentRef.current || !autoScroll) return;
    const container = contentRef.current;
    const step = 445;
    let scrollInterval;
    const startScrolling = () => {
      scrollInterval = setInterval(() => {
        if (!container) return;
        const maxScrollTop = container.scrollHeight - container.clientHeight;

        if (container.scrollTop >= maxScrollTop - 100) {
          container.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          container.scrollBy({ top: step, behavior: "smooth" });
        }
      }, scrollDelay);
    };
    let delayTimer;
    if (firstLoad.current) {
      delayTimer = setTimeout(() => {
        startScrolling();
        firstLoad.current = false;
      }, 15000);
    } else {
      startScrolling();
    }

    return () => {
      clearTimeout(delayTimer);
      clearInterval(scrollInterval);
    };
  }, [autoScroll, scrollDelay]);


  function getAverageMachineData(data, machineIds) {
    const result = {};
    machineIds.forEach(id => {
      const machine = data[id];
      if (!machine) return;
      Object.entries(machine).forEach(([date, shifts]) => {
        if (!result[date]) result[date] = {};
        Object.entries(shifts).forEach(([shift, value]) => {
          if (!result[date][shift]) result[date][shift] = [];
          result[date][shift].push(value);
        });
      });
    });

    const averaged = {};
    Object.entries(result).forEach(([date, shifts]) => {
      averaged[date] = {};
      Object.entries(shifts).forEach(([shift, values]) => {
        const validValues = values.filter(v => typeof v === 'number' && !isNaN(v));
        const avg =
          validValues.length > 0
            ? validValues.reduce((a, b) => a + b, 0) / validValues.length
            : 0;
        averaged[date][shift] = Math.round(avg); // rounded average
      });
    });

    return averaged;
  }

  // --- Helper to average machine OEE data ---
  function getAverageMachineData(data, machineIds) {
    const result = {};

    machineIds.forEach(id => {
      const machine = data[id];
      if (!machine) return;

      Object.entries(machine).forEach(([date, shifts]) => {
        if (!result[date]) result[date] = {};
        Object.entries(shifts).forEach(([shift, value]) => {
          if (!result[date][shift]) result[date][shift] = [];
          result[date][shift].push(value);
        });
      });
    });

    // Compute averages
    const averaged = {};
    Object.entries(result).forEach(([date, shifts]) => {
      averaged[date] = {};
      Object.entries(shifts).forEach(([shift, values]) => {
        // const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
        // the below line is for avoiding zero while doing avg
        const valid = values.filter(v => typeof v === 'number' && v > 0 && !isNaN(v));

        const avg =
          valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
        averaged[date][shift] = Math.round(avg);
      });
    });

    return averaged;
  }
  function getMachineNameById(map, id) {
    return Object.keys(map).find(name => map[name] === id) || null;
  }
  function getAverageMachineDataForMonth(dataByMachine, idsArray) {
    const dailyShiftAverages = {};

    idsArray.forEach(id => {
      const machineData = dataByMachine[id] || {};

      Object.entries(machineData).forEach(([date, shiftData]) => {
        if (!dailyShiftAverages[date]) {
          dailyShiftAverages[date] = {};
        }

        Object.entries(shiftData).forEach(([shift, value]) => {
          if (!dailyShiftAverages[date][shift]) {
            dailyShiftAverages[date][shift] = [];
          }

          if (typeof value === 'number' && value > 0 && !isNaN(value)) {
            dailyShiftAverages[date][shift].push(value);
          }
        });
      });
    });

    // Debug log
    console.log('📊 Daily Shift Averages structure:', dailyShiftAverages);

    const result = Object.keys(dailyShiftAverages)
      .sort()
      .map(date => {
        const shiftData = dailyShiftAverages[date];
        const shiftAverages = [];

        console.log(`\n📅 Date: ${date}`);

        Object.entries(shiftData).forEach(([shift, values]) => {
          if (values.length > 0) {
            const shiftAvg = values.reduce((a, b) => a + b, 0) / values.length;
            shiftAverages.push(shiftAvg);
            console.log(`  Shift ${shift}: ${values.join(', ')} → Avg: ${Math.round(shiftAvg)}`);
          }
        });

        if (shiftAverages.length > 0) {
          const dailyAvg = shiftAverages.reduce((a, b) => a + b, 0) / shiftAverages.length;
          console.log(`  Daily avg from shifts: ${shiftAverages.map(a => Math.round(a)).join(', ')} → ${Math.round(dailyAvg)}`);
          return {
            date,
            value: Math.round(dailyAvg)
          };
        }

        console.log(`  No shift data for this date`);
        return { date, value: 0 };
      });

    console.log('\n✅ Final monthly averages:', result);
    return result;
  }

  const buildCellGrafanaUrl = () => {
    const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
    const cleanedId = cleanCustomerId(customerId) || cleanCustomerId(customerId1);
    const cellname = encodeURIComponent(selectedGroup);
    let owner = 'N/A';
    let machines = [];

    if (selectedGroup === 'All') {
      owner = [...new Set(machineGroups.map(m => m.owner))].join(', ') || 'N/A';
      machines = machineGroups.flatMap(m => m.machines || []);
    } else {
      const group = machineGroups.find(m => m.name === selectedGroup);
      if (group) {
        owner = group.owner || 'N/A';
        machines = group.machines || [];
      }
    }

    const idsArray = machines
      .map(name => deviceNameIdJson[name])
      .filter(id => id != null);

    const currentWeekOee = getAverageMachineData(currentWeekShiftWiseOEE, idsArray);
    const lastWeekOee = getAverageMachineData(lastWeekShiftWiseOEE, idsArray);
    const monthOee = getAverageMachineDataForMonth(shiftWiseOEEByDate, idsArray);

    console.log('📊 Averaged OEE for current week:', currentWeekOee);
    console.log('📊 Averaged OEE for last week:', lastWeekOee);
    console.log('📊 Averaged OEE for month:', monthOee);


    const currentWeekOeeJson = encodeURIComponent(JSON.stringify(currentWeekOee));
    const lastWeekOeeJson = encodeURIComponent(JSON.stringify(lastWeekOee));
    const monthOeeJson = encodeURIComponent(JSON.stringify(monthOee));


    const machineDisplay = selectedGroup === 'All' ? 'All Machines' : machines.join(', ') || 'N/A';

    console.log(deviceWiseData, 'deviceWiseData ---------------------------> 20', shiftWiseOEEByDate)
    const url = `${GRAFANA_URL}d/ef88i43fdmry8b/oee-dashboard-new-for-cell?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&var-prefrom=${LAST_WEEK_FROM_EPOCH}&var-preto=${LAST_WEEK_TO_EPOCH}&var-curfrom=${THIS_WEEK_FROM_EPOCH}&var-curto=${THIS_WEEK_TO_EPOCH}&var-curMonthStart=${THIS_MONTH_FROM_EPOCH}&var-curMonthEnd=${THIS_MONTH_TO_EPOCH}&var-fiscalweek=${fiscalWeekNumber}&var-cellname=${cellname}&var-owner=${owner}&var-machines=${machineDisplay}&var-curWeekOee=${currentWeekOeeJson}&var-shiftOEE=${lastWeekOeeJson}&var-avgOee=${monthOeeJson}&kiosk&theme=light&refresh=20s`;

    console.log('🔗 Cell Grafana Iframe URL:', url);
    return url;
  };

  const handleLogout = () => {
    Swal.fire({
      title: 'Are you sure want  to logout?',
      showCancelButton: true,
      confirmButtonText: 'Ok',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        stopTokenAutoRefresh();
        localStorage.clear();
        navigate('/');
      }
    });
  };

  return (

    <div style={{ paddingBottom: "0.5rem", position: "relative" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(250,250,250,0.85)",
          backdropFilter: "blur(10px)",
          padding: "0.7rem 2rem",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#222",
              letterSpacing: "0.2px",
            }}
          >
            Date: <span>{dayjs().format("MMM D, YYYY")}</span>
          </div>

          {currentShift && (
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                padding: "4px 12px",
                borderRadius: "8px",
                background: "#fff",
                borderLeft: "4px solid #FFA500",
                color: "#333",
                boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                display: "inline-block",
              }}
            >
              Shift {currentShift.shift_no}:{" "}
              {dayjs(from).format("h:mm A")} – {dayjs(to).format("h:mm A")}
            </div>
          )}
        </div>

        <div
          style={{
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: "800",
              color: "#111",
              textTransform: "uppercase",
              letterSpacing: "1px",
              textShadow: "0 1px 1px rgba(0,0,0,0.05)",
            }}
          >
            {customerTitle}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <FormControl
            variant="outlined"
            size="small"
            sx={{
              minWidth: 160,
              background: "#fff",
              borderRadius: "10px",
              boxShadow: "0 3px 6px rgba(0,0,0,0.05)",
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                "& fieldset": {
                  borderColor: "rgba(0,0,0,0.1)",
                },
                "&:hover fieldset": {
                  borderColor: "#FFA500",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#FFA500",
                  borderWidth: "1.5px",
                },
              },
            }}
          >
            <InputLabel
              sx={{
                fontWeight: 600,
                color: "#666",
                "&.Mui-focused": { color: "#FFA500" },
              }}
            >
              Group
            </InputLabel>
            <Select
              value={selectedGroup || "All"}
              label="Group"
              onChange={(e) => {
                const group = e.target.value;
                setSelectedGroup(group);
                localStorage.setItem("selectedGroup", group);
              }}
              sx={{
                fontWeight: 600,
                color: "#222",
              }}
              renderValue={(selected) => selected || "All"}
            >
              <MenuItem value="All">
                <em>All</em>
              </MenuItem>
              {machineGroups.map((g) => (
                <MenuItem key={g.id} value={g.name}>
                  {g.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              padding: "4px 12px",
              borderRadius: "8px",
              background: "#fff",
              borderLeft: "4px solid #FFA500",
              color: "#222",
              boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
              display: "inline-block",
            }}
          >

            <FiscalWeek
              fiscalYearStartMonth={1}
              onWeekChange={setFiscalWeekNumber}
            />
          </div>

          <FormControlLabel
            control={
              <Switch
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                sx={{
                  "& .MuiSwitch-track": {
                    backgroundColor: "#ccc",
                    borderRadius: 20,
                  },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    backgroundColor: "#FFA500",
                  },
                  "& .MuiSwitch-thumb": {
                    backgroundColor: "#fff",
                    border: "1px solid #888",
                  },
                }}
              />
            }
            label="Auto Scroll"
            slotProps={{
              typography: {
                sx: { fontSize: "13px", fontWeight: 600, color: "#111" },
              },
            }}
          />
          <Tooltip title="Log-out">
            <label className="circles-icon" onClick={handleLogout} style={{ cursor: 'pointer' }}>
              <MdPowerSettingsNew />
            </label>
          </Tooltip>
        </div>
      </div>

      <div
        ref={contentRef}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "15px",
          width: "100%",
          gridAutoRows: "auto",
          overflowY: "auto",
          height: "calc(100vh - 6.5rem)",
          paddingBottom: "20px",
        }}
      >
        {filteredDevices.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              fontSize: "18px",
              fontWeight: "500",
              color: "#666",
              padding: "40px 0",
            }}
          >
            No Devices
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "15px",
              width: "100%",
              marginTop: "20px",
              gridAutoRows: "518px",
            }}
            className="device-card"
          >
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 50,
                height: "100%",
                borderRadius: "10px",
                overflow: "hidden",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <iframe
                key={buildCellGrafanaUrl()}
                src={buildCellGrafanaUrl()}
                style={{
                  flex: 1,
                  border: "0",
                  width: "100%",
                  height: "100%",
                }}
                title={`Cell-OEE-${selectedGroup}`}
              />
            </div>
            {filteredDevices.map((device, index) => {
              const url = buildGrafanaUrl(device, avgData);
              return (
                <div
                  key={index}
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    borderRadius: "8px",
                    overflow: "hidden",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <iframe
                    key={url}
                    src={url}
                    style={{
                      flex: 1,
                      border: "0",
                      width: "100%",
                      height: "1000px",
                    }}
                    title={`OEE-${device.name}`}
                  />
                  <div  //header
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 14,
                      width: "100%",
                      height: 40,
                      backgroundColor: 'transparent',
                      zIndex: 10
                    }}
                  />
                  <div //oee %
                    style={{
                      position: 'absolute',
                      top: 60,
                      left: "13%",
                      width: 86,
                      height: 40,
                      backgroundColor: 'transparent',
                      zIndex: 10

                    }}
                  />
                  <div  //operator detail
                    style={{
                      position: 'absolute',
                      top: 210,
                      left: "13%",
                      width: 86,
                      height: 40,
                      backgroundColor: 'transparent',
                      zIndex: 10

                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

};

export default OeeTv;
