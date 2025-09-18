import { useEffect, useState } from "react";
import dayjs from "dayjs";
import "./verticalprogress.css";

function VerticalProgress({
    shiftNo,
    shiftStart = "10:00",
    shiftEnd = "22:00",
    firstActive
}) {
    
    const [currentTime, setCurrentTime] = useState(dayjs());

    const [startH, startM] = shiftStart.split(":").map(Number);
    const [endH, endM] = shiftEnd.split(":").map(Number);

    // Build shift start & end times based on today
    let shiftStartTime = dayjs().hour(startH).minute(startM).second(0).millisecond(0);
    let shiftEndTime = dayjs().hour(endH).minute(endM).second(0).millisecond(0);

    // ✅ If overnight shift (end < start), push end to next day
    if (shiftEndTime.isBefore(shiftStartTime)) {
        shiftEndTime = shiftEndTime.add(1, "day");
    }

    // ✅ Make sure currentTime falls inside the correct shift window
    if (currentTime.isBefore(shiftStartTime)) {
        // Shift hasn't started yet → use previous day's window
        shiftStartTime = shiftStartTime.subtract(1, "day");
        shiftEndTime = shiftEndTime.subtract(1, "day");
    } else if (currentTime.isAfter(shiftEndTime)) {
        // Shift already ended → move to next cycle
        shiftStartTime = shiftStartTime.add(1, "day");
        shiftEndTime = shiftEndTime.add(1, "day");
    }

    // Calculate progress
    const total = shiftEndTime.diff(shiftStartTime);
    const passed = currentTime.diff(shiftStartTime);
    let progressPercent = (passed / total) * 100;
    if (progressPercent < 0) progressPercent = 0;
    if (progressPercent > 100) progressPercent = 100;

    // Handle login marker
    let loginPercent = 0;
    let formattedLoginTime = "N/A";
    if (firstActive) {
        const loginDate = dayjs(firstActive);
        const loginOffset = loginDate.diff(shiftStartTime);
        loginPercent = Math.min(100, Math.max(0, (loginOffset / total) * 100));
        formattedLoginTime = loginDate.format("HH:mm");
    }

    // Update clock every second
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(dayjs()), 1000);
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
                            height: `${progressPercent}%`,
                            width: "100%"
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
