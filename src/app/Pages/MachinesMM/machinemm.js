import React, { useState, useMemo, useRef } from "react";
import dayjs from "dayjs";

import {
  Card, CardContent, Typography, Chip, Button, Popover,
  FormControl, InputLabel, Select, MenuItem, TextField, IconButton,
  List, ListItem, ListItemIcon, ListItemButton, ListItemText, Checkbox, Collapse
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useEffect } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Tabs, Tab, Box } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";



import {
  cleanCustomerId,
  telemetrylatestdata,
  customerbaseddevices,
  customerbasedshift,
  telemetrykeydata
} from '../../Services/app/companyservice';
import './machinemm.css';


export default function MachineDashboard() {



  const [newToken, setNewToken] = useState(localStorage.getItem("token"));
  console.log(newToken)

  // ✅ Listen for token changes in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const latestToken = localStorage.getItem("token");
      if (latestToken && latestToken !== newToken) {
        setNewToken(latestToken);
        console.log("🔄 Token updated:", latestToken);
      }
    };

    // Case 1: token updated in another tab
    window.addEventListener("storage", handleStorageChange);

    // Case 2: token updated in same tab by refresh API
    const interval = setInterval(handleStorageChange, 1000); // check every 5s

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [newToken]);


  const [selectedDevice, setSelectedDevice] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [openMachines, setOpenMachines] = useState(false);
  const [openStatus, setOpenStatus] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const [activeTab, setActiveTab] = useState("overview");
  const [iframeSrc, setIframeSrc] = useState("");
  const [value, setValue] = useState(0);
  const [viewedMachine, setViewedMachine] = useState(null);
  const [idleTime, setIdleTime] = useState("00:00:00");
  const [fromTime, setFromTime] = useState(null);
  const [toTime, setToTime] = useState(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [durationsByMachine, setDurationsByMachine] = useState({});
  const [machineDurations, setMachineDurations] = useState({});
  const [machineUtilization, setMachineUtilization] = useState({});
  const [selectedMachineId, setSelectedMachineId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const savedDate = localStorage.getItem("selectedDate");
    return savedDate ? dayjs(savedDate) : dayjs();
  });
  const [selectedShift, setSelectedShift] = useState(() => getCurrentShift(shifts));
  const [machineStatusTimes, setMachineStatusTimes] = useState({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [autoSelected, setAutoSelected] = useState(false);




  const customerId = localStorage.getItem("CustomerID");

  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, "allShift");
      const shiftList = result[0]?.value || [];
      setShifts(shiftList);
      console.log("Fetched Shifts:", shiftList);
    } catch (err) {
      console.error("Failed to fetch shifts", err);
    }
  };

  // ⏰ Find the current shift based on start_time / end_time
  function getCurrentShift(shifts) {
    if (!Array.isArray(shifts) || shifts.length === 0) return null;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const s of shifts) {
      const [fromH, fromM] = s.start_time.split(":").map(Number);
      const [toH, toM] = s.end_time.split(":").map(Number);

      const fromMinutes = fromH * 60 + fromM;
      const toMinutes = toH * 60 + toM;

      // normal or overnight
      if (
        (fromMinutes <= currentMinutes && currentMinutes < toMinutes) ||
        (fromMinutes > toMinutes &&
          (currentMinutes >= fromMinutes || currentMinutes < toMinutes))
      ) {
        return String(s.shift_no);
      }
    }

    return String(shifts[0].shift_no);
  }



  // set default shift only once when data arrives
  useEffect(() => {
    if (shifts.length > 0 && (selectedShift === null || selectedShift === undefined)) {
      const cur = getCurrentShift(shifts); // string
      setSelectedShift(cur);
      console.log("currect shift", cur)
    }
    // intentionally omit selectedShift from deps so this runs once when shifts load
  }, [shifts]);






  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];
      setDevices(devicesList);

      // Create name → id map
      const nameIdMap = devicesList.reduce((acc, device) => {
        acc[device.name] = device.id.id;
        return acc;
      }, {});

      setDeviceNameIdJson(nameIdMap);
      console.log("Device Name → ID Map:", nameIdMap);
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };

  useEffect(() => {
    if (customerId && newToken) {
      fetchShifts();
      fetchDevices();
    }
  }, [customerId, newToken]);

  function getShiftTimes(shifts, selectedShift, selectedDate) {
    if (!Array.isArray(shifts) || shifts.length === 0 || !selectedDate) {
      return { from: null, to: null };
    }

    const todayStr = dayjs().format("YYYY-MM-DD"); // today
    const selectedStr = dayjs(selectedDate).format("YYYY-MM-DD");
    const nextDayStr = dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD");

    const normalizedShift =
      typeof selectedShift === "string"
        ? selectedShift.trim().toLowerCase()
        : selectedShift == null
          ? ""
          : String(selectedShift);

    if (normalizedShift === "") return { from: null, to: null };

    // All shifts
    if (normalizedShift === "allshift" || normalizedShift === "all shift") {
      const sortedShifts = [...shifts].sort(
        (a, b) => Number(a.shift_no) - Number(b.shift_no)
      );
      const firstShiftStart = sortedShifts[0]?.start_time;
      const lastShiftEnd = sortedShifts[sortedShifts.length - 1]?.end_time;

      if (firstShiftStart && lastShiftEnd) {
        const fromStr = `${selectedStr}T${firstShiftStart}`;
        let toStr;
        if (selectedStr === todayStr) {
          toStr =
            lastShiftEnd <= firstShiftStart
              ? `${nextDayStr}T${lastShiftEnd}`
              : `${selectedStr}T${lastShiftEnd}`;
        } else {
          // handle overnight shifts
          toStr =
            lastShiftEnd <= firstShiftStart
              ? `${nextDayStr}T${lastShiftEnd}`
              : `${selectedStr}T${lastShiftEnd}`;
        }

        return { from: new Date(fromStr).getTime(), to: new Date(toStr).getTime() };
      }

      return { from: null, to: null };
    }

    // Single shift
    const shiftData = shifts.find((s) => String(s.shift_no) === normalizedShift);
    if (!shiftData) return { from: null, to: null };

    const shiftStart = shiftData.start_time;
    const shiftEnd = shiftData.end_time;

    const fromStr = `${selectedStr}T${shiftStart}`;
    let toStr;
    if (selectedStr === todayStr) {
      toStr = shiftEnd <= shiftStart
        ? `${nextDayStr}T${shiftEnd}`
        : `${selectedStr}T${shiftEnd}`; // current time
    } else {
      // handle overnight shifts
      toStr =
        shiftEnd <= shiftStart
          ? `${nextDayStr}T${shiftEnd}`
          : `${selectedStr}T${shiftEnd}`;
    }

    return { from: new Date(fromStr).getTime(), to: new Date(toStr).getTime() };
  }



  console.log('From', from, 'to', to);

  // state for dropdown selection
  const [filteredDevices, setFilteredDevices] = useState([]);




  /*state for dropdown selection */

  // useEffect(() => {
  //   const filtered = devices.filter((d) => {
  //     const matchDropdown = selectedDevice === "all" || d.id.id === selectedDevice;
  //     const matchSearch = d.name.toLowerCase().includes(searchText.toLowerCase());
  //     const matchMachineFilter =
  //       selectedMachines.length === 0 || selectedMachines.includes(d.name);
  //     const matchStatusFilter =
  //       selectedStatus.length === 0 || selectedStatus.includes(d.status);

  //     return matchDropdown && matchSearch && matchMachineFilter && matchStatusFilter;
  //   });

  //   setFilteredDevices(filtered);
  // }, [devices, selectedDevice, searchText, selectedMachines, selectedStatus]);  


  // Fetch durations for all filtered devices
  // Fetch durations for all filtered devices
  useEffect(() => {
    const fetchAllDurations = async () => {
      if (!from || !to || filteredDevices.length === 0) return;

      const results = {};

      await Promise.all(
        filteredDevices.map(async (machine) => {
          try {
            const [totalData, autoData] = await Promise.all([
              telemetrykeydata(machine.id.id, "DEVICE", "total_duration", from, to),
              telemetrykeydata(machine.id.id, "DEVICE", "auto_duration", from, to),
            ]);

            const totalValues = totalData?.total_duration || [];
            const autoValues = autoData?.auto_duration || [];
            const firstTotal = totalValues[0] || {};
            const firstAuto = autoValues[0] || {};

            const totalObj = typeof firstTotal.value === "string" ? JSON.parse(firstTotal.value) : firstTotal.value || {};
            const autoObj = typeof firstAuto.value === "string" ? JSON.parse(firstAuto.value) : firstAuto.value || {};
            const run = +((totalObj.total_run_duration || 0) + (autoObj.total_run_duration || 0)).toFixed(3);
            const idle = +((totalObj.total_idle_duration || 0) + (autoObj.total_idle_duration || 0)).toFixed(3);
            const disconnect = +((totalObj.total_disconnect_duration || 0) + (autoObj.total_disconnect_duration || 0)).toFixed(3);
            const alarm = +((totalObj.total_alarm_duration || 0) + (autoObj.total_alarm_duration || 0)).toFixed(3);
            const setting = +((totalObj.total_setting_duration || 0) + (autoObj.total_setting_duration || 0)).toFixed(3);
            const total = +(run + idle + disconnect + alarm + setting).toFixed(3);

            const allValues = [...totalValues, ...autoValues].filter(v => v?.ts);
            let firstActiveTime = null;
            if (allValues.length) {
              const earliestPoint = allValues.reduce((min, point) => point.ts < min.ts ? point : min);
              const dateObj = new Date(earliestPoint.ts);
              let hours = dateObj.getHours();
              const minutes = String(dateObj.getMinutes()).padStart(2, "0");
              const seconds = String(dateObj.getSeconds()).padStart(2, "0");
              const ampm = hours >= 12 ? "PM" : "AM";
              hours = hours % 12 || 12;
              firstActiveTime = `${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
            }
            results[machine.id.id] = { run, idle, total, disconnect, alarm, setting, firstActiveTime };

            console.log(`Final Totals for ${machine.name}:`, results[machine.id.id]);
          } catch (error) {
            console.error("Error fetching durations for", machine.name, error);
            results[machine.id.id] = {
              run: 0,
              idle: 0,
              total: 0,
              disconnect: 0,
              alarm: 0,
              setting: 0,
              firstActiveTime: null
            };
          }
        })
      );
      setMachineDurations(results);
    };
    fetchAllDurations();
  }, [filteredDevices, from, to]);


  const handleFilterClick = (event) => {
    setFilterAnchor(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchor(null);
  };

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };




  function calculateShiftTimesWithDate(shifts, selectedShift, selectedDate) {
    if (!Array.isArray(shifts) || shifts.length === 0 || !selectedDate) {
      return { fromEpoch: null, toEpoch: null };
    }

    const baseDate = dayjs(selectedDate).subtract(1, 'day').format("YYYY-MM-DD");
    const todayStr = dayjs(selectedDate).format("YYYY-MM-DD");

    let fromEpoch = null;
    let toEpoch = null;

    const normalizedShift = selectedShift?.trim().toLowerCase() || "";

    if (normalizedShift === "allshift" || normalizedShift === "all shift") {
      const sortedShifts = [...shifts].sort((a, b) => Number(a.shift_no) - Number(b.shift_no));
      const firstShiftStart = sortedShifts[0]?.start_time;
      const lastShiftEnd = sortedShifts[sortedShifts.length - 1]?.end_time;

      if (firstShiftStart && lastShiftEnd) {
        fromEpoch = new Date(`${baseDate}T${firstShiftStart}`).getTime();
        toEpoch = new Date(`${baseDate}T${lastShiftEnd}`).getTime();

        if (lastShiftEnd <= firstShiftStart) {
          toEpoch = new Date(`${todayStr}T${lastShiftEnd}`).getTime();
        }
      }
    } else {
      const shiftData = shifts.find((s) => String(s.shift_no) === String(selectedShift));
      if (shiftData) {
        const shiftStart = shiftData.start_time;
        const shiftEnd = shiftData.end_time;

        fromEpoch = new Date(`${baseDate}T${shiftStart}`).getTime();
        toEpoch = new Date(`${baseDate}T${shiftEnd}`).getTime();

        if (shiftEnd <= shiftStart) {
          toEpoch = new Date(`${todayStr}T${shiftEnd}`).getTime();
        }
      }
    }


    return { fromEpoch, toEpoch };
  }

  console.log("FromTime (epoch):", fromTime);
  console.log("ToTime (epoch):", toTime);
  console.log("Shifts data type:", typeof shifts, shifts);


  // 🔄 Keep times in sync whenever date or shift changes
  useEffect(() => {
    if (!shifts.length || !selectedShift || !selectedDate) return;

    const { fromEpoch, toEpoch } = calculateShiftTimesWithDate(shifts, selectedShift, selectedDate);
    const { from, to } = getShiftTimes(shifts, selectedShift, selectedDate);

    if (fromEpoch && toEpoch && from && to) {
      setFromTime(fromEpoch);
      setToTime(toEpoch);
      setFrom(from);
      setTo(to);

      console.log("✅ fromTime:", fromEpoch);
      console.log("✅ toTime:", toEpoch);



      console.log("✅ from:", from);
      console.log("✅ to:", to);
    }
  }, [shifts, selectedShift, selectedDate]);


  console.log("✅ from:", from);
  console.log("✅ to:", to);
  console.log("✅ fromTime:", fromTime);
  console.log("✅ toTime:", toTime);




  const intervalRef = useRef(null);

  function getShiftEndDateTime(selectedDate, shiftObj) {
    if (!shiftObj) return null;

    const baseDate = dayjs(selectedDate);

    // adjust if shift crosses into next day
    const endDate = baseDate.add(Number(shiftObj.end_day) - 1, "day");

    const [h, m, s] = shiftObj.end_time.split(":").map(Number);

    return endDate.hour(h).minute(m).second(s).millisecond(0).toDate();
  }

  useEffect(() => {
    // Normalize selectedShift -> shiftObj
    const shiftNo =
      typeof selectedShift === "string"
        ? selectedShift.replace("Shift ", "")
        : String(selectedShift ?? "");

    const shiftObj = shifts.find(s => s.shift_no === shiftNo);

    const isToday = dayjs(selectedDate).isSame(dayjs(), "day");

    if (isToday) {
      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);

      console.log("⏱ Live update (today)");
    } else if (shiftObj) {
      if (intervalRef.current) clearInterval(intervalRef.current);

      const endDate = getShiftEndDateTime(selectedDate, shiftObj);
      if (endDate) {
        setCurrentTime(endDate.getTime());
        console.log("📅 Past date, fixed at shift end:", endDate.toString());
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [selectedDate, selectedShift, shifts]);

  console.log("Current Time", currentTime);

  // Called when tab is clicked
  const handleTabClick = (tab, machine) => {
    if (!machine) return;

    setActiveTab(tab);
    localStorage.setItem("activeTab", tab);

    const machineId = machine.id?.id;
    const machineName = encodeURIComponent(machine.name || "");

    const baseUrls = {
      overview: `${window._env_.GRAFANA_URL}d/ca045704-dd28-4115-9441-0fa3a94e0a02/mm-production-utilization-2-copy-copy?orgId=1`,

      timeline: `${window._env_.GRAFANA_URL}d/b0002ac4-f3c7-446a-b5bf-563b521795c1/valve-c-56-timeline-copy?orgId=1&from=${from}&to=${currentTime}`,

      diagnostics: `http://example.com/diagnostics`,
      toolMonitoring: `${window._env_.GRAFANA_URL}d/da065e50-263c-43e5-8a19-610e8c09820c/main-screen-valve-c-56-tool-monitoring`,
    };

    const bearerToken = encodeURIComponent(`Bearer+${newToken}`);

    const GRAFANA_URL = window._env_.GRAFANA_URL;
    console.log("GRAFANA_URL", GRAFANA_URL);

    const baseUrl = window._env_.SERVER_URL;
    console.log("baseurl", baseUrl);

    let url = `${baseUrls[tab]}&var-from=${from}&var-to=${to}&var-fromTime=${fromTime}&var-toTime=${toTime}&var-token=${bearerToken}&var-deviceId=${machineId}&var-deviceName=${machineName}&var-grafanaurl=${GRAFANA_URL}&var-url=${baseUrl}&theme=light&kiosk&refresh=5s`;

    if (tab === "diagnostics") {
      url = `${baseUrls[tab]}?&from=${from}&to=${to}&var-fromTime=${fromTime}&var-toTime=${toTime}&deviceId=${machineId}&var-deviceName=${machineName}`;
    }

    console.log("Final iframe URL:", url);
    setIframeSrc(url); // 🔹 Updates the iframe
  };


  // States
  const [runDuration, setRunDuration] = useState(0);
  const [idleDuration, setIdleDuration] = useState(0);
  const [selectedMachine, setSelectedMachine] = useState(
    filteredDevices.length > 0 ? filteredDevices[0] : null
  );

  const [latestIdleRunDuration, setLatestIdleRunDuration] = useState({});

  useEffect(() => {
    const fetchLatestIdleRunDuration = async () => {
      if (!from || !to || filteredDevices.length === 0) return;

      const results = {};

      await Promise.all(
        filteredDevices.map(async (machine) => {
          try {
            const data = await telemetrykeydata(
              machine.id.id,
              "DEVICE",
              "idlerunstate",
              from,
              to
            );

            const values = data?.idlerunstate || [];
            if (!Array.isArray(values) || values.length === 0) {
              results[machine.id.id] = null;
              return;
            }

            // ✅ Take the 0th value directly
            const firstPoint = values[0];

            let keyName = null;
            let durationSeconds = null;

            const parseValue =
              typeof firstPoint.value === "string"
                ? JSON.parse(firstPoint.value)
                : firstPoint.value;

            if (parseValue && typeof parseValue === "object") {
              if (parseValue.idleduration !== undefined && parseValue.idleduration !== null) {
                keyName = "idleduration";
                durationSeconds = Number(parseValue.idleduration);
              } else {
                const foundKey = Object.keys(parseValue).find((k) =>
                  ["runduration", "disconnectduration", "alarmduration", "settings"].includes(k)
                );

                if (foundKey) {
                  keyName = foundKey;
                  durationSeconds = Number(parseValue[foundKey]) ?? null;
                }
              }
            }

            results[machine.id.id] = {
              keyName,
              durationSeconds
            };

            console.log(
              `Machine: ${machine.name} | Key: ${keyName} | Duration: ${durationSeconds} sec`
            );
          } catch (error) {
            console.error(
              `Error fetching idlerunstate (0th value) for ${machine.name}`,
              error
            );
            results[machine.id.id] = null;
          }
        })
      );

      setLatestIdleRunDuration(results);
    };

    fetchLatestIdleRunDuration();
  }, [filteredDevices, from, to]);




  useEffect(() => {
    const fetchAllUtilization = async () => {
      if (!from || !to || filteredDevices.length === 0) return;

      const results = {};

      await Promise.all(
        filteredDevices.map(async (machine) => {
          try {
            const data = await telemetrykeydata(
              machine.id.id,
              "DEVICE",
              "utilization",
              from,
              to
            );

            const values = data?.utilization || [];

            // 📌 Console the full array of data
            console.log(`\n🔹 Full utilization array for ${machine.name}:`, values);

            if (!Array.isArray(values) || values.length === 0) {
              results[machine.id.id] = { utilization: 0 };
              console.log(`⚠️ Machine: ${machine.name} → No utilization data`);
              return;
            }

            const latestPoint = values.reduce((latest, point) =>
              new Date(point.ts) > new Date(latest.ts) ? point : latest
            );

            console.log(`✅ Latest utilization point for ${machine.name}:`, latestPoint);

            let utilizationValue = Number(latestPoint.value);
            if (!isNaN(utilizationValue)) {
              utilizationValue = parseFloat(utilizationValue.toFixed(1));
            } else {
              utilizationValue = 0;
            }

            results[machine.id.id] = { utilization: utilizationValue };
          } catch (error) {
            console.error("❌ Error fetching utilization for", machine.name, error);
            results[machine.id.id] = { utilization: 0 };
          }
        })
      );

      setMachineUtilization(results);
    };

    fetchAllUtilization();
  }, [filteredDevices, from, to]);



  useEffect(() => {
    const fetchHistoricalBaseline = async () => {
      if (!from || !to || filteredDevices.length === 0) return;

      const results = {};

      await Promise.all(
        filteredDevices.map(async (machine) => {
          try {
            const data = await telemetrykeydata(
              machine.id.id,
              "DEVICE",
              "historicalbaseline",
              from,
              to
            );

            const values = data?.historicalbaseline || [];
            if (!Array.isArray(values) || values.length === 0) {
              results[machine.id.id] = { utilizationBaseline: 0 };
              console.log(`Machine: ${machine.name} → No historical baseline data`);
              return;
            }

            // ✅ Get latest point (max timestamp)
            const latestPoint = values.reduce((max, point) =>
              point.ts > max.ts ? point : max
            );

            let utilizationBaseline = 0;
            if (latestPoint?.value) {
              try {
                const parsed = typeof latestPoint.value === "string"
                  ? JSON.parse(latestPoint.value)
                  : latestPoint.value;
                utilizationBaseline = parseFloat(parsed?.utilization ?? 0);
              } catch (err) {
                console.error(`Error parsing historical baseline for ${machine.name}`, err);
              }
            }

            results[machine.id.id] = {
              utilizationBaseline: parseFloat(utilizationBaseline.toFixed(1))
            };

            console.log(
              `Machine: ${machine.name} → Utilization Baseline = ${results[machine.id.id].utilizationBaseline}`
            );

          } catch (error) {
            console.error("Error fetching historical baseline for", machine.name, error);
            results[machine.id.id] = { utilizationBaseline: 0 };
          }
        })
      );

      setUtilizationBaseline(results); // <-- You'll need this state
    };

    fetchHistoricalBaseline();
  }, [filteredDevices, from, to]);

  // State for storing utilization baseline
  const [utilizationBaseline, setUtilizationBaseline] = useState({});

  const [liveComponent, setLiveComponent] = useState({});

  useEffect(() => {
    const fetchLiveComponent = async () => {
      if (!from || !to || filteredDevices.length === 0) return;

      const results = {};

      await Promise.all(
        filteredDevices.map(async (machine) => {
          try {
            const data = await telemetrykeydata(
              machine.id.id,
              "DEVICE",
              "live_component",
              from,
              to
            );

            const values = data?.live_component || [];
            if (!Array.isArray(values) || values.length === 0) {
              results[machine.id.id] = { componentName: null };
              console.log(`Machine: ${machine.name} → No live_component data`);
              return;
            }

            // ✅ Get latest point (max timestamp)
            const latestPoint = values.reduce((max, point) =>
              point.ts > max.ts ? point : max
            );

            let componentName = null;
            if (latestPoint?.value) {
              try {
                const parsed = typeof latestPoint.value === "string"
                  ? JSON.parse(latestPoint.value)
                  : latestPoint.value;
                componentName = parsed?.name ?? null;
              } catch (err) {
                console.error(`Error parsing live_component for ${machine.name}`, err);
              }
            }

            results[machine.id.id] = { componentName };

            console.log(
              `Machine: ${machine.name} → Live Component Name = ${results[machine.id.id].componentName}`
            );

          } catch (error) {
            console.error("Error fetching live_component for", machine.name, error);
            results[machine.id.id] = { componentName: null };
          }
        })
      );

      setLiveComponent(results); // <-- Define state with useState({})
    };

    fetchLiveComponent();
  }, [filteredDevices, from, to]);


  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  }

  useEffect(() => {
    if (filteredDevices.length > 0 && !selectedMachineId) {
      const firstMachine = filteredDevices[0];
      setViewedMachine(firstMachine);
      setSelectedMachineId(firstMachine.id.id);
      setSelectedMachine(firstMachine);
      handleTabClick(activeTab, firstMachine);
    }
  }, [filteredDevices, selectedMachineId, activeTab, newToken]);

  useEffect(() => {
    const savedDate = localStorage.getItem("selectedDate");
    if (savedDate) {
      setSelectedDate(dayjs(savedDate));
    }
  }, []);

  // ✅ Save to localStorage whenever date changes
  useEffect(() => {
    if (selectedDate) {
      localStorage.setItem("selectedDate", selectedDate.toISOString());
    }
  }, [selectedDate]);


  // ✅ Save to localStorage whenever shift changes
  useEffect(() => {
    if (selectedShift) {
      localStorage.setItem("selectedShift", selectedShift);
    }
  }, [selectedShift]);


  const [machineStatuses, setMachineStatuses] = useState({});

  useEffect(() => {
    const fetchMachineStatus = async () => {
      if (!from || !to || filteredDevices.length === 0) return;

      const results = {};

      await Promise.all(
        filteredDevices.map(async (machine) => {
          try {
            const data = await telemetrykeydata(
              machine.id.id,
              "DEVICE",
              "machine_Status", // <-- status key
              from,
              to
            );

            const values = data?.machine_Status || [];
            if (!Array.isArray(values) || values.length === 0) {
              results[machine.id.id] = { machineName: machine.name, status: "No Data" };
              console.log(`Machine: ${machine.name} → No status data`);
              return;
            }

            // ✅ Get latest point (max timestamp)
            const latestPoint = values.reduce((max, point) =>
              point.ts > max.ts ? point : max
            );

            let status = "Unknown";
            if (latestPoint?.value) {
              try {
                status = typeof latestPoint.value === "string"
                  ? latestPoint.value
                  : String(latestPoint.value);
              } catch (err) {
                console.error(`Error parsing machine status for ${machine.name}`, err);
              }
            }

            // ✅ Store result with machine name
            results[machine.id.id] = {
              machineName: machine.name,
              status
            };

            console.log(
              `Machine: ${machine.name} → Latest Status = ${results[machine.id.id].status}`
            );

          } catch (error) {
            console.error("Error fetching machine status for", machine.name, error);
            results[machine.id.id] = { machineName: machine.name, status: "Error" };
          }
        })
      );

      setMachineStatuses(results); // <-- You'll need a state for this
    };

    fetchMachineStatus();
  }, [filteredDevices, from, to]);

  console.log('Machine Status', machineStatuses);



  useEffect(() => {
    const filtered = devices.filter((d) => {
      const matchDropdown =
        selectedDevice === "all" || d.id.id === selectedDevice;

      const matchSearch = (d.name || "")
        .toLowerCase()
        .includes(searchText.toLowerCase());

      const machineName = d.name || "";
      const status = machineStatuses[d.id.id]?.status || "";  // ✅ get from machineStatuses

      const machineMatch =
        selectedMachines.length === 0 || selectedMachines.includes(machineName);

      const statusMatch =
        selectedStatus.length === 0 || selectedStatus.includes(status);

      return matchDropdown && matchSearch && machineMatch && statusMatch;
    });

    setFilteredDevices(filtered);
  }, [devices, selectedDevice, searchText, selectedMachines, selectedStatus, machineStatuses]);

  // Default tab auto-load (once)
  useEffect(() => {
    if (from && to && fromTime && toTime && selectedMachine && !autoSelected) {
      handleTabClick("overview", selectedMachine);
      setAutoSelected(true);
    }
  }, [from, to, fromTime, toTime, selectedMachine, autoSelected, newToken]);



  const machineStatusOptions = ["Running", "Idle", "Disconnect", "Alarm"];

  // Toggle machine selection
  const toggleMachineSelection = (name) => {
    setSelectedMachines((prev) =>
      prev.includes(name)
        ? prev.filter((m) => m !== name)
        : [...prev, name]
    );
  };

  // Toggle status selection
  const toggleStatusSelection = (status) => {
    setSelectedStatus((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };


  // All machines from your state
  const machineList = Object.values(machineStatuses);

  // Filter machines based on status & machine selection
  const filteredMachines = machineList.filter((m) => {
    const statusMatch =
      selectedStatus.length === 0 || selectedStatus.includes(m.status);
    const machineMatch =
      selectedMachines.length === 0 || selectedMachines.includes(m.machineName);
    return statusMatch && machineMatch;
  });







  useEffect(() => {
    const fetchAllMachineStatus = async () => {
      if (!from || !to || filteredDevices.length === 0) return;

      const results = {};

      await Promise.all(
        filteredDevices.map(async (machine) => {
          try {
            const data = await telemetrykeydata(
              machine.id.id,
              "DEVICE",
              "machine_status",
              from,
              to
            );

            const values = data?.machine_status || [];

            console.log(`🔹 Full machine_status array for ${machine.name}:`, values);

            if (!Array.isArray(values) || values.length === 0) {
              results[machine.id.id] = { lastTs: null };
              return;
            }

            // ✅ Find last element where value === "3"
            const lastValue = [...values].reverse().find(item => item.value === "3");

            if (lastValue) {
              results[machine.id.id] = { lastTs: lastValue.ts };
            } else {
              results[machine.id.id] = { lastTs: null }; // no "3" found
            }
          } catch (error) {
            console.error("❌ Error fetching machine_status for", machine.name, error);
            results[machine.id.id] = { lastTs: null };
          }
        })
      );

      // ✅ Save all machines lastTs
      setMachineStatusTimes(results);

      // ✅ Console the collected results
      console.log("✅ All machines last active times:", results);
    };

    fetchAllMachineStatus();
  }, [filteredDevices, from, to]);

  console.log('First Active time of all devices', machineStatusTimes)


  function formatMillisecondsTo12HourTime(ms) {
    if (!ms) return "N/A";

    const date = new Date(ms);

    let hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const ampm = hours >= 12 ? "PM" : "AM";

    hours = hours % 12;
    hours = hours ? hours : 12; // Convert '0' to '12'

    const formattedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} ${ampm}`;

    return formattedTime;
  }



  return (
    <div style={{ display: "flex", height: "100vh", paddingTop: "20px" }}>
      {/* Left Panel */}
      <div
        style={{
          width: "350px",
          background: "#f9f9f9",
          padding: "15px",
          paddingTop: "40px",
          borderRight: "1px solid #ddd",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Dropdown */}
        <FormControl
          size="small"
          style={{ minWidth: 160, background: "#fff", marginBottom: "10px" }}
        >
          <InputLabel>Machines</InputLabel>
          <Select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
          >
            <MenuItem value="all">
              All Machines ({devices.length})
            </MenuItem>
            {devices.map((d) => (
              <MenuItem key={d.id.id} value={d.id.id}>
                {d.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Search + Filter Button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <TextField
            size="small"
            placeholder="Search Here"
            variant="outlined"
            fullWidth
            style={{ background: "#fff" }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              endAdornment: <SearchIcon style={{ color: "#777" }} />,
            }}
          />
          <IconButton onClick={handleFilterClick} style={{ marginLeft: "5px" }}>
            <FilterListIcon />
          </IconButton>
        </div>

        {/* Live Compared to Baseline */}
        <div style={{ marginBottom: "10px" }}>
          <span
            style={{
              background: "#eee",
              padding: "3px 6px",
              borderRadius: "4px",
              fontSize: "12px",
              marginRight: "8px",
            }}
          >
            Live
          </span>
          <span style={{ fontSize: "13px", color: "#555" }}>
            Compared to: <strong>Baseline</strong>
          </span>
        </div>

        {/* Machine List */}
        <div style={{ overflowY: "auto", flexGrow: 1 }}>
          {filteredDevices.length === 0 ? (
            <Typography
              variant="body2"
              sx={{ textAlign: "center", color: "gray", mt: 2 }}
            >
              No machines in{" "}
              {[...selectedMachines, ...selectedStatus].length > 0
                ? `(${[...selectedMachines, ...selectedStatus].join(", ")})`
                : "filter"}
            </Typography>
          ) : (
            filteredDevices.map((machine) => {
              const changePositive = machine.changeFromBaseline >= 0;
              const { run = 0, idle = 0, total = 0, disconnect = 0, alarm = 0, setting = 0 } =
                machineDurations[machine.id.id] || {};
              // const firstActiveTime =
              //   machineDurations[machine.id.id]?.firstActiveTime || "00:00:00";
              const isSelected = machine.id.id === selectedMachineId; // ✅ Check if selected
              const firstActiveTime = machineStatusTimes?.[machine.id.id] || "N/A";


              return (
                <Card
                  key={machine.id.id}
                  onClick={() => {
                    setViewedMachine(machine);
                    setSelectedMachineId(machine.id.id); // ✅ Store clicked machine
                    setSelectedMachine(machine);
                    handleTabClick(activeTab, machine);
                  }}
                  sx={{
                    mb: 2,
                    borderLeft: `4px solid ${machineStatuses[machine.id.id]?.status === "Running"
                      ? "#4caf50" // Green
                      : machineStatuses[machine.id.id]?.status === "Idle"
                        ? "#f1a014ff" // Yellow
                        : machineStatuses[machine.id.id]?.status === "Alarm"
                          ? "#f44336" // Red
                          : machineStatuses[machine.id.id]?.status === "Disconnect"
                            ? "#9e9e9e" // Gray
                            : machineStatuses[machine.id.id]?.status === "Setting"
                              ? "#81c8f5ff" // blue
                              : "#f44336" // Default Red for others
                      }`,
                    boxShadow: 1,
                    cursor: "pointer",
                    backgroundColor: isSelected ? "#e6edf4ff" : "#fff", // ✅ Persistent selection background
                    "&:hover": {
                      backgroundColor: isSelected
                        ? "#e6ecf3ff"
                        : "#f5f5f5", // Hover only if not selected
                    },
                  }}
                >
                  <CardContent>
                    {/* Machine Name */}
                    <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                      {machine.name}
                    </Typography>

                    {/* Run / Idle Durations */}
                    <Box sx={{ display: "flex", alignItems: "center", mt: 0.5 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor:
                            machineStatuses[machine.id.id]?.status === "Running"
                              ? "#4caf50" // Green
                              : machineStatuses[machine.id.id]?.status === "Idle"
                                ? "#f1a014" // Yellow
                                : machineStatuses[machine.id.id]?.status === "Disconnect"
                                  ? "#9e9e9e" // Gray
                                  : machineStatuses[machine.id.id]?.status === "Alarm"
                                    ? "#f44336" // Red
                                    : machineStatuses[machine.id.id]?.status === "Setting"
                                      ? "#81c8f5ff" // blue
                                      : "#9e9e9e", // Default Gray
                          mr: 1,
                        }}
                      />

                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{
                          mr: 2,
                          fontSize: "0.75rem",
                          color: "black",
                        }}
                      >
                        {machineStatuses[machine.id.id]?.status === "Running"
                          ? `Run: ${formatTime(run)}`
                          : machineStatuses[machine.id.id]?.status === "Idle"
                            ? `Idle: ${formatTime(idle)}`
                            : machineStatuses[machine.id.id]?.status === "Disconnect"
                              ? `Disconnect: ${formatTime(disconnect)}`
                              : machineStatuses[machine.id.id]?.status === "Alarm"
                                ? `Alarm: ${formatTime(alarm)}`
                                : machineStatuses[machine.id.id]?.status === "Setting"
                                  ? `Setting: ${formatTime(setting)}`
                                  : `Total: ${formatTime(total)}`}
                      </Typography>


                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{
                          fontSize: "0.75rem",
                          display: "flex",
                          alignItems: "center",
                          color: "black",
                          mt: 0.5,
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="black"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ marginRight: "4px" }}
                        >
                          <polyline points="0 12 5 12 8 4 12 20 16 8 19 12 24 12" />
                        </svg>
                        First Active: {formatMillisecondsTo12HourTime(machineStatusTimes[machine.id.id]?.lastTs)}
                      </Typography>



                    </Box>

                    {/* Component Chip */}
                    {(() => {
                      const componentName =
                        liveComponent[machine.id.id]?.componentName ?? "No Component";

                      return (
                        <Chip
                          label={` ${componentName}`}
                          size="small"
                          sx={{
                            mt: 1,
                            ml: -1,
                            fontSize: "0.75rem",
                            height: 20,
                            fontWeight: "bold",
                            paddingLeft: "4px",
                            bgcolor:
                              componentName !== "No Component" ? "#e8f5e9" : "#ffebee",
                            color:
                              componentName !== "No Component" ? "#2e7d32" : "#c62828",
                          }}
                        />
                      );
                    })()}

                    {/* Utilization Rate */}
                    {(() => {
                      const utilization =
                        machineUtilization[machine.id.id]?.utilization ?? 0;
                      const baseline =
                        utilizationBaseline[machine.id.id]?.utilizationBaseline ?? 0;
                      const changeFromBaseline = parseFloat(
                        (utilization - baseline).toFixed(1)
                      );
                      const changePositive = changeFromBaseline >= 0;

                      return (
                        <Box sx={{ mt: 1 }}>
                          {/* Top Row: Label */}
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "bold", fontSize: "14px" }}
                          >
                            Utilization Rate
                          </Typography>

                          {/* Bottom Row: Percentage + Change */}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            {/* Big % value */}
                            <Typography
                              sx={{
                                fontWeight: "bold",
                                fontSize: "26px",
                                lineHeight: 1,
                              }}
                            >
                              {utilization}%
                            </Typography>

                            {/* Change info */}
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                ml: 5,
                              }}
                            >
                              {changePositive ? (
                                <ArrowUpwardIcon
                                  fontSize="small"
                                  sx={{ color: "#4caf50" }}
                                />
                              ) : (
                                <ArrowDownwardIcon
                                  fontSize="small"
                                  sx={{ color: "#f44336" }}
                                />
                              )}
                              <Typography
                                variant="body2"
                                sx={{
                                  color: changePositive
                                    ? "#4caf50"
                                    : "#f44336",
                                  ml: 0.5,
                                }}
                              >
                                {Math.abs(changeFromBaseline)} pp{" "}
                                {changePositive ? "up" : "down"} from baseline
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })()}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

      </div>

      {/* Right Panel */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header above iframe */}
        <div
          style={{
            padding: "10px 15px",
            borderBottom: "1px solid #ddd",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {viewedMachine && (() => {
              const data = latestIdleRunDuration[viewedMachine.id.id] || {};
              if (!data.keyName) return null;

              const label = data.keyName.replace("duration", "");
              const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);

              return (
                <Typography
                  variant="h6"
                  component="div"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <strong>{viewedMachine.name}</strong>
                  {/* <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'blue',
          display: 'inline-block'
        }}
      ></span>
      <Typography variant="body2.3" color="textSecondary" component="span">
        {displayLabel} 
      </Typography> */}
                </Typography>
              );
            })()}


          </div>

          {/* Tab Buttons */}
          <div style={{ marginTop: "10px", display: "flex", gap: "30px" }}>
            <Button
              variant={activeTab === "overview" ? "contained" : "text"}
              onClick={() => handleTabClick("overview", selectedMachine)}
            >
              Overview
            </Button>

            <Button
              variant={activeTab === "timeline" ? "contained" : "text"}
              onClick={() => handleTabClick("timeline", selectedMachine)}
            >
              Timeline
            </Button>





          </div>

          {/* Date Picker + Shift Dropdown */}
          {(activeTab === "overview" || activeTab === "timeline") && (
            <div style={{ marginTop: "15px", display: "flex", gap: "15px" }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Select Date"
                  value={selectedDate}
                  onChange={(newValue) => setSelectedDate(newValue)}
                  format="DD-MM-YYYY"
                  slotProps={{
                    textField: {
                      size: "small",
                      style: { background: "#fff", flex: 1, minWidth: 160 },
                    },
                  }}
                />
              </LocalizationProvider>

              <FormControl
                size="small"
                variant="outlined"
                sx={{ flex: 1, minWidth: 160, backgroundColor: "#fff" }}
              >
                <InputLabel id="shifts-label">Shifts</InputLabel>
                <Select
                  labelId="shifts-label"
                  value={selectedShift || ""}
                  onChange={(e) => setSelectedShift(e.target.value)}
                  label="Shifts"
                >
                  {shifts.map((s) => (
                    <MenuItem key={s.id} value={s.shift_no}>
                      {s.shift_name || `Shift ${s.shift_no}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          )}
        </div>

        {/* Iframe */}
        <iframe
          src={iframeSrc}
          title="Grafana Dashboard"
          style={{ width: "100%", height: "100%", border: "none", flexGrow: 1 }}
        />
      </div>

      {/* Filter Popover */}


      <Popover
        open={Boolean(filterAnchor)}
        anchorEl={filterAnchor}
        onClose={handleFilterClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
      >
        <div style={{ width: "250px", padding: "10px" }}>
          {/* Machines */}
          <div
            onClick={() => setOpenMachines(!openMachines)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
          >
            <Typography variant="subtitle1">Machines</Typography>
            {openMachines ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </div>
          <Collapse in={openMachines}>
            <List>
              {devices.map((m) => (
                <ListItem
                  key={m.name}
                  dense
                  button
                  onClick={() => toggleMachineSelection(m.name)}
                >
                  <ListItemIcon>
                    <Checkbox checked={selectedMachines.includes(m.name)} />
                  </ListItemIcon>
                  <ListItemText primary={m.name} />
                </ListItem>
              ))}
            </List>
          </Collapse>

          {/* Machine Status */}
          <div
            onClick={() => setOpenStatus(!openStatus)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              cursor: "pointer",
              marginTop: "10px",
            }}
          >
            <Typography variant="subtitle1">Machine Status</Typography>
            {openStatus ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </div>

          <Collapse in={openStatus}>
            {/* Status Checkboxes */}
            <List>
              {["Running", "Idle", "Disconnect", "Alarm"].map((status) => (
                <ListItem
                  key={status}
                  dense
                  button
                  onClick={() => toggleStatusSelection(status)}
                >
                  <ListItemIcon>
                    <Checkbox checked={selectedStatus.includes(status)} />
                  </ListItemIcon>
                  <ListItemText primary={status} />
                </ListItem>
              ))}
            </List>


          </Collapse>


          {/* Filter Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "10px",
            }}
          >
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setSelectedMachines([]);
                setSelectedStatus([]);
              }}
            >
              Clear
            </Button>
            <Button variant="contained" size="small" onClick={handleFilterClose}>
              Done
            </Button>
          </div>
        </div>
      </Popover>
    </div>

  );
}
