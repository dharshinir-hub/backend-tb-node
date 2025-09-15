import { useEffect, useState } from "react";
import dayjs from "dayjs";
import "./verticalprogress.css";

function VerticalProgress({
    shiftNo,
    shiftStart = "10:00",
    shiftEnd = "22:00",
    firstActive
}) {
    const [currentTime, setCurrentTime] = useState(new Date());

    const [startH, startM] = shiftStart.split(":").map(Number);
    const [endH, endM] = shiftEnd.split(":").map(Number);

    const shiftStartTime = new Date();
    shiftStartTime.setHours(startH, startM, 0, 0);

    const shiftEndTime = new Date();
    shiftEndTime.setHours(endH, endM, 0, 0);

    const total = shiftEndTime - shiftStartTime;
    const passed = currentTime - shiftStartTime;
    const progressPercent = Math.min(100, Math.max(0, (passed / total) * 100));

    let loginPercent = 0;
    let formattedLoginTime = "N/A";

    if (firstActive) {
        const loginDate = new Date(firstActive);
        const loginOffset = loginDate - shiftStartTime;
        loginPercent = Math.min(100, Math.max(0, (loginOffset / total) * 100));
        formattedLoginTime = dayjs(loginDate).format("HH:mm");
    }

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="vertical-progress-container">
            <div className="time-label start-time">
                Shift {shiftNo}: {shiftStart}
            </div>
            <div className="progress-wrapper">
                <div className="progress-bar">
                 <div
  className="progress"
  style={{
    height: window.innerWidth > 1024 ? `${progressPercent}%` : "100%",
    width: window.innerWidth <= 1024 ? `${progressPercent}%` : "100%",
    minHeight: progressPercent > 0 && window.innerWidth > 1024 ? "2px" : "0px"
  }}
/>
                    {firstActive && (
                        <div
                            className="login-indicator"
                            style={{ top: `${loginPercent}%` }}
                        >
                            <div className="login-time-label">
                                Started: {formattedLoginTime}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="time-label end-time">Shift End: {shiftEnd}</div>
        </div>
    );
}

export default VerticalProgress;
