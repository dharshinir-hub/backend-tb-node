
import {
  Box,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Card,
  CardContent,
  Grid,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import React, { useEffect, useState } from "react";
import {
  telemetrykeydata,
  customerbaseddevices,
  customerbasedshift
} from "../../Services/app/companyservice";
import { IoMdSearch } from "react-icons/io";


export function SidebarPanel({
  partNumber,
  setPartNumber,
  reportType,
  setReportType,
  formatDuration,
  from,
  to,
}) {


  const Id = localStorage.getItem("CustomerID");
  let customerId = decodeURIComponent(Id || "");
  customerId = customerId.replace(/^"|"$/g, "");
  const newToken = localStorage.getItem("newToken");

  const [oeeVsBaseline, setOeeVsBaseline] = useState([]);
  useEffect(() => {
    const fetchOeeVsBaseline = async () => {
      if (!from || !to) return;
      try {
        const data = await telemetrykeydata(
          customerId,
          "CUSTOMER",
          "oeevsbaseline",
          from,
          to
        );
        const values = data?.oeevsbaseline || [];
        const validValues = values
          .map((point) => {
            try {
              const parsed =
                typeof point.value === "string"
                  ? JSON.parse(point.value)
                  : point.value;
              return { ts: point.ts, ...parsed };
            } catch {
              return null;
            }
          })
          .filter((v) => v && v.start_time && v.end_time);
        setOeeVsBaseline(validValues);
      } catch {
        setOeeVsBaseline([]);
      }
    };
    fetchOeeVsBaseline();
  }, [customerId, from, to]);



  const [partTimeVsExp, setPartTimeVsExp] = useState([]);
  useEffect(() => {
    const fetchPartTimeVsExp = async () => {
      if (!from || !to) return;
      try {
        const data = await telemetrykeydata(
          customerId,
          "CUSTOMER",
          "parttimevsexp",
          from,
          to
        );
        const values = data?.parttimevsexp || [];
        const validValues = values
          .map((point) => {
            try {
              const parsed =
                typeof point.value === "string"
                  ? JSON.parse(point.value)
                  : point.value;
              return { ts: point.ts, ...parsed };
            } catch {
              return null;
            }
          })
          .filter((v) => v && v.start_time && v.end_time);
        setPartTimeVsExp(validValues);
      } catch {
        setPartTimeVsExp([]);
      }
    };
    fetchPartTimeVsExp();
  }, [customerId, from, to]);

  return (
    <div
      style={{
        width: "280px",
        background: "#f2f6fd",
        borderRight: "1px solid #e0e0e0",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        height: "100vh",
        boxShadow: "2px 0 6px rgba(0,0,0,0.05)",
        position: "relative",
        paddingTop: "30px"
      }}
    >
      {/* 🔍 Search Bar */}
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center" }}>
        <div style={{ position: "relative", width: "100%" }}>
          <input
            type="text"
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
            placeholder="Search Part"
            style={{
              width: "100%",
              padding: "8px 35px 8px 12px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "14px",
              outline: "none",
            }}
          />
          {partNumber && (
            <span
              onClick={() => setPartNumber("")}
              style={{
                position: "absolute",
                right: "32px",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
                fontSize: "14px",
                color: "#888",
              }}
            >
            </span>
          )}
          <span
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              cursor: "pointer",
              fontSize: "15px",
              color: "#666",
            }}
          >
            <IoMdSearch style={{ fontSize: "20px", color: "#908f8fff", marginRight: "8px" }} />

          </span>
        </div>
      </div>

      {/* 📊 Report Type Selector */}
      <select
        value={reportType}
        onChange={(e) => setReportType(e.target.value)}
        style={{
          padding: "8px 10px",
          borderRadius: "6px",
          border: "1px solid #ccc",
          background: "#fff",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        <option value="Part Time vs Expected">Part Time vs Expected</option>
        <option value="OEE Vs Baseline">OEE Vs Baseline</option>
      </select>

      {/* 📘 Summary Section */}
      <div style={{ marginTop: "1rem" }}>
        <div
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "#111",
            marginBottom: "2px",
            paddingTop: '0'
          }}
        >
          Summary
        </div>
        <div style={{ fontSize: "13px", color: "#666" }}>
          Completed runs listed by latest
        </div>
      </div>

      {/* 🧩 Report Cards */}
      {/* <div
        style={{
          marginTop: "1.2rem",
          display: "grid",
          gap: "12px",
        }}
      >
        {reportType === "Part Time vs Expected"
          ? (partTimeVsExp || []).map((item, index) => {
            const start = new Date(item.start_time);
            const end = new Date(item.end_time);
            const runSeconds = item.run_duration
              ? Math.floor(item.run_duration)
              : Math.floor((item.end_time - item.start_time) / 1000);
            const runDuration = formatDuration(runSeconds);
            const expSeconds = Math.floor(item.exp_duration || 0);
            const diffSeconds = expSeconds - runSeconds;
            const diffFormatted = formatDuration(Math.abs(diffSeconds));

            return (
              <div
                key={index}
                style={{
                  background: "#fff",
                  borderRadius: "10px",
                  border: "2px solid #e5e0e0ff",
                  padding: "10px 12px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  transition: "transform 0.2s ease",
                }}
              // onMouseEnter={(e) =>
              //   (e.currentTarget.style.transform = "scale(1.02)")
              // }
              // onMouseLeave={(e) =>
              //   (e.currentTarget.style.transform = "scale(1)")
              // }
              >
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#222",
                  }}
                >
                  {item.component_name}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    color: "#3a3838ff",
                  }}
                >
                  <span>{start.toLocaleString()}</span>
                  <span>{end.toLocaleString()}</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginTop: "4px",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "20px",
                      fontWeight: 600,
                      color: "#111",
                    }}
                  >
                    {runDuration}
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color:
                        diffSeconds > 0 ? "#008000" : "#e53935",
                    }}
                  >
                    {diffSeconds > 0
                      ? `+${diffFormatted}`
                      : `-${diffFormatted}`}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "#f3f3f3",
                      borderRadius: "6px",
                      padding: "3px 8px",
                      color: "#333",
                    }}
                  >
                    {item.device_name}
                  </span>
                </div>
              </div>
            );
          })
          : (oeeVsBaseline || []).map((item, index) => {
            const oee = Number(item.oee || 0).toFixed(1);
            const baseline = Number(item.oeebaseline || 0).toFixed(1);
            const diff = oee - baseline;

            return (
              <div
                key={index}
                style={{
                  background: "#fff",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  transition: "transform 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "scale(1.02)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#222",
                  }}
                >
                  {item.component_name}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    color: "#666",
                  }}
                >
                  <span>OEE: <b>{oee}%</b></span>
                  <span>Baseline: <b>{baseline}%</b></span>
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: diff >= 0 ? "#008000" : "#e53935",
                  }}
                >
                  {diff >= 0
                    ? `+${diff.toFixed(1)}%`
                    : `${diff.toFixed(1)}%`}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "#f3f3f3",
                      borderRadius: "6px",
                      padding: "3px 8px",
                      color: "#333",
                    }}
                  >
                    {item.device_name}
                  </span>
                </div>
              </div>
            );
          })}
      </div> */}
    </div>
  );

}
