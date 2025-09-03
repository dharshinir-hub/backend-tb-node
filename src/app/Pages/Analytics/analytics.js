import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Button,
  Card,
  CardContent,
  Grid,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import {
  cleanCustomerId,
  telemetrylatestdata,
  customerbaseddevices,
  customerbasedshift,
  telemetrykeydata
} from '../../Services/app/companyservice';
import dayjs from "dayjs";


export default function ProductionAnalysis() {
  const [partNumber, setPartNumber] = useState("");
  const [reportType, setReportType] = useState("Part Time vs Expected");
  const [selectedReport, setSelectedReport] = useState("");
  const [machineGroup, setMachineGroup] = useState("CNC Group "); // default selected
  const [shifts, setShifts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
    
// Last 7 days in epoch milliseconds
const from = dayjs().subtract(6, "day").startOf("day").valueOf();
const to = dayjs().endOf("day").valueOf();

console.log("From:", from); // e.g. 1755369000000
console.log("To:", to);     // e.g. 1755993599999

const Id = localStorage.getItem("CustomerID");  // e.g. %22d276e510-3238-11f0-829a-733b0192d6b3%22
let customerId = decodeURIComponent(Id);        // → "d276e510-3238-11f0-829a-733b0192d6b3"
customerId = customerId.replace(/^"|"$/g, ""); 

  const newToken = localStorage.getItem("newToken");

  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, "allShift");
      const shiftList = result[0]?.value || [];
      setShifts(shiftList);
      console.log("Fetched Shifts:", shiftList);
    } catch (err) {
      console.error("Failed to fetch shifts", err);
    }
  };

  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];
      setDevices(devicesList);

      // Create name → id map
      const nameIdMap = devicesList.reduce((acc, device) => {
        acc[device.name] = device.id.id;
        return acc;
      }, {});

      setDeviceNameIdJson(nameIdMap);
      console.log("Device Name → ID Map:", nameIdMap);
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };

  useEffect(() => {
    if (customerId && newToken) {
      fetchShifts();
      fetchDevices();
    }
  }, [customerId, newToken]);




const [partTimeVsExp, setPartTimeVsExp] = useState({});

useEffect(() => {
  const fetchPartTimeVsExp = async () => {
    if (!from || !to) return;

    try {
      const data = await telemetrykeydata(
        customerId,          // 👈 use your customerId
        "CUSTOMER",          // ✅ get from CUSTOMER
        "parttimevsexp",
        from,
        to
      );

      const values = data?.parttimevsexp || [];
      if (!Array.isArray(values) || values.length === 0) {
        console.log("❌ No parttimevsexp data found");
        setPartTimeVsExp([]);
        return;
      }

      const validValues = values
        .map((point) => {
          try {
            const parsed =
              typeof point.value === "string"
                ? JSON.parse(point.value)
                : point.value;

            return {
              ts: point.ts,
              ...parsed, // keep all fields from JSON
            };
          } catch (err) {
            console.error("⚠️ Error parsing parttimevsexp", err);
            return null;
          }
        })
        .filter((v) => v && v.start_time && v.end_time); // ✅ only keep entries with both

      console.log("✅ Valid PartTimeVsExp Data:", validValues);
      setPartTimeVsExp(validValues);

    } catch (error) {
      console.error("❌ Error fetching parttimevsexp:", error);
      setPartTimeVsExp([]);
    }
  };

  fetchPartTimeVsExp();
}, [customerId, from, to]);


  const [oeeVsBaseline, setOeeVsBaseline] = useState([]);

//oee vs baseline

  // ✅ Fetch OeeVsBaseline
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
        if (!Array.isArray(values) || values.length === 0) {
          console.log("❌ No oeevsbaseline data found");
          setOeeVsBaseline([]);
          return;
        }

        const validValues = values
          .map((point) => {
            try {
              const parsed =
                typeof point.value === "string"
                  ? JSON.parse(point.value)
                  : point.value;

              return {
                ts: point.ts,
                ...parsed, // 👈 keep component_name, oee, oeebaseline, etc.
              };
            } catch (err) {
              console.error("⚠️ Error parsing oeevsbaseline", err);
              return null;
            }
          })
          .filter((v) => v && v.start_time && v.end_time);

        console.log("✅ Valid OeeVsBaseline Data:", validValues);
        setOeeVsBaseline(validValues);
      } catch (error) {
        console.error("❌ Error fetching oeevsbaseline:", error);
        setOeeVsBaseline([]);
      }
    };

    fetchOeeVsBaseline();
  }, [customerId, from, to]);





  const machineGroups = [
    "CNC Group "
   
  ];

  const reports = [
    {
      title: "Completed work Cycle Times",
      description:
        "Report comparing completed work cycle times to ERP standards and baseline.",
    },
    {
      title: "Completed work OEE",
      description:
        "A report showing OEE performance of completed work compared with baseline.",
    },
    {
      title: "In-Progress cycle Time",
      description:
        "A report showing work that is currently in progress.",
    },
    {
      title: "In-progress OEE",
      description:
        "A report showing work that is currently in progress.",
    },
    {
      title: "Part Operation History",
      description:
        "A summary of a part’s performance across all machines for quoting and cycle time standards.",
    },
  ];


