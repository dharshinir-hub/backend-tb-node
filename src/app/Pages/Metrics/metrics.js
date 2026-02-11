import React, { useEffect, useState } from "react";
import { customerbaseddevices, customerbasedshift, telemetrykeydata, telemetrylatestdata } from "../../Services/app/operatorservice";
import FilterListIcon from "@mui/icons-material/FilterList";

const GroupCard = ({ name, active, total, performance, target, actual, actualColor, targetColor, color, selected, onClick, icon,
}) => {
    const percentage =
        target > 0
            ? Math.min((actual / target) * 100, 100)
            : 0;
    return (
        <div
            onClick={onClick}
            style={{
                cursor: "pointer",
                background: "#fff",
                borderRadius: "14px",
                padding: "16px",
                border: selected ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                boxShadow: selected
                    ? "0 6px 16px rgba(59,130,246,0.25)"
                    : "0 2px 6px rgba(0,0,0,0.08)",
                position: "relative",
                transition: "all 0.2s ease",
            }}
        >
            {selected && (
                <div
                    style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        fontSize: "10px",
                        fontWeight: 700,
                        background: "#3b82f6",
                        color: "#fff",
                        border: "1px solid #3b82f6",
                        borderRadius: "10px",
                        padding: "2px 8px",
                    }}
                >
                    SELECTED
                </div>
            )}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div>
                    <div style={{ fontSize: "16px", fontWeight: 600 }}>
                        {name}
                    </div>
                    <div style={{ fontSize: "14px", color: "#6b7280" }}>
                        {active}/{total} Machines Active
                    </div>
                </div>

                <div style={{ fontSize: "20px", color: "#6b7280" }}>
                    {icon}
                </div>
            </div>
            <div
                style={{
                    marginTop: "14px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#6b7280",
                }}
            >
                PERFORMANCE
            </div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "4px",
                }}
            >
                <div style={{ fontSize: "22px", fontWeight: 700 }}>
                    {performance}
                </div>
                <div
                    style={{
                        fontSize: "14px",
                        color: "#6b7280",
                        textAlign: "right",
                    }}
                >
                    Target vs Actual
                    <br />
                    <b>
                        <span style={{ color: targetColor }}>
                            {target}
                        </span>{" "}
                        /{" "}
                        <span style={{ color: actualColor }}>
                            {actual}
                        </span>
                    </b>
                </div>
            </div>
            <div
                style={{
                    marginTop: "10px",
                    height: "6px",
                    background: "#f1f5f9",
                    borderRadius: "6px",
                }}
            >
                <div
                    style={{
                        width: `${percentage}%`,
                        height: "100%",
                        background: actualColor,
                        borderRadius: "6px",
                        transition: "width 0.3s ease",
                    }}
                />
            </div>
        </div>
    );
};


const StatusBadge = ({ status }) => {
    const statusColors = {
        Running: "#22c55e",
        Idle: "#eab308",
        Alarm: "#ef4444",
        Disconnect: "#9ca3af",
        Locked: "#a855f7",
    };
    const color = statusColors[status] || "#9ca3af";
    return (
        <span
            style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: "12px",
                backgroundColor: color + "33",
                color,
                fontSize: "14px",
                fontWeight: 600,
            }}
        >
            {status}
        </span>
    );
};


const ProgressBar = ({ actual, target }) => {
    const percentage =
        target > 0
            ? Math.min((actual / target) * 100, 100)
            : 0;
    return (
        <div
            style={{
                background: "#f1f1f1",
                borderRadius: "6px",
                height: "8px",
                width: "100%",
            }}
        >
            <div
                style={{
                    width: `${percentage}%`,
                    background: "#22c55e",
                    height: "100%",
                    borderRadius: "6px",
                }}
            ></div>
        </div>
    );
};


const OEEBar = ({ value }) => {
    return (
        <div style={{ background: "#f1f1f1", borderRadius: "6px", height: "8px", width: "60px" }}>
            <div
                style={{
                    width: `${value}%`,
                    background: "#22c55e",
                    height: "100%",
                    borderRadius: "6px",
                }}
            ></div>
        </div>
    );
};

