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
  const newToken = localStorage.getItem('newToken');

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
const [selectedDate, setSelectedDate] = useState((dayjs) );
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
  }, [selectedDevice, formattedUtilization, formattedTime, selectedShiftData, fromTime, toTime, from, to]);

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
console.log('Device Id',deviceNameIdJson);
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
        toStr = new Date().toISOString(); // current time
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
    toStr = new Date().toISOString(); // current time
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


const [finalUtilizationData, setFinalUtilizationData] = useState({});

useEffect(() => {
  const fetchUtilizationData = async () => {
    if (!from || !to || devices.length === 0) return;

    const results = {};
    const devicesToFetch =
      selectedDevice === "all"
        ? devices
        : devices.filter(d => d.id?.id === selectedDevice);

    // Helper: normalize numeric string like "4%", " 4.0 " -> 4
    const toNumber = (v) => {
      if (v === null || v === undefined) return 0;
      const s = String(v).replace(/[^\d\.\-]/g, "");
      return s === "" ? 0 : parseFloat(s);
    };

    // Helper: try to locate the device's data inside parsed value
    const extractDeviceEntry = (parsed, machine) => {
      if (!parsed || typeof parsed !== "object") return null;
      if (parsed[machine.name]) return parsed[machine.name];
      if (machine.id?.id && parsed[machine.id.id]) return parsed[machine.id.id];
      if ("utilization" in parsed || "expected_utilization" in parsed || "expected" in parsed) {
        return parsed;
      }
      for (const k of Object.keys(parsed)) {
        const v = parsed[k];
        if (v && typeof v === "object" && ("utilization" in v || "expected_utilization" in v || "expected" in v)) {
          return v;
        }
      }
      return null;
    };

    await Promise.all(
      devicesToFetch.map(async (machine) => {
        try {
          const resp = await telemetrykeydata(
            machine.id.id,
            "DEVICE",
            "lowerutilization",
            from,
            to
          );

          const rows = Array.isArray(resp?.lowerutilization) ? resp.lowerutilization : [];
          if (rows.length === 0) {
            results[machine.name] = {};
            return;
          }

          // ✅ pick latest row only
          let latestRow = rows.reduce((latest, row) => {
            const tsNum = Number(row.ts);
            return (!latest || tsNum > Number(latest.ts)) ? row : latest;
          }, null);

          if (!latestRow) {
            results[machine.name] = {};
            return;
          }

          let parsed;
          try {
            parsed = typeof latestRow.value === "string" ? JSON.parse(latestRow.value) : latestRow.value;
          } catch (err) {
            console.warn("failed parse row.value", latestRow.value, err);
            results[machine.name] = {};
            return;
          }

          const dev = extractDeviceEntry(parsed, machine);
          if (!dev) {
            results[machine.name] = {};
            return;
          }

          // ✅ Store full latest JSON
          results[machine.name] = dev;

        } catch (err) {
          console.error("Error for", machine.name, err);
          results[machine.name] = {};
        }
      })
    );

    // ✅ Filter only machines where utilization < expected
    const filteredResults = Object.fromEntries(
      Object.entries(results).filter(([_, dev]) => {
        const util = toNumber(dev.utilization ?? dev.util ?? dev.u ?? 0);
        const expected = toNumber(dev.expected_utilization ?? dev.expected ?? dev.expectedUtilization ?? 0);
        return util < expected;
      })
    );

    setFinalUtilizationData(filteredResults);
    window.FinalLowerUtilization = results;
    window.FilteredLowerUtilization = filteredResults;

    console.log("✅ All latest lower utilization JSON:", results);
    console.log("⚠️ Filtered (util < expected):", filteredResults);
  };

  fetchUtilizationData();
}, [devices, selectedDevice, from, to]);


console.log('Final Lower utilization', finalUtilizationData);



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




console.log('Lower CycleTime',allMachinesData);







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
    `${window._env_.GRAFANA_URL}d/ee6814b1-edf0-4361-ba7b-c2fe16bb1f64/todayyesterdayseries-1?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${entityId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light&refresh=5s`,

    `${window._env_.GRAFANA_URL}d/e05288c8-81a1-4f19-bf5d-d8da502b49b8/lower-utilization-dashboard-3?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${entityId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-allid=${encodedid}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light&refresh=5s`,

    `${window._env_.GRAFANA_URL}d/f862d350-2f94-45a6-a561-f7622a57bf7a/piecharts-dasboard-2?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${entityId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-allid=${encodedid}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light&refresh=5s`,

    `${window._env_.GRAFANA_URL}d-solo/dd09d336-9d3f-44b7-81bd-5fe2179ac504/lower-cycletime-dashboard-4?orgId=1&panelId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${entityId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-allid=${encodedid}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light&refresh=5s`,

    `${window._env_.GRAFANA_URL}d/ca045704-dd28-4115-9441-0fa3a94e0a02/mm-production-utilization-2-copy-copy?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=DEVICE&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-allid=${encodedid}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light&refresh=5s`
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

  // Check if all required variables are defined
  if (deviceId && fromTime && toTime && from && to) {
    // Assume you already have these variables from props/context/state
    const baseUrl = window._env_.SERVER_URL;
    const GRAFANA_URL = window._env_.GRAFANA_URL;
    const grafanaUrl = grafanaUrls[4];
    const bearerToken = encodeURIComponent(`Bearer+${newToken}`);

    // Construct the Grafana iframe URL
    const url = `${grafanaUrl}&var-deviceId=${deviceId}&var-deviceName=${encodeURIComponent(deviceName)}`;

    console.log('Navigating to /machineutilization with:', { url, deviceId, deviceName, fromTime, toTime, baseUrl, grafanaUrl });

    // Navigate with query params + state
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
              // check if selected date = today
              const isToday =
                dayjs(selectedDate).format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD");
        
              // compute shift start timestamp for today
              const shiftStart = new Date(`${dayjs(selectedDate).format("YYYY-MM-DD")}T${s.start_time}`).getTime();
        
              // disable only if today AND shift start is in the future
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
    onChange={(newValue) => setSelectedDate(newValue)}
    format="DD-MM-YYYY"
    slotProps={{
      textField: {
        size: "small",            // ✅ match dropdown height
        fullWidth: false,
        sx: { minWidth: 160, background: "#fff" } // ✅ same width & style as others
      }
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
    }}
  >
    {/* Top iframe */}
    <iframe
      src={grafanaUrls[0]}
      style={{ width: "100%", height: "400px", border: "0" }}
      title="Grafana Left Top"
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
            background: "orange",
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

        const validEntries = Object.entries(finalUtilizationData).filter(
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
                  expected: values.expected_utilization,
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
  <div>
    <iframe
      src={grafanaUrls[2]}
      style={{ width: "100%", height: "100%", border: "0" }}
      title="Grafana Right"
    />
  </div>
</div>








    </div>
  );
};

export default CompanyDashboard;
