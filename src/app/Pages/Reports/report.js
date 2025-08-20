import React, { useState } from "react";
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tabs,
  Tab,
  Box,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";

export default function MachineReport() {
  const [selectedTab, setSelectedTab] = useState("oee");
  const [selectedModule, setSelectedModule] = useState("SURIN");
  const [selectedMachine, setSelectedMachine] = useState("SURIN-FourStar_HDT2470");
  const [selectedShift, setSelectedShift] = useState("1");
  const [startDate, setStartDate] = useState(dayjs());
  const [endDate, setEndDate] = useState(dayjs());
  const [reportData, setReportData] = useState([]);

  const handleSubmit = () => {
    // Dummy data for now (replace with API call)
    const data = [
      {
        sno: 1,
        date: startDate.format("DD-MM-YYYY"),
        shift: selectedShift,
        machineName: selectedMachine,
        availability: 14.03,
        performance: 0,
        quality: 0,
        oee: 0,
      },
    ];
    setReportData(data);
  };

  return (
<Box sx={{ p: 2, background: "#fffefeff", color: "#0a0a0aff", minHeight: "100vh", paddingTop: "50px" }}>
      {/* Tabs */}
      <Tabs
        value={selectedTab}
        onChange={(e, v) => setSelectedTab(v)}
        textColor="inherit"
        indicatorColor="secondary"
      >
        <Tab label="General Report" value="general" />
        <Tab label="OEE Report" value="oee" />
        <Tab label="Idle Reason Report" value="idle" />
        <Tab label="Part Wise Report" value="part" />
      </Tabs>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", my: 3,  }}>
        <FormControl size="small" sx={{ background: "#fff", minWidth: 160 }}>
          <InputLabel>Module</InputLabel>
          <Select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
          >
            <MenuItem value="SURIN">SURIN</MenuItem>
            <MenuItem value="MODULE2">MODULE 2</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ background: "#fff", minWidth: 200 }}>
          <InputLabel>Machine</InputLabel>
          <Select
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
          >
            <MenuItem value="SURIN-FourStar_HDT2470">SURIN-FourStar_HDT2470</MenuItem>
            <MenuItem value="MACHINE2">MACHINE 2</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ background: "#fff", minWidth: 160 }}>
          <InputLabel>Shift</InputLabel>
          <Select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
          >
            <MenuItem value="1">Shift 1</MenuItem>
            <MenuItem value="2">Shift 2</MenuItem>
          </Select>
        </FormControl>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="Start Date"
            value={startDate}
            onChange={(newValue) => setStartDate(newValue)}
            format="DD-MM-YYYY"
            slotProps={{
              textField: {
                size: "small",
                style: { background: "#fff", minWidth: 160 },
              },
            }}
          />
        </LocalizationProvider>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="End Date"
            value={endDate}
            onChange={(newValue) => setEndDate(newValue)}
            format="DD-MM-YYYY"
            slotProps={{
              textField: {
                size: "small",
                style: { background: "#fff", minWidth: 160 },
              },
            }}
          />
        </LocalizationProvider>

        <Button
          variant="contained"
          color="warning"
          onClick={handleSubmit}
          sx={{ minWidth: 120 }}
        >
          Submit
        </Button>
      </Box>

      {/* Action Buttons */}
      {reportData.length > 0 && (
        <Box sx={{ mb: 2, display: "flex", gap: 2 }}>
          <Button variant="contained" color="warning">
            View Chart
          </Button>
          <Button variant="contained" color="warning">
            Export
          </Button>
        </Box>
      )}

      {/* Report Table */}
      {reportData.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f47803ff" }}>
            <tr>
              <th style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px',color: ' #fff' }}>S.no</th>
              <th style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px',color: ' #fff' }}>Date</th>
              <th style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px' ,color: ' #fff' }}>Shift</th>
              <th style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px',color: ' #fff' }}>Machine Name</th>
              <th style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px',color: ' #fff' }}>Availability(%)</th>
              <th style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px',color: ' #fff' }}>Performance(%)</th>
              <th style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px',color: ' #fff' }}>Quality(%)</th>
              <th style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px',color: ' #fff' }}>OEE(%)</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, index) => (
              <tr key={index}>
                <td style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px' }}>{row.sno}</td>
                <td style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px'}}>{row.date}</td>
                <td style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px'}}>{row.shift}</td>
                <td style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px'}}>{row.machineName}</td>
                <td style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px'}}>{row.availability}</td>
                <td style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px'}}>{row.performance}</td>
                <td style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px'}}>{row.quality}</td>
                <td style={{ border: "1px solid #555", padding: "8px" , fontSize: '18px'}}>{row.oee}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Box>
  );
}
