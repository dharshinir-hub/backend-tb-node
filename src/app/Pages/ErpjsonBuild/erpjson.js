import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import "./erpjson.css";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { IconButton } from "@mui/material";
import { customerbaseddevices } from "../../Services/app/operatorservice";
import { getReportToken, createPlan, updatePlan, getAllPlans, deletePlan } from "../../Services/app/reportservice";
import Swal from "sweetalert2";

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

const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = iso.split("T")[0];
    const [y, m, day] = d.split("-");
    return `${day}-${m}-${y}`;
};

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
function ErpJson() {
    const [view, setView] = useState("list");      // 'list' | 'create' | 'edit'
    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [editId, setEditId] = useState(null);

    // ── Machine ───────────────────────────────────────────────────
    const [machines, setMachines] = useState([]);
    const [deviceNameIdJson, setDeviceNameIdJson] = useState({});

    // ── Plan form ─────────────────────────────────────────────────
    const [planForm, setPlanForm] = useState(defaultPlanForm());
    const [details, setDetails] = useState([emptyDetail()]);
    const [jsonPreview, setJsonPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [expandedPlans, setExpandedPlans] = useState({});

    const toggleExpand = (id) =>
        setExpandedPlans((prev) => ({ ...prev, [id]: !prev[id] }));

    // ── Init ──────────────────────────────────────────────────────
    useEffect(() => {
        fetchDevices();
        fetchPlans();
    }, []);

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

    const fetchPlans = async () => {
        setLoadingPlans(true);
        try {
            await getReportToken("pmi", "pmi");
            const data = await getAllPlans();
            console.log("Plan/all response:", data);
            const list = Array.isArray(data) ? data
                : Array.isArray(data?.data) ? data.data
                : Array.isArray(data?.plans) ? data.plans
                : Array.isArray(data?.result) ? data.result
                : [];
            setPlans(list);
        } catch (err) {
            console.error("Failed to fetch plans", err);
        } finally {
            setLoadingPlans(false);
        }
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

    // ── Open create ───────────────────────────────────────────────
    const handleCreateNew = () => {
        setPlanForm(defaultPlanForm());
        setDetails([emptyDetail()]);
        setEditId(null);
        setJsonPreview(null);
        setView("create");
    };

    // ── Open edit ─────────────────────────────────────────────────
    const handleEdit = (plan) => {
        setPlanForm(mapPlanToForm(plan));
        const mapped = mapDetailsToForm(plan.details || []);
        setDetails(mapped.length > 0 ? mapped : [emptyDetail()]);
        setEditId(plan.id);
        setJsonPreview(null);
        setView("edit");
    };

    // ── Delete plan ───────────────────────────────────────────────
    const handleDelete = async (planId) => {
        Swal.fire({
            title: "Delete Plan?",
            text: "Do you want to delete this plan?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#dc3545",
            cancelButtonColor: "#6c757d",
            confirmButtonText: "Yes, delete it",
            cancelButtonText: "Cancel",
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await getReportToken("pmi", "pmi");
                    await deletePlan(planId);
                    Swal.fire({
                        icon: "success",
                        title: "Deleted",
                        text: "Plan has been successfully deleted.",
                        confirmButtonColor: "#f99022",
                    }).then(() => {
                        fetchPlans();
                    });
                } catch (err) {
                    console.error("Plan delete failed:", err);
                    Swal.fire({
                        icon: "error",
                        title: "Failed",
                        text: err?.response?.data?.message || "Failed to delete plan. Please try again.",
                        confirmButtonColor: "#f99022",
                    });
                }
            }
        });
    };

    // ── Back to list ──────────────────────────────────────────────
    const handleBack = () => {
        fetchPlans();
        setView("list");
    };

    // ── Save (create or update) ───────────────────────────────────
    const handleSave = async () => {
        const payload = buildJson();
        setJsonPreview(payload);
        setSubmitting(true);
        try {
            await getReportToken("pmi", "pmi");
            if (view === "edit") {
                await updatePlan(editId, payload);
            } else {
                await createPlan(payload);
            }
            Swal.fire({
                icon: "success",
                title: view === "edit" ? "Plan Updated" : "Plan Created",
                text: `Plan has been successfully ${view === "edit" ? "updated" : "submitted"}.`,
                confirmButtonColor: "#f99022",
            }).then(() => {
                fetchPlans();
                setView("list");
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

    const handleReset = () => {
        if (view === "edit") {
            const plan = plans.find((p) => p.id === editId);
            if (plan) {
                setPlanForm(mapPlanToForm(plan));
                const mapped = mapDetailsToForm(plan.details || []);
                setDetails(mapped.length > 0 ? mapped : [emptyDetail()]);
            }
        } else {
            setPlanForm(defaultPlanForm());
            setDetails([emptyDetail()]);
        }
        setJsonPreview(null);
    };

    // ═══════════════════════════════════════════════════════════════
    // LIST VIEW
    // ═══════════════════════════════════════════════════════════════
    if (view === "list") {
        return (
            <div className="erpjson-page">
                <div className="erpjson-container">
                    <div className="erpjson-header erpjson-header--list">
                        <h2>Live Plans</h2>
                        <button className="erpjson-header-btn" onClick={handleCreateNew}>
                            <AddIcon fontSize="small" /> Create New Plan
                        </button>
                    </div>

                    {loadingPlans ? (
                        <div className="erpjson-loading">Loading plans...</div>
                    ) : plans.length === 0 ? (
                        <div className="erpjson-empty">No plans found.</div>
                    ) : (
                        <div className="erpjson-table-wrap">
                            <table className="erpjson-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Plan No</th>
                                        <th className="erpjson-th-machine">Machine Name</th>
                                        <th>Plan Date</th>
                                        <th>Type</th>
                                        <th>Item List</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plans.map((plan) => {
                                        const details = plan.details || [];
                                        const machineNames = [...new Set(details.map((d) => d.MachineDesc || "").filter(Boolean))].join(", ");
                                        const isExpanded = !!expandedPlans[plan.id];
                                        return (
                                            <React.Fragment key={plan.id}>
                                                <tr>
                                                    <td>{plan.id}</td>
                                                    <td>{plan.plan_no}</td>
                                                    <td className="erpjson-td-machine">{machineNames || "—"}</td>
                                                    <td>{fmtDate(plan.plan_date + "T00:00:00")}</td>
                                                    <td>{plan.type}</td>
                                                    <td>
                                                        <IconButton
                                                            size="small"
                                                            className={`erpjson-eye-btn${isExpanded ? " erpjson-eye-btn--active" : ""}`}
                                                            onClick={() => toggleExpand(plan.id)}
                                                            title={isExpanded ? "Hide Item List" : "View Item List"}
                                                        >
                                                            <VisibilityIcon fontSize="small" />
                                                        </IconButton>
                                                    </td>
                                                    <td>
                                                        <IconButton
                                                            size="small"
                                                            className="erpjson-edit-icon-btn"
                                                            onClick={() => handleEdit(plan)}
                                                            title="Edit Plan"
                                                        >
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            className="erpjson-delete-icon-btn"
                                                            onClick={() => handleDelete(plan.id)}
                                                            title="Delete Plan"
                                                        >
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="erpjson-details-row">
                                                        <td colSpan={7}>
                                                            <div className="erpjson-details-section">
                                                                <div className="erpjson-details-section-title">Details</div>
                                                                {details.length === 0 ? (
                                                                    <div className="erpjson-details-empty">No details available.</div>
                                                                ) : (
                                                                    details.map((det, dIdx) => {
                                                                        const items = plan.type === "Machining"
                                                                            ? [{ Item: det.Item, ItemDesc: det.ItemDesc }]
                                                                            : (det.Item || []);
                                                                        const itemIds = items.map((i) => i.Item).filter(Boolean).join(" & ");
                                                                        const itemDescs = items.map((i) => i.ItemDesc).filter(Boolean).join(" & ");
                                                                        return (
                                                                            <div key={dIdx} className="erpjson-details-entry">
                                                                                <div className="erpjson-details-machine">
                                                                                    {det.MachineDesc || `Detail #${dIdx + 1}`}
                                                                                </div>
                                                                                <div className="erpjson-details-item-line">
                                                                                    <span className="erpjson-item-id">({itemIds})</span>
                                                                                    {" - "}
                                                                                    <span className="erpjson-item-desc">({itemDescs})</span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // FORM VIEW (create / edit)
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="erpjson-page">
            <div className="erpjson-container">
                <div className="erpjson-header erpjson-header--list">
                    <div className="erpjson-header-left">
                        <IconButton size="small" onClick={handleBack}
                            sx={{ color: "#fff", mr: 1 }}>
                            <ArrowBackIcon />
                        </IconButton>
                        <h2>
                            {view === "edit"
                                ? `Edit Plan — ${planForm.PlanNo || editId}`
                                : "New Live Plan"}
                        </h2>
                    </div>
                </div>

                {/* ── PLAN DETAILS ─────────────────────────────────── */}
                <div className="erpjson-section-title">Plan Details</div>
                <div className="erpjson-grid">
                    <div className="erpjson-field">
                        <label>Plan No</label>
                        <input type="text" value={planForm.PlanNo}
                            onChange={(e) => onPlanChange("PlanNo", e.target.value)}
                            placeholder="e.g. 1000000049" />
                    </div>
                    <div className="erpjson-field">
                        <label>Document Date</label>
                        <input type="date" value={planForm.DocumentDate} readOnly
                            style={{ background: "#f5f5f5", cursor: "default" }} />
                    </div>
                    <div className="erpjson-field">
                        <label>Plan Date</label>
                        <input type="date" value={planForm.PlanDate}
                            onChange={(e) => onPlanChange("PlanDate", e.target.value)} />
                    </div>
                    <div className="erpjson-field">
                        <label>Unit ID</label>
                        <input type="text" value={planForm.UnitId}
                            onChange={(e) => onPlanChange("UnitId", e.target.value)}
                            placeholder="e.g. DCD" />
                    </div>
                    <div className="erpjson-field">
                        <label>Unit Description</label>
                        <input type="text" value={planForm.UnitDesc}
                            onChange={(e) => onPlanChange("UnitDesc", e.target.value)}
                            placeholder="e.g. DIE CASTING DIVISION" />
                    </div>
                    <div className="erpjson-field">
                        <label>Shift ID</label>
                        <input type="text" value={planForm.ShiftId}
                            onChange={(e) => onPlanChange("ShiftId", e.target.value)}
                            placeholder="e.g. 0001" />
                    </div>
                    <div className="erpjson-field">
                        <label>Shift Description</label>
                        <input type="text" value={planForm.ShiftDesc}
                            onChange={(e) => onPlanChange("ShiftDesc", e.target.value)}
                            placeholder="e.g. SHIFT 1" />
                    </div>
                    <div className="erpjson-field">
                        <label>Type</label>
                        <select value={planForm.Type}
                            onChange={(e) => onPlanChange("Type", e.target.value)}
                            className="erpjson-select">
                            <option value="">-- Select Type --</option>
                            <option value="Die Casting">Die Casting</option>
                            <option value="Trimming">Trimming</option>
                            <option value="Machining">Machining</option>
                        </select>
                    </div>
                </div>

                {/* ── DETAILS ──────────────────────────────────────── */}
                <>
                    <div className="erpjson-section-header">
                        <div className="erpjson-section-title" style={{ marginBottom: 0 }}>Details</div>
                        <button className="erpjson-add-btn" onClick={addDetail}>
                            <AddIcon fontSize="small" /> Add Detail
                        </button>
                    </div>

                    {details.map((det, dIdx) => (
                        <div key={dIdx} className="erpjson-detail-block">
                            <div className="erpjson-detail-block-header">
                                <span className="erpjson-detail-label">Detail #{dIdx + 1}</span>
                                {details.length > 1 && (
                                    <IconButton size="small" onClick={() => removeDetail(dIdx)}
                                        className="erpjson-delete-btn">
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </div>

                            {/* Machine */}
                            <div className="erpjson-group-label">Machine</div>
                            <div className="erpjson-grid">
                                <div className="erpjson-field">
                                    <label>Machine Name</label>
                                    <select value={det.MachineName}
                                        onChange={(e) => onDetailMachineChange(dIdx, e.target.value)}
                                        className="erpjson-select">
                                        <option value="">-- Select Machine --</option>
                                        {machines.map((name) => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="erpjson-field">
                                    <label>Machine ID</label>
                                    <input type="text" value={det.MachineId} readOnly
                                        style={{ background: "#f5f5f5", cursor: "default" }} />
                                </div>
                            </div>

                            {/* Tool */}
                            <div className="erpjson-group-label">Tool</div>
                            <div className="erpjson-grid">
                                <div className="erpjson-field">
                                    <label>Tool ID</label>
                                    <input type="text" value={det.ToolId}
                                        onChange={(e) => onDetailChange(dIdx, "ToolId", e.target.value)}
                                        placeholder="e.g. GPL-O-0163" />
                                </div>
                                <div className="erpjson-field">
                                    <label>Tool Name</label>
                                    <input type="text" value={det.ToolName}
                                        onChange={(e) => onDetailChange(dIdx, "ToolName", e.target.value)}
                                        placeholder="e.g. AE FRAME LHD" />
                                </div>
                                <div className="erpjson-field">
                                    <label>Tool Tag</label>
                                    <input type="text" value={det.ToolTag}
                                        onChange={(e) => onDetailChange(dIdx, "ToolTag", e.target.value)}
                                        placeholder="e.g. DM0003" />
                                </div>
                            </div>

                            {/* Cycle Time */}
                            <div className="erpjson-group-label">Cycle Time</div>
                            <div className="erpjson-grid">
                                <div className="erpjson-field erpjson-field--wide">
                                    <label>Cycle Time (HH : MM : SS)</label>
                                    <div className="erpjson-time">
                                        <input type="number" min={0} max={23} value={det.CycleTimeHours}
                                            onChange={(e) => onDetailChange(dIdx, "CycleTimeHours", Math.max(0, parseInt(e.target.value) || 0))}
                                            placeholder="HH" />
                                        <span>:</span>
                                        <input type="number" min={0} max={59} value={det.CycleTimeMinutes}
                                            onChange={(e) => onDetailChange(dIdx, "CycleTimeMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                                            placeholder="MM" />
                                        <span>:</span>
                                        <input type="number" min={0} max={59} value={det.CycleTimeSeconds}
                                            onChange={(e) => onDetailChange(dIdx, "CycleTimeSeconds", Math.max(0, parseInt(e.target.value) || 0))}
                                            placeholder="SS" />
                                    </div>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="erpjson-item-section-header">
                                <div className="erpjson-item-divider">Item</div>
                                <button className="erpjson-add-btn erpjson-add-btn--sm"
                                    onClick={() => addItem(dIdx)}>
                                    <AddIcon fontSize="small" /> Add Item
                                </button>
                            </div>

                            {det.Items.map((item, iIdx) => (
                                <div key={iIdx} className="erpjson-item-block">
                                    <div className="erpjson-item-block-header">
                                        <span className="erpjson-item-label">Item #{iIdx + 1}</span>
                                        {det.Items.length > 1 && (
                                            <IconButton size="small" onClick={() => removeItem(dIdx, iIdx)}
                                                className="erpjson-delete-btn">
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </div>
                                    <div className="erpjson-grid">
                                        <div className="erpjson-field">
                                            <label>Item</label>
                                            <input type="text" value={item.Item}
                                                onChange={(e) => onItemChange(dIdx, iIdx, "Item", e.target.value)}
                                                placeholder="e.g. C00038D051400000" />
                                        </div>
                                        <div className="erpjson-field">
                                            <label>Item Rev</label>
                                            <input type="number" value={item.ItemRev} min={0}
                                                onChange={(e) => onItemChange(dIdx, iIdx, "ItemRev", e.target.value)}
                                                placeholder="e.g. 0" />
                                        </div>
                                        <div className="erpjson-field erpjson-field--wide">
                                            <label>Item Description</label>
                                            <input type="text" value={item.ItemDesc}
                                                onChange={(e) => onItemChange(dIdx, iIdx, "ItemDesc", e.target.value)}
                                                placeholder="e.g. CARBURETOR HOUSING RAW CASTING" />
                                        </div>
                                        <div className="erpjson-field">
                                            <label>Cavity</label>
                                            <input type="number" value={item.Cavity} min={0}
                                                onChange={(e) => onItemChange(dIdx, iIdx, "Cavity", e.target.value)}
                                                placeholder="e.g. 2" />
                                        </div>
                                        <div className="erpjson-field">
                                            <label>Production Order No</label>
                                            <input type="text" value={item.ProductionOrderNo}
                                                onChange={(e) => onItemChange(dIdx, iIdx, "ProductionOrderNo", e.target.value)}
                                                placeholder="e.g. 2526000251" />
                                        </div>
                                        <div className="erpjson-field">
                                            <label>Production Order Qty</label>
                                            <input type="number" value={item.ProductionOrderQty} min={0}
                                                onChange={(e) => onItemChange(dIdx, iIdx, "ProductionOrderQty", e.target.value)}
                                                placeholder="e.g. 23700" />
                                        </div>
                                        <div className="erpjson-field">
                                            <label>Plan Qty</label>
                                            <input type="number" value={item.PlanQty} min={1}
                                                onChange={(e) => onItemChange(dIdx, iIdx, "PlanQty", e.target.value)}
                                                placeholder="e.g. 1900" />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Process */}
                            <div className="erpjson-item-section-header">
                                <div className="erpjson-item-divider">Process</div>
                                <button className="erpjson-add-btn erpjson-add-btn--sm"
                                    onClick={() => addProcess(dIdx)}>
                                    <AddIcon fontSize="small" /> Add Process
                                </button>
                            </div>

                            {det.Processes.map((proc, pIdx) => (
                                <div key={pIdx} className="erpjson-item-block">
                                    <div className="erpjson-item-block-header">
                                        <span className="erpjson-item-label">Process #{pIdx + 1}</span>
                                        {det.Processes.length > 1 && (
                                            <IconButton size="small" onClick={() => removeProcess(dIdx, pIdx)}
                                                className="erpjson-delete-btn">
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </div>
                                    <div className="erpjson-grid">
                                        <div className="erpjson-field">
                                            <label>Process ID</label>
                                            <input type="text" value={proc.ProcessId}
                                                onChange={(e) => onProcessChange(dIdx, pIdx, "ProcessId", e.target.value)}
                                                placeholder="e.g. CAST001" />
                                        </div>
                                        <div className="erpjson-field">
                                            <label>Process Name</label>
                                            <input type="text" value={proc.ProcessName}
                                                onChange={(e) => onProcessChange(dIdx, pIdx, "ProcessName", e.target.value)}
                                                placeholder="e.g. CASTING-DCD" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </>

                {/* ── ACTIONS ─────────────────────────────────────── */}
                <div className="erpjson-actions">
                    <button className="erpjson-btn erpjson-btn--cancel" onClick={handleReset}>
                        Reset
                    </button>
                    <button className="erpjson-btn erpjson-btn--save"
                        onClick={handleSave}
                        disabled={!planForm.PlanNo || !planForm.Type || submitting}>
                        {submitting ? "Saving..." : view === "edit" ? "Update Plan" : "Save Plan"}
                    </button>
                </div>

                {/* ── JSON PREVIEW ────────────────────────────────── */}
                {jsonPreview && (
                    <div className="erpjson-preview">
                        <div className="erpjson-preview-title">JSON Payload</div>
                        <pre className="erpjson-pre">{JSON.stringify(jsonPreview, null, 2)}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ErpJson;
