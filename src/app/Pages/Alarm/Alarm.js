import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import {
  cleanCustomerId,
  telemetrylatestdata,
  customerbaseddevices,
  customerbasedshift,
  telemetrykeydata
} from "../../Services/app/companyservice";
import "./Alarm.css";

const Alarm = () => {
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedShift, setSelectedShift] = useState("");
  const [shifts, setShifts] = useState([]);
  const [iframeUrl, setIframeUrl] = useState("");
  const [devices, setDevices] = useState([]);
  const [machineData, setMachineData] = useState([]);
  const [deviceNameIdList, setDeviceNameIdList] = useState([]);
  const [fromEpoch, setFromEpoch] = useState(null);
  const [toEpoch, setToEpoch] = useState(null);
  const [customerData, setCustomerDataArray] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [actualData, setactualData] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("part-vs-expected");
  const [searchText, setSearchText] = useState("");
const [dropdownValue, setDropdownValue] = useState("part-vs-expected");


 

const tabs = [
  {
    name: "Summary",
    url: `http://demo.yantra24x7.com:3000/d/c48b068a-e60c-400e-b444-2df022b3c748/summary-dashboard?orgId=1&from=1753052248054&to=1753095448054&theme=light&kiosk`
  },
    { name: "Cycles", url: "http://demo.yantra24x7.com:3000/d/a0b97da4-e29b-4516-ac5a-a31cca367a57/valve-c-46-cycle-statics-4?orgId=1&from=1750019172020&to=1750105572024&theme=light&kiosk" },
    { name: "Downtime", url: "http://demo.yantra24x7.com:3000/d/a26599fa-4269-4706-b156-e11ac9c423da/valve-c-46-production-analysis-downtime-7?orgId=1&from=1753071905722&to=1753093505722&theme=light&kiosk" },
    { name: "Alarms", url: "http://demo.yantra24x7.com:3000/d/b57f74e5-0bb6-4096-9b1a-b60b40d155b4/valve-c-46-production-analysis-alarm-8?orgId=1&from=1753072497419&to=1753094097419&theme=light&kiosk" },
    { name: "Cost", url: "https://example.com/cost" },
    { name: "Tooling", url: "https://example.com/tooling" },
  ];
  const [activeTab, setActiveTab] = useState(tabs[0]);

  const customerId = cleanCustomerId(localStorage.getItem("CustomerID"));

  const getCurrentShift = () => {
    const now = dayjs();
    const time = now.format("HH:mm:ss");
    return time >= "08:00:00" && time < "20:00:00" ? "1" : "2";
  };

  const getEpochFromShift = (shiftNo, selectedDateObj) => {
    const selectedShiftData = shifts.find(
      (shift) => String(shift.shift_no) === String(shiftNo)
    );
    if (!selectedShiftData || !selectedDateObj)
      return { fromEpoch: null, toEpoch: null };

    const dateStr = selectedDateObj.format("YYYY-MM-DD");
    const startDateTime = dayjs(`${dateStr}T${selectedShiftData.start_time}`);
    let endDateTime;

    if (shiftNo === "2") {
      const nextDay = selectedDateObj.add(1, "day").format("YYYY-MM-DD");
      endDateTime = dayjs(`${nextDay}T${selectedShiftData.end_time}`);
    } else {
      endDateTime = dayjs(`${dateStr}T${selectedShiftData.end_time}`);
    }

    if (
      dateStr === dayjs().format("YYYY-MM-DD") &&
      dayjs().isBefore(endDateTime)
    ) {
      endDateTime = dayjs();
    }

    return {
      fromEpoch: startDateTime.valueOf(),
      toEpoch: endDateTime.valueOf(),
    };
  };

  console.log('From Time', fromEpoch, 'To Time', toEpoch);

  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, "allShift");
      const shiftList = result[0]?.value || [];
      setShifts(shiftList);
      localStorage.setItem("shifts", JSON.stringify(shiftList));
      setSelectedShift(getCurrentShift());
    } catch (err) {
      console.error("Failed to fetch shifts", err);
    }
  };

  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];
      setDevices(devicesList);
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };

  const extractDeviceNameId = (devicesList) => {
    const list = devicesList.map((device) => ({
      name: device.name,
      id: device.id.id,
    }));
    setDeviceNameIdList(list);
  };

  const fetchMachineData = async () => {
  if (devices.length === 0 || !fromEpoch || !toEpoch) return;

  const machineArray = [];

  for (const device of devices) {
    try {
      // Fetch data from telemetry between fromEpoch and toEpoch
      const telemetry = await telemetrylatestdata(
        device.id.id,
        "DEVICE",
        "totalrunduration",
        fromEpoch,
        toEpoch
      );

      const rundurationValue = telemetry?.totalrunduration?.[0]?.value || 0;
      const formattedDuration = formatDuration(rundurationValue);

      machineArray.push({
        name: device.name,
        ts: dayjs(fromEpoch).format("YYYY-MM-DD HH:mm:ss"), // ✅ Reflect selected date
        runduration: formattedDuration,
      });
    } catch (err) {
      console.error(`Failed to fetch telemetry for ${device.name}`, err);
    }
  }

  setMachineData(machineArray);
};

