import React, { useEffect, useState } from 'react';
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

const OeeDashboard = () => {
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});

  const baseUrl = window._env_.SERVER_URL;
  const GRAFANA_URL = window._env_.GRAFANA_URL;

  const customerId = localStorage.getItem('CustomerID');
  const newToken = localStorage.getItem('newToken');

     const [shifts, setShifts] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [from, setFrom] = useState(null); // epoch ms
  const [to, setTo] = useState(null);     // epoch ms

  // Convert HH:mm:ss to epoch ms
  const convertShiftToEpoch = (fromTimeStr, toTimeStr) => {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0]; // "YYYY-MM-DD"

    let fromDate = new Date(`${dateStr}T${fromTimeStr}`);
    let toDate = new Date(`${dateStr}T${toTimeStr}`);

    // Handle overnight shifts
    if (toDate <= fromDate) {
      toDate.setDate(toDate.getDate() + 1);
    }

    return {
      from: fromDate.getTime(),
      to: toDate.getTime(),
    };
  };

  // Determine current shift based on time
  const getCurrentShift = (shiftsList) => {
    if (!Array.isArray(shiftsList) || shiftsList.length === 0) return null;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const s of shiftsList) {
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
        // Set epoch times
        const { from: fromEpoch, to: toEpoch } = convertShiftToEpoch(
          s.start_time,
          s.end_time
        );
        setFrom(fromEpoch);
        setTo(toEpoch);

        return s; // return the active shift object
      }
    }

    // Fallback to first shift
    const fallback = shiftsList[0];
    const { from: fromEpoch, to: toEpoch } = convertShiftToEpoch(
      fallback.start_time,
      fallback.end_time
    );
    setFrom(fromEpoch);
    setTo(toEpoch);

    return fallback;
  };

  // Fetch shifts from API
  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, "allShift");
      const shiftList = result[0]?.value || [];
      setShifts(shiftList);

      // Determine active shift immediately
      const activeShift = getCurrentShift(shiftList);
      setCurrentShift(activeShift);
    } catch (err) {
      console.error("Failed to fetch shifts", err);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  console.log("Shifts:", shifts);
  console.log("Current Shift:", currentShift);
  console.log("From (epoch ms):", from, "To (epoch ms):", to);

  // 🔹 Fetch Devices
  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      console.log("📡 Raw API result:", result);

      const devicesList = result?.data?.data || result?.data || [];
      console.log("✅ Extracted devices list:", devicesList);

      setDevices(devicesList);

      // Map { deviceName: deviceId }
      const nameIdMap = devicesList.reduce((acc, device) => {
        if (device?.name && device?.id?.id) {
          acc[device.name] = device.id.id;
        }
        return acc;
      }, {});
      console.log("📌 Device Name → ID map:", nameIdMap);

      setDeviceNameIdJson(nameIdMap);

    } catch (err) {
      console.error("❌ Failed to fetch devices", err);
    }
  };

  // 🔹 Run when customerId changes
  useEffect(() => {
    if (customerId) {
      fetchDevices();
    } else {
      console.warn("⚠️ No customerId found in localStorage");
    }
  }, [customerId]);

 

  // 🔹 Build Grafana URL for each device
  const buildGrafanaUrl = (device) => {
    if (!device?.id?.id) return "";

    const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
    const cleanedId = cleanCustomerId(customerId);
    const encodedid = encodeURIComponent(JSON.stringify(deviceNameIdJson));

    return `${GRAFANA_URL}d/a94d350e-0089-4739-a549-4d7bf74794b0/machine-card-pmi?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=DEVICE&var-device_id=${device.id.id}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light&refresh=5s`;
  };

  return (
  <div style={{ width: "100%", height: "100%", overflowY: "auto", padding: "40px 10px" }}>

    {currentShift && (
  <div
    style={{
      textAlign: "center",
      fontSize: "20px",
      fontWeight: "600",
      color: "#444",
      marginBottom: "20px",
    }}
  >
    {`Shift ${currentShift.shift_no || ""} : `}
    {dayjs(from).format("MMM D YYYY, h:mm:ss A")} -{" "}
    {dayjs(to).format("MMM D YYYY, h:mm:ss A")}
  </div>
)}
    {/* 🔹 Header */}
    {/* <div
      style={{
        position: "sticky",
        top: 0, // stick to top of container
       
        background: "#fff",
        padding: "15px 10px",
        borderBottom: "2px solid #ddd",
        textAlign: "center",
      }}
    >
      <h2
        style={{
          fontSize: "24px",
          fontWeight: "700",
          margin: 0,
          color: "#333",
        }}
      >
        OEE Details
      </h2>
    </div> */}

    {/* 🔹 Content */}
    {devices.length === 0 ? (
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
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "15px",
          width: "100%",
          marginTop: "20px",
          gridAutoRows: "600px",
        }}
      >
        {devices.map((device, index) => {
          const url = buildGrafanaUrl(device);
          console.log("🖼️ Final iframe URL:", url);

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
              onClick={() => console.log("🖱️ Clicked device:", device)}
            >
              {/* 🔹 Machine Name Header
              <div
                style={{
                  background: "#f5f5f5",
                  fontWeight: "600",
                  textAlign: "center",
                  padding: "6px 0",
                  fontSize: "14px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                {device?.name || "Unnamed Device"}
              </div> */}

              {/* 🔹 Iframe */}
              <iframe
                src={url}
                style={{ flex: 1, border: "0", width: "100%", height: "1000px" }}
                title={`OEE-${device.name}`}
              />
            </div>
          );
        })}
      </div>
    )}
  </div>
);

};

export default OeeDashboard;