function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return [
    h > 0 ? `${h}h` : "",
    m > 0 ? `${m}m` : "",
    s > 0 ? `${s}s` : "",
  ]
    .filter(Boolean) // remove empty values
    .join(" ");
}

 return (
    <Box display="flex" height="100vh" paddingTop="20px">
      {/* Sidebar */}
      <Box
        width="280px"
        bgcolor="#f2f9ff"
        borderRight="1px solid #e0e0e0"
        p={2}
        display="flex"
        flexDirection="column"
        overflow="auto"
      >
        {/* Part Number */}
        <Box display="flex" alignItems="center" mb={2}>
          <TextField
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
            size="small"
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {partNumber && (
                    <IconButton onClick={() => setPartNumber("")}>
                      <ClearIcon />
                    </IconButton>
                  )}
                  <IconButton>
                    <FilterListIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Dropdown */}
        <Select
          size="small"
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          fullWidth
        >
          <MenuItem value="Part Time vs Expected">Part Time vs Expected</MenuItem>
          <MenuItem value="OEE Vs Baseline">OEE Vs Baseline</MenuItem>
        </Select>

        {/* Summary */}
        <Box mt={4}>
          <Typography variant="h6" fontWeight="bold">
            Summary
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Completed runs listed by latest
          </Typography>
        </Box>

        {/* ✅ Charts Below Summary */}
        <Box mt={3}>
          {reportType === "Part Time vs Expected" ? (
            <Grid container spacing={2}>
              {(Array.isArray(partTimeVsExp) ? partTimeVsExp : []).map((item, index) => {
                const start = new Date(item.start_time);
                const end = new Date(item.end_time);

                // Run Duration
                const runSeconds = item.run_duration
                  ? Math.floor(item.run_duration)
                  : Math.floor((item.end_time - item.start_time) / 1000);
                const runDuration = formatDuration(runSeconds);

                // Expected Duration
                const expSeconds = Math.floor(item.exp_duration || 0);
                const expDuration = formatDuration(expSeconds);

                // Diff = expected - run
                const diffSeconds = expSeconds - runSeconds;
                const diffFormatted = formatDuration(Math.abs(diffSeconds));

                return (
                  <Grid item xs={12} key={index}>
                    <Card
                      variant="outlined"
                      sx={{
                        p: 1,
                        paddingLeft: 2,
                        bgcolor: "#fff",
                        "&:hover": { bgcolor: "#f9f9f9" },
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight="bold" fontStyle="Sans" fontSize='20px'>
                        {item.component_name}
                      </Typography>

                      <Box display="flex" justifyContent="space-between" alignItems="center" mt={1} color="black" >
                        <Typography variant="body2"  >
                          {start.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" >
                          {end.toLocaleString()}
                        </Typography>
                      </Box>

                      <Box display="flex" alignItems="center" mt={1}>
                        <Typography variant="body1" fontWeight="bold" mr={1} fontSize='24px'>
                          {runDuration}
                        </Typography>
                        <Typography
                          variant="body2 " fontSize='16px'
                          color={diffSeconds > 0 ? "success.main" : "error.main"}
                        >
                          {diffSeconds > 0 ? `+${diffFormatted}` : `-${diffFormatted}`}
                        </Typography>
                      </Box>

                      {/* Machine Name bottom-right */}
                      <Box display="flex" justifyContent="flex-end" mt={1}>
                        <Box
                          px={2}
                          py={0.5}
                          borderRadius="12px"
                          bgcolor="#f0f0f0"
                          display="inline-block"
                        >
                          <Typography variant="caption" fontWeight="bold">
                            {item.device_name}
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          ) : reportType === "OEE Vs Baseline" ? (
            <Grid container spacing={2}>
              {(Array.isArray(oeeVsBaseline) ? oeeVsBaseline : []).map((item, index) => {
                const oee = Number(item.oee || 0).toFixed(1);
                const baseline = Number(item.oeebaseline || 0).toFixed(1);
                      const start = Number(item.start_time || 0).toFixed(1);
                      const end = Number(item.end_time || 0).toFixed(1);



                // Diff = OEE - Baseline
                const diff = oee - baseline;

                return (
                  <Grid item xs={12} key={index}>
                    <Card
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: "#fff",
                        "&:hover": { bgcolor: "#f9f9f9" },
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight="bold">
                        {item.component_name}
                      </Typography>

                      

                      <Box display="flex" justifyContent="space-between" mt={1}>
                        <Typography variant="body2" color="textSecondary">
                          OEE: <b>{oee}%</b>
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Baseline: <b>{baseline}%</b>
                        </Typography>
                      </Box>

                      <Box display="flex" alignItems="center" mt={1}>
                        <Typography
                          variant="body2"
                          color={diff >= 0 ? "success.main" : "error.main"}
                          fontWeight="bold"
                        >
                          {diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`}
                        </Typography>
                      </Box>

                      {/* Machine Name bottom-right */}
                      <Box display="flex" justifyContent="flex-end" mt={1}>
                        <Box
                          px={2}
                          py={0.5}
                          borderRadius="12px"
                          bgcolor="#f0f0f0"
                          display="inline-block"
                        >
                          <Typography variant="caption" fontWeight="bold">
                            {item.device_name}
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Box textAlign="center">
              <Typography variant="body2" color="textSecondary">
                Choose a report or explore production runs
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Main Content */}
      <Box flex={1} p={3} overflow="auto" background="white">
        <Typography variant="h6" fontWeight="bold" mb={2} >
          Production Analysis
        </Typography>

        {/* Dropdown for Machine Groups */}
        <Select
          size="small"
          value={machineGroup}
          onChange={(e) => setMachineGroup(e.target.value)}
        >
          {machineGroups.map((group, index) => (
            <MenuItem key={index} value={group}>
              {group}
            </MenuItem>
          ))}
        </Select>

        {/* Reports Grid */}
        <Grid container spacing={2} mt={2}>
          {reports.map((report, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card
                variant="outlined"
                sx={{
                  cursor: "pointer",
                  "&:hover": { bgcolor: "#f9f9f9" },
                }}
              >
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {report.title}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {report.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}
