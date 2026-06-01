import React, { useEffect, useState, useCallback } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import { getJobsByWorkname } from "../../Services/app/reportservice";
import EmailConfig from "../EmailConfiguration/emailconfig";
import "./erpreportschedule.css";

// ─── Constants ─────────────────────────────────────────────────────────────────
const TOP_TABS = ["Email Configuration","Email-Report Schedule"];

const EMAIL_TABS = [
    { key: "shiftwise", label: "Shift End" },
    { key: "dayend",    label: "Day End"   },
    { key: "weekend",   label: "Week End"  },
    { key: "monthend",  label: "Month End" },
    { key: "custom",    label: "Custom"    },
];

const REPORT_LABELS = {
    generalreport:    "General Report",
    oeereport:        "OEE Report",
    partwisereport:   "Part Wise Report",
    idlereasonreport: "Idle Reason Report",
};

const STATUS_CONFIG = [
    { key: "waiting",   label: "Waiting",   cls: "ers-status-waiting"   },
    { key: "active",    label: "Active",    cls: "ers-status-active"    },
    { key: "delayed",   label: "Delayed",   cls: "ers-status-delayed"   },
    { key: "completed", label: "Completed", cls: "ers-status-completed" },
    { key: "failed",    label: "Failed",    cls: "ers-status-failed"    },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const TabPanel = ({ children, value, index }) => (
    <div hidden={value !== index}>
        {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
);

const STATUS_KEYS = ["waiting", "active", "delayed", "completed", "failed"];

function extractJobData(raw) {
    if (!raw) return { triggers: [], counts: {} };

    // Response shape: { waiting: { total, page, limit, data[] }, active: {...}, ... }
    const counts = {};
    const triggers = [];

    STATUS_KEYS.forEach(status => {
        const bucket = raw[status];
        if (bucket && typeof bucket === "object") {
            counts[status] = bucket.total ?? 0;
            (bucket.data || []).forEach(job => triggers.push({ ...job, _status: status }));
        } else {
            counts[status] = 0;
        }
    });

    return { triggers, counts };
}

function fmtTime(ms) {
    if (!ms) return "—";
    const d = new Date(ms);
    return isNaN(d) ? "—" : d.toLocaleString();
}

function scheduledAt(job) {
    const ts    = job.timestamp ?? job.opts?.timestamp;
    const delay = job.delay     ?? job.opts?.delay ?? 0;
    if (!ts) return "—";
    return fmtTime(ts + delay);
}

function reportSummary(trigger) {
    if (!trigger || typeof trigger !== "object") return "—";
    return Object.entries(trigger)
        .map(([k, v]) => `${REPORT_LABELS[k] || k}: ${(v || []).join(", ")}`)
        .join(" | ") || "—";
}

// ─── Status bar ────────────────────────────────────────────────────────────────
function JobStatusBar({ counts }) {
    return (
        <div className="ers-status-bar">
            {STATUS_CONFIG.map(({ key, label, cls }) => (
                <div key={key} className="ers-status-item">
                    <span className={`ers-status-count ${cls}`}>{counts[key] ?? 0}</span>
                    <span className="ers-status-label">{label}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const s = (status || "").toLowerCase();
    return (
        <span className={`ers-badge ers-badge-${s}`}>
            {status || "—"}
        </span>
    );
}

// ─── Triggers table ─────────────────────────────────────────────────────────────
function TriggersTable({ triggers }) {
    if (!triggers.length) {
        return (
            <div className="ers-empty">
                <span className="ers-empty-icon">📭</span>
                <span className="ers-empty-text">No triggers found for this schedule.</span>
            </div>
        );
    }

    return (
        <div className="ers-table-wrapper">
            <table className="ers-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Status</th>
                        <th>Job ID</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Shift</th>
                        <th>Reports</th>
                        <th>Scheduled At</th>
                        <th>Processed On</th>
                        <th>Finished On</th>
                        <th>Attempts</th>
                    </tr>
                </thead>
                <tbody>
                    {triggers.map((job, idx) => {
                        const d = job.data || {};
                        return (
                            <tr key={job.id || idx}>
                                <td className="ers-td-no">{idx + 1}</td>
                                <td><StatusBadge status={job._status} /></td>
                                <td className="ers-td-id">{job.id ?? "—"}</td>
                                <td>{d.customer ?? "—"}</td>
                                <td>{d.date ?? "—"}</td>
                                <td className="ers-td-center">{d.shift_no ?? "—"}</td>
                                <td className="ers-td-reports">{reportSummary(d.trigger)}</td>
                                <td className="ers-td-time">{scheduledAt(job)}</td>
                                <td className="ers-td-time">{fmtTime(job.processedOn)}</td>
                                <td className="ers-td-time">{fmtTime(job.finishedOn)}</td>
                                <td className="ers-td-center">{job.attemptsMade ?? 0}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Email sub-tab content ──────────────────────────────────────────────────────
function EmailScheduleJobTab({ workname }) {
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState(null);
    const [triggers, setTriggers] = useState([]);
    const [counts,   setCounts]   = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const raw = await getJobsByWorkname(workname);
            const { triggers: t, counts: c } = extractJobData(raw);
            setTriggers(t);
            setCounts(c);
        } catch (err) {
            setError("Failed to load job data.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [workname]);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) return <div className="ers-loading">Loading triggers…</div>;
    if (error)   return <div className="ers-error">{error}</div>;

    return (
        <div className="ers-job-section">
            <JobStatusBar counts={counts} />
            <TriggersTable triggers={triggers} />
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function ErpReportSchedule() {
    const [topTab,   setTopTab]   = useState(0);
    const [emailTab, setEmailTab] = useState(0);

    return (
        <div className="pages ers-page">
            <div className="pagecontents">
                <h2 className="ers-main-title">Email Schedule</h2>

                {/* Top-level tabs */}
                <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                    <Tabs
                        value={topTab}
                        onChange={(_, v) => setTopTab(v)}
                        textColor="inherit"
                        TabIndicatorProps={{ sx: { backgroundColor: "orange" } }}
                    >
                        {TOP_TABS.map(label => (
                            <Tab key={label} label={label} sx={{ textTransform: "none", fontWeight: 600 , fontSize:"16px"}} />
                        ))}
                    </Tabs>
                </Box>

                {/* Email Configuration */}
                <TabPanel value={topTab} index={0}>
                    <EmailConfig />
                </TabPanel>

                {/* Email-Report Schedule */}
                <TabPanel value={topTab} index={1}>
                    {/* Email sub-tabs */}
                    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                        <Tabs
                            value={emailTab}
                            onChange={(_, v) => setEmailTab(v)}
                            textColor="inherit"
                            TabIndicatorProps={{ sx: { backgroundColor: "#f59e0b" } }}
                            variant="scrollable"
                            scrollButtons="auto"
                        >
                            {EMAIL_TABS.map(({ label }) => (
                                <Tab key={label} label={label} sx={{ textTransform: "none", fontWeight: 500 }} />
                            ))}
                        </Tabs>
                    </Box>

                    {EMAIL_TABS.map(({ key }, idx) => (
                        <TabPanel key={key} value={emailTab} index={idx}>
                            <EmailScheduleJobTab workname={key} />
                        </TabPanel>
                    ))}
                </TabPanel>
            </div>
        </div>
    );
}