export default function Metrics() {
    const [dateTime, setDateTime] = useState(new Date());
    const [shifts, setShifts] = useState([]);
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);
    const [shiftNo, setShiftNo] = useState(null);
    const [groups, setGroups] = useState("");
    const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [telemetryData, setTelemetryData] = useState([]);
    const [devices, setDevices] = useState([]);
    const [statusFilter, setStatusFilter] = useState({
        Idle: true,
        Running: true,
        Disconnected: true,
        Alarm: true,
    });

    const [performanceSort, setPerformanceSort] = useState(null); // "asc" | "desc"
    const [oeeSort, setOeeSort] = useState(null); // "asc" | "desc"
    const [openFilter, setOpenFilter] = useState(null);

    const customerId = localStorage.getItem("CustomerID");

    useEffect(() => {
        const timer = setInterval(() => {
            setDateTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

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
            console.log("Device Name → ID Map:", nameIdMap);
        } catch (err) {
            console.error("Failed to fetch devices", err);
        }
    };

    const fetchShifts = async () => {
        try {
            const result = await customerbasedshift(customerId, "allShift");
            const result1 = await customerbasedshift(customerId, "machinegroups");
            setGroups(result1[0]?.value || []);
            setShifts(result[0]?.value || []);
        } catch (err) {
            console.error("Failed to fetch shifts", err);
        }
    };

    useEffect(() => {
        fetchShifts();
        fetchDevices();
    }, []);

    const calculateCurrentShift = (shifts) => {
        const now = Date.now();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (const shift of shifts) {
            const [sh, sm, ss] = shift.start_time.split(":").map(Number);
            const [eh, em, es] = shift.end_time.split(":").map(Number);
            const fromDate = new Date(today);
            if (shift.start_day === "2") {
                fromDate.setDate(fromDate.getDate() + 1);
            }
            fromDate.setHours(sh, sm, ss);
            const toDate = new Date(today);
            if (shift.end_day === "2") {
                toDate.setDate(toDate.getDate() + 1);
            }
            toDate.setHours(eh, em, es);

            const fromEpoch = fromDate.getTime();
            const toEpoch = toDate.getTime();

            if (now >= fromEpoch && now < toEpoch) {
                return {
                    from: fromEpoch,
                    to: toEpoch,
                    shiftNo: shift.shift_no,
                };
            }
        }
        return null;
    };

    useEffect(() => {
        if (!shifts || shifts.length === 0) return;
        const currentShift = calculateCurrentShift(shifts);
        if (currentShift) {
            setFrom(currentShift.from);
            setTo(currentShift.to);
            setShiftNo(currentShift.shiftNo);
        }
    }, [shifts]);

    const isSingleCard = (telemetryData || []).length === 1;


    useEffect(() => {
        const fetchTelemetryData = async () => {
            if (!devices?.length || !groups?.length) return;
            const keys = [
                "machine_status",
                "totalparts",
                "targetparts",
                "operations",
            ];
            try {
                const machineTelemetry = await Promise.all(
                    devices.map(async (device) => {
                        const deviceId = device.id.id;
                        const machineName = device.name;
                        const data = await telemetrykeydata(
                            deviceId,
                            "DEVICE",
                            keys,
                            from,
                            to
                        );
                        const deviceTelemetry = {
                            deviceId,
                            machineName,
                            machine_status: null,
                            totalparts: 0,
                            targetparts: 0,
                            operations: 0,
                            performance: 0,
                        };

                        Object.entries(data || {}).forEach(([key, arr]) => {
                            // Always take 0th index value
                            let value = Array.isArray(arr) && arr.length > 0
                                ? arr[0].value
                                : null;

                            // Parse JSON fields
                            if (
                                (key === "totalparts" || key === "operations") &&
                                value
                            ) {
                                try {
                                    value = JSON.parse(value);
                                } catch {
                                    value = null;
                                }
                            }

                            // Convert numeric field safely
                            if (key === "targetparts") {
                                value = Number(value) || 0;
                            }

                            deviceTelemetry[key] = value;
                        });


                        const shots = deviceTelemetry.totalparts?.totalshots || 0;
                        const target = deviceTelemetry.targetparts || 0;
                        deviceTelemetry.performance =
                            target > 0
                                ? Number(((shots / target) * 100).toFixed(1))
                                : 0;
                        return deviceTelemetry;
                    })
                );
                const groupedData = groups.map(group => {
                    const machines = machineTelemetry.filter(machine =>
                        group.machines.includes(machine.machineName)
                    );
                    const totalMachines = machines.length;
                    const runningMachines = machines.filter(
                        m => String(m.machine_status) === "3"
                    ).length;
                    const totalshotsSum = machines.reduce(
                        (sum, m) =>
                            sum + (m.totalparts?.totalshots || 0),
                        0
                    );
                    const targetpartsSum = machines.reduce(
                        (sum, m) => sum + (m.targetparts || 0),
                        0
                    );
                    return {
                        ...group,
                        machines, // operations inside machine
                        statuscount: `${runningMachines}/${totalMachines}`,
                        totalshots: totalshotsSum,
                        targetparts: targetpartsSum,
                    };
                });
                setTelemetryData(groupedData);
                console.log("✅ Group-wise telemetry:", groupedData);
            } catch (err) {
                console.error("❌ Telemetry Fetch Failed", err);
            }
        };
        fetchTelemetryData();

        //    const interval = setInterval(() => {
        //     fetchTelemetryData();
        // }, 60 * 1000);

        // return () => clearInterval(interval);
    }, [JSON.stringify(shifts), from, to]);

    console.log('telemetry data', telemetryData);

    const groupCards = (telemetryData || []).map((g, index) => {
        const colors = ["#2563eb", "#f97316", "#ef4444", "#22c55e", "#8b5cf6"];
        const totalMachines = g.machines?.length || 0;
        const activeMachines = g.machines?.filter(
            m => String(m.machine_status) === "3"
        ).length || 0;
        const actual = g.totalshots || 0;
        const target = g.targetparts || 0;
        const performance =
            target > 0
                ? `${((actual / target) * 100).toFixed(1)}%`
                : "0%";
        const targetColor = "#9ca3af";
        let actualColor = "#9ca3af";

        if (actual > 0 && target > 0) {
            actualColor = actual < target
                ? "#ef4444"
                : "#22c55e";
        }

        return {
            id: g.id,
            name: g.name,
            machines: g.machines || [],
            owner: g.owner,
            total: totalMachines,
            active: activeMachines,
            performance,
            target,
            actual,
            targetColor,
            actualColor,
            color: colors[index % colors.length],
        };
    });



    console.log('from', from, 'to', to);
    console.log('shifts', shifts);
    console.log('machine groups', groups)

    useEffect(() => {
        if (groupCards.length > 0) {
            setSelectedGroup(groupCards[0].name);
        }
    }, [telemetryData]);

    const getStatusLabel = (status) => {
        const map = {
            0: "Idle",
            1: "Idle",
            2: "Idle",
            3: "Running",
            5: "Alarm",
            6: "Locked",
            100: "Disconnect",
        };

        return map[status] || "Unknown";
    };

    const selectedGroupData = telemetryData?.find(
        g => g.name === selectedGroup
    );
    const tableMachines = selectedGroupData?.machines || [];

    const toggleStatus = (status) => {
        setStatusFilter(prev => ({
            ...prev,
            [status]: !prev[status],
        }));
    };


    const processedMachines = [...tableMachines]
        .filter(machine => {
            const status = getStatusLabel(machine.machine_status);
            return statusFilter[status];
        })
        .sort((a, b) => {
            const perfA = Number(a.performance || 0);
            const perfB = Number(b.performance || 0);

            const oeeA = Number(a.operations?.oee || 0);
            const oeeB = Number(b.operations?.oee || 0);

            if (performanceSort) {
                return performanceSort === "asc"
                    ? perfA - perfB
                    : perfB - perfA;
            }

            if (oeeSort) {
                return oeeSort === "asc"
                    ? oeeA - oeeB
                    : oeeB - oeeA;
            }

            const priority = {
                Idle: 1,
                Disconnect: 2,
                Alarm: 3,
                Running: 4,
            };

            const statusA = getStatusLabel(a.machine_status);
            const statusB = getStatusLabel(b.machine_status);

            return (priority[statusA] || 99) -
                (priority[statusB] || 99);
        });

    const FilterIcon = ({ onClick }) => (
        <span
            onClick={onClick}
            style={{
                marginLeft: 6,
                cursor: "pointer",
                fontSize: 12,
            }}
        >
            🔽
        </span>
    );
    const menuStyle = {
        position: "absolute",
        top: "36px",
        right: 0,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        padding: "10px 12px",
        minWidth: "170px",
        zIndex: 10,
    };


    const menuItemRow = {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 14px",
        fontSize: "14px",
        cursor: "pointer",
    };

    const sortItem = {
        padding: "10px 14px",
        fontSize: "14px",
        cursor: "pointer",
    };



    console.log('selected group', selectedGroup)

    return (
        <div style={{ backgroundColor: "#f6f4f4", minHeight: "100vh", width: "100%" }}>
            <div style={{ padding: "40px 32px 22px", backgroundColor: "#fff", marginBottom: "20px" }}>
                <h4 style={{ margin: 0, fontWeight: 600 }}>Production Metrics</h4>
                <div style={{ marginTop: "6px", fontSize: "13px", color: "#09090a" }}>
                    Shift {shiftNo} {" \u00B7 "}
                    {dateTime.toLocaleDateString("en-US", {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                    })}
                    {" \u00B7 "}
                    {dateTime.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                    })}
                </div>
            </div>
            {groupCards.length === 0 ? (
                <div
                    style={{
                        padding: "90px 32px",
                        textAlign: "center",
                        fontSize: "14px",
                        color: "#6b7280",
                    }}
                >
                    Loading Data...
                </div>
            ) : (
                <div
                    style={{
                        padding: "0px 32px",
                        display: "grid",
                        gridTemplateColumns: isSingleCard
                            ? "minmax(260px, 420px)"
                            : "repeat(auto-fit, minmax(260px, 1fr))",
                        gap: "16px",
                        justifyContent: isSingleCard ? "left" : "stretch",
                    }}
                >
                    {groupCards.map((g) => (
                        <GroupCard
                            key={g.name}
                            {...g}
                            selected={selectedGroup === g.name}
                            onClick={() => setSelectedGroup(g.name)}
                        />
                    ))}
                </div>
            )}

            {selectedGroup && (
                <div
                    style={{
                        padding: "20px",
                        borderRadius: "14px",
                        background: "#fff",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        margin: "20px 26px 34px 26px",
                        border: "2px solid rgb(238, 240, 241)",
                        minHeight: "400px",
                    }}
                >
                    {(() => {
                        const statusCounts = tableMachines.reduce(
                            (acc, m) => {
                                const status = getStatusLabel(m.machine_status);
                                if (status === "Idle") acc.idle++;
                                else if (status === "Alarm") acc.alarm++;
                                else if (status === "Disconnect") acc.disconnect++;
                                else if (status === "Running") acc.running++;
                                return acc;
                            },
                            { idle: 0, alarm: 0, disconnect: 0, running: 0 }
                        );

                        const badgeStyle = (bgColor) => ({
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            backgroundColor: bgColor + "33",
                            color: bgColor,
                            fontSize: "16px",
                            fontWeight: 600,
                            marginLeft: "6px",
                        });

                        return (
                            <h4
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginTop: "0px",
                                    marginBottom: "20px",
                                    fontWeight: 600,
                                    fontSize: "16px",
                                }}
                            >
                                <span>{selectedGroup} Details</span>
                                <span style={{ fontWeight: 400, display: "flex", gap: "10px" }}>
                                    <span style={badgeStyle("#facc15")}>Idle: {statusCounts.idle}</span>
                                    <span style={badgeStyle("#6b7280")}>Disconnect: {statusCounts.disconnect}</span>
                                    <span style={badgeStyle("#ef4444")}>Alarm: {statusCounts.alarm}</span>
                                    <span style={badgeStyle("#22c55e")}>Running: {statusCounts.running}</span>
                                </span>
                            </h4>
                        );
                    })()}

                    <div
                        style={{
                            minHeight: "400px",
                            maxHeight: "400px", // vertical scroll
                            overflowY: "auto",
                            overflowX: "auto",
                        }}
                    >
                        {tableMachines.length === 0 ? (
                            <div
                                style={{
                                    padding: "150px",
                                    textAlign: "center",
                                    fontSize: "14px",
                                    color: "#6b7280",
                                }}
                            >
                                Loading Machines...
                            </div>
                        ) : (


                            <table style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                minWidth: "700px",
                            }}
                            >
                                <thead
                                    style={{
                                        position: "sticky",
                                        top: 0,
                                        background: "#fff",
                                        zIndex: 1,
                                    }}
                                >
                                    <tr style={{ textAlign: "left", borderBottom: "2px solid #e5e7eb", fontSize: "16px", }}>

                                        <th style={{ padding: "12px" }}>Machine</th>

                                        {/* STATUS */}
                                        <th style={{ padding: "12px", position: "relative" }}>
                                            Status
                                            <FilterListIcon
                                                style={{ fontSize: 18, cursor: "pointer", marginLeft: 6 }}
                                                onClick={() =>
                                                    setOpenFilter(openFilter === "status" ? null : "status")
                                                }
                                            />

                                            {openFilter === "status" && (
                                                <div style={menuStyle}>
                                                    {["Running", "Idle", "Disconnected", "Alarm"].map(s => (
                                                        <label
                                                            key={s}
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "8px",
                                                                padding: "6px 2px",
                                                                cursor: "pointer",
                                                                fontSize: "14px",
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={statusFilter[s]}
                                                                onChange={() => toggleStatus(s)}
                                                            />
                                                            {s}
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </th>


                                        <th style={{ padding: "12px" }}>Current Part</th>
                                        <th style={{ padding: "12px" }}>Target / Actual</th>

                                        {/* PERFORMANCE */}
                                        <th style={{ padding: "12px", position: "relative" }}>
                                            Performance
                                            <FilterListIcon
                                                style={{ fontSize: 18, cursor: "pointer", marginLeft: 6 }}
                                                onClick={() =>
                                                    setOpenFilter(openFilter === "performance" ? null : "performance")
                                                }
                                            />

                                            {openFilter === "performance" && (
                                                <div style={menuStyle}>
                                                    {[
                                                        { label: "Low → High", value: "asc" },
                                                        { label: "High → Low", value: "desc" },
                                                        { label: "Default", value: null },
                                                    ].map(opt => (
                                                        <div
                                                            key={opt.label}
                                                            onClick={() => setPerformanceSort(opt.value)}
                                                            style={{
                                                                padding: "6px",
                                                                cursor: "pointer",
                                                                fontSize: "14px",
                                                                borderRadius: "6px",
                                                                background:
                                                                    performanceSort === opt.value ? "#f3f4f6" : "transparent",
                                                                fontWeight:
                                                                    performanceSort === opt.value ? 600 : "normal",
                                                            }}
                                                        >
                                                            {opt.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </th>


                                        {/* OEE */}
                                        <th style={{ padding: "12px", position: "relative" }}>
                                            OEE %
                                            <FilterListIcon
                                                style={{ fontSize: 18, cursor: "pointer", marginLeft: 6 }}
                                                onClick={() =>
                                                    setOpenFilter(openFilter === "oee" ? null : "oee")
                                                }
                                            />

                                            {openFilter === "oee" && (
                                                <div style={menuStyle}>
                                                    {[
                                                        { label: "Low → High", value: "asc" },
                                                        { label: "High → Low", value: "desc" },
                                                        { label: "Default", value: null },
                                                    ].map(opt => (
                                                        <div
                                                            key={opt.label}
                                                            onClick={() => setOeeSort(opt.value)}
                                                            style={{
                                                                padding: "6px",
                                                                cursor: "pointer",
                                                                fontSize: "14px",
                                                                borderRadius: "6px",
                                                                background:
                                                                    oeeSort === opt.value ? "#f3f4f6" : "transparent",
                                                                fontWeight: oeeSort === opt.value ? 600 : "normal",
                                                            }}
                                                        >
                                                            {opt.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </th>


                                    </tr>
                                </thead>


                                <tbody>
                                    {processedMachines.map((machine, i) => {
                                        const operationName =
                                            machine.operations?.operation_name || "-";

                                        const actual =
                                            machine.totalparts?.goodparts || 0;

                                        const target = machine.targetparts || 0;

                                        const performance =
                                            machine.performance
                                                ? `${machine.performance}%`
                                                : "0%";

                                        const oee = machine.operations?.oee || 0;

                                        return (
                                            <tr
                                                key={i}
                                                style={{
                                                    borderBottom: "1px solid #e5e7eb",
                                                    fontSize: "14px",
                                                }}
                                            >
                                                <td style={{ padding: "12px" }}>
                                                    <div>{machine.machineName}</div>
                                                </td>

                                                <td style={{ padding: "12px" }}>
                                                    <StatusBadge
                                                        status={getStatusLabel(machine.machine_status)}
                                                    />
                                                </td>

                                                <td style={{ padding: "12px" }}>{operationName}</td>

                                                <td style={{ padding: "12px", width: "180px" }}>
                                                    <div
                                                        style={{
                                                            fontSize: "12px",
                                                            marginBottom: "4px",
                                                        }}
                                                    >
                                                        {target} / {actual}
                                                    </div>
                                                    <ProgressBar target={target} actual={actual} />
                                                </td>

                                                <td
                                                    style={{
                                                        fontSize: "14px",
                                                        padding: "12px",
                                                        color: "#22c55e",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {performance}
                                                </td>

                                                <td style={{ padding: "12px" }}>
                                                    <span>{oee}%</span>
                                                    <OEEBar value={oee} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>

                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

}
