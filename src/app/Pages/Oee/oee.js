import React, { useEffect, useState , useRef} from 'react';
import dayjs from 'dayjs';
import { useNavigate, useLocation } from "react-router-dom";

import {
  cleanCustomerId,
  telemetrylatestdata,
  getCustomerName
} from '../../Services/app/companyservice';
import { getOperatorDetails, Loginapi, startTokenAutoRefresh } from '../../Services/app/loginservice';
import { customerbasedshift, customerbaseddevices, telemetrykeydata } from '../../Services/app/operatorservice';
import { FaRegClock, FaRegCalendarAlt } from "react-icons/fa";



const Oee = () => {
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
    if (location.pathname !== "/Zx9R2tLmN7wQvB1cF4kH5oPjU6yE3aDgT8sK0qWl~1rMnOp" &&
  location.pathname !== "/o") {
      return;
    }

    const init = async () => {
      try {
        const secondUsername = "pms@gmail.com";
        const secondPassword = "pmspms";
        const secondResponse = await Loginapi(secondUsername, secondPassword);

        localStorage.setItem("email1", secondUsername);
        localStorage.setItem("token1", secondResponse.token); // ✅ write to token1
        localStorage.setItem("refreshToken1", secondResponse.refreshToken);
        localStorage.setItem("Companyname1", secondResponse.Companyname);
        localStorage.setItem("role_name1", secondResponse.Role);

        setCustomerId1("690d2210-8a3a-11f0-a3ac-9b534c07af2b");
        

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

const convertShiftToEpoch = (date, start, end) => {
  const startTime = dayjs(`${date.format("YYYY-MM-DD")} ${start}`);
  let endTime = dayjs(`${date.format("YYYY-MM-DD")} ${end}`);

  if (endTime.isBefore(startTime)) {
    endTime = endTime.add(1, "day"); // overnight shift case
  }

  return { from: startTime.valueOf(), to: endTime.valueOf() };
};

  // Find current shift
  const getCurrentShift = (shiftList) => {
  const now = dayjs();
  for (const s of shiftList) {
    const { from, to } = convertShiftToEpoch(now, s.start_time, s.end_time);
    if (now.valueOf() >= from && now.valueOf() < to) {
      return { ...s, from, to };
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
  console.log('Shifts', shifts)

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



let LAST_WEEK_FROM_EPOCH;
let LAST_WEEK_TO_EPOCH;

function setLastMondayToSaturdayEpoch() {
  const now = new Date();
  const dayOfWeek = now.getDay();

  const lastMonday = new Date(now);
  const diffToMonday = (dayOfWeek + 6) % 7 + 7; 
  lastMonday.setDate(now.getDate() - diffToMonday);
  lastMonday.setHours(0, 0, 0, 0);

  const lastSaturday = new Date(lastMonday);
  lastSaturday.setDate(lastMonday.getDate() + 5); 
  lastSaturday.setHours(23, 59, 59, 999);

  LAST_WEEK_FROM_EPOCH = lastMonday.getTime();
  LAST_WEEK_TO_EPOCH = lastSaturday.getTime();
}

setLastMondayToSaturdayEpoch();

console.log("From:", LAST_WEEK_FROM_EPOCH);
console.log("To:", LAST_WEEK_TO_EPOCH);

let THIS_WEEK_FROM_EPOCH;
let THIS_WEEK_TO_EPOCH;

function setThisWeekMondayToSaturdayEpoch() {
  const now = new Date();
  const dayOfWeek = now.getDay(); 
  const thisMonday = new Date(now);
  const diffToMonday = (dayOfWeek + 6) % 7;
  thisMonday.setDate(now.getDate() - diffToMonday);
  thisMonday.setHours(0, 0, 0, 0); 
  const thisSaturday = new Date(thisMonday);
  thisSaturday.setDate(thisMonday.getDate() + 5); 
  thisSaturday.setHours(23, 59, 59, 999); 

  THIS_WEEK_FROM_EPOCH = thisMonday.getTime();
  THIS_WEEK_TO_EPOCH = thisSaturday.getTime();
}

setThisWeekMondayToSaturdayEpoch();

console.log("This week From:", THIS_WEEK_FROM_EPOCH);
console.log("This week To:", THIS_WEEK_TO_EPOCH);


const now = new Date();

const end = new Date(now);
end.setHours(23, 59, 59, 999);

const start = new Date(now);
start.setDate(start.getDate() - 30);
start.setHours(0, 0, 0, 0);

const monfrom = start.getTime();
const monto = end.getTime();

console.log("Last 30 days From:", monfrom);
console.log("Last 30 days To:", monto);

const [oeeData, setOEEData] = useState({});

useEffect(() => {
  const fetchOEEData = async () => {
    if (!monfrom || !monto || devices.length === 0) return;

    const results = {};

    await Promise.all(
      devices.map(async (device) => {
        try {
          const data = await telemetrykeydata(
            device.id.id,
            "DEVICE",
            "oee",
            monfrom,
            monto
          );

          const values = data?.oee || [];
          if (!Array.isArray(values) || values.length === 0) {
            results[device.id.id] = { oeeValues: [] };
            console.log(`Machine: ${device.name} → No OEE data`);
            return;
          }

          // ✅ Collect all values (last 30 days)
          const oeeArray = values.map((point) => {
            let val = 0;
            if (point?.value !== undefined && point?.value !== null) {
              try {
                val = parseInt(point.value, 10) || 0;
              } catch (err) {
                console.error(`Error parsing OEE for ${device.name}`, err);
              }
            }
            return { ts: point.ts, value: val };
          });

          results[device.id.id] = { oeeValues: oeeArray };

          console.log(
            `Machine: ${device.name} → Collected ${oeeArray.length} OEE values`
          );

        } catch (error) {
          console.error("Error fetching OEE data for", device.name, error);
          results[device.id.id] = { oeeValues: [] };
        }
      })
    );

    setOEEData(results); 
  };

  fetchOEEData();
}, [devices, monfrom, monto]);

console.log('Oee data', oeeData);



const [shiftWiseOEEByDate, setShiftWiseOEEByDate] = useState({});
const [avgData, setAvgData] = useState({});


useEffect(() => {
  if (!oeeData || Object.keys(oeeData).length === 0 || !shifts) return;

  const results = {};

  Object.keys(oeeData).forEach((machineId) => {
    const oeeArray = oeeData[machineId]?.oeeValues || [];
    results[machineId] = {};

    oeeArray.forEach((point) => {
      const ts = point.ts; // timestamp in ms
      const value = point.value;

      const pointDate = new Date(ts);
      const dateKey = pointDate.toISOString().split("T")[0]; // YYYY-MM-DD

      if (!results[machineId][dateKey]) {
        // Initialize shifts for this date
        results[machineId][dateKey] = {};
        shifts.forEach((shift, idx) => {
          results[machineId][dateKey][`Shift ${idx + 1}`] = 0; // default as 0
        });
      }

      // Assign to the correct shift
      shifts.forEach((shift, idx) => {
        const [shHour, shMin, shSec] = shift.start_time.split(":").map(Number);
        const [enHour, enMin, enSec] = shift.end_time.split(":").map(Number);

        const shiftStart = new Date(pointDate);
        shiftStart.setHours(shHour, shMin, shSec, 0);

        let shiftEnd = new Date(pointDate);
        shiftEnd.setHours(enHour, enMin, enSec, 0);

        // Handle shifts crossing midnight
        if (shiftEnd <= shiftStart) {
          shiftEnd.setDate(shiftEnd.getDate() + 1);
        }

        if (
          ts >= shiftStart.getTime() &&
          ts <= shiftEnd.getTime() &&
          results[machineId][dateKey][`Shift ${idx + 1}`] === 0 // only update if still 0
        ) {
          results[machineId][dateKey][`Shift ${idx + 1}`] = value;
        }
      });
    });
  });

  setShiftWiseOEEByDate(results);
}, [oeeData, shifts]);


console.log('Shift Wise OEE data', shiftWiseOEEByDate);


const getDailyAveragesOnly = (shiftWiseData) => {
  const averages = {};

  Object.keys(shiftWiseData).forEach((machineId) => {
    averages[machineId] = {};

    Object.keys(shiftWiseData[machineId]).forEach((dateKey) => {
      const shifts = shiftWiseData[machineId][dateKey];

      const shiftValues = Object.values(shifts);

      // ✅ Always include 0s in average
      const avg =
        shiftValues.reduce((sum, v) => sum + v, 0) / shiftValues.length;

      averages[machineId][dateKey] = Math.round(avg);
    });
  });

  return averages;
};


useEffect(() => {
  if (Object.keys(shiftWiseOEEByDate).length === 0) return;

  const avgResult = getDailyAveragesOnly(shiftWiseOEEByDate);
  setAvgData(avgResult);
}, [shiftWiseOEEByDate]);

console.log('Avg Oee Data', avgData);

const deviceWiseData = Object.fromEntries(
  Object.entries(avgData).map(([deviceId, deviceData]) => {
    const formatted = Object.entries(deviceData).map(([date, value]) => ({
      date,
      value
    }));
    return [deviceId, formatted];
  })
);

console.log(deviceWiseData);


// Global variable to store filtered data
let lastWeekShiftWiseOEE = {};

for (const machineId in shiftWiseOEEByDate) {
  const machineData = shiftWiseOEEByDate[machineId];
  
  lastWeekShiftWiseOEE[machineId] = {};

  for (const dateStr in machineData) {
    const dateEpoch = new Date(dateStr).getTime(); // Convert date string to epoch
    
    if (dateEpoch >= LAST_WEEK_FROM_EPOCH && dateEpoch <= LAST_WEEK_TO_EPOCH) {
      lastWeekShiftWiseOEE[machineId][dateStr] = machineData[dateStr];
    }
  }
}

console.log('Last week shift wise oee',lastWeekShiftWiseOEE);


  const buildGrafanaUrl = (device) => {
    if (!device?.id?.id) return "";

    const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
    const cleanedId = cleanCustomerId(customerId) || cleanCustomerId(customerId1);

    const deviceAvgData = deviceWiseData[device.id.id] || {};
    const avgOeeJson = encodeURIComponent(JSON.stringify(deviceAvgData)); 


    const lastWeekOeeForDevice = lastWeekShiftWiseOEE[device.id.id] || {};
    const lastWeekOeeJson = encodeURIComponent(JSON.stringify(lastWeekOeeForDevice));

  const url = `${GRAFANA_URL}d/a94d350e-0089-4739-a549-4d7bf74794b1/machine-card-pmi?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=DEVICE&var-device_id=${device.id.id}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&var-prefrom=${LAST_WEEK_FROM_EPOCH}&var-preto=${LAST_WEEK_TO_EPOCH}&var-curfrom=${THIS_WEEK_FROM_EPOCH}&var-curto=${THIS_WEEK_TO_EPOCH}&var-avgOee=${avgOeeJson}&var-shiftOEE=${lastWeekOeeJson}&kiosk&theme=light&refresh=5s`;

  console.log("🔗 Grafana Iframe URL:", url); 

  return url;
  };

useEffect(() => {
  if (!shifts || shifts.length === 0) return;

  let refreshTimers = [];

  const scheduleShiftRefreshes = () => {
    const now = dayjs();

    refreshTimers.forEach((t) => clearTimeout(t));
    refreshTimers = [];

    shifts.forEach((shift) => {
      if (!shift.end_time) return;

      const [h, m, s] = shift.end_time.split(":").map(Number);
      let endTime = dayjs().hour(h).minute(m).second(s);

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


const date = dayjs().format("MMM D, YYYY");

const contentRef = useRef(null);
const autoScroll = true;
useEffect(() => {
  if (!contentRef.current || !autoScroll) return;
  const container = contentRef.current;
  const step = 440; 
  let scrollInterval;
  const startScrolling = () => {
    scrollInterval = setInterval(() => {
      if (!container) return;
      const maxScrollTop = container.scrollHeight - container.clientHeight;
      if (container.scrollTop >= maxScrollTop - 100) {
        container.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        container.scrollBy({ top: step, behavior: "smooth" });
      }
    }, 3000);
  };
  const delayTimer = setTimeout(startScrolling, 20000);
  return () => {
    clearTimeout(delayTimer);
    clearInterval(scrollInterval);
  };
}, []);



return (

   <div style={{paddingTop: '1rem', paddingBottom: '0.5rem', position: 'relative'}}>
     <div style={{position: 'sticky' , top: '0', zIndex: '100', background: '#EDEDED'}}>
       <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '1.2rem',paddingRight: '1.2rem'}}>
        <div>
         <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px",  fontWeight: "500" }}>
            <span style={{ color: "#050504" }}>Date: {date}</span>
        </div>

    {currentShift && (
      <div style={{ color: "#0b0a0a", fontSize: "18px", fontWeight: "500" }}>
        Shift  {currentShift.shift_no} : {dayjs(from).format("h:mm A")} –{" "}
        {dayjs(to).format("h:mm A")}
      </div>
    )}
      </div>
        <div
    style={{
      fontSize: "24px",
      fontWeight: "700",
      color: "#333",
    }}
  >
    PMI GLOBAL
  </div>
    <div
          style={{
            fontSize: "18px",
            fontWeight: "500",
            color: "#d9534f",
          }}
        >
          ⏳ Time Left: {countdown}
        </div>
    </div>

      {/* <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: "16px",
        fontWeight: "600",
        background: "#f7f7f7",
        borderBottom: "2px solid #ccc",
        padding: "10px 10rem",
        marginTop: '1rem'
      
      }}
    >
      <div>OEE</div>
      <div>Last Week OEE</div>
      <div>Month OEE</div>
      <div>Last Week Downtime</div>
      <div>Current Week Downtime</div>
    </div> */}

</div>
  <div ref={contentRef}  
   style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '15px',
      width: '100%',
      gridAutoRows: 'auto',
      overflowY: 'auto',
      height: '95vh',
      paddingBottom: "20px"
    }}
 >
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
            // gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "15px",
            width: "100%",
            marginTop: "20px",
            gridAutoRows: "440px",
          }}
      className='device-card' 
        >
          {devices.map((device, index) => {
            const url = buildGrafanaUrl(device, avgData);
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
                  key={url}
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
   </div>
  );

};

export default Oee;
