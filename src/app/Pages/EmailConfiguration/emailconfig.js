import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { customerbasedshift, shiftadd } from "../../Services/app/masterservice";
import "./emailconfig.css";

// ─── Constants ────────────────────────────────────────────────────────────────
const TRIGGER_TYPES = [
    { key: "shiftwise", label: "Shift Wise" },
    { key: "dayend",    label: "Day End"    },
    { key: "weekend",   label: "Week End"   },
    { key: "monthend",  label: "Month End"  },
];

const REPORT_KEYS = [
    { key: "generalreport",    label: "General Report"     },
    { key: "oeereport",        label: "OEE Report"         },
    { key: "partwisereport",   label: "Part Wise Report"   },
    { key: "idlereasonreport", label: "Idle Reason Report" },
];

const FORMAT_OPTIONS = ["csv", "pdf"];
const DAY_OPTIONS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emptyReports() {
    return { generalreport: [], oeereport: [], partwisereport: [], idlereasonreport: [] };
}

function buildEmptyForm() {
    return {
        subject: "",
        to: [], cc: [], bcc: [],
        triggers: {
            shiftwise: { enabled: false, reports: emptyReports() },
            dayend:    { enabled: false, reports: emptyReports() },
            weekend:   { enabled: false, reports: emptyReports() },
            monthend:  { enabled: false, reports: emptyReports() },
            customSchedules: [],
        },
    };
}

function buildEmptySchedule() {
    return { day: "", time: "", reports: emptyReports() };
}

function formToConfig(form) {
    const triggers = {};
    TRIGGER_TYPES.forEach(({ key }) => {
        const t = form.triggers[key];
        if (!t.enabled) return;
        const obj = {};
        REPORT_KEYS.forEach(({ key: rk }) => {
            if (t.reports[rk].length) obj[rk] = [...t.reports[rk]];
        });
        if (Object.keys(obj).length) triggers[key] = obj;
    });
    if (form.triggers.customSchedules.length) {
        const custom = {};
        form.triggers.customSchedules.forEach((s, i) => {
            const entry = { day: s.day.toLowerCase(), time: s.time };
            REPORT_KEYS.forEach(({ key: rk }) => {
                if (s.reports[rk].length) entry[rk] = [...s.reports[rk]];
            });
            custom[`schedule_${i + 1}`] = entry;
        });
        triggers.custom = custom;
    }
    return { subject: form.subject, to: form.to, cc: form.cc, bcc: form.bcc, triggers };
}

function configToForm(config) {
    const form = buildEmptyForm();
    form.subject = config.subject || "";
    form.to  = config.to  || [];
    form.cc  = config.cc  || [];
    form.bcc = config.bcc || [];
    const t = config.triggers || {};
    TRIGGER_TYPES.forEach(({ key }) => {
        // handle "monnthend" typo in existing data
        const data = t[key] || (key === "monthend" ? t["monnthend"] : null);
        if (data && typeof data === "object") {
            form.triggers[key].enabled = true;
            REPORT_KEYS.forEach(({ key: rk }) => {
                form.triggers[key].reports[rk] = data[rk] || [];
            });
        }
    });
    if (t.custom && typeof t.custom === "object") {
        form.triggers.customSchedules = Object.values(t.custom).map((s) => ({
            day:  s.day ? s.day.charAt(0).toUpperCase() + s.day.slice(1) : "",
            time: s.time || "",
            reports: {
                generalreport:    s.generalreport    || [],
                oeereport:        s.oeereport        || [],
                partwisereport:   s.partwisereport   || [],
                idlereasonreport: s.idlereasonreport || [],
            },
        }));
    }
    return form;
}

