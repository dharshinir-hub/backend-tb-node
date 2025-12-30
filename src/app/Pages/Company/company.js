import React, { useEffect, useState } from 'react';
import { MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { useNavigate } from "react-router-dom";

import {
  cleanCustomerId,
  telemetrylatestdata,
  customerbaseddevices,
  customerbasedshift,
  telemetrykeydata,
  getCustomerName
} from '../../Services/app/companyservice';
import './company.css';

const CompanyDashboard = () => {
  const customerId = localStorage.getItem('CustomerID');
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


  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const [shifts, setShifts] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [selectedShiftData, setSelectedShiftData] = useState(null);
  const [utilizationData, setUtilizationData] = useState([]);
  const [formattedUtilization, setFormattedUtilization] = useState('');
  const [grafanaUrls, setGrafanaUrls] = useState([]);
  const [timeData, setTimeData] = useState([]);
  const [formattedTime, setFormattedTime] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [fromTime, setFromTime] = useState(null);
  const [toTime, setToTime] = useState(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [lowerUtilization, setLowerUtilization] = useState({});
  const [selectedDate, setSelectedDate] = useState((dayjs));
  const [selectedShift, setSelectedShift] = useState(() => getCurrentShift(shifts));

  const [selectedMachineId, setSelectedMachineId] = useState(null);
  const [filteredDevices, setFilteredDevices] = useState([]);


  useEffect(() => {
    if (customerId) {
      fetchShifts();
      fetchDevices();
    }
  }, [customerId]);



  useEffect(() => {
    updateGrafanaURL();
  }, [selectedDevice, formattedUtilization, formattedTime, selectedShiftData, fromTime, toTime, from, to, newToken]);

  useEffect(() => {
    if (shifts.length > 0 && (selectedShift === null || selectedShift === undefined)) {
      const cur = getCurrentShift(shifts); // detect current shift
      setSelectedShift(cur);

      if (selectedDate) {
        const { from, to } = getShiftTimes(shifts, cur, selectedDate);
        setFrom(from);
        setTo(to);
        setFromTime(from);
        setToTime(to);

        // Always console log
        console.log("✅ from:", from);
        console.log("✅ to:", to);
        console.log("✅ fromTime:", from);
        console.log("✅ toTime:", to);
      }
    }
  }, [shifts, selectedDate]);


  useEffect(() => {
    if (shifts.length > 0 && selectedDate && selectedShift) {
      const { from, to } = getShiftTimes(shifts, selectedShift, selectedDate);
      console.log("From", from, "To", to);
      setFrom(from);
      setTo(to);
      setFromTime(from);
      setToTime(to);
      setShiftTimingForSelected(); // ✅ safe, uses latest values
    }
  }, [shifts, selectedShift, selectedDate]);




  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, 'allShift');
      const shiftList = result[0]?.value || [];
      setShifts(shiftList);
    } catch (err) {
      console.error('Failed to fetch shifts', err);
    }
  };

  console.log('Fetched Shifts', shifts);


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
    }
    // intentionally omit selectedShift from deps so this runs once when shifts load
  }, [shifts]);

  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];

      setDevices(devicesList);

      // Extract device name and id into JSON
      const nameIdMap = devicesList.reduce((acc, device) => {
        acc[device.name] = device.id.id;
        return acc;
      }, {});

      setDeviceNameIdJson(nameIdMap); // store in global state
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };
  console.log('Device Id', deviceNameIdJson);
  // Global variable to store device name and id


  // Function to filter devices based on some condition
  const filterDevices = () => {
    const filtered = devices.filter((device) => {
      // Example: Filter active devices, you can adjust based on your condition
      return device.status === "active";  // Adjust filter condition
    });
    setFilteredDevices(filtered);  // Set filtered devices state
  };


  const fetchTimeTelemetryForAllDevices = async () => {
    try {
      // Determine devices to fetch
      const devicesToFetch =
        selectedDevice === 'all'
          ? devices
          : devices.filter((device) => device.id?.id === selectedDevice);

      // Fetch telemetry for each device
      const timeList = await Promise.all(
        devicesToFetch.map(async (device) => {
          try {
            const response = await telemetrylatestdata(device.id?.id, 'DEVICE', 'time');
            const timeValue = response?.time?.[0]?.value || '{}';
            return { label: device.name, id: device.id?.id, time: timeValue };
          } catch {
            return { label: device.name, id: device.id?.id, time: '{}' };
          }
        })
      );

      setTimeData(timeList);

      // Format based on selection
      const filteredFormattedTime =
        selectedDevice === 'all'
          ? timeList // show all
          : timeList.filter((entry) => entry.id === selectedDevice); // show only selected

      setFormattedTime(encodeURIComponent(JSON.stringify(filteredFormattedTime)));
    } catch (error) {
      console.error('Error fetching time telemetry:', error);
    }
  };

  useEffect(() => {
    if (devices.length > 0) {
      fetchTimeTelemetryForAllDevices();
    }
  }, [devices, selectedDevice]);



  const setShiftTimingForSelected = () => {
    try {
      let starttime = '';
      let endtime = '';
      let shiftData = null;

      if (selectedShift === 'allshift') {
        shiftData = shifts.find((shift) => shift.shift_no === 1);
        if (shiftData) {
          starttime = shiftData.start_time;
          const now = new Date();
          endtime = now.toTimeString().split(' ')[0];
        }
      } else {
        shiftData = shifts.find((shift) => String(shift.shift_no) === String(selectedShift));
        if (shiftData) {
          starttime = shiftData.start_time;
          endtime = shiftData.end_time;
        }
      }

      if (shiftData) {
        setSelectedShiftData(shiftData);
      }

      setStartTime(starttime);
      setEndTime(endtime);
    } catch (error) {
      console.error('Error setting shift timing:', error);
    }
  };



  function combineDateAndTimeToMs(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    return new Date(`${dateStr}T${timeStr}`).getTime();
  }

  function getShiftTimes(shifts, selectedShift, selectedDate) {
    if (!Array.isArray(shifts) || shifts.length === 0 || !selectedDate) {
      return { from: null, to: null };
    }

    const selectedStr = dayjs(selectedDate).format("YYYY-MM-DD");
    const getDateByDayOffset = (baseDate, dayValue) => {
      const offset = Number(dayValue) - 1; // 1 = same day, 2 = +1 day, etc.
      return dayjs(baseDate).add(offset, "day").format("YYYY-MM-DD");
    };

    const normalizedShift =
      typeof selectedShift === "string"
        ? selectedShift.trim().toLowerCase()
        : selectedShift == null
          ? ""
          : String(selectedShift);

    if (normalizedShift === "") return { from: null, to: null };

    if (normalizedShift === "allshift" || normalizedShift === "all shift") {
      const sortedShifts = [...shifts].sort(
        (a, b) => Number(a.shift_no) - Number(b.shift_no)
      );

      const firstShift = sortedShifts[0];
      const lastShift = sortedShifts[sortedShifts.length - 1];
      if (!firstShift || !lastShift) return { from: null, to: null };

      const fromDateStr = getDateByDayOffset(selectedStr, firstShift.start_day);
      const toDateStr = getDateByDayOffset(selectedStr, lastShift.end_day);

      const fromStr = `${fromDateStr}T${firstShift.start_time}`;
      const toStr = `${toDateStr}T${lastShift.end_time}`;

      return {
        from: new Date(fromStr).getTime(),
        to: new Date(toStr).getTime(),
      };
    }

    // 🟡 Handle Single Shift
    const shiftData = shifts.find((s) => String(s.shift_no) === normalizedShift);
    if (!shiftData) return { from: null, to: null };

    const { start_time, end_time, start_day, end_day } = shiftData;

    const fromDateStr = getDateByDayOffset(selectedStr, start_day);
    const toDateStr = getDateByDayOffset(selectedStr, end_day);

    const fromStr = `${fromDateStr}T${start_time}`;
    const toStr = `${toDateStr}T${end_time}`;

    return {
      from: new Date(fromStr).getTime(),
      to: new Date(toStr).getTime(),
    };
  }



  console.log('From', from, 'to', to);

  function calculateShiftTimesWithDate(shifts, selectedShift, selectedDate) {
    if (!Array.isArray(shifts) || shifts.length === 0 || !selectedDate) {
      return { fromEpoch: null, toEpoch: null };
    }

    const shiftValue =
      typeof selectedShift === "number"
        ? String(selectedShift)
        : selectedShift || "";

    const normalizedShift = shiftValue.trim().toLowerCase();
    const baseDate = dayjs(selectedDate).subtract(1, "day").format("YYYY-MM-DD");
    const todayStr = dayjs(selectedDate).format("YYYY-MM-DD");

    const getDateByDayOffset = (baseDate, dayValue) => {
      const offset = Number(dayValue) - 1; // 1 = same day, 2 = +1 day
      return dayjs(baseDate).add(offset, "day").format("YYYY-MM-DD");
    };

    let fromEpoch = null;
    let toEpoch = null;

    if (normalizedShift === "allshift" || normalizedShift === "all shift") {
      const sortedShifts = [...shifts].sort(
        (a, b) => Number(a.shift_no) - Number(b.shift_no)
      );
      const firstShift = sortedShifts[0];
      const lastShift = sortedShifts[sortedShifts.length - 1];
      if (!firstShift || !lastShift) return { fromEpoch: null, toEpoch: null };

      const fromDateStr = getDateByDayOffset(baseDate, firstShift.start_day);
      const toDateStr = getDateByDayOffset(baseDate, lastShift.end_day);

      const fromStr = `${fromDateStr}T${firstShift.start_time}`;
      const toStr = `${toDateStr}T${lastShift.end_time}`;

      fromEpoch = new Date(fromStr).getTime();
      toEpoch = new Date(toStr).getTime();
    }
    else {
      const shiftData = shifts.find(
        (s) => String(s.shift_no) === String(shiftValue)
      );
      if (!shiftData) return { fromEpoch: null, toEpoch: null };

      const { start_time, end_time, start_day, end_day } = shiftData;

      const fromDateStr = getDateByDayOffset(baseDate, start_day);
      const toDateStr = getDateByDayOffset(baseDate, end_day);

      const fromStr = `${fromDateStr}T${start_time}`;
      const toStr = `${toDateStr}T${end_time}`;

      fromEpoch = new Date(fromStr).getTime();
      toEpoch = new Date(toStr).getTime();
    }

    return { fromEpoch, toEpoch };
  }

  console.log("FromTime (epoch):", fromTime);
  console.log("ToTime (epoch):", toTime);
  console.log("Shifts data type:", typeof shifts, shifts);

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



  // const [finalUtilizationData, setFinalUtilizationData] = useState({});

  // useEffect(() => {
  //   const fetchUtilizationData = async () => {
  //     if (!from || !to || devices.length === 0) return;

  //     const results = {};
  //     const devicesToFetch =
  //       selectedDevice === "all"
  //         ? devices
  //         : devices.filter(d => d.id?.id === selectedDevice);

  //     const toNumber = (v) => {
  //       if (v === null || v === undefined) return 0;
  //       const s = String(v).replace(/[^\d\.\-]/g, "");
  //       return s === "" ? 0 : parseFloat(s);
  //     };

  //     await Promise.all(
  //       devicesToFetch.map(async (machine) => {
  //         try {
  //           const resp = await telemetrykeydata(
  //             machine.id.id,
  //             "DEVICE",
  //             "utilization",
  //             from,
  //             to
  //           );

  //           const rows = Array.isArray(resp?.utilization) ? resp.utilization : [];
  //           if (rows.length === 0) {
  //             results[machine.name] = null;
  //             return;
  //           }

  //           const firstRow = rows[0];
  //           let firstValue = 0;

  //           if (typeof firstRow === "number") {
  //             firstValue = firstRow;
  //           } else if (typeof firstRow === "string") {
  //             try {
  //               const parsed = JSON.parse(firstRow);
  //               firstValue = toNumber(parsed.utilization ?? parsed.value ?? 0);
  //             } catch {
  //               firstValue = toNumber(firstRow);
  //             }
  //           } else if (typeof firstRow === "object" && firstRow !== null) {
  //             firstValue = toNumber(firstRow.value ?? firstRow.utilization ?? 0);
  //           }

  //           results[machine.name] = firstValue;

  //         } catch (err) {
  //           console.error("Error fetching utilization for", machine.name, err);
  //           results[machine.name] = null;
  //         }
  //       })
  //     );

  //     setFinalUtilizationData(results);
  //     window.FinalUtilization = results;

  //     console.log("✅ Utilization for devices:", results);
  //   };

  //   fetchUtilizationData();
  // }, [devices, selectedDevice, from, to]);

  // console.log('Final Utilization', finalUtilizationData);



  const [allMachinesData, setAllMachinesData] = useState({});

  useEffect(() => {
    const fetchAllMachinesData = async () => {
      const results = {};

      // ✅ Decide which devices to fetch
      const devicesToFetch =
        selectedDevice === "all"
          ? devices
          : devices.filter((d) => d.id?.id === selectedDevice);

      await Promise.all(
        devicesToFetch.map(async (machine) => {
          try {
            const resp = await telemetrykeydata(
              machine.id.id,
              "DEVICE",
              "time", // 👈 telemetry key
              from,
              to
            );

            const rows = Array.isArray(resp?.time) ? resp.time : [];
            if (rows.length === 0) {
              results[machine.name] = {};
              return;
            }

            const firstRow = rows[0];

            let parsed = {};
            try {
              parsed =
                typeof firstRow.value === "string"
                  ? JSON.parse(firstRow.value)
                  : firstRow.value;
            } catch (err) {
              console.warn("❌ Parse error for", machine.name, firstRow.value);
            }

            // ✅ Store machine data under machine name
            results[machine.name] = parsed;
          } catch (err) {
            console.error("⚠️ Error fetching for", machine.name, err);
            results[machine.name] = {};
          }
        })
      );

      // ✅ If single machine was selected → directly set that machine’s JSON
      if (selectedDevice !== "all" && Object.keys(results).length === 1) {
        const onlyMachine = Object.values(results)[0];
        setAllMachinesData(onlyMachine);
        window.AllMachinesData = onlyMachine;
        console.log("✅ Single Machine Data:", JSON.stringify(onlyMachine, null, 2));
      } else {
        setAllMachinesData(results);
        window.AllMachinesData = results;
        console.log("✅ All Machines Data:", JSON.stringify(results, null, 2));
      }
    };

    fetchAllMachinesData();
  }, [devices, selectedDevice, from, to]);




  console.log('Lower CycleTime', allMachinesData);



  const [finalUtilizationBaseline, setFinalUtilizationBaseline] = useState({});

  useEffect(() => {
    const fetchUtilizationAndBaseline = async () => {
      if (!from || !to || devices.length === 0) return;

      const results = {};
      const devicesToFetch =
        selectedDevice === "all"
          ? devices
          : devices.filter(d => d.id?.id === selectedDevice);

      // Helper: normalize to number
      const toNumber = (v) => {
        if (v === null || v === undefined) return 0;
        const s = String(v).replace(/[^\d\.\-]/g, "");
        return s === "" ? 0 : parseFloat(s);
      };

      await Promise.all(
        devicesToFetch.map(async (machine) => {
          try {
            // --- Fetch utilization key ---
            const utilResp = await telemetrykeydata(
              machine.id.id,
              "DEVICE",
              "utilization",
              from,
              to
            );

            const utilRows = Array.isArray(utilResp?.utilization) ? utilResp.utilization : [];
            let latestUtil = null;
            if (utilRows.length > 0) {
              latestUtil = toNumber(utilRows[0]?.value); // 👈 first row
            }

            // --- Fetch historicalbaseline key ---
            const baselineResp = await telemetrykeydata(
              machine.id.id,
              "DEVICE",
              "historicalbaseline",
              from,
              to
            );

            const baselineRows = Array.isArray(baselineResp?.historicalbaseline) ? baselineResp.historicalbaseline : [];
            let baselineUtil = null;
            if (baselineRows.length > 0) {
              try {
                const parsed = JSON.parse(baselineRows[0]?.value); // 👈 first row
                baselineUtil = toNumber(parsed.utilization);
              } catch (err) {
                console.error("Error parsing baseline JSON for", machine.name, baselineRows[0]?.value, err);
              }
            }

            // --- Store both values ---
            results[machine.name] = {
              utilization: latestUtil,
              baseline: baselineUtil
            };
            console.log('full utilization data', results);
          } catch (err) {
            console.error("Error for", machine.name, err);
            results[machine.name] = { utilization: null, baseline: null };
          }
        })
      );

      // ✅ Filter only machines where utilization < baseline
      const filtered = Object.fromEntries(
        Object.entries(results).filter(([_, data]) =>
          data.utilization != null &&
          data.baseline != null &&
          data.utilization < data.baseline
        )
      );

      setFinalUtilizationBaseline(filtered);
      window.FinalUtilizationBaseline = filtered;

      console.log("✅ Filtered machines (util < baseline):", filtered);
    };

    fetchUtilizationAndBaseline();


  }, [devices, selectedDevice, from, to]);


  console.log('final utilization', finalUtilizationBaseline);





  const updateGrafanaURL = () => {
    const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
    const shiftListSerialized = encodeURIComponent(JSON.stringify(shifts));
    const cleanedId = cleanCustomerId(customerId);
    const encodedid = encodeURIComponent(JSON.stringify(deviceNameIdJson));

    let entityType = "CUSTOMER";
    let entityId = cleanedId;
    if (selectedDevice !== "all") {
      entityType = "DEVICE";
      entityId = selectedDevice;
    }

    const baseUrl = window._env_.SERVER_URL;
    const GRAFANA_URL = window._env_.GRAFANA_URL;



    const grafanaUrls = [
      `${window._env_.GRAFANA_URL}d/ee6814b1-edf0-4361-ba7b-c2fe16bb1f64/todayyesterdayseries-1?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${entityId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light&refresh=1h`,

      `${window._env_.GRAFANA_URL}d/e05288c8-81a1-4f19-bf5d-d8da502b49b8/lower-utilization-dashboard-3?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${entityId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-allid=${encodedid}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light`,

      `${window._env_.GRAFANA_URL}d/f862d350-2f94-45a6-a561-f7622a57bf7a/piecharts-dasboard-2?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${entityId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-allid=${encodedid}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light&refresh=20s`,

      `${window._env_.GRAFANA_URL}d-solo/dd09d336-9d3f-44b7-81bd-5fe2179ac504/lower-cycletime-dashboard-4?orgId=1&panelId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${entityId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-allid=${encodedid}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light`,

      `${window._env_.GRAFANA_URL}d/ca045704-dd28-4115-9441-0fa3a94e0a02/mm-production-utilization-2-copy-copy?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=DEVICE&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-allid=${encodedid}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light`
    ];

    setGrafanaUrls(grafanaUrls);

    grafanaUrls.forEach((url, i) => {
      console.log(`Iframe url ${i + 1}:`, url);
    });
  };







  useEffect(() => {
    const savedDate = localStorage.getItem("selectedDate");
    if (savedDate) {
      setSelectedDate(dayjs(savedDate));
    }
  }, []);

  useEffect(() => {
    const fetchCustomerName = async () => {
      try {
        const customerName = await getCustomerName();
        localStorage.setItem("customerName", customerName.customer);
      } catch (err) {
        console.error("Failed to fetch customer name:", err.message);
      }
    };
    fetchCustomerName();
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


  const navigate = useNavigate(); // For navigation


  const handleViewMachineCard = (deviceName) => {
    console.log("Device name passed:", deviceName);

    // Get the deviceId using the deviceName from the map
    const deviceId = deviceNameIdJson[deviceName];
    console.log('clicked device id', deviceId);

    if (deviceId && fromTime && toTime && from && to) {
      const baseUrl = window._env_.SERVER_URL;
      const GRAFANA_URL = window._env_.GRAFANA_URL;
      const grafanaUrl = grafanaUrls[4];
      const bearerToken = encodeURIComponent(`Bearer+${newToken}`);

      const url = `${grafanaUrl}&var-deviceId=${deviceId}&var-deviceName=${encodeURIComponent(deviceName)}`;

      console.log('Navigating to /machineutilization with:', { url, deviceId, deviceName, fromTime, toTime, baseUrl, grafanaUrl });

      navigate(`/machineutilization?deviceId=${deviceId}&token=${bearerToken}&fromTime=${fromTime}&toTime=${toTime}&from=${from}&to=${to}&grafanaurl=${GRAFANA_URL}&baseurl=${baseUrl}&deviceName=${encodeURIComponent(deviceName)}`);
    } else {
      console.error("Missing required variables or device ID not found for:", deviceName);
    }
  };






  // Use effect to filter devices when the component mounts or devices change
  useEffect(() => {
    if (devices?.length > 0) {
      filterDevices(); // Call filterDevices when devices are available
    }
  }, [devices]);



  return (
    <div style={{ padding: '30px', background: '#fefcfcff', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', flexWrap: 'wrap' }} className='company-dashboard'>
        <h4><b>Company Dashboard</b></h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>

          <FormControl
            size="small"
            style={{ minWidth: 160, background: '#fff' }}
            variant="outlined"
          >
            <InputLabel id="machines-label">Machines</InputLabel>
            <Select
              labelId="machines-label"
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              label="Machines"
            >
              <MenuItem value="all">All Machines</MenuItem>
              {devices.map((d) => (
                <MenuItem key={d.id.id} value={d.id.id}>
                  {d.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>


          <FormControl size="small" sx={{ minWidth: 160, background: "#fff" }}>
            <InputLabel id="shift-label">Shifts</InputLabel>
            <Select
              labelId="shift-label"
              value={selectedShift || ""}
              onChange={(e) => setSelectedShift(e.target.value)}
            >
              {shifts.map((s) => {
                const isToday =
                  dayjs(selectedDate).format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD");

                const shiftDate = dayjs(selectedDate).add(Number(s.start_day) - 1, "day");
                const shiftStart = dayjs(`${shiftDate.format("YYYY-MM-DD")}T${s.start_time}`).valueOf();

                const isDisabled = isToday && shiftStart > Date.now();

                return (
                  <MenuItem key={s.shift_no} value={s.shift_no} disabled={isDisabled}>
                    {`Shift ${s.shift_no}`}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Select Date"
              value={selectedDate}
              onChange={(newValue) => {
                if (!newValue) return;
                const newDate = dayjs(newValue);
                const isToday = newDate.isSame(dayjs(), "day");
                if (isToday && selectedShift) {
                  const currentShift = shifts.find(
                    (s) => String(s.shift_no) === String(selectedShift)
                  );
                  if (currentShift) {
                    const shiftDate = newDate.add(Number(currentShift.start_day) - 1, "day");
                    const shiftStart = dayjs(
                      `${shiftDate.format("YYYY-MM-DD")}T${currentShift.start_time}`
                    ).valueOf();
                    if (shiftStart > Date.now()) {
                      setSelectedShift("1");
                    }
                  }
                }
                setSelectedDate(newValue);
              }}
              format="DD-MM-YYYY"
              maxDate={dayjs()}
              slotProps={{
                textField: {
                  size: "small",
                  fullWidth: false,
                  sx: { minWidth: 160, background: "#fff" },
                },
              }}
            />
          </LocalizationProvider>

        </div>
      </div>




      <div className='two-column-layout'>

        {/* Left Column */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: "auto auto auto", // Top iframe + Utilization + Cycle Time
            gap: "30px",
            position: "relative",
          }}
        >
          {/* Top iframe */}
          <iframe
            src={grafanaUrls[0]}
            style={{ width: "100%", height: "400px", border: "0", }}
            title="Grafana Left Top"
          />

          <div //utilization
            style={{
              position: 'absolute',
              top: 2,
              right: "50%",
              width: 80,
              height: 40,
              backgroundColor: 'transparent',
              zIndex: 10,

            }}
          />
          <div //availability
            style={{
              position: 'absolute',
              top: 180,
              right: "50%",
              width: 80,
              height: 40,
              backgroundColor: 'transparent',
              zIndex: 10,

            }}
          />
          <div //right corner
            style={{
              position: 'absolute',
              top: 2,
              right: 14,
              width: 80,
              height: "40%",
              backgroundColor: 'transparent',
              zIndex: 10,
            }}
          />

          {/* Legend Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "20px",
              padding: "0 4px",
              fontSize: "16px",
              color: "#444",
              lineHeight: "1",
            }}
          >
            {/* Historical Baseline */}
            <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span
                style={{
                  width: "20px",
                  height: "2px",
                  background: "#666",
                  borderTop: "2px dashed #666",
                  display: "inline-block",
                }}
              />
              <span style={{ color: "black" }}>Historical baseline</span>
            </span>

            {/* Yesterday */}
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="30" height="4">
                <line
                  x1="0"
                  y1="2"
                  x2="30"
                  y2="2"
                  stroke="orange"
                  strokeWidth="2"
                  strokeDasharray="6,4"
                />
              </svg>
              <span style={{ color: "black" }}>Yesterday</span>
            </span>

            {/* Today */}
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: "30px",
                  height: "2px",
                  background: "#5c6bc0",
                  display: "inline-block",
                }}
              />
              <span style={{ color: "black" }}>Today</span>
            </span>
          </div>

          <h3
            style={{
              textAlign: "left",
              marginBottom: "0px",
              marginTop: "0px",
              fontSize: "20px",
              fontWeight: "600",
              color: "#333",
            }}
          >
            Utilization Lower than Expected
          </h3>
          {/* Utilization Section */}
          <div style={{ width: "100%", height: "210px", overflowY: "auto" }}>


            {(() => {
              const iframeHeight = 200;

              const validEntries = Object.entries(finalUtilizationBaseline).filter(
                ([_, values]) => Object.keys(values).length > 0
              );

              if (validEntries.length === 0) {
                return (
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "18px",
                      fontWeight: "500",
                      color: "#666",
                      padding: "40px 0",
                    }}
                  >
                    No Operations
                  </div>
                );
              }

              return (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "10px",
                    width: "100%",
                    gridAutoRows: `${iframeHeight}px`,
                  }}
                >
                  {validEntries.map(([machine, values], index) => {
                    const machineData = encodeURIComponent(
                      JSON.stringify({
                        machine,
                        utilization: values.utilization,
                        expected: values.baseline,
                      })
                    );

                    const url = `${grafanaUrls[1]}&var-lowerutilization=${machineData}`;
                    console.log("utilization machine Data", machineData);
                    const deviceId = encodeURIComponent(values?.deviceId || machine);
                    const deviceName = encodeURIComponent(
                      values?.deviceName || machine
                    );

                    return (
                      <div
                        key={index}
                        style={{
                          position: "relative",
                          width: "100%",
                          height: `${iframeHeight}px`,
                          borderRadius: "8px",
                          overflow: "hidden",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                          cursor: "pointer",
                        }}
                        onClick={() => handleViewMachineCard(deviceName)}
                      >
                        <iframe
                          src={url}
                          style={{
                            width: "100%",
                            height: "100%",
                            border: "0",
                          }}
                          title={`Utilization-${deviceName}`}
                        />
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "transparent",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>


          <h3
            style={{
              textAlign: "left",
              marginBottom: "0px",
              marginTop: "0px",
              fontSize: "20px",
              fontWeight: "600",
              color: "#333",
            }}
          >
            Cycle Time Lower than Expected
          </h3>

          {/* Cycle Time Section */}
          <div style={{ width: "100%", height: "210px", overflowY: "auto" }}>
            {(() => {
              // Normalize allMachinesData into a consistent object
              let machines = {};

              if (allMachinesData) {
                if (!Array.isArray(allMachinesData) && typeof allMachinesData === "object") {
                  machines = allMachinesData.machinename
                    ? { [allMachinesData.machinename]: allMachinesData }
                    : allMachinesData;
                } else if (Array.isArray(allMachinesData)) {
                  machines = allMachinesData.reduce((acc, item) => {
                    if (item && item.machinename) acc[item.machinename] = item;
                    return acc;
                  }, {});
                }
              }

              // Filter out machines with empty object or both times as 0
              const validMachines = Object.fromEntries(
                Object.entries(machines).filter(([_, v]) => {
                  if (!v || Object.keys(v).length === 0) return false;
                  if (v.actualTime === 0 && v.referenceTime === 0) return false;
                  return true;
                })
              );


              if (Object.keys(validMachines).length === 0) {
                return (
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "18px",
                      fontWeight: "500",
                      color: "#666",
                      padding: "40px 0",
                    }}
                  >
                    No Operations
                  </div>
                );
              }

              return (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "10px",
                    width: "100%",
                  }}
                >
                  {Object.entries(validMachines).map(([machineKey, v], index) => {
                    const machineDataObj = {
                      machine: v.machinename,
                      actualTime: v.actualTime,
                      referenceTime: v.referenceTime,
                      component: v.component,
                      partnumber: v.partnumber,
                    };

                    const machineData = encodeURIComponent(JSON.stringify(machineDataObj));
                    const url = `${grafanaUrls[3]}&var-cycletime=${machineData}`;

                    return (
                      <iframe
                        key={index}
                        src={url}
                        style={{
                          width: "100%",
                          height: "200px",
                          border: "0",
                          borderRadius: "8px",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                        }}
                        title={`Machine-${machineKey}`}
                      />
                    );
                  })}
                </div>
              );
            })()}
          </div>



        </div>

        {/* Right Column */}
        <div style={{ position: "relative" }}>
          <iframe
            src={grafanaUrls[2]}
            style={{ width: "100%", height: "100%", border: "0" }}
            title="Grafana Right"
          />
          <div //performance
            style={{
              position: 'absolute',
              top: 0,
              right: 14,
              width: 80,
              height: "100%",
              backgroundColor: 'transparent',
              zIndex: 10
            }}
          />
        </div>
      </div>

    </div>
  );
};

export default CompanyDashboard;
