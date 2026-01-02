import React, { useEffect, useState } from "react";
import {
  customerbaseddevices,
  customerbasedshift,
  telemetrykeydata,
} from "../../Services/app/companyservice";

import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";

// 🟢 Get Current Shift
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

// 🟢 Get Shift Times
function getShiftTimes(shifts, selectedShift, selectedDate) {
  if (!Array.isArray(shifts) || shifts.length === 0 || !selectedDate)
    return { from: null, to: null };

  const selectedStr = dayjs(selectedDate).format("YYYY-MM-DD");
  const getDateByDayOffset = (baseDate, dayValue) =>
    dayjs(baseDate).add(Number(dayValue) - 1, "day").format("YYYY-MM-DD");

  if (selectedShift === "allShift") {
    const sortedShifts = [...shifts].sort(
      (a, b) => Number(a.shift_no) - Number(b.shift_no)
    );
    const firstShift = sortedShifts[0];
    const lastShift = sortedShifts[sortedShifts.length - 1];
    const fromStr = `${getDateByDayOffset(selectedStr, firstShift.start_day)}T${firstShift.start_time}`;
    const toStr = `${getDateByDayOffset(selectedStr, lastShift.end_day)}T${lastShift.end_time}`;
    return { from: new Date(fromStr).getTime(), to: new Date(toStr).getTime() };
  }

  const shiftData = shifts.find((s) => String(s.shift_no) === String(selectedShift));
  if (!shiftData) return { from: null, to: null };

  const fromStr = `${getDateByDayOffset(selectedStr, shiftData.start_day)}T${shiftData.start_time}`;
  const toStr = `${getDateByDayOffset(selectedStr, shiftData.end_day)}T${shiftData.end_time}`;
  return { from: new Date(fromStr).getTime(), to: new Date(toStr).getTime() };
}

