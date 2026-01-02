import React, { useEffect, useState } from "react";
import {
  customerbaseddevices,
  customerbasedshift,
  telemetrykeydata,
} from "../../Services/app/companyservice";

export default function LeaderBoard() {
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const [shifts, setShifts] = useState([]);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [shiftNo, setShiftNo] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState([]);
  const [finalResult, setFinalResult] = useState([]);
  const [topOperators, setTopOperators] = useState([]);

  const [telemetryData, setTelemetryData] = useState({
    totalParts: {},
    targetParts: {},
    operator: {},
    component: {},
  });

  const customerId = localStorage.getItem("CustomerID");

  // ================= Fetch Shifts ====================
  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, "allShift");
      const data = result[0]?.value || [];
      setShifts(data);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= Fetch Devices ====================
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

  useEffect(() => {
    fetchDevices();
    fetchShifts();
  }, []);

  // ============== Get Current Shift ==================
  useEffect(() => {
    if (!Array.isArray(shifts) || shifts.length === 0) return;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let activeShift = shifts[0];

    for (const s of shifts) {
      const [fromH, fromM] = s.start_time.split(":").map(Number);
      const [toH, toM] = s.end_time.split(":").map(Number);
      const fromMinutes = fromH * 60 + fromM;
      const toMinutes = toH * 60 + toM;

      if (
        (fromMinutes <= currentMinutes && currentMinutes < toMinutes) ||
        (fromMinutes > toMinutes &&
          (currentMinutes >= fromMinutes || currentMinutes < toMinutes))
      ) {
        activeShift = s;
        break;
      }
    }

    const [startH, startM] = activeShift.start_time.split(":").map(Number);
    const [endH, endM] = activeShift.end_time.split(":").map(Number);

    const startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      startH,
      startM
    );

    let endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      endH,
      endM
    );

    if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);

    setFrom(startDate.valueOf());
    setTo(endDate.valueOf());
    setShiftNo(String(activeShift.shift_no));
  }, [shifts]);

  // Auto select all devices
  useEffect(() => {
    if (devices.length > 0) {
      const allDeviceIds = devices.map((d) => d.id.id);
      setSelectedDevice(allDeviceIds);
    }
  }, [devices]);

const parseTelemetryValues = (data, key) => {
  return (data?.[key] || [])
    .map((p) => {
      try {
        // If JSON → parse
        if (typeof p.value === "string" && p.value.startsWith("{")) {
          const parsed = JSON.parse(p.value);
          return { ts: p.ts, ...parsed };
        }

        // If number or simple value
        return { ts: p.ts, value: Number(p.value) || p.value };
      } catch {
        return null;
      }
    })
    .filter((v) => v !== null);
};


  // =================== Fetch Telemetry =====================
  const fetchTelemetryData = async () => {
    if (!from || !to || !selectedDevice?.length) return;

    try {
      const results = await Promise.all(
        selectedDevice.map(async (deviceId) => {
          const data = await telemetrykeydata(
            deviceId,
            "DEVICE",
            ["totalparts", "targetparts", "live_operator", "live_component"],
            from,
            to
          );

          return {
            name: deviceNameIdJson[deviceId] || "Unknown Device",
            totalparts: parseTelemetryValues(data, "totalparts"),
            targetparts: parseTelemetryValues(data, "targetparts"),
            operator: parseTelemetryValues(data, "live_operator"),
            component: parseTelemetryValues(data, "live_component"),
          };
        })
      );

      const merged = {
        totalParts: {},
        targetParts: {},
        operator: {},
        component: {},
      };

      results.forEach((r) => {
        merged.totalParts[r.name] = r.totalparts;
        merged.targetParts[r.name] = r.targetparts;
        merged.operator[r.name] = r.operator;
        merged.component[r.name] = r.component;
      });

      setTelemetryData(merged);
    } catch (err) {
      console.error("❌ Telemetry Fetch Failed", err);
      setTelemetryData({
        totalParts: {},
        targetParts: {},
        operator: {},
        component: {},
      });
    }
  };

  useEffect(() => {
    if (selectedDevice && from && to) fetchTelemetryData();
  }, [selectedDevice, from, to]);

  // ================= Final Result ======================
const processFinalData = (telemetry) => {
  if (!telemetry) return;

  const operatorMap = {}; // key = operator code

  // Loop through each machine
  Object.keys(telemetry.operator).forEach((machine) => {
    const operators = telemetry.operator[machine] || [];
    const total = telemetry.totalParts[machine] || [];
    const target = telemetry.targetParts[machine] || [];

    operators.forEach((op) => {
      const start = Number(op?.start_time || op?.ts);
      const end =
        op?.end_time && op.end_time !== "-" 
          ? Number(op.end_time)
          : Date.now();

      // Find latest total parts in the operator time range
      const totalRange = total.filter(
        (t) => Number(t.ts) >= start && Number(t.ts) <= end
      );
      const latestTotal = totalRange.length
        ? totalRange.reduce((a, b) =>
            Number(a.ts) > Number(b.ts) ? a : b
          )
        : null;

      // Find latest target parts in the operator time range
      const targetRange = target.filter(
        (t) => Number(t.ts) >= start && Number(t.ts) <= end
      );
      const latestTarget = targetRange.length
        ? targetRange.reduce((a, b) =>
            Number(a.ts) > Number(b.ts) ? a : b
          )
        : null;

      const totalParts = latestTotal?.totalshots ?? latestTotal?.goodparts ?? 0;
      const targetParts = Number(latestTarget?.value ?? latestTarget?.target ?? 0);

      // Merge by operator code
      const code = op?.code || op?.name || `unknown-${op?.ts}`;

      if (!operatorMap[code]) {
        operatorMap[code] = {
          operator: op?.name || "Unknown",
          operatorCode: code,
          totalParts: 0,
          targetParts: 0,
          machines: new Set(), // ✅ keep track of machines
        };
      }

      // Sum totalParts and targetParts for same code
      operatorMap[code].totalParts += totalParts;
      operatorMap[code].targetParts += targetParts;

      // Add machine name to the set
      operatorMap[code].machines.add(machine);
    });
  });

  // Convert map to array, calculate percent, and convert machines set to array
  const final = Object.values(operatorMap)
    .map((op) => ({
      ...op,
      machines: Array.from(op.machines), // ✅ convert Set to array
      percent:
        op.targetParts > 0
          ? Number(((op.totalParts / op.targetParts) * 100).toFixed(2))
          : 0,
    }))
    .sort((a, b) => b.percent - a.percent) // descending
    .map((op, index) => ({
      ...op,
      top: `Top ${index + 1}`,
    }));

  console.log("✅ FINAL RESULT MERGED BY OPERATOR CODE WITH MACHINES ===>", final);
  setFinalResult(final);
};



