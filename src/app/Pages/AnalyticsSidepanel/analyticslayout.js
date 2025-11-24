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
  Grid, CircularProgress
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

  // highestComponent = codeWiseSummary data

  const getPercentValue = (item) =>
    Number(item.percentage.replace("%", "")) || 0;

  // 1️⃣ Remove unwanted values
  const cleanedData = highComponent.filter(item =>
    item.operation_name !== "No Operations" &&
    item.code !== "0"
  );

  // 2️⃣ Sort by percentage descending
  const sortedData = [...cleanedData].sort(
    (a, b) => getPercentValue(b) - getPercentValue(a)
  );

  // 3️⃣ Top 5 and Last 5
  const topList = sortedData.slice(0, 5);
  const belowList = sortedData.slice(-5);


  console.log("Top List:", topList);
  console.log("Below List:", belowList);



  const Id = localStorage.getItem("CustomerID");
  let customerId = decodeURIComponent(Id || "").replace(/^"|"$/g, "");
  const newToken = localStorage.getItem("newToken");

return (
  <div
    style={{
      width: "350px",
      background: "#f4f7fb",
      borderRight: "1px solid #e0e0e0",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      height: "100vh",
      boxShadow: "2px 0 6px rgba(0,0,0,0.05)",
    }}
  >

    {/* 🔍 Search Bar */}
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ position: "relative", width: "100%" }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search Component..."
          style={{
            width: "100%",
            padding: "10px 40px 10px 14px",
            borderRadius: "8px",
            border: "1px solid #d0d0d0",
            fontSize: "14px",
            outline: "none",
            background: "#ffffff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
          }}
        />

        {/* Clear Icon */}
        {searchTerm && (
          <span
            onClick={() => setSearchTerm("")}
            style={{
              position: "absolute",
              right: "40px",
              top: "50%",
              transform: "translateY(-50%)",
              cursor: "pointer",
              color: "#888",
            }}
          >
            <ClearIcon fontSize="small" />
          </span>
        )}

        {/* Search Icon */}
        <span
          style={{
            position: "absolute",
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#777",
            fontSize: "18px",
          }}
        >
          <IoMdSearch style={{ fontSize: "20px" }} />
        </span>
      </div>
    </div>

    {/* 📘 TOP 5 HEADER */}
    <div style={{ marginBottom: "1rem" }}>
      <div
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "#222",
        }}
      >
        Top 5 Performed Components
      </div>
      <div style={{ fontSize: "13px", color: "#666" }}>
        Completed runs listed by highest
      </div>
    </div>

    {/* 🧩 LIST SECTION */}
    <div>

      {loading ? (
        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <CircularProgress />
          <Typography sx={{ mt: 1 }}>Loading...</Typography>
        </div>
      ) : topList.length > 0 || belowList.length > 0 ? (
        <>

          {/* ⭐ TOP LIST CARDS */}
          {topList.map((item, index) => (
            <div
              key={`top-${index}`}
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e0e0e0",
                boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
                padding: "14px 16px",
                marginBottom: "14px",
                transition: "0.2s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.02)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              <div style={{ fontSize: "16px", fontWeight: 600, color: "#222" }}>
                {item.operation_name}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "#555",
                  marginTop: "4px",
                }}
              >
                <span>Code: {item.code}</span>
                <span>Occurrence: {item.occurrence}</span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                <span style={{ color: "#2d9a08" }}>
                  Total Parts: {item.totalNumerator}
                  <br />
                  <span style={{ color: "#555" }}>
                    ({item.percentage})
                  </span>
                </span>

                <span style={{ color: "#555" }}>
                  Target: {item.totalDenominator}
                  <br />
                  (100%)
                </span>
              </div>
            </div>
          ))}

          {/* 🔽 LEAST 5 HEADER */}
          <div style={{ marginTop: "1.5rem", marginBottom: "0.8rem" }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#222" }}>
              Least 5 Performed Components
            </div>
            <div style={{ fontSize: "13px", color: "#666" }}>
              Listed next priority based on occurrence
            </div>
          </div>

          {/* 🔻 BELOW LIST CARDS */}
          {belowList.map((item, index) => (
            <div
              key={`below-${index}`}
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e0e0e0",
                padding: "14px 16px",
                marginBottom: "14px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
                transition: "0.2s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.02)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              <div style={{ fontSize: "16px", fontWeight: 600, color: "#222" }}>
                {item.operation_name}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "#555",
                  marginTop: "4px",
                }}
              >
                <span>Code: {item.code}</span>
                <span>Occurrence: {item.occurrence}</span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                <span style={{ color: "#d91c1c" }}>
                  Total Parts: {item.totalNumerator}
                  <br />
                  <span style={{ color: "#555" }}>
                    ({item.percentage})
                  </span>
                </span>

                <span style={{ color: "#555" }}>
                  Target: {item.totalDenominator}
                  <br />
                  (100%)
                </span>
              </div>
            </div>
          ))}

        </>
      ) : (
        <div style={{ fontSize: "14px", color: "#777", textAlign: "center" }}>
          No components found
        </div>
      )}
    </div>
  </div>
);

}