console.log('Machine Data',machineData);


const fetchactualData = async (fromEpoch, toEpoch) => {
  if (devices.length === 0 || !fromEpoch || !toEpoch) return;

  try {
    const kpiPromises = devices.map(async (device) => {
      try {
        // ✅ Fetch telemetry data for given time range
        const telemetry = await telemetrykeydata(
          device.id.id,
          "DEVICE",
          "oee,availability,performance,quality",
          fromEpoch,
          toEpoch
        );

        // ✅ Merge all keys into single time-series by timestamp
        const keys = ["oee", "performance", "availability", "quality"];
        const timeMap = new Map();

        keys.forEach((key) => {
          (telemetry[key] || []).forEach((item) => {
            const ts = item.ts;
            if (!timeMap.has(ts)) {
              timeMap.set(ts, { ts, value: {} });
            }
            timeMap.get(ts).value[key] = item.value ?? 0;
          });
        });

        const mergedData = Array.from(timeMap.values()).sort((a, b) => a.ts - b.ts);

        return {
          deviceId: device.id.id,
          deviceName: device.name,
          data: mergedData,
        };
      } catch (err) {
        console.error(`Failed to fetch historical KPI for ${device.name}`, err);
        return null;
      }
    });

    const results = await Promise.all(kpiPromises);
    const validResults = results.filter((item) => item !== null);

    console.log("Actual Data (from API)", validResults);
    setactualData(validResults);
  } catch (error) {
    console.error("Error fetching actual data:", error);
  }
};