export default function LeaderBoard() {
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const [shifts, setShifts] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [selectedShift, setSelectedShift] = useState("allShift");
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [telemetryData, setTelemetryData] = useState({
    totalParts: {},
    targetParts: {},
    operator: {},
    component: {},
  });
  const [finalResult, setFinalResult] = useState([]);

  const customerId = localStorage.getItem("CustomerID");

  // =================== Fetch Devices ===================
  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result?.data || [];
      setDevices(devicesList);

      const map = devicesList.reduce((acc, d) => {
        acc[d.id.id] = d.name;
        return acc;
      }, {});
      setDeviceNameIdJson(map);
    } catch (err) {
      console.error(err);
    }
  };

  // =================== Fetch Shifts ===================
  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, "allShift");
      const data = result[0]?.value || [];
      setShifts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchShifts();
  }, []);

  // Auto-select current shift after shifts are loaded
  useEffect(() => {
    if (shifts.length > 0) {
      const currentShift = getCurrentShift(shifts);
      setSelectedShift(currentShift);
    }
  }, [shifts]);

  // =================== Calculate from/to based on shift & date ===================
  useEffect(() => {
    if (!selectedShift || !selectedDate || !shifts.length) return;
    const { from, to } = getShiftTimes(shifts, selectedShift, selectedDate);
    setFrom(from);
    setTo(to);
  }, [selectedShift, selectedDate, shifts]);

  // =================== Fetch Telemetry ===================
  const fetchTelemetryData = async () => {
    if (!from || !to) return;

    const devicesToFetch =
      selectedDevice === "all" ? devices.map((d) => d.id.id) : [selectedDevice];

    try {
      const results = await Promise.all(
        devicesToFetch.map(async (deviceId) => {
          const data = await telemetrykeydata(
            deviceId,
            "DEVICE",
            ["totalparts", "targetparts", "live_operator", "live_component"],
            from,
            to
          );

          const parseTelemetryValues = (arr) =>
            (arr || [])
              .map((p) => {
                try {
                  if (typeof p.value === "string" && p.value.startsWith("{")) {
                    return { ts: p.ts, ...JSON.parse(p.value) };
                  }
                  return { ts: p.ts, value: Number(p.value) || p.value };
                } catch {
                  return null;
                }
              })
              .filter(Boolean);

          return {
            name: deviceNameIdJson[deviceId] || "Unknown Device",
            totalparts: parseTelemetryValues(data.totalparts),
            targetparts: parseTelemetryValues(data.targetparts),
            operator: parseTelemetryValues(data.live_operator),
            component: parseTelemetryValues(data.live_component),
          };
        })
      );

      const merged = { totalParts: {}, targetParts: {}, operator: {}, component: {} };
      results.forEach((r) => {
        merged.totalParts[r.name] = r.totalparts;
        merged.targetParts[r.name] = r.targetparts;
        merged.operator[r.name] = r.operator;
        merged.component[r.name] = r.component;
      });

      setTelemetryData(merged);
    } catch (err) {
      console.error("❌ Telemetry Fetch Failed", err);
    }
  };

  useEffect(() => {
    if (from && to) fetchTelemetryData();
  }, [from, to, selectedDevice]);

  // =================== Process Final Operator Data ===================
  const processFinalData = (telemetry) => {
    const operatorMap = {};

    Object.keys(telemetry.operator).forEach((machine) => {
      const operators = telemetry.operator[machine] || [];
      const total = telemetry.totalParts[machine] || [];
      const target = telemetry.targetParts[machine] || [];

      operators.forEach((op) => {
        const start = Number(op?.start_time || op?.ts);
        const end = op?.end_time && op.end_time !== "-" ? Number(op.end_time) : Date.now();

        const totalRange = total.filter((t) => Number(t.ts) >= start && Number(t.ts) <= end);
        const latestTotal = totalRange.length
          ? totalRange.reduce((a, b) => (Number(a.ts) > Number(b.ts) ? a : b))
          : null;

        const targetRange = target.filter((t) => Number(t.ts) >= start && Number(t.ts) <= end);
        const latestTarget = targetRange.length
          ? targetRange.reduce((a, b) => (Number(a.ts) > Number(b.ts) ? a : b))
          : null;

        const totalParts = latestTotal?.totalshots ?? latestTotal?.goodparts ?? 0;
        const targetParts = Number(latestTarget?.value ?? latestTarget?.target ?? 0);

        const code = op?.code || op?.name || `unknown-${op?.ts}`;
        if (!operatorMap[code]) {
          operatorMap[code] = {
            operator: op?.name || "Unknown",
            operatorCode: code,
            totalParts: 0,
            targetParts: 0,
            machines: new Set(),
          };
        }

        operatorMap[code].totalParts += totalParts;
        operatorMap[code].targetParts += targetParts;
        operatorMap[code].machines.add(machine);
      });
    });

    // Convert Map to Array, Sort, and assign Top 3 permanently
    let final = Object.values(operatorMap)
      .map((op) => ({
        ...op,
        machines: Array.from(op.machines),
        percent: op.targetParts > 0 ? Number(((op.totalParts / op.targetParts) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.percent - a.percent)
      .map((op, index) => ({
        ...op,
        top: index === 0 ? "Top 1" : index === 1 ? "Top 2" : index === 2 ? "Top 3" : null,
      }));

    // Only keep top 3
    setFinalResult(final.filter((op) => op.top));
  };

  useEffect(() => {
    if (telemetryData) processFinalData(telemetryData);
  }, [telemetryData]);

  // =================== Render ===================
  return (
    <div style={{ padding: "20px", minHeight: "100vh", backgroundColor: "white" }}>
      {/* Selectors */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', flexWrap: 'wrap' }} className='company-dashboard'>
        <h4><b>Operator Leaderboard</b></h4>
         <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap", marginBottom: "20px" }}>
        {/* Machine */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Machines</InputLabel>
          <Select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
            <MenuItem value="all">All Machines</MenuItem>
            {devices.map((d) => (
              <MenuItem key={d.id.id} value={d.id.id}>{d.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Shift */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Shifts</InputLabel>
          <Select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)}>
            {/* <MenuItem value="allShift">All Shifts</MenuItem> */}
            {shifts.map((s) => (
              <MenuItem key={s.shift_no} value={s.shift_no}>Shift {s.shift_no}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Date */}
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="Select Date"
            value={selectedDate}
            onChange={(newValue) => setSelectedDate(newValue)}
            maxDate={dayjs()}
            slotProps={{ textField: { size: "small", sx: { minWidth: 160 } } }}
          />
        </LocalizationProvider>
      </div>
        </div>
     

      {/* Top 3 Operators */}
      <div style={{ display: "flex", gap: "40px", marginTop: "50px" }}>
        {finalResult.map((op) => {
          let border = "#000";
          if (op.top === "Top 1") border = "#F4C430";
          else if (op.top === "Top 2") border = "#B0B0B0";
          else if (op.top === "Top 3") border = "#B87333";

          const dataForIframe = {
            name: op.operator,
            latestTotalParts: op.totalParts,
            latestTargetParts: op.targetParts,
            percent: op.percent,
            top: op.top,
          };
          const encodedData = encodeURIComponent(JSON.stringify(dataForIframe));

          return (
            <div key={op.operatorCode} style={{ flex: 1 }}>
              <div style={{ borderRadius: "14px", overflow: "hidden", border: `6px solid ${border}` }}>
                <div style={{ background: border, padding: "10px", textAlign: "center", fontWeight: "bold", fontSize: "24px" }}>
                  {op.top === "Top 1" && <>🥇 TOP 1</>}
                  {op.top === "Top 2" && <>🥈 TOP 2</>}
                  {op.top === "Top 3" && <>🥉 TOP 3</>}
                </div>
                <iframe
                  title={`TOP ${op.top.split(" ")[1]}`}
                  src={`http://smart.yantra24x7.com:9097/d/ff8qtt015bg8wc/new-dashboard?orgId=1&refresh=5s&theme=light&kiosk&var-data=${encodedData}`}
                  style={{ width: "100%", height: "660px", border: "none" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
