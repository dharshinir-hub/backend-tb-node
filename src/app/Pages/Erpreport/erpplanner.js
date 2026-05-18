import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { customerbaseddevices } from "../../Services/app/operatorservice";
import { getReportToken, createPlan, updatePlan, getAllPlans, deletePlan } from "../../Services/app/reportservice";
import Swal from "sweetalert2";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

// ── Defaults ─────────────────────────────────────────────────────
const emptyItem = () => ({
    Item: "",
    ItemRev: 0,
    ItemDesc: "",
    Cavity: 0,
    ProductionOrderNo: "",
    ProductionOrderQty: 0,
    PlanQty: "",
});

const emptyProcess = () => ({
    ProcessId: "",
    ProcessName: "",
});

const emptyDetail = () => ({
    MachineName: "",
    MachineId: "",
    MachineTag: "",
    ToolId: "",
    ToolName: "",
    ToolTag: "",
    CycleTimeHours: 0,
    CycleTimeMinutes: 0,
    CycleTimeSeconds: 0,
    Items: [emptyItem()],
    Processes: [emptyProcess()],
});

const defaultPlanForm = () => ({
    PlanNo: "",
    DocumentDate: dayjs().format("YYYY-MM-DD"),
    PlanDate: dayjs().format("YYYY-MM-DD"),
    UnitId: "",
    UnitDesc: "",
    ShiftId: "",
    ShiftDesc: "",
    Type: "",
});

// ── Helpers ───────────────────────────────────────────────────────
const d1 = (val, fallback = "1") => (val !== "" && val !== null && val !== undefined ? val : fallback);
const n1 = (val) => (parseInt(val) > 0 ? parseInt(val) : 1);
const n0 = (val) => parseInt(val) || 0;

// ── Map API plan → form state ─────────────────────────────────────
const mapPlanToForm = (plan) => ({
    PlanNo: plan.plan_no || "",
    DocumentDate: plan.document_date ? plan.document_date.split("T")[0] : dayjs().format("YYYY-MM-DD"),
    PlanDate: plan.plan_date || dayjs().format("YYYY-MM-DD"),
    UnitId: plan.unit_id || "",
    UnitDesc: plan.unit_desc || "",
    ShiftId: plan.shift_id || "",
    ShiftDesc: plan.shift_desc || "",
    Type: plan.type || "",
});

const mapDetailsToForm = (apiDetails = []) =>
    apiDetails.map((d) => ({
        MachineName: d.MachineDesc || "",
        MachineId: d.MachineId || "",
        MachineTag: d.MachineTag || "",
        ToolId: d.ToolId || "",
        ToolName: d.ToolName || "",
        ToolTag: d.ToolTag || "",
        CycleTimeHours: d.CycleTime?.Hours || 0,
        CycleTimeMinutes: d.CycleTime?.Minutes || 0,
        CycleTimeSeconds: d.CycleTime?.Seconds || 0,
        Items: (d.Item || []).length > 0
            ? (d.Item || []).map((item) => ({
                Item: item.Item || "",
                ItemRev: item.ItemRev ?? 0,
                ItemDesc: item.ItemDesc || "",
                Cavity: item.Cavity ?? 0,
                ProductionOrderNo: item.ProductionOrderNo || "",
                ProductionOrderQty: item.ProductionOrderQty ?? 0,
                PlanQty: item.PlanQty || "",
            }))
            : [emptyItem()],
        Processes: (d.Process || []).length > 0
            ? (d.Process || []).map((p) => ({
                ProcessId: p.ProcessId || "",
                ProcessName: p.ProcessName || "",
            }))
            : [emptyProcess()],
    }));