console.log('Actual Data', actualData)


  const formatDuration = (value) => {
    const seconds = parseInt(value, 10);
    if (isNaN(seconds)) return "00:00:00";

    const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const handleMachineClick = (deviceId) => {
  if (!fromEpoch || !toEpoch) return;

  const device = devices.find((d) => d.id.id === deviceId);
  if (!device) return;

  const deviceName = device?.name || "";
  const encodedDeviceName = encodeURIComponent(deviceName);
  const newToken = localStorage.getItem("newToken");

  // Bar iframe URL (timeline)
  const grafanaLink = `http://demo.yantra24x7.com:3000/d/f1db1e7b-9eac-4ce6-89bd-92e71f994004/main-screen-valve-c-46-summary-3-copy-2?orgId=1&var-token=${newToken}&var-fromTime=${fromEpoch}&var-toTime=${toEpoch}&theme=light&var-device_id=${deviceId}&var-device_name=${encodedDeviceName}&kiosk`;

  setIframeUrl(grafanaLink);
  setSelectedDevice(device);

  console.log("Grafana Bar URL:", grafanaLink);

  // Default tab set to Summary
  const summaryUrl = generateTabUrl("Summary", deviceId, encodedDeviceName, newToken);
  setActiveTab({ name: "Summary", url: summaryUrl });
};

// ✅ Function to generate tab URL dynamically
const generateTabUrl = (tabName, deviceId, encodedDeviceName, token) => {
  let dashboardUid = "";

  switch (tabName) {
    case "Summary":
      dashboardUid = "c48b068a-e60c-400e-b444-2df022b3c748"; // Example UID for Summary
      break;
    case "Cycles":
      dashboardUid = "a0b97da4-e29b-4516-ac5a-a31cca367a57"; // Replace with actual UID
      break;
    case "Downtime":
      dashboardUid = "a26599fa-4269-4706-b156-e11ac9c423da"; // Replace with actual UID
      break;
    case "Alarms":
      dashboardUid = "b57f74e5-0bb6-4096-9b1a-b60b40d155b4"; // Replace with actual UID
      break;
    case "Cost":
      dashboardUid = "e4973a36-dfc6-4b5d-9339-1b6efa2cc229";
      break;
    case "Tooling":
      dashboardUid = "c06f2901-a06c-4eac-bf88-341508c1e97f";
      break;
    default:
      dashboardUid = "f1db1e7b-9eac-4ce6-89bd-92e71f994004"; // Default Summary
  }

  const encodedactualData = encodeURIComponent(JSON.stringify(actualData));
  console.log('Encoded Actual Data',encodedactualData);
    const customerId = localStorage.getItem('CustomerID');

    const cleanedId = cleanCustomerId(customerId);
    console.log('customer id',cleanedId);
  

  const url=`http://demo.yantra24x7.com:3000/d/${dashboardUid}/${tabName.toLowerCase()}-screen?orgId=1&var-token=${token}&var-fromTime=${fromEpoch}&var-toTime=${toEpoch}&theme=light&var-device_id=${deviceId}&var-device_name=${encodedDeviceName}&var-customerid=${cleanedId}&var-actualdata=${encodedactualData}&kiosk`;
  return url;
};

// ✅ Tab click handler
useEffect(() => {
  if (!selectedDevice || !activeTab) return;

  const deviceId = selectedDevice.id.id;
  const encodedDeviceName = encodeURIComponent(selectedDevice.name);
  const newToken = localStorage.getItem("newToken");

  const updatedTabUrl = generateTabUrl(activeTab.name, deviceId, encodedDeviceName, newToken);

  setActiveTab((prev) => ({ ...prev, url: updatedTabUrl }));

  // ✅ Console log for debug
  console.log(`✅ useEffect updated URL for ${activeTab.name}:`, updatedTabUrl);

}, [activeTab.name, selectedDevice, fromEpoch, toEpoch]);



  useEffect(() => {
    fetchShifts();
    fetchDevices();
  }, []);

useEffect(() => {
  if (devices.length > 0 && fromEpoch && toEpoch) {
    fetchMachineData();
  }
}, [devices, fromEpoch, toEpoch]);




  useEffect(() => {
    if (selectedShift && selectedDate && shifts.length > 0) {
      const { fromEpoch, toEpoch } = getEpochFromShift(
        selectedShift,
        selectedDate
      );
      setFromEpoch(fromEpoch);
      setToEpoch(toEpoch);
    }
  }, [selectedShift, selectedDate, shifts]);

   useEffect(() => {
  fetchactualData();
}, []);

const filteredMachines = machineData.filter(machine =>
  machine.name.toLowerCase().includes(searchText.toLowerCase()) &&
  (dropdownValue === "high" ? machine.runduration > 100 : dropdownValue === "low" ? machine.runduration <= 100 : true)
);


  return (
  <div className="pages">
    <div className="pagecontents" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      
      {/* HEADER BAR */}
      <div
        className="top-bar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 20px",
          backgroundColor: "#fff",
          borderBottom: "1px solid #ddd"
        }}
      >
        {/* LEFT SIDE - Page Title */}
        <h5 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>
          Production Monitoring Alarms
        </h5>

        {/* RIGHT SIDE - Date Picker and Shift Dropdown */}
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
         <LocalizationProvider dateAdapter={AdapterDayjs}>
  <DatePicker
    label="Select Date"
    value={selectedDate}
    onChange={(newValue) => {
      setSelectedDate(newValue);

      if (selectedShift && shifts.length > 0) {
        const { fromEpoch: newFromEpoch, toEpoch: newToEpoch } = getEpochFromShift(
          selectedShift,
          newValue
        );

        setFromEpoch(newFromEpoch);
        setToEpoch(newToEpoch);

        console.log("✅ Updated Date:", newValue.format("DD-MM-YYYY"));
        console.log("✅ New From:", newFromEpoch, "✅ New To:", newToEpoch);

        // ✅ If a device is already selected, update Grafana URL for active tab
        if (selectedDevice) {
          const deviceId = selectedDevice.id.id;
          const encodedDeviceName = encodeURIComponent(selectedDevice.name);
          const newToken = localStorage.getItem("newToken");

          const updatedTabUrl = generateTabUrl(
            activeTab.name,
            deviceId,
            encodedDeviceName,
            newToken
          );

          setActiveTab((prev) => ({ ...prev, url: updatedTabUrl }));

          // ✅ Also update top timeline iframe
          const grafanaLink = `http://demo.yantra24x7.com:3000/d/f1db1e7b-9eac-4ce6-89bd-92e71f994004/main-screen-valve-c-46-summary-3-copy-2?orgId=1&var-token=${newToken}&var-fromTime=${newFromEpoch}&var-toTime=${newToEpoch}&theme=light&var-device_id=${deviceId}&var-device_name=${encodedDeviceName}&kiosk`;
          setIframeUrl(grafanaLink);

          console.log("✅ Grafana Updated URL:", grafanaLink);
        }
      }
    }}
    format="DD-MM-YYYY"
    disableFuture
  />
