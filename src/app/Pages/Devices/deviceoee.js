import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useNavigate, useLocation } from "react-router-dom";

import {
  cleanCustomerId,
  telemetrylatestdata,
  telemetrykeydata,
  getCustomerName
} from '../../Services/app/companyservice';
import { getOperatorDetails, Loginapi, startTokenAutoRefresh } from '../../Services/app/loginservice';
import { customerbasedshift, customerbaseddevices } from '../../Services/app/operatorservice';

const OeeDashboard = () => {
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

  const baseUrl = window._env_.SERVER_URL;
  const GRAFANA_URL = window._env_.GRAFANA_URL;
  const customerId = localStorage.getItem('CustomerID');

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

  // ✅ login and set customerId1
  useEffect(() => {
    if (location.pathname !== "/Zx9R2tLmN7wQvB1cF4kH5oPjU6yE3aDgT8sK0qWl~1rMnOp") {
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

        setCustomerId1(window._env_.CUSTOMER_ID);
        

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

  // Convert shift times to epoch
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

  useEffect(() => {
    if (customerId || customerId1) {
      fetchShifts();
    }
  }, [customerId, customerId1]);

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
      fetchDevices();
    }
  }, [customerId, customerId1]);

  // Build grafana url
  const buildGrafanaUrl = (device) => {
    if (!device?.id?.id) return "";

    const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
    const cleanedId = cleanCustomerId(customerId) || cleanCustomerId(customerId1);
    const encodedid = encodeURIComponent(JSON.stringify(deviceNameIdJson));

  const url = `${GRAFANA_URL}d/a94d350e-0089-4739-a549-4d7bf74794b0/machine-card-pmi?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=DEVICE&var-device_id=${device.id.id}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light&refresh=20s`;

  console.log("🔗 Grafana Iframe URL:", url); // ✅ log URL

  return url;
  };

  // 🔹 Refresh page at each shift end
useEffect(() => {
  if (!shifts || shifts.length === 0) return;

  let refreshTimers = [];

  const scheduleShiftRefreshes = () => {
    const now = dayjs();

    // Clear old timers
    refreshTimers.forEach((t) => clearTimeout(t));
    refreshTimers = [];

    shifts.forEach((shift) => {
      if (!shift.end_time) return;

      const [h, m, s] = shift.end_time.split(":").map(Number);
      let endTime = dayjs().hour(h).minute(m).second(s);

      // If the end time already passed today, schedule for tomorrow
      if (endTime.isBefore(now)) {
        endTime = endTime.add(1, "day");
      }

      const delay = endTime.diff(now, "millisecond");

      if (delay > 0) {
        console.log(
          `⏳ Scheduling refresh for Shift ${
            shift.shift_no || "?"
          } at ${endTime.format("YYYY-MM-DD HH:mm:ss")}, in ${Math.round(
            delay / 1000 / 60
          )} minutes`
        );

        const timer = setTimeout(() => {
          console.log(
            `🔄 Auto-refreshing at shift ${
              shift.shift_no || "?"
            } end → ${shift.end_time}`
          );
          window.location.reload();
        }, delay);

        refreshTimers.push(timer);
      }
    });
  };

  // Schedule immediately
  scheduleShiftRefreshes();

  // 🔹 Calculate how long until midnight → then reschedule daily
  const now = dayjs();
  const nextMidnight = now.add(1, "day").startOf("day");
  const msUntilMidnight = nextMidnight.diff(now, "millisecond");

  const midnightTimer = setTimeout(() => {
    scheduleShiftRefreshes();

    // after first midnight, repeat every 24h
    setInterval(scheduleShiftRefreshes, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);

  return () => {
    refreshTimers.forEach((t) => clearTimeout(t));
    clearTimeout(midnightTimer);
  };
}, [shifts]);

  // ✅ Final UI return
  return (
  <div
    style={{
      width: "100%",
      height: "100%",
      overflowY: "auto",
      padding: "40px 10px",
    }}
  >
    {/* ✅ Show current shift info always */}
    {currentShift && (
      <>
     <div
  style={{
    textAlign: "center",
    fontSize: "20px",
    fontWeight: "600",
    color: "#444",
    marginBottom: "10px",
  }}
>
           {`Shift ${currentShift.shift_no} : `}
  {dayjs(from).format("MMM D YYYY, h:mm:ss A")} –{" "}
  {dayjs(to).format("MMM D YYYY, h:mm:ss A")}
        </div>

        <div
          style={{
            textAlign: "center",
            fontSize: "18px",
            fontWeight: "500",
            color: "#d9534f",
            marginBottom: "20px",
          }}
        >
          ⏳ Time Left: {countdown}
        </div>
      </>
    )}

    {/* ✅ Always render devices below */}
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
                key={url} // ✅ forces reload when token changes
                src={url}
                style={{
                  flex: 1,
                  border: "0",
                  width: "100%",
                  height: "1000px",
                }}
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