// ─── MultiEmailInput ──────────────────────────────────────────────────────────
function MultiEmailInput({ label, emails, onChange }) {
    const [inputVal, setInputVal] = useState("");
    const [error, setError]       = useState("");

    const addEmail = () => {
        const val = inputVal.trim();
        if (!val) return;
        if (!emailRegex.test(val)) { setError("*Enter a valid email format"); return; }
        if (emails.includes(val))  { setError("*Email already added");        return; }
        setError("");
        onChange([...emails, val]);
        setInputVal("");
    };

    return (
        <div className="ec-email-field">
            <label className="ec-label">{label}</label>
            <div className="ec-email-row">
                <input
                    className={`ec-input${error ? " ec-input-error" : ""}`}
                    value={inputVal}
                    onChange={(e) => { setInputVal(e.target.value); setError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                    placeholder="name@example.com"
                />
                <button type="button" className="ec-add-btn" onClick={addEmail}>Add</button>
            </div>
            {error && <span className="ec-error">{error}</span>}
            <div className="ec-chip-list">
                {emails.map((email) => (
                    <span key={email} className="ec-chip">
                        {email}
                        <button type="button" className="ec-chip-remove"
                            onClick={() => onChange(emails.filter((e) => e !== email))}>×</button>
                    </span>
                ))}
            </div>
        </div>
    );
}

// ─── ReportFormatMatrix ───────────────────────────────────────────────────────
function ReportFormatMatrix({ reports, onChange }) {
    const toggle = (rk, fmt) => {
        const cur  = reports[rk] || [];
        const next = cur.includes(fmt) ? cur.filter(f => f !== fmt) : [...cur, fmt];
        onChange({ ...reports, [rk]: next });
    };

    return (
        <table className="ec-matrix">
            <thead>
                <tr>
                    <th className="ec-matrix-th ec-matrix-report-col"></th>
                    {FORMAT_OPTIONS.map(fmt => (
                        <th key={fmt} className="ec-matrix-th ec-matrix-fmt-col">{fmt.toUpperCase()}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {REPORT_KEYS.map(({ key, label }) => (
                    <tr key={key} className="ec-matrix-row">
                        <td className="ec-matrix-label">{label}</td>
                        {FORMAT_OPTIONS.map(fmt => (
                            <td key={fmt} className="ec-matrix-cell">
                                <input
                                    type="checkbox"
                                    className="ec-matrix-check"
                                    checked={(reports[key] || []).includes(fmt)}
                                    onChange={() => toggle(key, fmt)}
                                />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// ─── FormDialog ───────────────────────────────────────────────────────────────
function FormDialog({ title, onClose, children }) {
    return (
        <div className="ec-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="ec-dialog">
                <div className="ec-dialog-header">
                    <span className="ec-dialog-title">{title}</span>
                    <button type="button" className="ec-icon-btn ec-dialog-close" onClick={onClose}>✕</button>
                </div>
                <div className="ec-dialog-body">{children}</div>
            </div>
        </div>
    );
}

// ─── MailConfigForm ───────────────────────────────────────────────────────────
function MailConfigForm({ initialData, onSave, onCancel }) {
    const [form, setForm] = useState(initialData || buildEmptyForm());

    const setTriggerEnabled = (key, enabled) =>
        setForm(p => ({ ...p, triggers: { ...p.triggers, [key]: { ...p.triggers[key], enabled } } }));

    const setTriggerReports = (key, reports) =>
        setForm(p => ({ ...p, triggers: { ...p.triggers, [key]: { ...p.triggers[key], reports } } }));

    const addSchedule = () =>
        setForm(p => ({ ...p, triggers: { ...p.triggers, customSchedules: [...p.triggers.customSchedules, buildEmptySchedule()] } }));

    const removeSchedule = (idx) =>
        setForm(p => ({ ...p, triggers: { ...p.triggers, customSchedules: p.triggers.customSchedules.filter((_, i) => i !== idx) } }));

    const updateSchedule = (idx, updated) => {
        setForm(p => {
            const s = [...p.triggers.customSchedules];
            s[idx] = updated;
            return { ...p, triggers: { ...p.triggers, customSchedules: s } };
        });
    };

    const isFormValid = () => {
        if (!form.subject.trim()) return false;
        if (!form.to.length) return false;
        const hasAnyTrigger = TRIGGER_TYPES.some(({ key }) => form.triggers[key].enabled)
            || form.triggers.customSchedules.length > 0;
        if (!hasAnyTrigger) return false;
        const customInvalid = form.triggers.customSchedules.find(s => !s.day || !s.time);
        if (customInvalid) return false;
        return true;
    };

    const handleSave = () => {
        if (!form.subject.trim()) {
            Swal.fire("Validation", "Please enter a subject.", "warning"); return;
        }
        if (!form.to.length) {
            Swal.fire("Validation", "Please add at least one To email.", "warning"); return;
        }
        const hasAnyTrigger = TRIGGER_TYPES.some(({ key }) => form.triggers[key].enabled)
            || form.triggers.customSchedules.length > 0;
        if (!hasAnyTrigger) {
            Swal.fire("Validation", "Please enable at least one trigger.", "warning"); return;
        }
        const customInvalid = form.triggers.customSchedules.find(s => !s.day || !s.time);
        if (customInvalid) {
            Swal.fire("Validation", "Please fill day and time for all custom schedules.", "warning"); return;
        }
        onSave(formToConfig(form));
    };

    return (
        <div className="ec-form-card">
            {/* Mail details */}
            <div className="ec-section">
                <span className="ec-section-title" style={{ display:"block", marginBottom:10 }}>Mail Details</span>
                <div className="ec-field-group">
                    <label className="ec-label">Subject <span style={{ color:"#ef4444" }}>*</span></label>
                    <input
                        className="ec-input"
                        value={form.subject}
                        onChange={(e) => setForm(p => ({ ...p, subject: e.target.value }))}
                        placeholder="Email subject"
                    />
                </div>
                <MultiEmailInput label={<><span>To</span> <span style={{ color:"#ef4444" }}>*</span></>} emails={form.to}  onChange={(to)  => setForm(p => ({ ...p, to  }))} />
                <MultiEmailInput label={<><span>CC</span> <span style={{ color:"#999", fontSize:"0.85em" }}>(optional)</span></>} emails={form.cc}  onChange={(cc)  => setForm(p => ({ ...p, cc  }))} />
                <MultiEmailInput label={<><span>BCC</span> <span style={{ color:"#999", fontSize:"0.85em" }}>(optional)</span></>} emails={form.bcc} onChange={(bcc) => setForm(p => ({ ...p, bcc }))} />
            </div>

            {/* Triggers */}
            <div className="ec-section">
                <span className="ec-section-title" style={{ display:"block", marginBottom:10 }}>Triggers <span style={{ color:"#ef4444" }}>*</span></span>

                {/* Vertical trigger list */}
                <div className="ec-trigger-list">
                    {TRIGGER_TYPES.map(({ key, label }) => (
                        <div key={key} className={`ec-trigger-item${form.triggers[key].enabled ? " ec-trigger-item-active" : ""}`}>
                            <label className="ec-trigger-item-label">
                                <input
                                    type="checkbox"
                                    className="ec-matrix-check"
                                    checked={form.triggers[key].enabled}
                                    onChange={() => setTriggerEnabled(key, !form.triggers[key].enabled)}
                                />
                                <span>{label}</span>
                            </label>
                            {form.triggers[key].enabled && (
                                <div className="ec-trigger-item-matrix">
                                    <ReportFormatMatrix
                                        reports={form.triggers[key].reports}
                                        onChange={(reports) => setTriggerReports(key, reports)}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Custom */}
                <div className="ec-trigger-matrix-block">
                    <div className="ec-trigger-matrix-header">
                        <span className="ec-trigger-matrix-title">Custom</span>
                        <button type="button" className="ec-plus-btn ec-plus-sm" onClick={addSchedule} title="Add schedule">+</button>
                    </div>
                    {form.triggers.customSchedules.map((sched, idx) => (
                        <div key={idx} className="ec-custom-sched">
                            <div className="ec-custom-sched-header">
                                <span className="ec-custom-sched-title">Schedule {idx + 1}</span>
                                <button type="button" className="ec-icon-btn ec-remove-btn" onClick={() => removeSchedule(idx)}>✕</button>
                            </div>
                            <div className="ec-custom-sched-fields">
                                <div className="ec-field-group">
                                    <label className="ec-label">Day</label>
                                    <select
                                        className="ec-select"
                                        value={sched.day}
                                        onChange={(e) => updateSchedule(idx, { ...sched, day: e.target.value })}
                                    >
                                        <option value="">-- Day --</option>
                                        {DAY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="ec-field-group">
                                    <label className="ec-label">Time</label>
                                    <input
                                        type="time"
                                        className="ec-input"
                                        value={sched.time}
                                        onChange={(e) => updateSchedule(idx, { ...sched, time: e.target.value })}
                                    />
                                </div>
                            </div>
                            <ReportFormatMatrix
                                reports={sched.reports}
                                onChange={(reports) => updateSchedule(idx, { ...sched, reports })}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="ec-form-actions">
                {onCancel && <button type="button" className="ec-cancel-btn" onClick={onCancel}>Cancel</button>}
                <button type="button" className="ec-save-btn" onClick={handleSave} disabled={!isFormValid()}>Save</button>
            </div>
        </div>
    );
}

// ─── MailConfigView ───────────────────────────────────────────────────────────
function MailConfigView({ configKey, config, onEdit, onDelete }) {
    const t = config.triggers || {};

    const allTriggerCols = [
        ...TRIGGER_TYPES.map(({ key, label }) => ({ key, label, isCustom: false })),
        { key: "custom", label: "Custom", isCustom: true },
    ];

    return (
        <div className="ec-view-card">
            {/* Header */}
            <div className="ec-view-header">
                <span className="ec-view-title">{configKey.replace(/_/g, " ").toUpperCase()}</span>
                <div className="ec-view-actions">
                    <button type="button" className="ec-icon-btn ec-edit-btn" onClick={onEdit} title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button type="button" className="ec-icon-btn ec-delete-btn" onClick={onDelete} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Mail details */}
            <div className="ec-view-body">
                {config.subject && (
                    <div className="ec-view-row">
                        <span className="ec-view-label">Subject</span>
                        <span className="ec-view-value">{config.subject}</span>
                    </div>
                )}
                <div className="ec-view-row">
                    <span className="ec-view-label">To</span>
                    <div className="ec-chip-list">
                        {(config.to || []).map(e => <span key={e} className="ec-chip">{e}</span>)}
                    </div>
                </div>
                {(config.cc || []).length > 0 && (
                    <div className="ec-view-row">
                        <span className="ec-view-label">CC</span>
                        <div className="ec-chip-list">
                            {config.cc.map(e => <span key={e} className="ec-chip">{e}</span>)}
                        </div>
                    </div>
                )}
                {(config.bcc || []).length > 0 && (
                    <div className="ec-view-row">
                        <span className="ec-view-label">BCC</span>
                        <div className="ec-chip-list">
                            {config.bcc.map(e => <span key={e} className="ec-chip">{e}</span>)}
                        </div>
                    </div>
                )}
            </div>

            {/* Triggers — one column per trigger type */}
            <div className="ec-view-trigger-grid">
                {allTriggerCols.map(({ key, label, isCustom }) => (
                    <div key={key} className="ec-view-trigger-col">
                        <div className="ec-view-trigger-col-header">{label}</div>
                        <div className="ec-view-trigger-col-body">
                            {!isCustom && t[key] && typeof t[key] === "object" ? (
                                (() => {
                                    const entries = REPORT_KEYS.filter(r => (t[key][r.key] || []).length > 0);
                                    return entries.length > 0 ? entries.map(({ key: rk, label: rl }) => (
                                        <div key={rk} className="ec-view-trigger-report-row">
                                            <span className="ec-view-trigger-report-name">{rl}</span>
                                            <div className="ec-chip-list">
                                                {t[key][rk].map(f => (
                                                    <span key={f} className="ec-chip ec-chip-trigger">{f.toUpperCase()}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )) : <span className="ec-view-trigger-empty">—</span>;
                                })()
                            ) : !isCustom ? (
                                <span className="ec-view-trigger-empty">—</span>
                            ) : null}

                            {isCustom && t.custom && Object.keys(t.custom).length > 0 ? (
                                Object.entries(t.custom).map(([sk, sv]) => {
                                    const entries = REPORT_KEYS.filter(r => (sv[r.key] || []).length > 0);
                                    return (
                                        <div key={sk} className="ec-view-custom-sched-entry">
                                            <span className="ec-view-custom-sched-label">{sv.day} · {sv.time}</span>
                                            {entries.length > 0 ? entries.map(({ key: rk, label: rl }) => (
                                                <div key={rk} className="ec-view-trigger-report-row">
                                                    <span className="ec-view-trigger-report-name">{rl}</span>
                                                    <div className="ec-chip-list">
                                                        {sv[rk].map(f => (
                                                            <span key={f} className="ec-chip ec-chip-trigger">{f.toUpperCase()}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )) : <span className="ec-view-trigger-empty">—</span>}
                                        </div>
                                    );
                                })
                            ) : isCustom ? (
                                <span className="ec-view-trigger-empty">—</span>
                            ) : null}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EmailConfig() {
    const customerId = localStorage.getItem("CustomerID");
    const [savedConfigs, setSavedConfigs] = useState({});
    const [isAdding,    setIsAdding]    = useState(false);
    const [editingKey,  setEditingKey]  = useState(null);
    const [loading,     setLoading]     = useState(false);

    const loadConfigs = async () => {
        if (!customerId) return;
        try {
            const data = await customerbasedshift(customerId, "emailconfig");
            const value = data?.[0]?.value;
            const existing = value?.emailconfig || (value && !value.emailconfig ? value : null);
            if (existing && typeof existing === "object") setSavedConfigs(existing);
        } catch (err) {
            console.error("Error loading email config:", err);
        }
    };

    useEffect(() => { loadConfigs(); }, [customerId]);

    const getNextKey = () => {
        const nums = Object.keys(savedConfigs).map(k => {
            const m = k.match(/^mail_config_(\d+)$/);
            return m ? parseInt(m[1], 10) : 0;
        });
        return `mail_config_${(nums.length ? Math.max(...nums) : 0) + 1}`;
    };

    const persistConfigs = async (configs, successMsg = "Email configuration saved successfully.") => {
        if (!customerId) { Swal.fire("Error", "Customer ID not found.", "error"); return false; }
        try {
            setLoading(true);
            await shiftadd({ emailconfig: configs }, customerId, "SERVER_SCOPE");
            await loadConfigs();
            Swal.fire({ title: "Saved", text: successMsg, icon: "success", confirmButtonText: "OK", customClass: { popup: "emailconfig-success" } });
            return true;
        } catch (err) {
            console.error("Error saving:", err);
            Swal.fire("Error", "Failed to save email configuration.", "error");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleSaveNew = async (config) => {
        const ok = await persistConfigs({ ...savedConfigs, [getNextKey()]: config });
        if (ok) setIsAdding(false);
    };

    const handleSaveEdit = async (config) => {
        const ok = await persistConfigs({ ...savedConfigs, [editingKey]: config });
        if (ok) setEditingKey(null);
    };

    const handleDelete = async (key) => {
        const result = await Swal.fire({
            title: "Delete Configuration?",
            text: `Remove "${key.replace(/_/g, " ").toUpperCase()}"? This cannot be undone.`,
            icon: "warning", showCancelButton: true,
            confirmButtonText: "Delete", cancelButtonText: "Cancel",
            confirmButtonColor: "#ef4444",
        });
        if (!result.isConfirmed) return;
        const remaining = Object.entries(savedConfigs)
            .filter(([k]) => k !== key)
            .sort(([a], [b]) => {
                const numA = parseInt(a.match(/^mail_config_(\d+)$/)?.[1] ?? 0, 10);
                const numB = parseInt(b.match(/^mail_config_(\d+)$/)?.[1] ?? 0, 10);
                return numA - numB;
            });
        const updated = {};
        remaining.forEach(([, val], i) => { updated[`mail_config_${i + 1}`] = val; });
        await persistConfigs(updated, "Configuration deleted successfully.");
    };

    const hasConfigs = Object.keys(savedConfigs).length > 0;

    return (
        <div className="pages emailconfig-page">
            <div className="pagecontents">
                <div className="ec-page-header">
                    <div className="ec-header-row">
                        <h2 className="ec-main-title">Add Mail Configuration</h2>
                        {hasConfigs && (
                            <button
                                type="button"
                                className="ec-plus-btn"
                                onClick={() => { setIsAdding(true); setEditingKey(null); }}
                                title="Add mail configuration"
                                disabled={loading}
                            >+</button>
                        )}
                    </div>
                </div>

                {/* Default inline form when no configs exist */}
                {!hasConfigs && <MailConfigForm onSave={handleSaveNew} />}

                {/* Saved config cards */}
                {hasConfigs && (
                    <div className="ec-cards-grid">
                        {Object.entries(savedConfigs).map(([key, config]) => (
                            <MailConfigView
                                key={key}
                                configKey={key}
                                config={config}
                                onEdit={() => { setEditingKey(key); setIsAdding(false); }}
                                onDelete={() => handleDelete(key)}
                            />
                        ))}
                    </div>
                )}

                {/* Add dialog */}
                {hasConfigs && isAdding && (
                    <FormDialog title="New Mail Configuration" onClose={() => setIsAdding(false)}>
                        <MailConfigForm onSave={handleSaveNew} onCancel={() => setIsAdding(false)} />
                    </FormDialog>
                )}

                {/* Edit dialog */}
                {editingKey && savedConfigs[editingKey] && (
                    <FormDialog
                        title={`Edit — ${editingKey.replace(/_/g, " ").toUpperCase()}`}
                        onClose={() => setEditingKey(null)}
                    >
                        <MailConfigForm
                            initialData={configToForm(savedConfigs[editingKey])}
                            onSave={handleSaveEdit}
                            onCancel={() => setEditingKey(null)}
                        />
                    </FormDialog>
                )}
            </div>
        </div>
    );
}
