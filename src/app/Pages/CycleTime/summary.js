import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Card,
  Grid
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import Tooltip from "@mui/material/Tooltip";

import {
  customerbaseddevices,
  customerbasedshift,
  telemetrykeydata
} from '../../Services/app/companyservice';
import dayjs from "dayjs";
import { useLocation } from "react-router-dom";
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { SidebarPanel } from "../../Pages/AnalyticsSidepanel/analyticslayout";


const Summary = () => {
  const [partNumber, setPartNumber] = useState("");
  const [reportType, setReportType] = useState("Part Time vs Expected");
  const [machineGroup, setMachineGroup] = useState("CNC Group ");
  const [shifts, setShifts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const [selectedDashboard, setSelectedDashboard] = useState("summary");



  const navigate = useNavigate();

  const location = useLocation();
  const { from, to } = location.state || {
    from: dayjs().subtract(6, "day").startOf("day").valueOf(),
    to: dayjs().endOf("day").valueOf()
  };
  const { previousScreen, componentName, deviceName, start_time, end_time, code, selectedDevice, codeWiseSummary } = location.state

  console.log('From', start_time, 'to', end_time, 'Component', componentName, 'deviceName', deviceName, 'code', code, 'Codewisesummary',codeWiseSummary)

  const Id = localStorage.getItem("CustomerID");
  let customerId = decodeURIComponent(Id || "").replace(/^"|"$/g, "");
  const newToken = localStorage.getItem("newToken");

  const baseUrl = window._env_.SERVER_URL;


  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, "allShift");
      setShifts(result[0]?.value || []);
    } catch (err) {
      console.error("Failed to fetch shifts", err);
    }
  };

  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];
      setDevices(devicesList);
      const nameIdMap = devicesList.reduce((acc, device) => {
        acc[device.id.id] = device.name;
        return acc;
      }, {});
      setDeviceNameIdJson(nameIdMap);
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };


  useEffect(() => {
    fetchShifts();
    fetchDevices();
    console.log('fetching devices ---------------------')
  }, []);

  console.log(deviceNameIdJson);



  // Reverse lookup: find key by value
  const deviceId = Object.keys(deviceNameIdJson).find(
    key => deviceNameIdJson[key] === deviceName
  );

  console.log('Choosen device id', deviceId);


  const dashboardUrls = {
    summary: `http://192.168.0.224:3000/yantra/d/eda91bdc-b024-47f8-8852-cb6eff0627ed/summary-1?orgId=1&var-from=${start_time}&var-to=${end_time}&var-device_id=${deviceId}&var-device_name=${deviceName}&var-token=${newToken}&var-url=${baseUrl}&var-customer_id=${customerId}&theme=light&kiosk`,
    cycles: `http://192.168.0.224:3000/yantra/d/a0b97da4-e29b-4516-ac5a-a31cca367a57/cycles-1?orgId=1&from=&var-from=${start_time}&var-to=${end_time}&var-device_id=${deviceId}&var-device_name=${deviceName}&var-token=${newToken}&var-url=${baseUrl}&theme=light&kiosk`,
    downtime: `http://192.168.0.224:3000/yantra/d/edc66384-2fb2-4e08-b92e-6d66d842ee32/analytics-dashboard-downtime?orgId=1&var-from=${start_time}&var-to=${end_time}&var-device_id=${deviceId}&var-device_name=${deviceName}&var-token=${newToken}&var-url=${baseUrl}&theme=light&kiosk`,
    alarm: `http://192.168.0.224:3000/yantra/d/eb13c6f2-82df-4e1e-a953-b99eefa0291b/analytics-dashboard-alarm?orgId=1&var-from=${start_time}&var-to=${end_time}&var-device_id=${deviceId}&var-device_name=${deviceName}&var-token=${newToken}&var-url=${baseUrl}&theme=light&kiosk`,
  };


  const dashboards = [
    { label: "Summary", value: "summary" },
    { label: "Cycles", value: "cycles" },
    { label: "Downtime", value: "downtime" },
    { label: "Alarm", value: "alarm" },
  ];


  const summarySubDashboards = [
    {
      label: "OEE",
      value: "oee",
      url: `http://192.168.0.224:3000/yantra/d/eda91bdc-b024-47f8-8852-cb6eff0627ed/summary-1?orgId=1&var-from=${start_time}&var-to=${end_time}&var-device_id=${deviceId}&var-device_name=${deviceName}&var-token=${newToken}&var-customer_id=${customerId}&var-url=${baseUrl}&theme=light&kiosk`,
    },
    {
      label: "Parts Goal",
      value: "parts_goal",
      url: `http://192.168.0.224:3000/yantra/d/e8e6a886-399f-4a69-b905-71fc96cedd9a/parts-goal-dashboard?orgId=1&var-from=${start_time}&var-to=${end_time}&var-device_id=${deviceId}&var-device_name=${deviceName}&var-token=${newToken}&var-url=${baseUrl}&theme=light&kiosk`,
    },
  ];

  const cyclesSubDashboards = [
    {
      label: "Statistics",
      value: "statistics",
      url: `http://192.168.0.224:3000/yantra/d/a0b97da4-e29b-4516-ac5a-a31cca367a57/cycles-1?orgId=1&from=&var-from=${start_time}&var-to=${end_time}&var-device_id=${deviceId}&var-device_name=${deviceName}&var-token=${newToken}&var-url=${baseUrl}&theme=light&kiosk`,
    },
    {
      label: "Part Cycles",
      value: "part_cycles",
      url: `http://192.168.0.224:3000/yantra/d/b99ea2f6-5697-47de-83c5-1389d5e12185/parts-cycle-dashboard?orgId=1&var-from=${start_time}&var-to=${end_time}&var-device_id=${deviceId}&var-device_name=${deviceName}&var-token=${newToken}&var-url=${baseUrl}&theme=light&kiosk`,
    },
  ];


  // Determine iframe URL dynamically
  const getIframeUrl = () => {
    const findUrl = (list, key) => list.find((d) => d.value === key)?.url;
    if (["oee", "parts_goal"].includes(selectedDashboard))
      return findUrl(summarySubDashboards, selectedDashboard);
    if (["statistics", "part_cycles"].includes(selectedDashboard))
      return findUrl(cyclesSubDashboards, selectedDashboard);
    return dashboardUrls[selectedDashboard];
  };

  // Helper function to parse telemetry data
  const parseTelemetryValues = (data, key) => {
    const values = data?.[key] || [];
    return values
      .map(point => {
        try {
          const parsed = typeof point.value === "string" ? JSON.parse(point.value) : point.value;
          // Ensure parsed is an object
          return parsed && typeof parsed === "object" ? { ts: point.ts, ...parsed } : null;
        } catch {
          return null;
        }
      })
      .filter(v => v !== null);
  };



  const [operationsData, setOperationsData] = useState([]);

  useEffect(() => {
    const fetchOperationsData = async () => {
      if (!start_time || !end_time || !deviceId) return;

      try {
        // Ensure deviceId is an array
        const deviceIds = Array.isArray(deviceId) ? deviceId : [deviceId];

        // Fetch operations data for all devices in parallel
        const allDataArray = await Promise.all(
          deviceIds.map(async (deviceId) => {
            const deviceName = deviceNameIdJson[deviceId] || "Unknown Device";

            const data = await telemetrykeydata(
              deviceId,
              "DEVICE",
              "operations", // key changed to operations
              start_time,
              end_time
            );

            const parsedData = parseTelemetryValues(data, "operations");

            return { deviceName, parsedData };
          })
        );

        // Convert array to object: { deviceName: parsedData }
        const allDataObject = allDataArray.reduce((acc, curr) => {
          acc[curr.deviceName] = curr.parsedData;
          return acc;
        }, {});

        setOperationsData(allDataObject); // Store in state
      } catch (error) {
        console.error("Error fetching operations data:", error);
        setOperationsData({});
      }
    };

    fetchOperationsData();
  }, [deviceId, start_time, end_time, devices, shifts, deviceNameIdJson]);


  console.log('Operations Data', operationsData);





  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", s > 0 ? `${s}s` : ""].filter(Boolean).join(" ");
  }

  function formatEpoch(epoch) {
    // If epoch is in seconds, convert to milliseconds
    if (epoch.toString().length === 10) {
      epoch *= 1000;
    }

    const date = new Date(epoch);

    const pad = (n) => n.toString().padStart(2, "0");

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1); // months are 0-based
    const day = pad(date.getDate());

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");

    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const strHours = hours.toString().padStart(2, "0");

    return `${day}/${month}/${year} ${strHours}:${minutes}:${seconds} ${ampm}`;
  }





  return (
    <Box display="flex" height="100vh" pt={2}>
      {/* Sidebar */}
      <SidebarPanel
        partNumber={partNumber}
        setPartNumber={setPartNumber}
        reportType={reportType}
        setReportType={setReportType}
        formatDuration={formatDuration}
        from={from}
        to={to}
        highestcomponent={codeWiseSummary}

      />

      {/* Right side content */}
      <Box flex={1} p={3} overflow="auto">
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5" fontWeight="bold">
            {componentName || code ? `${componentName} (${code})` : "Component Details"}
            <Typography
              variant="subtitle2"
              display="block"
              fontWeight="bold"
              sx={{ fontSize: "18px" }}
            >
              {deviceName || code ? `${deviceName}` : "Device"}
            </Typography>
          </Typography>

          {/* Back Button */}
          <Button
            variant="contained"
            onClick={() => navigate(previousScreen, {
              state: { selectedDevice, componentName, code ,codeWiseSummary}
            })}
            color="warning"
            sx={{
              backgroundColor: "#626262",
              "&:hover": { backgroundColor: "#4d4d4d" },
            }}
          >
            Back
          </Button>
        </Box>

        {/* Time Range */}
        {start_time && end_time && (
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            {formatEpoch(Number(start_time))} → {formatEpoch(Number(end_time))}
          </Typography>
        )}

        {/* Top summary preview iframe */}
        <Box mt={2} mb={2}>
          <iframe
            title="Main Dashboard"
            width="100%"
            height="180px"
            src={`http://192.168.0.224:3000/yantra/d/f39bad0f-9771-4c10-a0c3-3c6935073647/summary-2?orgId=1&var-from=${start_time}&var-to=${end_time}&var-device_id=${deviceId}&var-device_name=${deviceName}&var-token=${newToken}&var-url=${baseUrl}&theme=light&kiosk`}
            frameBorder="0"
          ></iframe>
        </Box>

        <Box
          display="flex"
          gap={4}
          alignItems="center"
          sx={{
            borderBottom: "1px solid #e0e0e0",
            backgroundColor: "#f9f9f9",
            paddingY: 1,
            paddingX: 2,
          }}
        >
          {dashboards.map((dash) => (
            <Box key={dash.value}>
              <Typography
                variant="subtitle1"
                sx={{
                  cursor: "pointer",
                  paddingBottom: "6px",
                  fontWeight:
                    (dash.value === "summary" &&
                      ["summary", "oee", "parts_goal"].includes(
                        selectedDashboard
                      )) ||
                      (dash.value === "cycles" &&
                        ["cycles", "statistics", "part_cycles"].includes(
                          selectedDashboard
                        )) ||
                      selectedDashboard === dash.value
                      ? "bold"
                      : "normal",
                  borderBottom:
                    (dash.value === "summary" &&
                      ["summary", "oee", "parts_goal"].includes(
                        selectedDashboard
                      )) ||
                      (dash.value === "cycles" &&
                        ["cycles", "statistics", "part_cycles"].includes(
                          selectedDashboard
                        )) ||
                      selectedDashboard === dash.value
                      ? "3px solid #1976d2"
                      : "3px solid transparent",
                  color:
                    (dash.value === "summary" &&
                      ["summary", "oee", "parts_goal"].includes(
                        selectedDashboard
                      )) ||
                      (dash.value === "cycles" &&
                        ["cycles", "statistics", "part_cycles"].includes(
                          selectedDashboard
                        )) ||
                      selectedDashboard === dash.value
                      ? "#1976d2"
                      : "#333",
                  "&:hover": { color: "#1976d2" },
                }}
                onClick={() => {
                  if (dash.value === "summary") setSelectedDashboard("oee");
                  else if (dash.value === "cycles")
                    setSelectedDashboard("statistics");
                  else setSelectedDashboard(dash.value);
                }}
              >
                {dash.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Sub Tabs Area */}
        {["summary", "oee", "parts_goal"].includes(selectedDashboard) && (
          <Box display="flex" gap={3} mt={2} ml={2} mb={2}>
            {summarySubDashboards.map((sub) => (
              <Box
                key={sub.value}
                onClick={() => setSelectedDashboard(sub.value)}
                sx={{
                  cursor: "pointer",
                  borderRadius: "10px",
                  px: 2,
                  py: 0.7,
                  fontSize: "0.9rem",
                  fontWeight: selectedDashboard === sub.value ? "bold" : "normal",
                  border:
                    selectedDashboard === sub.value
                      ? "2px solid #1976d2"
                      : "1px solid #ccc",
                  color:
                    selectedDashboard === sub.value ? "#1976d2" : "text.primary",
                  backgroundColor:
                    selectedDashboard === sub.value ? "#e8f1fb" : "#fff",
                  transition: "0.2s",
                  "&:hover": {
                    border: "2px solid #1976d2",
                    color: "#1976d2",
                    backgroundColor: "#f5f9ff",
                  },
                }}
              >
                {sub.label}
              </Box>
            ))}
          </Box>
        )}


        {["cycles", "statistics", "part_cycles"].includes(selectedDashboard) && (
          <Box display="flex" gap={2} mt={2} ml={2} mb={2}>
            {cyclesSubDashboards.map((sub) => (
              <Box
                key={sub.value}
                onClick={() => setSelectedDashboard(sub.value)}
                sx={{
                  cursor: "pointer",
                  borderRadius: "10px",
                  px: 2,
                  py: 0.7,
                  fontSize: "0.9rem",
                  fontWeight: selectedDashboard === sub.value ? "bold" : "normal",
                  border:
                    selectedDashboard === sub.value
                      ? "2px solid #1976d2"
                      : "1px solid #ccc",
                  color:
                    selectedDashboard === sub.value ? "#1976d2" : "text.primary",
                  backgroundColor:
                    selectedDashboard === sub.value ? "#e8f1fb" : "#fff",
                  transition: "0.2s",
                  "&:hover": {
                    border: "2px solid #1976d2",
                    color: "#1976d2",
                    backgroundColor: "#f5f9ff",
                  },
                }}
              >
                {sub.label}
              </Box>
            ))}
          </Box>
        )}


        {/* Dashboard Iframe */}
        <Box>
          <iframe
            title="Selected Dashboard"
            width="100%"
            height="600px"
            src={getIframeUrl()}
            frameBorder="0"
            style={{ borderRadius: "8px", overflow: "hidden" }}
          ></iframe>
        </Box>
      </Box>
    </Box>
  );



}

export default Summary;