</LocalizationProvider>

          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>Select Shift</InputLabel>
            <Select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
            >
              {shifts.map((shift) => (
                <MenuItem key={shift.shift_no} value={String(shift.shift_no)}>
                  Shift {shift.shift_no}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </div>

      {/* MAIN CONTENT - SPLIT LEFT & RIGHT */}
      <div style={{ display: "flex", flex: 1 }}>
  {/* LEFT PANEL - Machine List */}
  <div
    style={{
      width: "30%",
      background: "#f9fafc",
      borderRight: "1px solid #ddd",
      padding: "15px",
      overflowY: "auto"
    }}
  >
    <h5 style={{ fontWeight: "bold", marginBottom: "8px" }}>Summary</h5>
    <div style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
      Completed runs listed by latest
    </div>

    {/* Search Box */}
    <input
      type="text"
      placeholder="Search machines..."
      value={searchText}
      onChange={(e) => setSearchText(e.target.value)}
      style={{
        padding: "8px",
        width: "100%",
        marginBottom: "10px",
        borderRadius: "4px",
        border: "1px solid #ccc"
      }}
    />

    {/* Dropdown Below Search */}
    <select
      value={dropdownValue}
      onChange={(e) => setDropdownValue(e.target.value)}
      style={{
        padding: "8px",
        width: "100%",
        marginBottom: "15px",
        borderRadius: "4px",
        border: "1px solid #ccc"
      }}
    >
      <option value="">-- Select Filter --</option>
      <option value="high">High Runtime</option>
      <option value="low">Low Runtime</option>
    </select>

    {/* Filtered Machine Cards */}
    {filteredMachines.map((machine, index) => {
      const device = devices.find((d) => d.name === machine.name);
      const deviceId = device?.id?.id || "";
      return (
        <div
          key={index}
          onClick={() => handleMachineClick(deviceId)}
          style={{
            background: "#fff",
            border: iframeUrl.includes(deviceId)
              ? "2px solid #FF7F32"
              : "1px solid #ccc",
            borderRadius: "6px",
            padding: "12px",
            marginBottom: "10px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "15px" }}>
            {machine.name}
          </div>
          <div style={{ fontSize: "13px", color: "#555" }}>
            {selectedDate.format("DD/MM/YYYY")},{" "}
            {selectedShift === "1" ? "08:00" : "20:00"}
          </div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: "bold",
              color: "#333"
            }}
          >
            {machine.runduration}
          </div>
        </div>
      );
    })}
  </div>

  {/* RIGHT PANEL */}
  <div style={{ width: "70%", background: "#fff", padding: "15px" }}>
    {iframeUrl ? (
      <>
        {/* Machine Header */}
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "bold",
            marginBottom: "6px"
          }}
        >
          {devices.find((d) => iframeUrl.includes(d.id.id))?.name ||
            "Select a Machine"}
        </h2>

        {/* Timeline Iframe */}
        <iframe
          src={iframeUrl}
          title="Timeline"
          style={{
            width: "100%",
            height: "120px",
            border: "1px solid #ddd",
            marginBottom: "15px",
            borderRadius: "4px"
          }}
          allowFullScreen
        ></iframe>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            borderBottom: "2px solid #eee",
            marginBottom: "10px"
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => {
                const token = localStorage.getItem("newToken");
                const selectedDeviceId = selectedDevice?.id || "";
                const tabUrl = `${tab.baseUrl}?orgId=1&var-token=${encodeURIComponent(
                  token
                )}&var-device_id=${selectedDeviceId}&var-device_name=${encodeURIComponent(
                  selectedDevice?.name
                )}&var-fromTime=${fromEpoch}&var-toTime=${toEpoch}&theme=light&kiosk`;
                setActiveTab({ ...tab, url: tabUrl });
              }}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "14px",
                paddingBottom: "6px",
                cursor: "pointer",
                position: "relative",
                color: activeTab.name === tab.name ? "#000" : "#666",
                fontWeight: activeTab.name === tab.name ? "bold" : "normal"
              }}
            >
              {tab.name}
              {activeTab.name === tab.name && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "100%",
                    height: "2px",
                    backgroundColor: "#FF7F32"
                  }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Iframe */}
        <iframe
          src={activeTab.url}
          title={activeTab.name}
          style={{
            width: "100%",
            height: "100vh",
            border: "none"
          }}
        ></iframe>
      </>
    ) : (
      <div
        style={{
          textAlign: "center",
          paddingTop: "50px",
          color: "#888"
        }}
      >
        Select a machine to view details
      </div>
    )}
  </div>
</div>

    </div>
  </div>
);




};

export default Alarm;