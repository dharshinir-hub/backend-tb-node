// analytics.js
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  MenuItem,
  Select,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  telemetrykeydata,
  customerbaseddevices,
  customerbasedshift
} from "../../Services/app/companyservice";
import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useNavigate } from "react-router-dom";
import { SidebarPanel } from "../../Pages/AnalyticsSidepanel/analyticslayout";

const Analytics = () => {
  const [partNumber, setPartNumber] = useState("");
  const [reportType, setReportType] = useState("Part Time vs Expected");
  const [shifts, setShifts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const [selectedDevice, setSelectedDevice] = useState([]);



  console.log('Selected Device Id', selectedDevice)

  const [startDate, setStartDate] = useState(dayjs().subtract(6, "day"));
  const [endDate, setEndDate] = useState(dayjs());




  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);

  const Id = localStorage.getItem("CustomerID");
  let customerId = decodeURIComponent(Id || "");
  customerId = customerId.replace(/^"|"$/g, "");
  const newToken = localStorage.getItem("newToken");


  useEffect(() => {
    if (from) {
      localStorage.setItem("analyticsStartDate", from);
    }
  }, [from]);

  useEffect(() => {
    if (to) {
      localStorage.setItem("analyticsEndDate", to);
    }
  }, [to]);


  console.log('From', from, 'to', to);

  // Fetch shifts
  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, "allShift");
      setShifts(result[0]?.value || []);
    } catch (err) {
      console.error("Failed to fetch shifts", err);
    }
  };

  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];
      setDevices(devicesList);
      const nameIdMap = devicesList.reduce((acc, device) => {
        acc[device.id.id] = device.name;
        return acc;
      }, {});
      setDeviceNameIdJson(nameIdMap);
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };


  useEffect(() => {
    fetchShifts();
    fetchDevices();
    console.log('fetching devices ---------------------')
  }, []);

  // Helper: combine a date + HH:mm:ss time → epoch
  const combineDateAndTime = (dateObj, timeStr, addDay = false) => {
    if (!dateObj || !timeStr) return null;
    const [h, m, s] = timeStr.split(":").map(Number);
    const combined = new Date(dateObj.year(), dateObj.month(), dateObj.date(), h, m, s);
    if (addDay) combined.setDate(combined.getDate() + 1);
    return combined.getTime();
  };

  // Update from/to whenever startDate, endDate, or shifts change
  useEffect(() => {
    if (shifts.length === 0) return;

    const firstShift = shifts[0];
    const lastShift = shifts[shifts.length - 1];
    const addDay = lastShift.end_time < lastShift.start_time;
    console.log('First Shift Start Time', firstShift);
    console.log('Last Shift End Time', lastShift);

    const newFrom = combineDateAndTime(startDate, firstShift.start_time);
    const newTo = combineDateAndTime(endDate, lastShift.end_time, addDay);

    setFrom(newFrom);
    setTo(newTo);
  }, [startDate, endDate, shifts]);


  //   useEffect(() => {
  //   if (devices.length > 0) {
  //     const allDeviceIds = devices.map((d) => d.id.id);
  //     setSelectedDevice(allDeviceIds);
  //   }
  // }, [devices]);

  // Fetch latest operations


  const reports = [
    {
      title: "Component",
      description: "Completed Component List.",
    },
    {
      title: "Completed Work Cycle Times",
      description:
        "Report comparing completed work cycle times to ERP standards and baseline.",
    },
    {
      title: "Completed Work OEE",
      description: "A report showing OEE performance of completed work compared with baseline.",
    },
    {
      title: "In-Progress Cycle Times",
      description: "A report showing work that is currently in progress.",
    },
    {
      title: "In-Progress OEE",
      description: "A report showing work that is currently in progress.",
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
    return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", s > 0 ? `${s}s` : ""]
      .filter(Boolean)
      .join(" ");
  }

  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedReportIndex, setSelectedReportIndex] = useState(null);
  const handleOpenPopover = (event, index) => {
    setAnchorEl(event.currentTarget);
    setSelectedReportIndex(index);
  };
  const handleClosePopover = () => setAnchorEl(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (devices && devices.length > 0) {
      // Set all device IDs when devices are loaded
      setSelectedDevice(devices.map((m) => m.id.id));
    }
  }, [devices]);

  const handleMachineChange = (event) => {
    const value = event.target.value;
    if (value.includes("all")) {
      // If user selects "All", select all device IDs
      setSelectedDevice(devices.map((m) => m.id.id));
    } else {
      setSelectedDevice(value);
    }
  };

  const parseTelemetryValues = (data, key) => {
    const values = data?.[key] || [];
    return values
      .map(point => {
        try {
          const parsed = typeof point.value === "string" ? JSON.parse(point.value) : point.value;
          return parsed && typeof parsed === "object" ? { ts: point.ts, ...parsed } : null;
        } catch {
          return null;
        }
      })
      .filter(v => v !== null);
  };

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");

  const [operationsData, setOperationsData] = useState([]);

  useEffect(() => {
    const fetchOperationsData = async () => {
      if (!from || !to || !selectedDevice) return;

      try {
        setLoading(true);
        setLoadingStage("Fetching data from all devices...");
        const deviceIds = Array.isArray(selectedDevice) ? selectedDevice : [selectedDevice];

        const allDataArray = await Promise.all(
          deviceIds.map(async (deviceId) => {
            const deviceName = deviceNameIdJson[deviceId] || "Unknown Device";

            const data = await telemetrykeydata(
              deviceId,
              "DEVICE",
              "operations",
              from,
              to
            );

            const parsedData = parseTelemetryValues(data, "operations");

            return { deviceName, parsedData };
          })
        );
        setLoadingStage("Processing data...");

        const allDataObject = allDataArray.reduce((acc, curr) => {
          acc[curr.deviceName] = curr.parsedData;
          return acc;
        }, {});

        setOperationsData(allDataObject);
      } catch (error) {
        console.error("Error fetching operations data:", error);
        setOperationsData({});
      } finally {
        setLoading(false);
        setLoadingStage("");
      }
    };

    fetchOperationsData();
  }, [selectedDevice, from, to, devices, shifts, ]);


  console.log('Operations Data', operationsData);

  const [groupedOperations, setGroupedOperations] = useState([]);
  const [finalGroup, setFinalGroup] = useState([]); // ✅ now an array

  useEffect(() => {
    if (!operationsData || Object.keys(operationsData).length === 0) return;

    const groupedData = Object.entries(operationsData).reduce((acc, [machineName, dataArray]) => {
      // Group by code
      const groupedByCode = dataArray.reduce((codeAcc, item) => {
        const code = item.code || "Unknown Code";
        if (!codeAcc[code]) codeAcc[code] = [];
        codeAcc[code].push(item);
        return codeAcc;
      }, {});

      // Group by start_time + end_time within each code
      const finalGroupForMachine = Object.entries(groupedByCode).flatMap(([code, items]) => {
        const groupedByTime = items.reduce((timeAcc, item) => {
          const start = item.start_time || "Unknown Start";
          const end = item.end_time || "Unknown End";
          const key = `${start}_${end}`;
          if (!timeAcc[key]) timeAcc[key] = [];
          timeAcc[key].push(item);
          return timeAcc;
        }, {});

        // ✅ Convert the grouped object into array format
        return Object.entries(groupedByTime).map(([key, timeItems]) => {
          const [start_time, end_time] = key.split("_");
          return { code, start_time, end_time, items: timeItems };
        });
      });

      acc[machineName] = finalGroupForMachine;
      return acc;
    }, {});

    // ✅ Flatten all machine data into one array (optional)
    const allFinalGroups = Object.values(groupedData).flat();



    setGroupedOperations(groupedData);
    setFinalGroup(allFinalGroups); // ✅ now array-based
  }, [operationsData]);

  console.log("✅ Grouped by code + time per machine:", groupedOperations);
  console.log("✅ Final group data (array format):", finalGroup);

  const getFirstItemsFromGroups = (finalGroupArray) => {
    if (!finalGroupArray || finalGroupArray.length === 0) return [];

    return finalGroupArray
      .map(group => group.items[0]) // pick first item of each group
      .filter(Boolean); // remove undefined/nulls if any
  };

  // Usage:
  const firstItems = getFirstItemsFromGroups(finalGroup);

  console.log("✅ First item from each group:", firstItems);

  // firstItems: array of items, each with a "code" property

  const sortItemsByCodeFrequencyDesc = (items) => {
    if (!items || items.length === 0) return [];

    // 1️⃣ Count occurrences of each code
    const codeCount = items.reduce((acc, item) => {
      const code = item.code || "Unknown";
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});

    // 2️⃣ Sort items by the frequency of their code (descending)
    return [...items].sort((a, b) => {
      const countA = codeCount[a.code] || 0;
      const countB = codeCount[b.code] || 0;
      return countB - countA; // descending
    });
  };

  // Usage:
  const sortedFirstItems = sortItemsByCodeFrequencyDesc(firstItems);

  console.log("✅ First items sorted by code frequency (desc):", sortedFirstItems);


  const groupByCodeSummary = (items) => {
    if (!items || items.length === 0) return [];

    // Step 1: Group items by code
    const codeGroups = items.reduce((acc, item) => {
      const code = item.code || "Unknown";
      if (!acc[code]) acc[code] = [];
      acc[code].push(item);
      return acc;
    }, {});

    // Step 2: Map each group to desired summary
    const summaryArray = Object.entries(codeGroups).map(([code, groupItems]) => {
      // Take the first operation_name (assuming same for all in group)
      const operation_name = groupItems[0]?.operation_name || "Unknown";

      // Count of items
      const occurrence = groupItems.length;

      // Sum the numerators of goodvsexp
      const numeratorSum = groupItems.reduce((sum, item) => {
        const [numerator] = (item.goodvsexp || "0/0").split("/").map(Number);
        return sum + (isNaN(numerator) ? 0 : numerator);
      }, 0);

      return {
        code,
        operation_name,
        occurrence,
        goodvsexp_numerator: numeratorSum
      };
    });

    return summaryArray;
  };

  // Usage:
  const codeWiseSummary = groupByCodeSummary(firstItems);

  console.log("✅ Analytics Code-wise summary:", codeWiseSummary);



  return (
    <Box display="flex" height="100vh" pt={2}>
      <SidebarPanel
        partNumber={partNumber}
        setPartNumber={setPartNumber}
        reportType={reportType}
        setReportType={setReportType}
        formatDuration={formatDuration}
        from={from}
        to={to}
        selectedDevice={selectedDevice}
        highestcomponent={codeWiseSummary}
        loading={loading}
      />

      <Box flex={1} p={3} bgcolor="#fff" overflow="auto">
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
          mb={2}
        >
          <Typography variant="h5" fontWeight="bold">
            Production Analysis
          </Typography>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box display="flex" flexWrap="wrap" alignItems="center" gap={2} sx={{ justifyContent: { xs: "flex-start", sm: "flex-end" }, flex: "1 1 auto" }}>
              <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 }, background: "#fff" }} variant="outlined">
                <InputLabel id="machines-label">Machines</InputLabel>
                <Select
                  labelId="machines-label"
                  value={selectedDevice.length === devices.length ? "all" : selectedDevice}
                  onChange={handleMachineChange}
                  label="Machines"
                >
                  <MenuItem value="all">All Machines</MenuItem>
                  {devices.map((d) => (
                    <MenuItem key={d.id.id} value={d.id.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </Select>


              </FormControl>

              {/* Start Date */}
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(nv) => nv && setStartDate(nv)}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: {
                      '& input': { fontSize: '0.9rem', padding: '4px 8px' },
                      '& .MuiInputBase-root': { height: '40px', width: { xs: '140px', sm: '150px' } },
                      '& .MuiSvgIcon-root': { fontSize: '1.2rem' },
                    },
                  },
                }}
              />

              {/* End Date */}
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(nv) => nv && setEndDate(nv)}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: {
                      '& input': { fontSize: '0.9rem', padding: '4px 8px' },
                      '& .MuiInputBase-root': { height: '40px', width: { xs: '140px', sm: '150px' } },
                      '& .MuiSvgIcon-root': { fontSize: '1.2rem' },
                    },
                  },
                }}
              />
            </Box>
          </LocalizationProvider>
        </Box>

        {/* Reports Grid */}
        <Grid container spacing={2} mt={2} alignItems="stretch">
          {reports.map((r, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card
                variant="outlined"
                sx={{
                  cursor: "pointer",
                  "&:hover": {
                    bgcolor: "#f8f5f5ff",
                    transform: "scale(1.03)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  },
                  height: "130px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  border: "1px solid rgba(197, 193, 193, 1)"

                }}
                onClick={() => {
                  if (r.title === "Component") {
                    navigate("/production-summary", { state: { from, to, selectedDevice, codeWiseSummary } });
                  } else if (r.title === "Completed Work Cycle Times") {
                    navigate("/cycletime", { state: { from, to, selectedDevice, codeWiseSummary } });
                  } else if (r.title === "Completed Work OEE") {
                    navigate("/analyticoee", { state: { from, to, selectedDevice, codeWiseSummary } });
                  } else if (r.title === "In-Progress Cycle Times") {
                    navigate("/inprogresscycle", { state: { from, to, selectedDevice, codeWiseSummary } });
                  } else if (r.title === "In-Progress OEE") {
                    navigate("/inprogressoee", { state: { from, to, selectedDevice, codeWiseSummary } });
                  }
                }}
              >
                <CardContent
                  sx={{
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    fontWeight="bold"
                    sx={{ "&:hover": { color: "primary.main" } }}
                  >
                    {r.title}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="textSecondary"
                    sx={{
                      mt: 0.5,
                      textAlign: "left",
                      flexGrow: 1,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {r.description}
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

export default Analytics;
