import React, { useEffect, useState } from "react";
import { customerbasedshift, } from "../../Services/app/companyservice";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { cleanCustomerId } from "../../Services/app/masterservice";

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
  if (selectedShift === "all") {
    const sorted = [...shifts].sort(
      (a, b) => Number(a.shift_no) - Number(b.shift_no)
    );
    return {
      from: getEpoch(sorted[0].start_day, sorted[0].start_time),
      to: getEpoch(
        sorted[sorted.length - 1].end_day,
        sorted[sorted.length - 1].end_time
      ),
    };
  }
  const shift = shifts.find(
    (s) => String(s.shift_no) === String(selectedShift)
  );
  if (!shift) return { from: null, to: null };
  return {
    from: getEpoch(shift.start_day, shift.start_time),
    to: getEpoch(shift.end_day, shift.end_time),
  };
}

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
      if (
        currentMinutes >= fromMinutes &&
        currentMinutes < toMinutes
      ) {
        return String(s.shift_no);
      }
    }
    else {
      if (
        currentMinutes >= fromMinutes ||
        currentMinutes < toMinutes
      ) {
        return String(s.shift_no);
      }
    }
  }

  return null;
}

export default function BlueCard() {
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [requestItems, setRequestItems] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [warningModal, setWarningModal] = useState(null);
  const [nokHistory, setNokHistory] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [isBeforeFirstShift, setIsBeforeFirstShift] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const CustomerId = localStorage.getItem('CustomerID');
  const customerId = cleanCustomerId(CustomerId);
  const navigate = useNavigate();
  console.log('customer id ', customerId)
  const fetchRequestPayload = async () => {
    try {
      const result = await customerbasedshift(customerId, "request_payload");
      const val = result[0]?.value;
      setRequestItems(Array.isArray(val) ? val : []);
    } catch {
      setRequestItems([]);
    }
  };

  const fetchNokHistory = async () => {
    try {
      const result = await customerbasedshift(customerId, "bluecard_nok_history");
      setNokHistory(result[0]?.value || {});
    } catch {
      setNokHistory({});
    }
  };

  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, "allShift");
      const data = result[0]?.value || [];
      setShifts(data);
    } catch (err) {
      console.error("Shift fetch error:", err);
    }
  };

  useEffect(() => {
    if (!customerId) return;
    fetchShifts();
    fetchNokHistory();
    fetchRequestPayload();
    const interval = setInterval(fetchRequestPayload, 10000);
    return () => clearInterval(interval);
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
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatWaitingTime = (startTs) => {
    const diff = now - startTs;
    const totalSeconds = Math.floor(diff / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const formatTs = (ts) =>
    ts ? new Date(ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "-";

  const formatReason = (val) => {
    if (!val) return "-";
    if (Array.isArray(val)) {
      return val.map(v => String(v).trim()).filter(Boolean).join(", ");
    }
    if (typeof val === "string") {
      return val.split(",").map(s => s.trim()).filter(Boolean).join(", ");
    }
    return "-";
  };

  return (
    <div style={{ padding: "20px 0px", minHeight: "100vh", backgroundColor: "#fcfeff" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 28px",
          background: "#f0f0f0",
        }}
      >
        <div style={{ color: "rgba(13, 12, 12, 0.96)", fontSize: "16px", fontWeight: 500 }}>
          Date: {selectedDate.format("DD MMM YYYY")}
        </div>
        <div style={{ color: "#0c0c0c", fontSize: "20px", fontWeight: 600, letterSpacing: "0.3px" }}>
          Blue Card Dashboard
        </div>
        <div style={{ color: "rgba(10, 10, 10, 0.92)", fontSize: "16px", fontWeight: 500 }}>
          Shift&nbsp;:&nbsp;{selectedShift || "–"}
        </div>
      </div>

      {(() => {
        const nokCount = requestItems?.filter((i) => (nokHistory[i.job_name] || []).length > 0).length;
        const noNokCount = requestItems.length - nokCount;
        const filters = [
          { key: "all", label: "Total Requests", value: requestItems.length, color: "#1d4ed8", activeColor: "#1d4ed8", activeBg: "#eff6ff", activeBorder: "#1d4ed8", inactiveBorder: "#1d4ed8" },
          { key: "nok", label: "Components with NOK History", value: nokCount, color: "#b91c1c", activeColor: "#b91c1c", activeBg: "#fef2f2", activeBorder: "#ef4444", inactiveBorder: "#ea7a7a" },
          { key: "no_nok", label: "Components with OK History", value: noNokCount, color: "#15803d", activeColor: "#15803d", activeBg: "#f0fdf4", activeBorder: "#22c55e", inactiveBorder: "#2be36f" },
        ];
        return (
          <div style={{ display: "flex", gap: "12px", padding: "16px 28px 0", flexWrap: "wrap" }}>
            {filters.map((f) => {
              const isActive = activeFilter === f.key;
              return (
                <div
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  style={{
                    flex: "1", minWidth: "140px", textAlign: "center",
                    padding: "12px 18px", borderRadius: "10px", cursor: "pointer",
                    background: isActive ? f.activeBg : "#ffffff",
                    border: `2px solid ${isActive ? f.activeBorder : f.inactiveBorder}`,
                    boxShadow: isActive ? `0 0 0 3px ${f.activeBorder}22` : "none",
                    transition: "all 0.18s ease",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px", fontWeight: 500 }}>{f.label}</div>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: isActive ? f.activeColor : "#374151" }}>{f.value}</div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Card grid ── */}
      {(() => {
        const filteredItems =
          activeFilter === "nok" ? requestItems?.filter((i) => (nokHistory[i.job_name] || []).length > 0) :
            activeFilter === "no_nok" ? requestItems?.filter((i) => (nokHistory[i.job_name] || []).length === 0) :
              requestItems;
        return (
          <div style={{ padding: "20px 28px" }}>
            {filteredItems.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "55vh",
                  gap: "12px",
                  color: "#9ca3af",
                }}
              >
                <div style={{ fontSize: "20px", fontWeight: 600 }}>No requests</div>
                <div style={{ fontSize: "14px" }}>
                  {activeFilter === "nok" ? "No components with NOK history." :
                    activeFilter === "no_nok" ? "No components without NOK history." :
                      "No Blue Card Records"}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "20px",
                }}
              >
                {filteredItems.map((item, index) => {
                  const nokEntries = nokHistory[item.job_name] || [];
                  const hasNok = nokEntries.length > 0;

                  return (
                    <div
                      key={index}
                      style={{
                        borderRadius: "16px",
                        background: "#ffffff",
                        boxShadow: hasNok
                          ? "0 4px 20px rgba(185,28,28,0.15)"
                          : "0 4px 16px rgba(37,99,235,0.10)",
                        border: hasNok ? "2px solid #fca5a5" : "2px solid transparent",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        transition: "all 0.25s ease",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        navigate("/bluecarddetails", {
                          state: { bluecardData: item, selectedShift },
                        })
                      }
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow = hasNok
                          ? "0 10px 28px rgba(185,28,28,0.22)"
                          : "0 10px 28px rgba(37,99,235,0.18)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = hasNok
                          ? "0 4px 20px rgba(185,28,28,0.15)"
                          : "0 4px 16px rgba(37,99,235,0.10)";
                      }}
                    >
                      <div
                        style={{
                          height: "5px",
                          background: hasNok ? "#ef4444" : "#22c55e",
                        }}
                      />

                      <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>

                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "3px" }}>
                              Machine
                            </div>
                            <div style={{ fontSize: "20px", fontWeight: 600, color: "#111827", letterSpacing: "-0.3px" }}>
                              {item.device_name || "–"}
                            </div>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "#757677" }}>
                              Route Card No : {item.route_card_no || "–"}
                            </div>
                          </div>

                          {hasNok ? (
                            <button
                              title={`⚠ ${nokEntries.length} previous NOK record(s) for this component – click to view`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setWarningModal({ componentName: item.job_name, machineName: item.device_name, entries: nokEntries });
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                                background: "#fef2f2",
                                border: "1.5px solid #fca5a5",
                                borderRadius: "999px",
                                padding: "4px 10px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "#b91c1c",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                              }}
                            >
                              ⚠ {nokEntries.length} NOK
                            </button>
                          ) : (
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                background: "#f0fdf4",
                                border: "1.5px solid #86efac",
                                borderRadius: "999px",
                                padding: "4px 10px",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "#15803d",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                              }}
                            >
                              ✓ No NOK
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: "10px",
                            padding: "10px 14px",
                          }}
                        >
                          <div style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>
                            Component
                          </div>
                          <div style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b", wordBreak: "break-word", overflowWrap: "anywhere", whiteSpace: "normal", }}>
                            {item.job_name || <span style={{ color: "#cbd5e1", fontStyle: "italic" }}>Route card not assigned</span>}
                          </div>
                        </div>
                        {item.operator_name && (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{
                              width: "28px", height: "28px", borderRadius: "50%",
                              background: "#dbeafe", display: "flex", alignItems: "center",
                              justifyContent: "center", fontSize: "14px", flexShrink: 0,
                            }}>
                              👤
                            </div>
                            <div>
                              <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 500 }}>Operator</div>
                              <div style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>{item.operator_name}</div>
                            </div>
                          </div>
                        )}

                        {/* Waiting timer */}
                        <div style={{
                          marginTop: "auto",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "linear-gradient(135deg,#eff6ff,#dbeafe)",
                          borderRadius: "10px",
                          padding: "10px 14px",
                        }}>
                          <div style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>⏱ Waiting Time</div>
                          <div style={{ fontSize: "14px", fontWeight: 800, color: "#1d4ed8", fontVariantNumeric: "tabular-nums" }}>
                            {formatWaitingTime(item.clicked_ts)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Warning Modal ── */}
      {warningModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setWarningModal(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              style={{
                background: "linear-gradient(135deg,#ef4444,#b91c1c)",
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  ⚠ Previous NOK History
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff", marginTop: "2px" }}>
                  {warningModal.componentName}
                </div>
                <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", marginTop: "2px" }}>
                  Machine: {warningModal.machineName}
                </div>
              </div>
              <button
                onClick={() => setWarningModal(null)}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  color: "#fff",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  fontSize: "18px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "16px 24px 8px", color: "#6b7280", fontSize: "13px" }}>
              Showing last <strong style={{ color: "#b91c1c" }}>{warningModal.entries.length} NOK rejection{warningModal.entries.length > 1 ? "s" : ""}</strong> for this component.
            </div>

            {/* NOK entry list */}
            <div style={{ overflowY: "auto", padding: "8px 24px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {warningModal.entries.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #fecaca",
                    borderLeft: "4px solid #ef4444",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    background: "#fef2f2",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#991b1b" }}>
                      NOK Record {i + 1}
                    </span>
                    <span style={{ fontSize: "11px", color: "#b91c1c", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "999px", padding: "2px 8px", fontWeight: 700 }}>
                      NOK
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px 16px",
                      fontSize: "13px",
                      color: "#374151",
                    }}
                  >
                    {/* Left column */}
                    <div><span style={{ color: "#6b7280" }}>Machine: </span><strong>{entry.machine_name || "–"}</strong></div>
                    <div><span style={{ color: "#6b7280" }}>Route Card No: </span><strong>{entry.route_card_no || "No Route Card No"}</strong></div>

                    <div><span style={{ color: "#6b7280" }}>Operator: </span><strong>{entry.operator_name || "No Operator"}</strong></div>
                    <div><span style={{ color: "#6b7280" }}>Shift: </span><strong>{entry.shift || "–"}</strong></div>

                    {/* Right column */}
                    <div><span style={{ color: "#6b7280" }}>Rejected at: </span><strong>{formatTs(entry.ts)}</strong></div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Reason: </span>
                      <strong style={{ color: "#b91c1c" }}>{formatReason(entry.reason) || "No Reason"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Remark: </span>
                      <strong>{entry.remark && entry.remark !== "-" ? entry.remark : "–"}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
