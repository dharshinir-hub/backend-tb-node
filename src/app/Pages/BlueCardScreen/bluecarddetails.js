import React, { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FormControl, InputLabel, Select, MenuItem, IconButton, Checkbox, ListItemText } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  cleanCustomerId,
  customerbaseddevices,
  customerbasedshift,
  telemetrykeydata,
} from "../../Services/app/companyservice";
import dayjs from "dayjs";
import { operatorTelemetry } from "../../Services/app/operatorservice";
import { shiftadd } from "../../Services/app/masterservice";
import "./bluecarddetails.css";
import Swal from "sweetalert2";
import { getReportGenerate, getReportGenerate1, getReportToken } from "../../Services/app/reportservice";

function getCurrentShift(shifts) {
  if (!Array.isArray(shifts) || shifts.length === 0) return null;

  const now = new Date();
  const currentMinutes =
    now.getHours() * 60 +
    now.getMinutes() +
    now.getSeconds() / 60;

  for (const s of shifts) {
    const [fromH, fromM] = s.start_time.split(":").map(Number);
    const [toH, toM] = s.end_time.split(":").map(Number);

    const fromMinutes = fromH * 60 + fromM;
    const toMinutes = toH * 60 + toM;

    if (fromMinutes < toMinutes) {
      if (currentMinutes >= fromMinutes && currentMinutes < toMinutes) {
        return String(s.shift_no);
      }
    } else {
      if (currentMinutes >= fromMinutes || currentMinutes < toMinutes) {
        return String(s.shift_no);
      }
    }
  }
  return null;
}

function getShiftTimes(shifts, selectedShift, selectedDate) {
  if (!Array.isArray(shifts) || shifts.length === 0 || !selectedDate) {
    return { from: null, to: null };
  }

  const baseDate = dayjs(selectedDate).startOf("day");
  const getEpoch = (dayOffset, timeStr) =>
    baseDate
      .add(Number(dayOffset) - 1, "day")
      .hour(Number(timeStr.split(":")[0]))
      .minute(Number(timeStr.split(":")[1]))
      .second(0)
      .millisecond(0)
      .valueOf();
  const shift = shifts.find(
    (s) => String(s.shift_no) === String(selectedShift)
  );
  if (!shift) return { from: null, to: null };

  return {
    from: getEpoch(shift.start_day, shift.start_time),
    to: getEpoch(shift.end_day, shift.end_time),
  };
}

const BluecardDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const bluecardData = location.state?.bluecardData;
  const shift = location.state?.selectedShift;
  const [status, setStatus] = useState(null);
  const [reason, setReason] = useState([]);
  const [endTime, setEndTime] = useState(new Date());
  const [remark, setRemark] = useState("");
  const [rejectionData, setRejectionData] = useState([{ reason: [], remark: "" }]);
  const [showNokPopup, setShowNokPopup] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const [qualityReasonList, setQualityReasonList] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const CustomerId = localStorage.getItem('CustomerID');
  const customerId = cleanCustomerId(CustomerId);
  const [isBeforeFirstShift, setIsBeforeFirstShift] = useState(false);
  const CustomerEmail = localStorage.getItem("email");
  const card = bluecardData;
  console.log('customer id', customerId);
  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result?.data || [];
      const map = devicesList.reduce((acc, d) => {
        acc[d.id.id] = d.name;
        return acc;
      }, {});
      setDeviceNameIdJson(map);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchShifts = async () => {
    try {
      const shiftResult = await customerbasedshift(customerId, "allShift");
      const shiftData = shiftResult?.[0]?.value || [];
      setShifts(shiftData);

      const qualityResult = await customerbasedshift(
        customerId,
        "qualityreason"
      );
      const qualityData = qualityResult?.[0]?.value || [];
      setQualityReasonList(qualityData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!customerId) return;
    fetchDevices();
    fetchShifts();
  }, [customerId]);

  useEffect(() => {
    if (shifts.length > 0) {
      const currentShift = getCurrentShift(shifts);
      setSelectedShift(currentShift);
    }
  }, [shifts]);

  useEffect(() => {
    if (!shifts?.length) return;
    const firstShift = [...shifts].sort(
      (a, b) => Number(a.shift_no) - Number(b.shift_no)
    )[0];
    if (!firstShift) return;

    const now = dayjs();

    const { from } = getShiftTimes(
      shifts,
      String(firstShift.shift_no),
      now
    );
    if (!from) return;

    const shiftStart = dayjs(from);
    if (now.isBefore(shiftStart)) {
      setIsBeforeFirstShift(true);
      setSelectedDate(prev =>
        prev?.isSame(dayjs().subtract(1, "day"), "day")
          ? prev
          : dayjs().subtract(1, "day")
      );

      const msUntilStart = shiftStart.diff(now);

      const timer = setTimeout(() => {
        setIsBeforeFirstShift(false);
        setSelectedDate(dayjs());
      }, msUntilStart);

      return () => clearTimeout(timer);
    }
    setIsBeforeFirstShift(false);
    setSelectedDate(prev =>
      prev?.isSame(dayjs(), "day") ? prev : dayjs()
    );

  }, [shifts]);

  useEffect(() => {
    const timer = setInterval(() => setEndTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (ts) =>
    ts ? new Date(ts).toLocaleString() : "-";

  const duration = useMemo(() => {
    if (!card?.clicked_ts || !endTime) return "-";
    const diff = Math.max(
      0,
      Math.floor((new Date(endTime).getTime() - new Date(card.clicked_ts).getTime()) / 1000)
    );
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${h}h ${m}m ${s}s`;
  }, [endTime, card]);

  const canComplete = status === "OK" || (status === "NOK" && Array.isArray(reason) && reason.length > 0);

  const handleComplete = () => {
    if (!canComplete) return;
    showCompleteConfirm();
  };

  const showCompleteConfirm = () => {
    Swal.fire({
      title: '<span style="font-size:22px;font-weight:400;">Confirm Complete</span>',
      text: "Do you want to confirm completion?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Confirm",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#3374EE",
      cancelButtonColor: "#787b81",
      allowOutsideClick: false,
    }).then((result) => {
      if (result.isConfirmed) confirmComplete();
    });
  };


  const showQualityCheckSuccess = () => {
    Swal.fire({
      html: `
        <div style="padding:20px;text-align:center;">
          <div style="
            width:90px;height:90px;border-radius:50%;
            border:4px solid #8BC57B;margin:0 auto 20px;
            display:flex;align-items:center;justify-content:center;
            color:#8BC57B;font-size:44px;font-weight:bold;
          ">✓</div>
          <p style="margin-top:12px;color:#050505;font-size:20px;">
            Quality check submitted successfully.
          </p>
        </div>
      `,
      showConfirmButton: false,
      timer: 1500,
      timerProgressBar: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
      width: "420px",
    });
  };

  const handleLoginAndFetch = async (machineName,
    formattedDate,
    selectedShift,
    isLiveShift) => {
    try {
      const loginRes = await getReportToken("pmi", "pmi");
      const token = loginRes?.accessToken;
      if (!token) {
        console.warn("Token missing — skipping report call");
        return;
      }
      await getReportGenerate1(
        machineName,
        formattedDate,
        selectedShift,
        isLiveShift
      );
    } catch (err) {
      console.error("Login/report flow failed:", err);
    }
  };

  const confirmComplete = async () => {
    const completedTime = Date.now();
    setEndTime(new Date());
    showQualityCheckSuccess();

    const payload = {
      job_name: card.job_name || "",
      code: card.code || "",
      device_name: card.device_name || "",
      clicked_ts: card.clicked_ts,
      component_starttime: card.component_starttime || "",
      operator_name: card.operator_name || "",
      total_shots: card.total_shots ?? 0,
      target_parts: card.target_parts ?? 0,
      end_time: completedTime,
      reason: reason || "-",
      remarks: remark || "---",
      status: status || "OK",
      progress: "completed",
      shift: selectedShift,
      route_card_no: card.route_card_no,
      bluecard_email: CustomerEmail
    };

    const telemetryPayload = {
      ts: card.clicked_ts,
      values: { bluecard_push: payload },
    };

    const deviceId = Object.keys(deviceNameIdJson).find(
      (key) => deviceNameIdJson[key] === card?.device_name
    );

    try {
      await operatorTelemetry(
        "CUSTOMER",
        cleanCustomerId(customerId),
        telemetryPayload
      );
      if (status === "NOK" && reason && reason !== "-") {

        let updatedBluecardCount = 1;
        let updatedReason = [];
        let updatedRemark = "";
        try {
          const data = await telemetrykeydata(
            deviceId,
            "DEVICE",
            "rejection",
            card.component_starttime,
            completedTime
          );

          const parsed = (data?.rejection || [])
            .map((p) => {
              try {
                if (
                  typeof p.value === "string" &&
                  p.value.trim().startsWith("{")
                ) {
                  return JSON.parse(p.value);
                }
                return null;
              } catch {
                return null;
              }
            })
            .filter(Boolean);
          const lastRecord = parsed.sort(
            (a, b) => Number(b.ts || 0) - Number(a.ts || 0)
          )[0];

          const existingCount = Number(lastRecord?.bluecard_count) || 0;
          updatedBluecardCount = existingCount + 1;

          const existingReasons = Array.isArray(lastRecord?.bluecard_reason)
            ? lastRecord.bluecard_reason
            : [];

          const newReasons = Array.isArray(reason)
            ? reason
            : reason
              ? [reason]
              : [];

          updatedReason = [...existingReasons, ...newReasons];
          updatedReason = [...new Set(updatedReason)];
          const existingRemark = lastRecord?.bluecard_remark || "";
          if (existingRemark && remark) {
            updatedRemark = `${existingRemark}, ${remark}`;
          } else {
            updatedRemark = existingRemark || remark || "";
          }
        } catch (err) {
          console.warn(
            "Failed to fetch rejection history, starting from 1"
          );
          updatedBluecardCount = 1;
        }

        const rejectdata = {
          bluecard_count: String(updatedBluecardCount),
          bluecard_reason: updatedReason,
          bluecard_remark: updatedRemark,
          bluecard_rejection_data: rejectionData,
          bluecard_email: CustomerEmail,
          shift: selectedShift,
          count: String(updatedBluecardCount),
          reason: reason
        };

        const rejectionPayload = {
          ts: card.component_starttime,
          values: { rejection: rejectdata },
        };

        await operatorTelemetry("DEVICE", deviceId, rejectionPayload);
        try {
          const COMMON_KEY = "bluecard_nok_history";
          const componentName = card.job_name || "unknown";
          let nokHistory = {};
          try {
            const historyResult = await customerbasedshift(customerId, COMMON_KEY);
            nokHistory = historyResult[0]?.value || {};
          } catch {
            nokHistory = {};
          }
          const newRecord = {
            ts: completedTime,
            machine_name: card.device_name || "-",
            operator_name: card.operator_name || "-",
            reason,
            remark: remark || "-",
            rejection_data: rejectionData,
            shift: selectedShift,
          };
          const componentHistory = nokHistory[componentName] || [];
          nokHistory[componentName] = [newRecord, ...componentHistory].slice(0, 5);
          await shiftadd(
            { [COMMON_KEY]: nokHistory, lastUpdateTs: Date.now() },
            customerId,
            "SERVER_SCOPE"
          );
        } catch (historyError) {
          console.error("Failed to save NOK history:", historyError);
        }
      }
      const formattedDate = dayjs(selectedDate).format("YYYY-MM-DD");
      console.log(formattedDate);
      let rejectcall = getReportGenerate(formattedDate);
      console.log("reject call", rejectcall);

      const todayStr = dayjs().format("YYYY-MM-DD");
      const selectedDateStr = dayjs(selectedDate).format("YYYY-MM-DD");
      const currentShift = getCurrentShift(shifts);
      const isToday = selectedDateStr === todayStr;
      const isCurrentShift = String(selectedShift) === String(currentShift);
      const isLiveShift = isToday && isCurrentShift;

      handleLoginAndFetch(card.device_name,
        formattedDate,
        selectedShift,
        isLiveShift ? "true" : "false")
      try {
        const REQUEST_KEY = "request_payload";
        let existingRequests = [];
        try {
          const existing = await customerbasedshift(customerId, REQUEST_KEY);
          const val = existing[0]?.value;
          existingRequests = Array.isArray(val) ? val : [];
        } catch {
          existingRequests = [];
        }
        const updatedRequests = existingRequests.filter(
          (r) => r.clicked_ts !== card.clicked_ts
        );
        await shiftadd(
          { [REQUEST_KEY]: updatedRequests, lastUpdateTs: Date.now() },
          customerId,
          "SERVER_SCOPE"
        );
      } catch (err) {
        console.error("Failed to update request_payload:", err);
      }
    } catch (error) {
      console.error("Telemetry send failed:", error);
    }
    setTimeout(() => navigate("/bluecard"), 3000);
  };
  if (!card) {
    return (
      <div style={{ textAlign: "center", marginTop: 60, color: "#64748b", fontSize: 18 }}>
        No Data Available
      </div>
    );
  }

  return (
    <div style={{ padding: "30px 0px", minHeight: "100vh", backgroundColor: "#ffffff" }}>
      <header className="bcd-header">
        <div className="bcd-header-meta">
          <span>
            Date: <strong>{selectedDate?.format("DD MMM YYYY")}</strong>
          </span>          <span>Shift: <strong>{shift ?? "-"}</strong></span>
        </div>

        <h1 className="bcd-header-title">Quality Check Board</h1>

        <button className="bcd-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </header>

      <main className="bcd-content">
        <div className="bcd-info-grid">
          {[
            { label: "Machine Name", value: card.device_name },
            { label: "Component Name", value: card.job_name, code: card.code },
            { label: "Operator Name", value: card.operator_name || "-" },
          ].map(({ label, value, code }) => (
            <div key={label} className="bcd-info-card">
              <div className="bcd-info-card-body">
                <span className="bcd-info-label">{label}</span>
                <span className="bcd-info-value" title={value}>
                  {value}
                  {label === "Component Name" && code && (
                    <span className="bcd-info-subvalue">{code}</span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="bcd-time-row">
          <div className="bcd-time-card">
            <span className="bcd-time-label">Start Time</span>
            <span className="bcd-time-value">{formatTime(card.clicked_ts)}</span>
          </div>

          <div className="bcd-time-card duration">
            <span className="bcd-time-label">Duration</span>
            <span className="bcd-time-value">{duration}</span>
          </div>

          <div className="bcd-time-card">
            <span className="bcd-time-label">End Time</span>
            <span className="bcd-time-value">{formatTime(endTime)}</span>
          </div>
        </div>

        {status === "NOK" && reason && (
          <div className="bcd-reason-row">
            <div className="bcd-reason-card">
              <span className="bcd-reason-label">NOK Reason</span>
              <span className="bcd-reason-value">
                {Array.isArray(reason) ? reason.join(", ") : reason}
              </span>            </div>
            {remark && (
              <div className="bcd-reason-card">
                <span className="bcd-reason-label">Remark</span>
                <span className="bcd-reason-value">{remark}</span>
              </div>
            )}
          </div>
        )}

        <div className="bcd-action-area">
          <span className="bcd-action-title">Quality Verdict</span>
          <div className="bcd-verdict-row">
            <button
              className={`bcd-verdict-btn bcd-ok-btn${status === "OK" ? " active" : ""}`}
              onClick={() => { setStatus("OK"); setReason([]); setRemark(""); }}
            >
              <span style={{ fontSize: 26 }}>✔</span> OK
            </button>

            <button
              className={`bcd-verdict-btn bcd-nok-btn${status === "NOK" ? " active" : ""}`}
              onClick={() => { setStatus("NOK"); setRejectionData([{ reason: [], remark: "" }]); setShowNokPopup(true); }}
            >
              <span style={{ fontSize: 26 }}>✘</span> NOK
            </button>
          </div>
          <button
            className={`bcd-complete-btn${canComplete ? " enabled" : ""}`}
            disabled={!canComplete}
            onClick={handleComplete}
          >
            ✓ &nbsp; Mark as Completed
          </button>
        </div>
      </main>

      {showNokPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 680,
              backgroundColor: "#fff",
              borderRadius: "12px",
              padding: "32px 28px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h4 style={{ marginBottom: "20px", fontWeight: 500, fontSize: "1.25rem" }}>
              Select NOK Reason
            </h4>

            {rejectionData.map((row, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
                  <InputLabel>Reason *</InputLabel>
                  <Select
                    multiple
                    value={row.reason}
                    onChange={(e) => {
                      const value = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                      const updated = rejectionData.map((r, i) =>
                        i === idx ? { ...r, reason: value } : r
                      );
                      setRejectionData(updated);
                    }}
                    label="Reason *"
                    renderValue={(selected) => selected.join(", ")}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 5 * 46,
                          overflowY: "auto",
                        },
                      },
                    }}
                  >
                    {(qualityReasonList || []).map((item, i) => {
                      const reasonText = typeof item === "string" ? item : item?.reason;
                      return (
                        <MenuItem key={i} value={reasonText} sx={{ padding: "4px 8px" }}>
                          <Checkbox checked={row.reason.includes(reasonText)} size="small" sx={{ padding: "4px" }} />
                          <ListItemText primary={reasonText} />
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                <input
                  placeholder="Remark"
                  value={row.remark}
                  onChange={(e) => {
                    const updated = rejectionData.map((r, i) =>
                      i === idx ? { ...r, remark: e.target.value } : r
                    );
                    setRejectionData(updated);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    padding: "8px 10px",
                    fontSize: "0.9rem",
                    fontFamily: "inherit",
                    height: 40,
                    boxSizing: "border-box",
                  }}
                />

                {rejectionData.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => setRejectionData(rejectionData.filter((_, i) => i !== idx))}
                    sx={{ color: "#EC6E17", flexShrink: 0, p: "4px" }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                )}
                {rejectionData.length === 1 && <span style={{ width: 32 }} />}
              </div>
            ))}

            <button
              onClick={() => setRejectionData([...rejectionData, { reason: [], remark: "" }])}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                padding: "3px 10px",
                borderRadius: 4,
                border: "1px solid #EC6E17",
                color: "#EC6E17",
                backgroundColor: "transparent",
                cursor: "pointer",
                fontSize: "0.9rem",
                marginBottom: 20,
                marginTop: 2,
                alignSelf: "flex-start",
              }}
            >
              + Add Row
            </button>

            <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
              <button
                onClick={() => {
                  setStatus(null);
                  setReason([]);
                  setRemark("");
                  setRejectionData([{ reason: [], remark: "" }]);
                  setShowNokPopup(false);
                }}
                style={{
                  padding: "8px 20px",
                  borderRadius: 4,
                  border: "1px solid #888",
                  backgroundColor: "#787b81",
                  color: "#fff",
                  fontWeight: "500",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                disabled={!rejectionData.some(r => r.reason?.length > 0)}
                onClick={() => {
                  const reasons = rejectionData.flatMap(r => r.reason).filter(Boolean);
                  const remarks = rejectionData.map(r => r.remark).filter(Boolean).join(", ");
                  setReason(reasons);
                  setRemark(remarks);
                  setShowNokPopup(false);
                }}
                style={{
                  padding: "10px 40px",
                  borderRadius: 4,
                  border: "none",
                  backgroundColor: !rejectionData.some(r => r.reason?.length > 0) ? "#f0d0a0" : "#EC6E17",
                  color: "white",
                  fontWeight: "500",
                  fontSize: "16px",
                  cursor: !rejectionData.some(r => r.reason?.length > 0) ? "not-allowed" : "pointer",
                  opacity: !rejectionData.some(r => r.reason?.length > 0) ? 0.6 : 1,
                }}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BluecardDetails;
