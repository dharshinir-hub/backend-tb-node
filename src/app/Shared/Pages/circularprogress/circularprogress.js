import React from "react";
import { FaCheckCircle, FaArrowUp, FaArrowDown, FaTimesCircle } from "react-icons/fa";
import "./circularprogress.css";

function CircularProgress({
  actual = 10,
  target = 20,
  partsBehind = 0,
  partsRejects = 0,
  status = "Running",
}) {
  let percentage = Math.min(100, Math.round((actual / target) * 100));
  if (isNaN(percentage)) {
    percentage = 0;
  }

  const intPartsBehind = Math.round(partsBehind);
  const intPartsRejects = Math.round(partsRejects);
  const partsAhead = actual > target ? actual - target : 0;

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
        <div className="progress-percentage1-inner">
          <span className="big">{percentage}%</span>
        </div>

        <div className="progress-metrics">
          {target > 0 && (
            <>
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
            </>
          )}

          <div className="metric">
            <FaTimesCircle style={{ color: "#f56565", fontSize: "1.2rem" }} />
            <span className="value">{intPartsRejects}</span>
          </div>
          <span className="label">Rejects</span>
        </div>
      </div>
    </div>
  );
}

export default CircularProgress;