// ─────────────────────────────────────────────────────────────────
function ErpPlannerDialog({ open, onClose, onSave }) {
    const [view, setView] = useState("form");
    const [machines, setMachines] = useState([]);
    const [deviceNameIdJson, setDeviceNameIdJson] = useState({});

    const [planForm, setPlanForm] = useState(defaultPlanForm());
    const [details, setDetails] = useState([emptyDetail()]);
    const [submitting, setSubmitting] = useState(false);

    // ── Init ──────────────────────────────────────────────────────
    useEffect(() => {
        if (open) {
            fetchDevices();
            resetForm();
        }
    }, [open]);

    const fetchDevices = async () => {
        try {
            const customerId = localStorage.getItem("CustomerID");
            const result = await customerbaseddevices(customerId, 1000, 0);
            const devicesList = result.data || [];
            setMachines(devicesList.map((d) => d.name));
            const nameIdMap = devicesList.reduce((acc, device) => {
                acc[device.name] = device.id.id;
                return acc;
            }, {});
            setDeviceNameIdJson(nameIdMap);
        } catch (err) {
            console.error("Failed to fetch devices", err);
        }
    };

    const resetForm = () => {
        setPlanForm(defaultPlanForm());
        setDetails([emptyDetail()]);
        setView("form");
    };

    // ── Plan form handlers ────────────────────────────────────────
    const onPlanChange = (field, value) => setPlanForm((p) => ({ ...p, [field]: value }));

    // ── Detail handlers ───────────────────────────────────────────
    const onDetailChange = (dIdx, field, value) =>
        setDetails((prev) => prev.map((d, i) => (i === dIdx ? { ...d, [field]: value } : d)));

    const onDetailMachineChange = (dIdx, machineName) => {
        const machineId = deviceNameIdJson[machineName] || "";
        setDetails((prev) =>
            prev.map((d, i) =>
                i === dIdx ? { ...d, MachineName: machineName, MachineId: machineId, MachineTag: machineName } : d
            )
        );
    };

    const addDetail = () => setDetails((prev) => [...prev, emptyDetail()]);
    const removeDetail = (dIdx) => setDetails((prev) => prev.filter((_, i) => i !== dIdx));

    // ── Item handlers ─────────────────────────────────────────────
    const onItemChange = (dIdx, iIdx, field, value) =>
        setDetails((prev) =>
            prev.map((d, i) =>
                i !== dIdx ? d : {
                    ...d,
                    Items: d.Items.map((item, j) =>
                        j === iIdx ? { ...item, [field]: value } : item
                    ),
                }
            )
        );

    const addItem = (dIdx) =>
        setDetails((prev) =>
            prev.map((d, i) => i !== dIdx ? d : { ...d, Items: [...d.Items, emptyItem()] })
        );

    const removeItem = (dIdx, iIdx) =>
        setDetails((prev) =>
            prev.map((d, i) =>
                i !== dIdx ? d : { ...d, Items: d.Items.filter((_, j) => j !== iIdx) }
            )
        );

    // ── Process handlers ──────────────────────────────────────────
    const onProcessChange = (dIdx, pIdx, field, value) =>
        setDetails((prev) =>
            prev.map((d, i) =>
                i !== dIdx ? d : {
                    ...d,
                    Processes: d.Processes.map((p, j) => (j === pIdx ? { ...p, [field]: value } : p)),
                }
            )
        );

    const addProcess = (dIdx) =>
        setDetails((prev) =>
            prev.map((d, i) => i !== dIdx ? d : { ...d, Processes: [...d.Processes, emptyProcess()] })
        );

    const removeProcess = (dIdx, pIdx) =>
        setDetails((prev) =>
            prev.map((d, i) =>
                i !== dIdx ? d : { ...d, Processes: d.Processes.filter((_, j) => j !== pIdx) }
            )
        );

    // ── Build JSON ────────────────────────────────────────────────
    const buildJson = () => ({
        PlanNo: d1(planForm.PlanNo),
        PlanRev: 0,
        DocumentDate: planForm.DocumentDate + "T00:00:00Z",
        PlanDate: planForm.PlanDate,
        UnitId: d1(planForm.UnitId),
        UnitDesc: d1(planForm.UnitDesc),
        ShiftId: d1(planForm.ShiftId),
        ShiftDesc: d1(planForm.ShiftDesc),
        Type: d1(planForm.Type),
        Details: details.map((det, idx) => ({
            Line: idx + 1,
            MachineId: d1(det.MachineId),
            MachineDesc: d1(det.MachineName),
            MachineTag: d1(det.MachineName),
            ToolId: d1(det.ToolId),
            ToolName: d1(det.ToolName),
            ToolTag: d1(det.ToolTag),
            CycleTime: {
                Hours: n0(det.CycleTimeHours),
                Minutes: n0(det.CycleTimeMinutes),
                Seconds: n0(det.CycleTimeSeconds),
            },
            Item: det.Items.map((item, iIdx) => ({
                Line: iIdx + 1,
                Item: d1(item.Item),
                ItemRev: n0(item.ItemRev),
                ItemDesc: d1(item.ItemDesc),
                Cavity: n0(item.Cavity),
                ProductionOrderNo: d1(item.ProductionOrderNo),
                ProductionOrderQty: n0(item.ProductionOrderQty),
                PlanQty: n1(item.PlanQty),
            })),
            Process: det.Processes.map((p, pIdx) => ({
                Line: pIdx + 1,
                ProcessId: d1(p.ProcessId),
                ProcessName: d1(p.ProcessName),
            })),
        })),
    });

    // ── Save ──────────────────────────────────────────────────────
    const handleSave = async () => {
        const payload = buildJson();
        setSubmitting(true);
        try {
            await getReportToken("gd", "gd");
            await createPlan(payload);
            Swal.fire({
                icon: "success",
                title: "Plan Created",
                text: "Plan has been successfully submitted.",
                confirmButtonColor: "#f99022",
            }).then(() => {
                try {
                    onSave();
                    handleClose();
                } catch (err) {
                    console.error("Error after save:", err);
                    onClose();
                }
            });
        } catch (err) {
            console.error("Plan save failed:", err);
            Swal.fire({
                icon: "error",
                title: "Failed",
                text: err?.response?.data?.message || "Failed to save plan. Please try again.",
                confirmButtonColor: "#f99022",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        try {
            resetForm();
            onClose();
        } catch (err) {
            console.error("Error closing dialog:", err);
            onClose();
        }
    };

    // ─────────────────────────────────────────────────────────────
    const dialogContentStyle = {
        maxHeight: "calc(100vh - 250px)",
        overflowY: "auto",
        scrollbarWidth: "thin",
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ backgroundColor: "#f99022", color: "#fff", fontWeight: "bold" }}>
                Create New Plan
            </DialogTitle>
            <DialogContent sx={{ pt: 3, pb: 0, ...dialogContentStyle }}>
                {/* PLAN DETAILS */}
                <div style={{ marginBottom: "24px" }}>
                    <h4 style={{ margin: "16px 0 16px 0", color: "#f99022", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase" }}>Plan Details</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                        <div>
                            <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Plan No</label>
                            <input
                                type="text"
                                value={planForm.PlanNo}
                                onChange={(e) => onPlanChange("PlanNo", e.target.value)}
                                placeholder="e.g. 1000000049"
                                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Document Date</label>
                            <input
                                type="date"
                                value={planForm.DocumentDate}
                                readOnly
                                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", background: "#f5f5f5", cursor: "default", fontSize: "13px" }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Plan Date</label>
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <DatePicker
                                    value={planForm.PlanDate ? dayjs(planForm.PlanDate) : dayjs()}
                                    onChange={(val) => onPlanChange("PlanDate", val.format("YYYY-MM-DD"))}
                                    format="DD-MM-YYYY"
                                    maxDate={dayjs()}
                                    slotProps={{ textField: { fullWidth: true, size: "small" } }}
                                />
                            </LocalizationProvider>
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                        <div>
                            <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Unit ID</label>
                            <input
                                type="text"
                                value={planForm.UnitId}
                                onChange={(e) => onPlanChange("UnitId", e.target.value)}
                                placeholder="e.g. DCD"
                                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Unit Description</label>
                            <input
                                type="text"
                                value={planForm.UnitDesc}
                                onChange={(e) => onPlanChange("UnitDesc", e.target.value)}
                                placeholder="e.g. DIE CASTING DIVISION"
                                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Shift ID</label>
                            <input
                                type="text"
                                value={planForm.ShiftId}
                                onChange={(e) => onPlanChange("ShiftId", e.target.value)}
                                placeholder="e.g. 0001"
                                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                            />
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                        <div>
                            <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Shift Description</label>
                            <input
                                type="text"
                                value={planForm.ShiftDesc}
                                onChange={(e) => onPlanChange("ShiftDesc", e.target.value)}
                                placeholder="e.g. SHIFT 1"
                                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Type</label>
                            <select
                                value={planForm.Type}
                                onChange={(e) => onPlanChange("Type", e.target.value)}
                                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                            >
                                <option value="">-- Select Type --</option>
                                <option value="Die Casting">Die Casting</option>
                                <option value="Trimming">Trimming</option>
                                <option value="Machining">Machining</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* DETAILS */}
                <div style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <h4 style={{ margin: "0", color: "#f99022", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase" }}>Details</h4>
                        <button
                            onClick={addDetail}
                            style={{
                                padding: "6px 12px",
                                background: "#fff",
                                color: "#f99022",
                                border: "2px solid #f99022",
                                borderRadius: "4px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "12px",
                                fontWeight: "600",
                            }}
                        >
                            + Add Detail
                        </button>
                    </div>

                    {details.map((det, dIdx) => (
                        <div key={dIdx} style={{
                            marginBottom: "24px",
                            border: "2px solid #f99022",
                            borderRadius: "6px",
                            padding: "16px",
                            background: "#fffaf5"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                <h5 style={{ margin: "0", color: "#f99022", fontSize: "13px", fontWeight: "bold", textTransform: "uppercase" }}>Detail {dIdx + 1}</h5>
                                {details.length > 1 && (
                                    <IconButton size="small" onClick={() => removeDetail(dIdx)} sx={{ color: "#f99022" }}>
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </div>

                            {/* MACHINE */}
                            <div style={{ marginBottom: "16px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                    <div>
                                        <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Machine Name</label>
                                        <select
                                            value={det.MachineName}
                                            onChange={(e) => onDetailMachineChange(dIdx, e.target.value)}
                                            style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                        >
                                            <option value="">-- Select Machine --</option>
                                            {machines.map((name) => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Machine ID</label>
                                        <input
                                            type="text"
                                            value={det.MachineId}
                                            readOnly
                                            style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", background: "#f5f5f5", cursor: "default", fontSize: "13px" }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* TOOL */}
                            <div style={{ marginBottom: "16px" }}>
                                <h6 style={{ margin: "0 0 12px 0", fontSize: "11px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>Tool</h6>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                                    <div>
                                        <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Tool ID</label>
                                        <input
                                            type="text"
                                            value={det.ToolId}
                                            onChange={(e) => onDetailChange(dIdx, "ToolId", e.target.value)}
                                            placeholder="e.g. GPL-O-0163"
                                            style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Tool Name</label>
                                        <input
                                            type="text"
                                            value={det.ToolName}
                                            onChange={(e) => onDetailChange(dIdx, "ToolName", e.target.value)}
                                            placeholder="e.g. AE FRAME LHD"
                                            style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Tool Tag</label>
                                        <input
                                            type="text"
                                            value={det.ToolTag}
                                            onChange={(e) => onDetailChange(dIdx, "ToolTag", e.target.value)}
                                            placeholder="e.g. DM0003"
                                            style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* CYCLE TIME */}
                            <div style={{ marginBottom: "16px" }}>
                                <h6 style={{ margin: "0 0 12px 0", fontSize: "11px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>Cycle Time</h6>
                                <div>
                                    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Cycle Time (HH : MM : SS)</label>
                                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                        <input
                                            type="number"
                                            min={0}
                                            max={23}
                                            value={det.CycleTimeHours}
                                            onChange={(e) => onDetailChange(dIdx, "CycleTimeHours", Math.max(0, parseInt(e.target.value) || 0))}
                                            placeholder="HH"
                                            style={{ width: "50px", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", textAlign: "center", fontSize: "13px" }}
                                        />
                                        <span style={{ fontWeight: "bold" }}>:</span>
                                        <input
                                            type="number"
                                            min={0}
                                            max={59}
                                            value={det.CycleTimeMinutes}
                                            onChange={(e) => onDetailChange(dIdx, "CycleTimeMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                                            placeholder="MM"
                                            style={{ width: "50px", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", textAlign: "center", fontSize: "13px" }}
                                        />
                                        <span style={{ fontWeight: "bold" }}>:</span>
                                        <input
                                            type="number"
                                            min={0}
                                            max={59}
                                            value={det.CycleTimeSeconds}
                                            onChange={(e) => onDetailChange(dIdx, "CycleTimeSeconds", Math.max(0, parseInt(e.target.value) || 0))}
                                            placeholder="SS"
                                            style={{ width: "50px", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", textAlign: "center", fontSize: "13px" }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ITEM */}
                            <div style={{ marginBottom: "16px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                    <h6 style={{ margin: "0", fontSize: "13px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>Item</h6>
                                    <button
                                        onClick={() => addItem(dIdx)}
                                        style={{
                                            padding: "4px 8px",
                                            background: "#fff",
                                            color: "#f99022",
                                            border: "1px solid #f99022",
                                            borderRadius: "4px",
                                            cursor: "pointer",
                                            fontSize: "11px",
                                            fontWeight: "600",
                                        }}
                                    >
                                        + Add Item
                                    </button>
                                </div>

                                {det.Items.map((item, iIdx) => (
                                    <div key={iIdx} style={{ marginBottom: "12px", border: "1px solid #f99022", padding: "12px", borderRadius: "4px", background: "#fff9f5" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                            <span style={{ fontSize: "13px", fontWeight: "bold", color: "#f99022", textTransform: "uppercase" }}>Item {iIdx + 1}</span>
                                            {det.Items.length > 1 && (
                                                <IconButton size="small" onClick={() => removeItem(dIdx, iIdx)}>
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                                            <div>
                                                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Item</label>
                                                <input
                                                    type="text"
                                                    value={item.Item}
                                                    onChange={(e) => onItemChange(dIdx, iIdx, "Item", e.target.value)}
                                                    placeholder="e.g. C00038D051400000"
                                                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Item Rev</label>
                                                <input
                                                    type="number"
                                                    value={item.ItemRev}
                                                    onChange={(e) => onItemChange(dIdx, iIdx, "ItemRev", e.target.value)}
                                                    placeholder="0"
                                                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                                />
                                            </div>
                                            <div style={{ gridColumn: "1 / -1" }}>
                                                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Item Description</label>
                                                <input
                                                    type="text"
                                                    value={item.ItemDesc}
                                                    onChange={(e) => onItemChange(dIdx, iIdx, "ItemDesc", e.target.value)}
                                                    placeholder="e.g. CARBURETOR HOUSING RAW CASTING"
                                                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Cavity</label>
                                                <input
                                                    type="number"
                                                    value={item.Cavity}
                                                    onChange={(e) => onItemChange(dIdx, iIdx, "Cavity", e.target.value)}
                                                    placeholder="e.g. 2"
                                                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Production Order No</label>
                                                <input
                                                    type="text"
                                                    value={item.ProductionOrderNo}
                                                    onChange={(e) => onItemChange(dIdx, iIdx, "ProductionOrderNo", e.target.value)}
                                                    placeholder="e.g. 2526000251"
                                                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Production Order Qty</label>
                                                <input
                                                    type="number"
                                                    value={item.ProductionOrderQty}
                                                    onChange={(e) => onItemChange(dIdx, iIdx, "ProductionOrderQty", e.target.value)}
                                                    placeholder="0"
                                                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Plan Qty</label>
                                                <input
                                                    type="number"
                                                    value={item.PlanQty}
                                                    onChange={(e) => onItemChange(dIdx, iIdx, "PlanQty", e.target.value)}
                                                    placeholder="e.g. 1900"
                                                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* PROCESS */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                    <h6 style={{ margin: "0", fontSize: "11px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>Process</h6>
                                    <button
                                        onClick={() => addProcess(dIdx)}
                                        style={{
                                            padding: "4px 8px",
                                            background: "#fff",
                                            color: "#f99022",
                                            border: "1px solid #f99022",
                                            borderRadius: "4px",
                                            cursor: "pointer",
                                            fontSize: "11px",
                                            fontWeight: "600",
                                        }}
                                    >
                                        + Add Process
                                    </button>
                                </div>

                                {det.Processes.map((proc, pIdx) => (
                                    <div key={pIdx} style={{ marginBottom: "12px", border: "1px solid #f99022", padding: "12px", borderRadius: "4px", background: "#fff9f5" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                            <span style={{ fontSize: "11px", fontWeight: "bold", color: "#f99022", textTransform: "uppercase" }}>Process {pIdx + 1}</span>
                                            {det.Processes.length > 1 && (
                                                <IconButton size="small" onClick={() => removeProcess(dIdx, pIdx)}>
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                            <div>
                                                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Process ID</label>
                                                <input
                                                    type="text"
                                                    value={proc.ProcessId}
                                                    onChange={(e) => onProcessChange(dIdx, pIdx, "ProcessId", e.target.value)}
                                                    placeholder="e.g. CAST001"
                                                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500" }}>Process Name</label>
                                                <input
                                                    type="text"
                                                    value={proc.ProcessName}
                                                    onChange={(e) => onProcessChange(dIdx, pIdx, "ProcessName", e.target.value)}
                                                    placeholder="e.g. CASTING-DCD"
                                                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
            <DialogActions sx={{ p: 2, background: "#f5f5f5" }}>
                <Button onClick={handleClose} variant="contained" sx={{ background: "#757575", "&:hover": { background: "#757575" } }}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={!planForm.PlanNo || !planForm.Type || submitting}
                    sx={{
                        background: "#f99022",
                        "&:hover": { background: "#e06d00" },
                        "&.Mui-disabled": { background: "#f4780380" },
                    }}
                >
                    {submitting ? "Saving..." : "Save Plan"}
                </Button>
            </DialogActions>

            {/* ── Swal Z-Index Override ────────────────────────── */}
            <style>{`
                .swal2-container {
                    z-index: 9999 !important;
                }
            `}</style>
        </Dialog>
    );
}

export default ErpPlannerDialog;
