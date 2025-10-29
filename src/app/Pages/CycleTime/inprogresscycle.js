import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  MenuItem,
  Select,
  Card,
  CardContent,
  Chip,
  Button,
  FormControl,
  InputLabel,
  keyframes,
  TableCell,
  TableHead,
  TableRow,
  Table,
  Paper,
  TableContainer,
  TableBody,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import {
  customerbaseddevices,
  customerbasedshift,
  telemetrykeydata,
  // telemetrylatestdata, // uncomment if you use it later
} from "../../Services/app/companyservice";
import dayjs from "dayjs";
import SearchIcon from "@mui/icons-material/Search";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { useLocation, useNavigate } from "react-router-dom";

const MetricRow = ({ label, value }) => (
  <Box
    sx={{
      display: "flex",
      justifyContent: "space-between",
      py: 0.8,
      borderBottom: "1px solid rgba(0,0,0,0.05)",
      "&:last-child": { borderBottom: "none" },
    }}
  >
    <Typography
      variant="body2"
      sx={{
        color: "#334155",
        fontWeight: 500,
      }}
    >
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{
        color: "#111827",
        fontWeight: 600,
      }}
    >
      {value}
    </Typography>
  </Box>
);

const Inprogress = () => {
  const baseUrl = window._env_.SERVER_URL;

  // UI / filter states
  const [partNumber, setPartNumber] = useState("");
  const [reportType, setReportType] = useState("Part Time vs Expected");
  const [machineGroup, setMachineGroup] = useState("CNC Group ");
  const [searchText, setSearchText] = useState("");
  const [filterAnchor, setFilterAnchor] = useState(null);

  // domain states
  const [shifts, setShifts] = useState([]);
  const [devices, setDevices] = useState([]); // full device objects
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({}); // name -> id
  const [idToName, setIdToName] = useState({}); // id -> name for lookups

  // telemetry-derived states
  const [machineUtilization, setMachineUtilization] = useState({});
  const [utilizationBaseline, setUtilizationBaseline] = useState({});
  const [liveComponent, setLiveComponent] = useState({});
  const [machineDurations, setMachineDurations] = useState({});
  const [machineStatuses, setMachineStatuses] = useState({});
  const [machineStatusTimes, setMachineStatusTimes] = useState({});
  const [partsData, setPartsData] = useState({});


  // selection / interactions
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [selectedMachines, setSelectedMachines] = useState([]); // for future multi-select needs
  const [selectedMachine, setSelectedMachine] = useState(null); // the currently selected device object
  const [selectedMachineId, setSelectedMachineId] = useState(null); // id string
  const [clickedDevice, setClickedDevice] = useState(null);
  const [viewedMachine, setViewedMachine] = useState(null);
  const [from, setFrom] = useState(null); // start epoch of current shift
  const [to, setTo] = useState(null);

  // time ranges and epochs
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedDevice: locSelectedDevice } =
    (location && location.state) || {};

  // initialize selectedDevices from route state if present and an array of ids
  const [selectedDevices, setSelectedDevices] = useState(
    Array.isArray(locSelectedDevice) ? locSelectedDevice : []
  );

  // start / end epoch state (computed from shifts)
  const [startEpoch, setStartEpoch] = useState(null);
  const [endEpoch, setEndEpoch] = useState(null);
  const [currentShift, setCurrentShift] = useState(null);


  // Customer info
  const Id = localStorage.getItem("CustomerID");
  let customerId = decodeURIComponent(Id || "").replace(/^"|"$/g, "");
  const newToken = localStorage.getItem("newToken");

  // Fetch shifts and compute start/end epoch (handles overnight shift end < start)
  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, "allShift");
      const dataShifts = result?.[0]?.value ?? [];
      setShifts(dataShifts);

      if (!Array.isArray(dataShifts) || dataShifts.length === 0) {
        setStartEpoch(null);
        setEndEpoch(null);
        setFrom(null);
        setTo(null);
        return;
      }

      const now = Date.now();

      // Helper to convert "HH:mm:ss" to epoch with optional addDay
      const toEpoch = (timeStr, addDay = false) => {
        if (!timeStr) return null;
        const [h, m, s] = timeStr.split(":").map(Number);
        const d = new Date();
        d.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
        if (addDay) d.setDate(d.getDate() + 1);
        return d.getTime();
      };

      // --- Compute first and last shift epochs ---
      const firstShift = dataShifts[0];
      const lastShift = dataShifts[dataShifts.length - 1];

      const sEpoch = toEpoch(firstShift.start_time);
      const addDayForEnd =
        lastShift.end_time && lastShift.start_time && lastShift.end_time < lastShift.start_time;
      const eEpoch = toEpoch(lastShift.end_time, addDayForEnd);

      setStartEpoch(sEpoch);
      setEndEpoch(eEpoch);

      // --- Find current shift ---
      const currentShift = dataShifts.find((shift) => {
        if (!shift.start_time || !shift.end_time) return false;

        const startEpoch = toEpoch(shift.start_time);
        const endEpoch = toEpoch(shift.end_time, shift.end_time < shift.start_time);

        return now >= startEpoch && now <= endEpoch;
      });

      if (currentShift) {
        setFrom(toEpoch(currentShift.start_time));
        setTo(toEpoch(currentShift.end_time, currentShift.end_time < currentShift.start_time));
      } else {
        // Default to first shift if no active shift
        setFrom(toEpoch(firstShift.start_time));
        setTo(toEpoch(firstShift.end_time, firstShift.end_time < firstShift.start_time));
      }
    } catch (err) {
      console.error("Failed to fetch shifts", err);
      setStartEpoch(null);
      setEndEpoch(null);
      setFrom(null);
      setTo(null);
    }
  };



  console.log('Current shift time', currentShift);
  console.log('from', from, 'to', to);

  // Fetch devices and build maps
  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result?.data ?? [];
      setDevices(devicesList);

      const nameToId = {};
      const idToNameMap = {};
      devicesList.forEach((d) => {
        const id = d?.id?.id ?? d?.id ?? d;
        nameToId[d.name] = id;
        idToNameMap[id] = d.name;
      });
      setDeviceNameIdJson(nameToId);
      setIdToName(idToNameMap);
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };

  // initial fetch of shifts + devices
  useEffect(() => {
    if (customerId && newToken) {
      fetchShifts();
      fetchDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, newToken]);

  // keep filteredDevices in sync with devices + search text + simple filter placeholders
  useEffect(() => {
    const q = (searchText || "").trim().toLowerCase();
    const filtered = devices.filter((d) => {
      if (!q) return true;
      return (d.name || "").toLowerCase().includes(q);
    });
    setFilteredDevices(filtered);
  }, [devices, searchText]);

  // helper: parse telemetry points that may have stringified JSON in .value
  const parseTelemetryValues = (data, key) => {
    const values = data?.[key] || [];
    return values
      .map((point) => {
        try {
          const raw = point?.value;
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (parsed && typeof parsed === "object") {
            return { ts: point.ts, ...parsed };
          }
          // if parsed is primitive (like a number), return as object with value
          return { ts: point.ts, value: parsed };
        } catch (err) {
          // fallback: return raw value as property
          return { ts: point.ts, value: point?.value ?? null };
        }
      })
      .filter(Boolean);
  };

  // Main telemetry fetch: pulls utilization, baseline, live component, durations, statuses for each selected device id
  useEffect(() => {
    let intervalId;

    const fetchAllMachineData = async () => {
      if (!from || !to || locSelectedDevice.length === 0) return;
      const resultsUtilization = {};
      const resultsBaseline = {};
      const resultsLiveComponent = {};
      const resultsDurations = {};
      const resultsMachineStatuses = {};
      const resultsMachineStatusTimes = {};
      const resultsPartData = {};


      const allKeys = [
        "hour_utilization",
        "historicalbaseline",
        "live_component",
        "machine_status",
        "machine_Status",
        "total_duration",
        "auto_duration",
        "part_data"
      ];

      await Promise.all(
        locSelectedDevice.map(async (machine) => {
          try {
            const data = await telemetrykeydata(machine, "DEVICE", allKeys, from, to);

            /** Hourly Utilization **/
            const utilValues = data?.hour_utilization || [];
            if (utilValues.length) {
              const hourlyGroups = {};
              utilValues.forEach((point) => {
                const date = new Date(point.ts);
                const hourKey = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), 0, 0, 0).toISOString();
                if (!hourlyGroups[hourKey]) hourlyGroups[hourKey] = [];
                hourlyGroups[hourKey].push(point);
              });
              const hourlyLatest = Object.entries(hourlyGroups).map(([hour, points]) => {
                const latestPoint = points.reduce((latest, point) => new Date(point.ts) > new Date(latest.ts) ? point : latest);
                return { hour, value: Number(latestPoint.value) || 0, timestamp: latestPoint.ts };
              });
              const avgUtil = hourlyLatest.reduce((sum, o) => sum + o.value, 0) / hourlyLatest.length;
              resultsUtilization[machine] = { utilization: parseInt(avgUtil) };
            } else {
              resultsUtilization[machine] = { utilization: 0 };
            }

            /** Historical Baseline **/
            const baselineValues = data?.historicalbaseline || [];
            if (baselineValues.length) {
              const latestPoint = baselineValues.reduce((max, p) => p.ts > max.ts ? p : max);
              let utilizationBaseline = 0;
              if (latestPoint?.value) {
                const parsed = typeof latestPoint.value === "string" ? JSON.parse(latestPoint.value) : latestPoint.value;
                utilizationBaseline = parseFloat(parsed?.utilization ?? 0);
              }
              resultsBaseline[machine] = { utilizationBaseline: parseFloat(utilizationBaseline.toFixed(1)) };
            } else {
              resultsBaseline[machine] = { utilizationBaseline: 0 };
            }

            /** Live Component **/
            const liveValues = data?.live_component || [];
            if (liveValues.length) {
              const latestPoint = liveValues.reduce((max, p) => p.ts > max.ts ? p : max);
              let componentName = null;
              if (latestPoint?.value) {
                const parsed = typeof latestPoint.value === "string" ? JSON.parse(latestPoint.value) : latestPoint.value;
                componentName = parsed?.name ?? null;
              }
              resultsLiveComponent[machine] = { componentName };
            } else {
              resultsLiveComponent[machine] = { componentName: null };
            }

            /** Total / Auto Durations **/
            const totalValues = data?.total_duration || [];
            const totalObj = totalValues[0] ? (typeof totalValues[0].value === "string" ? JSON.parse(totalValues[0].value) : totalValues[0].value) : {};
            const run = Math.round(totalObj.total_run_duration || 0);
            const idle = Math.round(totalObj.total_idle_duration || 0);
            const disconnect = Math.round(totalObj.total_disconnect_duration || 0);
            const alarm = Math.round(totalObj.total_alarm_duration || 0);
            const setting = Math.round(totalObj.total_setting_duration || 0);
            const total = run + idle + disconnect + alarm + setting;

            resultsDurations[machine] = { run, idle, disconnect, alarm, setting, total };

            /** Machine Statuses **/
            const statusValues = data?.machine_Status || [];
            if (statusValues.length) {
              const latestPoint = statusValues.reduce((max, p) => p.ts > max.ts ? p : max);
              let status = typeof latestPoint.value === "striith ng" ? latestPoint.value : String(latestPoint.value);
              resultsMachineStatuses[machine] = { machineName: machine.name, status };
            } else {
              resultsMachineStatuses[machine] = { machineName: machine.name, status: "No Data" };
            }


            /**  Part Data values **/
            const partData = data?.part_data || [];

            if (partData.length) {
              // Extract only 'value' and parse it
              const parsedValues = partData.map(item => {
                try {
                  return JSON.parse(item.value);
                } catch (e) {
                  console.warn("Failed to parse partData value:", item.value);
                  return null; // fallback if parsing fails
                }
              });

              resultsPartData[machine] = { partData: parsedValues };
            } else {
              resultsPartData[machine] = { partData: null };
            }


            /** Last '3' timestamp **/
            const status3Values = data?.machine_status || [];
            const lastValue = [...status3Values].reverse().find(p => p.value === "3");
            resultsMachineStatusTimes[machine] = { lastTs: lastValue?.ts ?? null };

          } catch (error) {
            console.error("Error fetching data for", machine.name, error);
            resultsUtilization[machine] = { utilization: 0 };
            resultsBaseline[machine] = { utilizationBaseline: 0 };
            resultsLiveComponent[machine] = { componentName: null };
            resultsDurations[machine] = { run: 0, idle: 0, disconnect: 0, alarm: 0, setting: 0, total: 0 };
            resultsMachineStatuses[machine] = { machineName: machine.name, status: "Error" };
            resultsMachineStatusTimes[machine] = { lastTs: null };
            resultsPartData[machine] = { partData: null };

          }
        })
      );

      setMachineUtilization(resultsUtilization);
      setUtilizationBaseline(resultsBaseline);
      setLiveComponent(resultsLiveComponent);
      setMachineDurations(resultsDurations);
      setMachineStatuses(resultsMachineStatuses);
      setMachineStatusTimes(resultsMachineStatusTimes);
      setPartsData(resultsPartData);
      
      console.log('Parts Data', partsData);

    };

    // Call immediately
    fetchAllMachineData();

    // Set interval to call every 10s
    intervalId = setInterval(fetchAllMachineData, 10000);

    // Cleanup on unmount
    return () => clearInterval(intervalId);

  }, [locSelectedDevice, from, to]);


  // CycleTimeFaster fetch (example usage) — using startEpoch/endEpoch states
  useEffect(() => {
    if (!startEpoch || !endEpoch || !customerId) return;

    let canceled = false;

    const fetchCycleTimeFaster = async () => {
      try {
        const data = await telemetrykeydata(customerId, "CUSTOMER", "live_component", startEpoch, endEpoch);
        if (!data) {
          setLiveComponent({});
          return;
        }
        const parsedValues = parseTelemetryValues(data, "live_component");
        if (!canceled) {
          // NOTE: this was earlier set to state as an array; to avoid colliding with device-specific liveComponent map,
          // we avoid overwriting the per-device liveComponent map — here we could store it in a separate state if needed.
          // For now, leave this call commented or use it to set a 'componentsSummary' state if required.
          // setLiveComponent(parsedValues); // <-- be careful: this conflicts with per-device map above.
          // console.log("Final live component values:", parsedValues);
        }
      } catch (error) {
        console.error("Error fetching live_component:", error);
      }
    };

    fetchCycleTimeFaster();
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, startEpoch, endEpoch]);

  // helpers for formatting
  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  }

  function formatMillisecondsTo12HourTime(ms) {
    if (!ms) return "N/A";
    const date = new Date(ms);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")} ${ampm}`;
  }

  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", s > 0 ? `${s}s` : ""].filter(Boolean).join(" ");
  }

  const blinkRedBorder = keyframes`
   0%, 100% {
      box-shadow:
        inset 0 2px 0 0 rgba(244, 67, 54, 0.8),
        inset -2px 0 0 0 rgba(244, 67, 54, 0.8),
        inset 0 -2px 0 0 rgba(244, 67, 54, 0.8),
        0 0 10px rgba(244, 67, 54, 0.6);
    }
    50% {
      box-shadow:
        inset 0 2px 0 0 rgba(244, 67, 54, 0.2),
        inset -2px 0 0 0 rgba(244, 67, 54, 0.2),
        inset 0 -2px 0 0 rgba(244, 67, 54, 0.2),
        0 0 4px rgba(244, 67, 54, 0.2);
    }
  `;

  // UI handlers
  const handleFilterClick = (event) => setFilterAnchor(event.currentTarget);
  const handleFilterClose = () => setFilterAnchor(null);

  // when user selects a device from the select dropdown, set it as selectedDevices single-selection
  const handleSelectChange = (event) => {
    const value = event.target.value;
    if (value === "all") {
      // select all device ids
      const allIds = devices.map((d) => d.id?.id ?? d.id ?? d);
      setSelectedDevices(allIds);
      setClickedDevice("all");
    } else {
      setSelectedDevices([value]);
      setClickedDevice(value);
    }
    // reset UI selection pointers
    setSelectedMachineId(null);
    setSelectedMachine(null);
  };

  // compute an array of device objects for selectedDevices (convenience)
  const selectedDeviceObjects = useMemo(() => {
    return selectedDevices.map((id) => devices.find((d) => (d.id?.id ?? d.id ?? d) === id)).filter(Boolean);
  }, [selectedDevices, devices]);

  // ensure filteredDevices displays properly when there are no devices
  useEffect(() => {
    if (!filteredDevices || filteredDevices.length === 0) {
      setFilteredDevices(devices);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices]);

  useEffect(() => {
    if (devices.length > 0) {
      setSelectedMachine(devices[0]);
      setSelectedMachineId(devices[0].id.id);
    }
  }, [devices]);


  return (
    <Box display="flex" height="100vh" pt={2}>
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
        <FormControl size="small" style={{ minWidth: 160, background: "#fff", marginBottom: "10px" }}>
          <InputLabel>Machines</InputLabel>
          <Select value={clickedDevice ?? (selectedDevices.length === 0 ? "" : selectedDevices[0])} onChange={handleSelectChange}>
            <MenuItem value="all">All Machines ({devices.length})</MenuItem>
            {devices.map((d) => (
              <MenuItem key={d.id?.id ?? d.id ?? d} value={d.id?.id ?? d.id ?? d}>
                {d.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Search + Filter Button */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
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
            <Typography variant="body2" sx={{ textAlign: "center", color: "gray", mt: 2 }}>
              No machines in{" "}
              {[...selectedMachines, /*...selectedStatus*/].length > 0
                ? `(${[...selectedMachines].join(", ")})`
                : "filter"}
            </Typography>
          ) : (
            filteredDevices.map((machine) => {
              const deviceId = machine.id?.id ?? machine.id ?? machine;
              const util = machineUtilization[deviceId]?.utilization ?? 0;
              const baseline = utilizationBaseline[deviceId]?.utilizationBaseline ?? 0;
              const changePositive = parseFloat((util - baseline).toFixed(1)) >= 0;
              const { run = 0, idle = 0, total = 0, disconnect = 0, alarm = 0, setting = 0 } =
                machineDurations[deviceId] || {};
              const isSelected = deviceId === selectedMachineId;
              const firstActiveTime = machineStatusTimes?.[deviceId]?.lastTs ?? null;

              return (
                <Card
                  key={deviceId}
                  onClick={() => {
                    setViewedMachine(machine);
                    setSelectedMachineId(machine.id.id);
                    setSelectedMachine(machine); // this updates right panel
                  }}
                  sx={{
                    mb: 1.5,
                    borderRadius: 3,
                    cursor: "pointer",
                    transition: "all 0.3s ease-in-out",
                    background: isSelected ? "#e3f2fd" : "#ffffff",
                    border: "1px solid #e0e0e0",
                    boxShadow: `4px 4px 8px rgba(0,0,0,0.08), -4px -4px 8px rgba(255,255,255,0.9)`,
                    borderLeft: `5px solid ${machineStatuses[deviceId]?.status === "Running"
                      ? "#4caf50"
                      : machineStatuses[deviceId]?.status === "Idle"
                        ? "#f1a014ff"
                        : machineStatuses[deviceId]?.status === "Alarm"
                          ? "#f44336"
                          : machineStatuses[deviceId]?.status === "Disconnect"
                            ? "#9e9e9e"
                            : machineStatuses[deviceId]?.status === "Setting"
                              ? "#81c8f5ff"
                              : "#f44336"
                      }`,
                    ...(machineStatuses[deviceId]?.status === "Alarm" && {
                      animation: `${blinkRedBorder} 1.5s ease-in-out infinite`,
                    }),
                  }}
                >
                  <CardContent sx={{ p: 1.5 }}>
                    {/* Header */}
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", color: "#222" }}>
                        {machine.name}
                      </Typography>
                      <Box
                        sx={{
                          px: 1.3,
                          py: 0.35,
                          borderRadius: "50px",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          color: "#fff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          background:
                            machineStatuses[deviceId]?.status === "Running"
                              ? "linear-gradient(135deg, #43a047, #2e7d32)"
                              : machineStatuses[deviceId]?.status === "Idle"
                                ? "linear-gradient(135deg, #fbc02d, #f57f17)"
                                : machineStatuses[deviceId]?.status === "Alarm"
                                  ? "linear-gradient(135deg, #e53935, #b71c1c)"
                                  : machineStatuses[deviceId]?.status === "Disconnect"
                                    ? "#616161"
                                    : machineStatuses[deviceId]?.status === "Setting"
                                      ? "linear-gradient(135deg, #29b6f6, #0288d1)"
                                      : "#b71c1c",
                        }}
                      >
                        {machineStatuses[deviceId]?.status ?? "Unknown"}
                      </Box>
                    </Box>

                    {/* Status & Duration */}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            bgcolor:
                              machineStatuses[deviceId]?.status === "Running"
                                ? "#4caf50"
                                : machineStatuses[deviceId]?.status === "Idle"
                                  ? "#f1a014"
                                  : machineStatuses[deviceId]?.status === "Disconnect"
                                    ? "#9e9e9e"
                                    : machineStatuses[deviceId]?.status === "Alarm"
                                      ? "#f44336"
                                      : machineStatuses[deviceId]?.status === "Setting"
                                        ? "#81c8f5ff"
                                        : "#9e9e9e",
                          }}
                        />
                        <Typography sx={{ fontSize: "0.83rem", color: "#222" }}>
                          {machineStatuses[deviceId]?.status === "Running"
                            ? `Run: ${formatTime(run)}`
                            : machineStatuses[deviceId]?.status === "Idle"
                              ? `Idle: ${formatTime(idle)}`
                              : machineStatuses[deviceId]?.status === "Disconnect"
                                ? `Disconnect: ${formatTime(disconnect)}`
                                : machineStatuses[deviceId]?.status === "Alarm"
                                  ? `Alarm: ${formatTime(alarm)}`
                                  : machineStatuses[deviceId]?.status === "Setting"
                                    ? `Setting: ${formatTime(setting)}`
                                    : `Total: ${formatTime(total)}`}
                        </Typography>
                      </Box>

                      <Typography sx={{ fontSize: "0.73rem", color: "#555", display: "flex", alignItems: "center" }}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#555"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ marginRight: "3px" }}
                        >
                          <polyline points="0 12 5 12 8 4 12 20 16 8 19 12 24 12" />
                        </svg>
                        First Active: {formatMillisecondsTo12HourTime(firstActiveTime)}
                      </Typography>
                    </Box>

                    {/* Reason & Component */}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1 }}>
                      <Chip
                        label={liveComponent[deviceId]?.componentName ?? "No Component"}
                        size="small"
                        sx={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          bgcolor:
                            (liveComponent[deviceId]?.componentName ?? "No Component") !== "No Component"
                              ? "#e0f7fa"
                              : "#ffebee",
                          color:
                            (liveComponent[deviceId]?.componentName ?? "No Component") !== "No Component"
                              ? "#00796b"
                              : "#c62828",
                        }}
                      />
                    </Box>

                    {/* Utilization with floating neumorphic progress bar */}
                    <Box
                      sx={{
                        mt: 0.8,
                        p: 1.5,
                        bgcolor: "#ffffff",
                        borderRadius: 2.5,
                        boxShadow: `3px 3px 6px rgba(0,0,0,0.08), -3px -3px 6px rgba(255,255,255,0.7)`,
                      }}
                    >
                      <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#222", mb: 0.8 }}>
                        Utilization Rate
                      </Typography>

                      <Typography sx={{ fontWeight: 700, fontSize: "22px", color: "#222", mb: 1.5 }}>
                        {util}%
                      </Typography>

                      <Box
                        sx={{
                          position: "relative",
                          height: 12,
                          borderRadius: 10,
                          bgcolor: "#f1f3f6",
                          mb: 1.5,
                          boxShadow: "inset 1.5px 1.5px 3px rgba(0,0,0,0.08), inset -1.5px -1.5px 3px rgba(255,255,255,0.7)",
                        }}
                      >
                        <Box
                          sx={{
                            width: `${util}%`,
                            height: "100%",
                            borderRadius: 10,
                            background:
                              parseFloat((util ?? 0) - (baseline ?? 0)) >= 0
                                ? "linear-gradient(90deg, #81c784, #4caf50)"
                                : "linear-gradient(90deg, #ef9a9a, #f44336)",
                            boxShadow: `1.5px 1.5px 3px rgba(0,0,0,0.15), -1.5px -1.5px 3px rgba(255,255,255,0.8)`,
                            transition: "width 0.5s ease",
                          }}
                        />
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                        {changePositive ? (
                          <ArrowUpwardIcon fontSize="small" sx={{ color: "#4caf50" }} />
                        ) : (
                          <ArrowDownwardIcon fontSize="small" sx={{ color: "#f44336" }} />
                        )}
                        <Typography sx={{ fontSize: "0.68rem", color: "#555" }}>
                          {Math.abs(parseFloat(((util ?? 0) - (baseline ?? 0)).toFixed(1)))} pp{" "}
                          {changePositive ? "up" : "down"} from baseline
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Right side content */}
      <Box flex={1} p={3} overflow="auto">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          {/* Component Name + Machine Name */}
          <Box>
            <Typography variant="h5" fontWeight="bold">
              {selectedMachine
                ? `${liveComponent[selectedMachine.id?.id]?.componentName ?? "Component"} `//(${selectedMachine.code ?? "N/A"})
                : "Component Details"}
              <Typography
                variant="subtitle2"
                display="block"
                fontWeight="bold"
                sx={{ fontSize: "18px", mt: 0.5 }}
              >
                {selectedMachine?.name ?? "Device"}
              </Typography>
            </Typography>
          </Box>

          {/* Back Button */}
          <Button
            variant="contained"
            onClick={() => navigate("/production-analysis")}
            color="warning"
            sx={{
              backgroundColor: "#626262",
              "&:hover": { backgroundColor: "#4d4d4d" },
            }}
          >
            Back
          </Button>
        </Box>

        {/* Time range + iframe */}
        {from && to && (
          <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
            <Typography variant="subtitle2" color="textSecondary">
              {new Date(from).toLocaleString()} → {new Date(to).toLocaleString()}
            </Typography>


          </Box>
        )}

        <Box flex={1}>
          <iframe
            title="Main Dashboard"
            width="100%"
            height="180px"
            src={`http://192.168.0.224:3000/yantra/d/f39bad0f-9771-4c10-a0c3-3c6935073647/summary-2?orgId=1&var-token=${newToken}&var-from=${from}&var-to=${to}&var-device_id=${selectedMachine?.id?.id ?? ""}&var-url=${baseUrl}&theme=light&kiosk`}
            frameBorder="0"
            style={{ borderRadius: "8px" }}
          ></iframe>
        </Box>

        <Box>
          <Typography variant="h5" fontWeight="bold">
            Parts Produced
          </Typography>


{selectedMachine ? (
  partsData[selectedMachine.id?.id]?.partData?.length > 0 ? (
    <Box
      sx={{
        maxHeight: 500,
        overflowY: "auto",
        p: 4,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: 4,
        backgroundColor: "transparent",
      }}
    >
      {partsData[selectedMachine.id?.id]?.partData.map((part, index) => {
        const isEfficient = part.actualTime <= part.referenceTime;

        return (
          <Paper
            key={index}
            elevation={0}
            sx={{
              position: "relative",
              p: 3,
              pl: 4.5, // space for accent border
              borderRadius: "24px",
              background: "linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%)",
              boxShadow:
                "rgba(0,0,0,0.08) 4px 4px 10px, rgba(255,255,255,0.9) -4px -4px 10px",
              border: "1px solid rgba(0,0,0,0.04)",
              backdropFilter: "blur(8px)",
              overflow: "hidden", // ✅ ensures left glow follows border radius
              transition:
                "transform 0.4s ease, box-shadow 0.4s ease, border 0.3s ease",
              "&:hover": {
                transform: "translateY(-8px)",
                boxShadow:
                  "rgba(0,0,0,0.15) 8px 8px 20px, rgba(255,255,255,0.9) -8px -8px 20px",
                border: `1px solid ${
                  isEfficient ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"
                }`,
              },
            }}
          >
            {/* 🔹 Full-Height Left Accent Line with Matching Radius */}
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: "6px",
                borderRadius: "24px 0 0 24px", // ✅ matches parent radius
                background: isEfficient
                  ? "linear-gradient(180deg, #34d399, #059669)"
                  : "linear-gradient(180deg, #f87171, #b91c1c)",
                boxShadow: `0 0 20px ${
                  isEfficient
                    ? "rgba(52,211,153,0.5)"
                    : "rgba(248,113,113,0.4)"
                }`,
                transition: "all 0.4s ease",
              }}
            />

            {/* Header */}
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
              mt={1}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: "#111827",
                  letterSpacing: 0.3,
                }}
              >
                {part.partnumber || "Unknown Part"}
              </Typography>

              <Chip
                label={isEfficient ? "Efficient" : "Lagging"}
                size="small"
                sx={{
                  fontWeight: 600,
                  color: isEfficient ? "#065f46" : "#991b1b",
                  backgroundColor: isEfficient
                    ? "rgba(16,185,129,0.15)"
                    : "rgba(239,68,68,0.15)",
                  borderRadius: "8px",
                  backdropFilter: "blur(4px)",
                  px: 1.5,
                  boxShadow:
                    "inset 2px 2px 5px rgba(255,255,255,0.5), inset -2px -2px 5px rgba(0,0,0,0.05)",
                }}
              />
            </Box>

            {/* Meta Info */}
            <Typography
              variant="body2"
              sx={{
                color: "#374151",
                mb: 0.5,
                fontSize: "0.9rem",
              }}
            >
              <strong style={{ color: "#111827" }}>Component:</strong>{" "}
              {part.component}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: "#374151",
                mb: 2,
                fontSize: "0.9rem",
              }}
            >
              <strong style={{ color: "#111827" }}>Machine:</strong>{" "}
              {part.machinename}
            </Typography>

            {/* Metrics */}
            <Box
              sx={{
                background: "linear-gradient(145deg, #ffffff, #f3f4f6)",
                borderRadius: 3,
                p: 2,
                border: "1px solid rgba(0,0,0,0.05)",
                boxShadow:
                  "inset 4px 4px 10px rgba(0,0,0,0.05), inset -4px -4px 10px rgba(255,255,255,0.9)",
                transition: "all 0.3s ease",
                "&:hover": {
                  boxShadow:
                    "inset 6px 6px 12px rgba(0,0,0,0.06), inset -6px -6px 12px rgba(255,255,255,1)",
                },
              }}
            >
              <MetricRow label="Actual Time" value={formatTime(part.actualTime)} />
              <MetricRow label="Reference Time" value={formatTime(part.referenceTime)} />
              <MetricRow label="Run Duration" value={formatTime(part.run_duration)} />
              <MetricRow label="Idle Duration" value={formatTime(part.idle_duration)} />
            </Box>
          </Paper>
        );
      })}
    </Box>
  ) : (
    <Typography variant="body2" color="textSecondary">
      No parts produced for this machine.
    </Typography>
  )
) : (
  <Typography variant="body2" color="textSecondary">
    Select a machine to see parts produced.
  </Typography>
)}






        </Box>
      </Box>

    </Box>
  );
};

export default Inprogress;
