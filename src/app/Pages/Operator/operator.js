import './operator.css';
import logo from '../../../assets/yantraimage.png';
import { FaRegClock, FaRegCalendarAlt, FaArrowUp } from "react-icons/fa";
import { IoLogOutOutline } from "react-icons/io5";
import { FaPause } from "react-icons/fa6";
import { RxCross2 } from "react-icons/rx";
import { useEffect, useState } from "react";
import dayjs from "dayjs";

import { FaCheckCircle, FaTimesCircle, FaArrowDown } from "react-icons/fa";

/* ---------------- OPERATOR SCREEN ---------------- */


import {
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { customerbaseddevices, telemetrylatestdata } from '../../Services/app/alarmservice';
import { Loginapi } from '../../Services/app/authservice';
import { getOperatorDetails } from '../../Services/app/loginservice';
import { assignOperator } from '../../Services/app/operatorservice';

/* ---------------- CIRCULAR PROGRESS ---------------- */

function CircularProgress({
  actual = 10,
  target = 20,
  partsBehind = 0,
  partsRejects = 0,
  status = "Running"
}) {
  const percentage = Math.min(100, Math.round((actual / target) * 100));
  const intPartsBehind = Math.round(partsBehind);
  const intPartsRejects = Math.round(partsRejects);
  const partsAhead = actual > target ? actual - target : 0;

  // 🎨 Color rules based on percentage and status
  let circleBackground;
  let innerBackground;
  
  if (status === "Alarm") {
    circleBackground = `conic-gradient(#742a2a ${percentage * 3.6}deg, #fc8181 ${percentage * 3.6}deg)`;
    innerBackground = "#c53030";
  } else if (percentage >= 100) {
    circleBackground = `conic-gradient(#22543d 360deg, #68d391 360deg)`;
    innerBackground = "#2f855a";
  } else if (percentage > 75) {
    circleBackground = `conic-gradient(#22543d ${percentage * 3.6}deg, #68d391 ${percentage * 3.6}deg)`;
    innerBackground = "#2f855a";
  } else if (percentage < 40) {
    circleBackground = `conic-gradient(#742a2a ${percentage * 3.6}deg, #fc8181 ${percentage * 3.6}deg)`;
    innerBackground = "#c53030";
  } else {
    circleBackground = `conic-gradient(#7b341e ${percentage * 3.6}deg, #f6ad55 ${percentage * 3.6}deg)`;
    innerBackground = "#dd6b20";
  }

  return (
    <div className="progress-circle" style={{ background: circleBackground }}>
      <div className="progress-circle-inner" style={{ background: innerBackground }}>
        {/* 🔹 Percentage */}
        <div className="progress-percentage1-inner">
          <span className="big">{percentage}%</span>
        </div>

        <div className="progress-metrics">
          {/* ✅ At Goal or Ahead/Behind */}
          {percentage >= 100 && partsAhead === 0 ? (
            <>
              <div className="metric">
                <FaCheckCircle style={{ color: "limegreen", fontSize: "1.8rem" }} />
              </div>
              <span className="label">At Goal</span>
            </>
          ) : partsAhead > 0 ? (
            <>
              <div className="metric">
                <FaArrowUp style={{ color: "#00bfff", fontSize: "1.2rem" }} />
                <span className="value">{partsAhead}</span>
              </div>
              <span className="label">Parts Ahead</span>
            </>
          ) : intPartsBehind > 0 ? (
            <>
              <div className="metric">
                <FaArrowDown style={{ color: "#ffcc00", fontSize: "1.2rem" }} />
                <span className="value">{intPartsBehind}</span>
              </div>
              <span className="label">Parts Behind</span>
            </>
          ) : (
            <>
              <div className="metric">
                <FaCheckCircle style={{ color: "limegreen", fontSize: "1.5rem" }} />
              </div>
              <span className="label">At Goal</span>
            </>
          )}

          {/* ❌ Rejects */}
          <div className="metric">
            <FaTimesCircle style={{ color: "red", fontSize: "1.2rem" }} />
            <span className="value">{intPartsRejects}</span>
          </div>
          <span className="label">Rejects</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- VERTICAL PROGRESS ---------------- */
function VerticalProgress({
  shiftStart = "10:00",
  shiftEnd = "22:00",
  login = "10:15"
}) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const [startH, startM] = shiftStart.split(":").map(Number);
  const [endH, endM] = shiftEnd.split(":").map(Number);
  const [loginH, loginM] = login.split(":").map(Number);

  const shiftStartTime = new Date();
  shiftStartTime.setHours(startH, startM, 0, 0);

  const shiftEndTime = new Date();
  shiftEndTime.setHours(endH, endM, 0, 0);

  const total = shiftEndTime - shiftStartTime;
  const passed = currentTime - shiftStartTime;
  const progressPercent = Math.min(100, Math.max(0, (passed / total) * 100));

  const loginDate = new Date(shiftStartTime);
  loginDate.setHours(loginH, loginM, 0, 0);
  const loginOffset = loginDate - shiftStartTime;
  const loginPercent = Math.min(100, Math.max(0, (loginOffset / total) * 100));

  // Format login time for display
  const loginAMPM = loginDate.getHours() >= 12 ? 'PM' : 'AM';
  const formattedLoginTime = `${(loginDate.getHours() % 12) || 12}:${(loginDate.getMinutes() < 10 ? '0' : '') + loginDate.getMinutes()} ${loginAMPM}`;

  return (
    <div className="vertical-progress-container">
      <div className="time-label start-time">Shift 1: {shiftStart}</div>
      <div className="progress-wrapper">
        <div className="progress-bar">
          <div 
            className="progress" 
            style={{ 
              height: `${progressPercent}%`,
              minHeight: progressPercent > 0 ? '2px' : '0px'
            }} 
          />
          <div className="login-indicator" style={{ top: `${loginPercent}%` }}>
            <div className="login-time-label">Started: {formattedLoginTime}</div>
          </div>
        </div>
      </div>
      <div className="time-label end-time">Shift End: {shiftEnd}</div>
    </div>
  );
}

/* ---------------- OPERATOR SCREEN ---------------- */


function Operator() {
  const [date, setDate] = useState(dayjs().format("DD-MM-YYYY"));
  const [time, setTime] = useState(dayjs().format("HH:mm:ss"));

  // machine & operator states
  const [machines, setMachines] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const [selectedMachine, setSelectedMachine] = useState("");

  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState("");

  // telemetry state
  const [telemetry, setTelemetry] = useState({
    machineStatus: "Unknown",
    targetParts: 0,
    totalShots: 0,
    goodParts: 0,
    scrap: 0,
    ncr: 0,
    jobName: "",
    jobCode: "",
  });

  // temp state for confirmation
  const [pendingMachine, setPendingMachine] = useState("");
  const [pendingOperator, setPendingOperator] = useState("");
  const [confirmType, setConfirmType] = useState(null);

  // status color mapping
  const statusColor =
    telemetry.machineStatus === "Running"
      ? "#3DA06A"
      : telemetry.machineStatus === "Idle"
      ? "#DD6B20"
      : telemetry.machineStatus === "Alarm"
      ? "#E53E3E"
      : telemetry.machineStatus === "Disconnect"
      ? "#ccc"
      : "#ccc";

  // fetch machines from API
  const fetchDevices = async () => {
    try {
      const customerId = "690d2210-8a3a-11f0-a3ac-9b534c07af2b"; // hardcoded
      const result = await customerbaseddevices(customerId, 1000, 0);
      const devicesList = result.data || [];

      setMachines(devicesList.map((d) => d.name));

      const nameIdMap = devicesList.reduce((acc, device) => {
        acc[device.name] = device.id.id;
        return acc;
      }, {});
      setDeviceNameIdJson(nameIdMap);

      if (devicesList.length > 0) {
        setSelectedMachine(devicesList[0].name);
      }
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };

  // ✅ Fetch telemetry for selected machine
  const fetchTelemetry = async (deviceId) => {
    try {
      const keys = ["machine_Status", "targetparts", "totalparts", "live_component", "live_operator"];
      const data = await telemetrylatestdata(deviceId, "DEVICE", keys.join(","));
    //   console.log("Telemetry Data:", data);

      const machineStatus = data?.machine_Status?.[0]?.value || "Unknown";
      const liveOperator = data?.live_operator?.[0]?.value || "Unknown";
      const targetParts = parseInt(data?.targetparts?.[0]?.value || 0, 10);

      // Parse totalparts JSON
      let totalShots = 0,
        goodParts = 0,
        scrap = 0,
        ncr = 0;
      if (data?.totalparts?.[0]?.value) {
        try {
          const parsed = JSON.parse(data.totalparts[0].value);
          totalShots = parsed.totalshots || 0;
          goodParts = parsed.goodparts || 0;
          scrap = parsed.scrap || 0;
          ncr = parsed.ncr || 0;
        } catch (err) {
          console.error("Error parsing totalparts JSON", err);
        }
      }

      // Parse live_component JSON
      let jobName = "",
        jobCode = "";
      if (data?.live_component?.[0]?.value) {
        try {
          const parsed = JSON.parse(data.live_component[0].value);
          jobName = parsed.name || "";
          jobCode = parsed.code || "";
        } catch (err) {
          console.error("Error parsing live_component JSON", err);
        }
      }

      setTelemetry({
        machineStatus,
        targetParts,
        totalShots,
        goodParts,
        scrap,
        ncr,
        jobName,
        jobCode,
        liveOperator
      });
    } catch (err) {
      console.error("Telemetry fetch failed", err);
    }
  };

  // refresh telemetry every 5 seconds
  useEffect(() => {
    if (!selectedMachine || !deviceNameIdJson[selectedMachine]) return;

    const deviceId = deviceNameIdJson[selectedMachine];
    fetchTelemetry(deviceId); // initial call

    const interval = setInterval(() => {
      fetchTelemetry(deviceId);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedMachine, deviceNameIdJson]);

  // init
  useEffect(() => {
    const init = async () => {
      try {
        const secondUsername = "pms@gmail.com";
        const secondPassword = "pmspms";
        const secondResponse = await Loginapi(secondUsername, secondPassword);
        localStorage.setItem("email1", secondUsername);
        localStorage.setItem("token1", secondResponse.token);
        localStorage.setItem("Companyname1", secondResponse.Companyname);
        localStorage.setItem("role_name1", secondResponse.Role);

        await fetchDevices();

        // fetch operators
        const operatorResponse = await getOperatorDetails(
          "690d2210-8a3a-11f0-a3ac-9b534c07af2b"
        );
        const responseData = operatorResponse?.[0]?.value || [];

        const mappedOperators = responseData.map((op) => ({
          id: op.operatorid,
          name: op.operatorname,
        }));

        setOperators(mappedOperators);

        if (mappedOperators.length > 0) {
          setSelectedOperator(mappedOperators[0].id);
        }
      } catch (err) {
        console.error("Init failed", err);
      }
    };
    init();
  }, []);

  // live date & time
  useEffect(() => {
    const interval = setInterval(() => {
      setDate(dayjs().format("DD-MM-YYYY"));
      setTime(dayjs().format("HH:mm:ss"));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleConfirm = () => {
    if (confirmType === "machine") {
      setSelectedMachine(pendingMachine);
    } else if (confirmType === "operator") {
      setSelectedOperator(pendingOperator);
      //

 postOperator(pendingOperator)

    }
    setConfirmType(null);
    setPendingMachine("");
    setPendingOperator("");
  };

  const handleCancel = () => {
    setConfirmType(null);
    setPendingMachine("");
    setPendingOperator("");
  };

  // inside Operator component
const [statusTimer, setStatusTimer] = useState("00:00:00");
const [statusStartTime, setStatusStartTime] = useState(null);
const [prevStatus, setPrevStatus] = useState("");



const postOperator = async(pendingOperator) => {
    try {
            const deviceId = deviceNameIdJson[selectedMachine];

              let payload = {
ts: dayjs().valueOf(),
values:{
operator_id: +pendingOperator
}
}


console.log(payload, 'payload')
      const response = await assignOperator('DEVICE', deviceId, payload)

}catch(err) {
    console.log('operator api failure')
}
} 
// ⏱️ Track timer when machine status changes
useEffect(() => {
  if (!telemetry.machineStatus) return;

  if (telemetry.machineStatus !== prevStatus) {
    setPrevStatus(telemetry.machineStatus);
    setStatusStartTime(new Date()); // reset start time
    setStatusTimer("00:00:00");
  }
}, [telemetry.machineStatus]);

// ⏱️ Update timer every second
useEffect(() => {
  if (!statusStartTime) return;

  const interval = setInterval(() => {
    const now = new Date();
    const diff = Math.floor((now - statusStartTime) / 1000); // seconds elapsed

    const hrs = String(Math.floor(diff / 3600)).padStart(2, "0");
    const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const secs = String(diff % 60).padStart(2, "0");

    setStatusTimer(`${hrs}:${mins}:${secs}`);
  }, 1000);

  return () => clearInterval(interval);
}, [statusStartTime]);


  return (
    <div className="operator-screen">
      {/* HEADER */}
      <div className="header">
        <img className="Logo" src={logo} alt="Logo" />
        <div className="header-text-element">
          <h5>
            <span className="span-1">Yantra </span>
            <span className="span-2">Smart Buddy</span>
          </h5>
        </div>

        <div className="calendar-container">
          <div className="calendar">
            <FaRegCalendarAlt style={{ fontSize: "1.3rem", color: "#F99022" }} />
            <p>Date: </p>
            <p>{date}</p>
          </div>

          <div className="calendar">
            <FaRegClock style={{ fontSize: "1.3rem", color: "#F99022" }} />
            <p>Time: </p>
            <p>{time}</p>
          </div>
        </div>
      </div>

      {/* STATUS HEADER */}
      <div className="header-2" style={{ background: statusColor }}>
        <div className="machine-name">
          <p>Machine:</p>
          <FormControl
            size="small"
            variant="standard"
            sx={{
              minWidth: 120,
              marginLeft: "0.5rem",
              "& .MuiInputBase-root": { color: "white" },
              "& .MuiSvgIcon-root": { color: "white" },
              "& .MuiInput-underline:before": { borderBottom: "1px solid white" },
              "& .MuiInput-underline:hover:before": {
                borderBottom: "2px solid white",
              },
            }}
          >
            <Select
              value={selectedMachine}
              onChange={(e) => {
                setPendingMachine(e.target.value);
                setConfirmType("machine");
              }}
            >
              {machines.map((machine) => (
                <MenuItem key={machine} value={machine}>
                  {machine}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
        <div className="header-2-right">
          <div className="machine-name">
            <p>Status: {telemetry.machineStatus}</p>
          </div>
        
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="content">
        <div className="contect-section">
          <VerticalProgress shiftStart="10:00" shiftEnd="22:00" login="08:20" />
        </div>

        <div className="contect-section circular-progress-section">
          <CircularProgress
            actual={telemetry.goodParts}
            target={telemetry.targetParts}
            partsBehind={Math.max(0, telemetry.targetParts - telemetry.goodParts)}
            partsRejects={telemetry.scrap}
            status={telemetry.machineStatus}
          />
          <div className="username-section">
            <FormControl
              variant="standard"
              sx={{
                minWidth: 140,
                "& .MuiInputBase-root": { color: "#f99022", fontWeight: 600 },
                "& .MuiSvgIcon-root": { color: "#f99022" },
              }}
            >
              <Select
                value={selectedOperator}
                onChange={(e) => {
                  setPendingOperator(e.target.value);
                  setConfirmType("operator");
                }}
                disableUnderline
              >
                {operators.map((op) => (
                  <MenuItem key={op.id} value={op.id}>
                    {op.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </div>

        <div className="contect-section">
          <p>
            Job Name: {telemetry.jobName}
          </p>
          <div style={{ textAlign: "end", marginTop: "0.2rem" }}>
            <p className="actual">Actual vs Target</p>
            <p className="actual-value">
              {telemetry.goodParts}/{telemetry.targetParts}
            </p>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="footer1">
        <div className="footer-left" onClick={() => alert("Reject Parts clicked!")}>
          <FaPause />
          Reject Parts
        </div>
        <div
          className="footer-right"
          onClick={() => alert("Reason for Downtime clicked!")}
        >
          <RxCross2 />
          Reason for Downtime
        </div>
      </div>

      {/* CONFIRMATION POPUP */}
      <Dialog open={!!confirmType} onClose={handleCancel}>
        <DialogTitle>Confirm Change</DialogTitle>
        <DialogContent>
          {confirmType === "machine"
            ? `Are you sure you want to change the machine to "${pendingMachine}"?`
            : `Are you sure you want to change the operator to "${
                operators.find((o) => o.id === pendingOperator)?.name || ""
              }"?`}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            sx={{
              backgroundColor: "#F99022",
              color: "white",
              "&:hover": { backgroundColor: "#d97706" },
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}


export default Operator;


