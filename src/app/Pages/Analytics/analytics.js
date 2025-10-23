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
  const [selectedDevice, setSelectedDevice] = useState("all");


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
      const shiftList = result[0]?.value || [];
      setShifts(shiftList);
    } catch (err) {
      console.error("Failed to fetch shifts", err);
    }
  };
  console.log('Shifts', shifts)

  // Fetch devices
  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];
      setDevices(devicesList);

      const nameIdMap = devicesList.reduce((acc, device) => {
        acc[device.name] = device.id.id;
        return acc;
      }, {});
      setDeviceNameIdJson(nameIdMap);

      // ✅ Set default to "all" → all device IDs
      const allDeviceIds = devicesList.map((d) => d.id.id);
      setSelectedDevice(allDeviceIds);
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
  const [latestOperations, setLatestOperations] = useState({});

  useEffect(() => {
    const fetchAllOperations = async () => {
      if (!from || !to || devices.length === 0) return;
      try {
        const allResults = [];

        for (const device of devices) {
          const data = await telemetrykeydata(
            device.id.id,
            "DEVICE",
            "operations",
            from,
            to
          );

          const values = data?.operations || [];

          const validValues = values
            .map((point) => {
              try {
                const parsed =
                  typeof point.value === "string"
                    ? JSON.parse(point.value)
                    : point.value;
                return { ts: Number(point.ts), ...parsed };
              } catch {
                return null;
              }
            })
            .filter((v) => v && v.operation_name && v.ts);

          allResults.push(...validValues);
        }

        const grouped = allResults.reduce((acc, item) => {
          const key = item.operation_name;
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {});

        const latestByOperation = Object.keys(grouped).map((opName) =>
          grouped[opName].reduce((a, b) => (a.ts > b.ts ? a : b))
        );

        const resultObj = latestByOperation.reduce((acc, item) => {
          acc[item.operation_name] = item;
          return acc;
        }, {});

        setLatestOperations(resultObj);
      } catch (err) {
        console.error("Error fetching operations:", err);
        setLatestOperations({});
      }
    };

    fetchAllOperations();
  }, [devices, from, to]);

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

  const handleMachineChange = (event) => {
    const value = event.target.value;
    if (value === "all") {
      // select all device IDs
      setSelectedDevice(devices.map((m) => m.id.id));
    } else {
      setSelectedDevice(value);
    }
  };



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
            navigate("/component", { state: { from, to, selectedDevice } });
          } else if (r.title === "Completed Work Cycle Times") {
            navigate("/cycletime", { state: { from, to, selectedDevice } });
          } else if (r.title === "Completed Work OEE") {
            navigate("/analyticoee", { state: { from, to ,selectedDevice} });
          } else if (r.title === "In-Progress Cycle Times") {
            navigate("/inprogresscycle", { state: { from, to ,selectedDevice} });
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
