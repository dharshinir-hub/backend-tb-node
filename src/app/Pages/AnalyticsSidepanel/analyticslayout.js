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
  Grid,CircularProgress
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import React, { useEffect, useState } from "react";
import {
  telemetrykeydata,
  customerbaseddevices,
  customerbasedshift,
} from "../../Services/app/companyservice";
import { IoMdSearch } from "react-icons/io";

export function SidebarPanel({
  reportType,
  setReportType,
  formatDuration,
  from,
  to,
  highestcomponent,
  loading
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const highComponent = highestcomponent || [];

  // 🔹 Filter valid + search + sort
  const filteredHighComponent = highComponent
    .filter(
      (item) =>
        item.operation_name?.toLowerCase() !== "no operations" &&
        item.code?.toLowerCase() !== "unknown" &&
        (item.operation_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code?.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => b.occurrence - a.occurrence)
    .slice(0, 5);
    console.log('Top 5 filtered list',filteredHighComponent)

  const Id = localStorage.getItem("CustomerID");
  let customerId = decodeURIComponent(Id || "").replace(/^"|"$/g, "");
  const newToken = localStorage.getItem("newToken");

  const [oeeVsBaseline, setOeeVsBaseline] = useState([]);
  const [partTimeVsExp, setPartTimeVsExp] = useState([]);

  // 🔹 Fetch OEE vs Baseline
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

  // 🔹 Fetch Part Time vs Expected
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
        width: "350px",
        background: "#f2f6fd",
        borderRight: "1px solid #e0e0e0",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        height: "100vh",
        boxShadow: "2px 0 6px rgba(0,0,0,0.05)",
        position: "relative",
        paddingTop: "30px",
      }}
    >
      {/* 🔍 Search Bar */}
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center" }}>
        <div style={{ position: "relative", width: "100%" }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Component..."
            style={{
              width: "100%",
              padding: "8px 35px 8px 12px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "14px",
              outline: "none",
            }}
          />

          {searchTerm && (
            <span
              onClick={() => setSearchTerm("")}
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
              <ClearIcon fontSize="small" />
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
            <IoMdSearch style={{ fontSize: "20px", color: "#908f8fff" }} />
          </span>
        </div>
      </div>

      {/* 📘 Summary Section */}
      <div style={{ marginTop: "1rem" }}>
        <div
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "#111",
            marginBottom: "2px",
            paddingTop: "2px",
          }}
        >
          Top 5 Performed Components
        </div>
        <div style={{ fontSize: "13px", color: "#666", paddingTop: "2px" }}>
          Completed runs listed by highest
        </div>
      </div>

      {/* 🧩 Component List */}
<div
  style={{
    marginTop: "1.2rem",
    display: "grid",
    gap: "12px",
  }}
>
  {loading ? (
    // 🔹 Loader Section
    <div style={{ textAlign: "center", marginTop: "1rem" }}>
      <CircularProgress />
      <Typography sx={{ mt: 2 }}>
        Loading...
      </Typography>
    </div>
  ) : filteredHighComponent.length > 0 ? (
    // 🔹 Data Section
    filteredHighComponent.map((item, index) => (
      <div
        key={index}
        style={{
          background: "#fff",
          borderRadius: "10px",
          border: "2px solid #d7d4d4ff",
          padding: "10px 12px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
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
            fontSize: "16px",
            fontWeight: 600,
            color: "#222",
          }}
        >
          {item.operation_name}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "#3a3838ff",
          }}
        >
          <span>Code: {item.code}</span>
          <span>Occurrence: {item.occurrence}</span>
        </div>

        <div
          style={{
            marginTop: "4px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#111",
          }}
        >
          Parts : {item.goodvsexp_numerator}
        </div>
      </div>
    ))
  ) : (
    // 🔹 No Data
    <div style={{ fontSize: "13px", color: "#777", textAlign: "center" }}>
      No components found
    </div>
  )}
</div>

    </div>
  );
}