// Get only Top 3 operators based on the 'top' field
// Filter only Top 1, 2, 3 and assign border color
const top3Operators = finalResult
  .filter((op) => ["Top 1", "Top 2", "Top 3"].includes(op.top))
  .map((op) => {
    let border = "#000"; // default border if something goes wrong

    if (op.top === "Top 1") border = "gold";
    else if (op.top === "Top 2") border = "silver";
    else if (op.top === "Top 3") border = "#cd7f32"; // bronze

    return {
      ...op,
      border,
    };
  });

console.log("🏆 FILTERED TOP 3 OPERATORS WITH BORDER ===>", top3Operators);




  useEffect(() => {
    if (telemetryData) processFinalData(telemetryData);
  }, [telemetryData]);

  

  console.log("All Shifts:", shifts);
  console.log("telemetrydata", telemetryData);
  console.log("finalResult", finalResult);
  console.log("Top Operators:", top3Operators);
  console.log('from', from);
  console.log('to', to);
  console.log('selectedDevice', selectedDevice);

  return (
    <div
      className="leaderboard-container"
      style={{
        padding: "20px",
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        marginTop: "10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "relative",
          width: "100%",
          backgroundColor: "darkorange",
          padding: "16px 20px",
          color: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          borderRadius: "6px 6px 0 0",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: "20px",
            fontSize: "20px",
            fontWeight: "700",
            padding: "8px",
            borderRadius: "6px",
            color: "#fff",
          }}
        >
          Shift: {shiftNo}
        </span>

        <h1 style={{ margin: 0, fontSize: "30px", textAlign: "center", fontWeight: "500",
 }}>
          High Performance LeaderBoard
        </h1>

   <div style={{
  position: "absolute",
  right: "20px",
  display: "flex",
  alignItems: "center",
  gap: "6px"
}}>
  <select
    value={
      selectedDevice.length === devices.length
        ? "all"
        : selectedDevice[0]
    }
    onChange={(e) => {
      const value = e.target.value;
      if (value === "all") {
        const allDeviceIds = devices.map((d) => d.id.id);
        setSelectedDevice(allDeviceIds);
      } else {
        setSelectedDevice([value]);
      }
    }}
    style={{
      padding: "8px",
      border: "none",
      borderBottom: "2px solid white",   // bottom border only
      background: "transparent",
      fontSize: "16px",
      color: "white",                     // white text
      outline: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      cursor: "pointer",
    }}
  >
    <option value="all" style={{ color: "black" }}>All Machines</option>
    {devices.map((d) => (
      <option key={d.id.id} value={d.id.id} style={{ color: "black" }}>
        {d.name}
      </option>
    ))}
  </select>

</div>


      </div>

      {/* Top 3 Operators */}
    <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    marginTop: "50px",
    width: "100%",
    gap: "40px",
  }}
>
  {top3Operators.map((op) => {
    const dataForIframe = {
      name: op.operator,
      latestTotalParts: op.totalParts,
      latestTargetParts: op.targetParts,
      percent: op.percent,
      top: op.top,
    };

    const encodedData = encodeURIComponent(JSON.stringify(dataForIframe));
    const borderColor = op.border || "#000";

    return (
      <div key={op.operatorCode} style={{ flex: 1 }}>
        {/* Card Wrapper */}
        <div
          style={{
            borderRadius: "14px",
            overflow: "hidden",
            border: `6px solid ${borderColor}`,
          }}
        >
          {/* Header */}
          <div
            style={{
              background: borderColor,
              color: "white",
              padding: "10px",
              textAlign: "center",
              fontWeight: "bold",
              fontSize: "20px",
            }}
          >
       {op.top === "Top 1"
  ? "TOP 1 PERFORMER"
  : op.top === "Top 2"
  ? "TOP 2 PERFORMER"
  : "TOP 3 PERFORMER"}


          </div>

          {/* Iframe */}
          <iframe
            title={`TOP ${op.top.split(" ")[1]} PERFORMER`}

            src={`http://smart.yantra24x7.com:9097/d/ff8qtt015bg8wc/new-dashboard?orgId=1&refresh=5s&theme=light&kiosk&var-data=${encodedData}`}
            style={{
              width: "100%",
              height: "560px",
              border: "none",
            }}
          />
        </div>
      </div>
    );
  })}
</div>

    </div>
  );
}
