import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, CircularProgress, Tabs, Tab, Typography, Button, Snackbar, IconButton, Tooltip,
  Menu, Divider,
} from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import FormatColorTextIcon from '@mui/icons-material/FormatColorText';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import BorderAllIcon from '@mui/icons-material/BorderAll';
import BorderOuterIcon from '@mui/icons-material/BorderOuter';
import BorderInnerIcon from '@mui/icons-material/BorderInner';
import BorderHorizontalIcon from '@mui/icons-material/BorderHorizontal';
import BorderVerticalIcon from '@mui/icons-material/BorderVertical';
import BorderTopIcon from '@mui/icons-material/BorderTop';
import BorderBottomIcon from '@mui/icons-material/BorderBottom';
import BorderLeftIcon from '@mui/icons-material/BorderLeft';
import BorderRightIcon from '@mui/icons-material/BorderRight';
import BorderClearIcon from '@mui/icons-material/BorderClear';
import AddIcon from '@mui/icons-material/Add';
import ExcelJS from 'exceljs';
import { getDocUrl, replaceDocumentFile, uploadDocument } from '../../../Services/app/zumendocservice';
import { alertCreated, alertSaved, alertError } from '../ppwAlerts';

const GUTTER_W = 46;
const DEFAULT_COL_W = 110;
const DEFAULT_ROW_H = 24;
const MIN_COLS = 26; // always show at least A–Z
const MIN_ROWS = 50;
const PALETTE = ['#ffffff', '#000000', '#cc0000', '#ff0000', '#ffd966', '#ffc000', '#00ff00', '#00b050',
  '#a64d79', '#3b82f6', '#ec6e17', '#9ca3af', '#fde68a', '#bbf7d0', '#fecaca', '#e9d5ff'];
const FONTS = ['Default', 'Arial', 'Calibri', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24];

const colLabel = (i) => { let s = ''; let n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const colNum = (s) => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n; };
const parseRef = (ref) => { const m = ref.match(/^([A-Z]+)(\d+)$/); return { c: colNum(m[1]) - 1, r: parseInt(m[2], 10) - 1 }; };
const parseRange = (rng) => { const [a, b] = rng.split(':'); const A = parseRef(a); const B = parseRef(b); return { top: Math.min(A.r, B.r), left: Math.min(A.c, B.c), bottom: Math.max(A.r, B.r), right: Math.max(A.c, B.c) }; };
const a1 = (r, c) => `${colLabel(c)}${r + 1}`;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');
const fmtDate = (d, numFmt) => {
  const Y = d.getUTCFullYear(); const M = d.getUTCMonth() + 1; const D = d.getUTCDate();
  let f = (numFmt || 'mm/dd/yyyy').replace(/\[[^\]]*\]/g, '').split(';')[0].trim().toLowerCase() || 'mm/dd/yyyy';
  return f
    .replace(/yyyy/g, Y).replace(/yy/g, String(Y).slice(-2))
    .replace(/mmmm/g, MON[M - 1]).replace(/mmm/g, MON[M - 1])
    .replace(/mm/g, p2(M)).replace(/(^|[^a-z])m([^a-z]|$)/g, (s, a, b) => `${a}${M}${b}`)
    .replace(/dd/g, p2(D)).replace(/(^|[^a-z])d([^a-z]|$)/g, (s, a, b) => `${a}${D}${b}`);
};
const argbToCss = (argb) => (argb ? `#${String(argb).slice(-6)}` : null);
const cssToArgb = (css) => `FF${String(css).replace('#', '').slice(-6).toUpperCase()}`;

// Border style (ExcelJS name) -> CSS. Used for both render and the style picker.
const BORDER_STYLES = [
  { key: 'thin', label: 'Thin', css: '1px solid' },
  { key: 'medium', label: 'Medium', css: '2px solid' },
  { key: 'thick', label: 'Thick', css: '3px solid' },
  { key: 'dashed', label: 'Dashed', css: '1px dashed' },
  { key: 'dotted', label: 'Dotted', css: '1px dotted' },
  { key: 'double', label: 'Double', css: '3px double' },
];
const BORDER_CSS = BORDER_STYLES.reduce((a, b) => ({ ...a, [b.key]: b.css }), {});
const cssBorder = (b) => (b ? `${BORDER_CSS[b.style] || '1px solid'} ${b.color || '#000000'}` : null);
const rdSide = (s) => (s && s.style ? { style: s.style, color: s.color ? argbToCss(s.color.argb) : '#000000' } : null);

const cellText = (cell) => {
  const v = cell.value;
  if (v == null) return '';
  if (v instanceof Date) return fmtDate(v, cell.numFmt);
  if (typeof v === 'object') {
    if (v.result instanceof Date) return fmtDate(v.result, cell.numFmt);
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return v.result == null ? '' : String(v.result);
    if ('text' in v) return String(v.text);
  }
  return cell.text != null ? String(cell.text) : String(v);
};
const cellBg = (cell) => {
  const f = cell.fill;
  if (f && f.type === 'pattern' && f.pattern && f.pattern !== 'none' && f.fgColor) return argbToCss(f.fgColor.argb);
  return null;
};
const xlWidthToPx = (w) => (w ? Math.round(w * 7 + 5) : DEFAULT_COL_W);
const xlHeightToPx = (h) => (h ? Math.round(h * 1.333) : DEFAULT_ROW_H);
const norm = (s) => (s ? { r1: Math.min(s.ar, s.fr), c1: Math.min(s.ac, s.fc), r2: Math.max(s.ar, s.fr), c2: Math.max(s.ac, s.fc) } : null);

const blankCell = () => ({ text: '', bg: null, fg: null, bold: false, align: null, fontName: null, fontSize: null, bdr: { top: null, bottom: null, left: null, right: null } });

// Build a blank in-memory sheet model (for "create new file").
const blankSheet = (name, nRows = MIN_ROWS, nCols = MIN_COLS) => ({
  name,
  cells: Array.from({ length: nRows }, () => Array.from({ length: nCols }, () => blankCell())),
  covered: new Set(), masters: {}, nCols, colW: {}, rowH: {},
});

// Pad a loaded sheet up to the minimum grid so there's always room to type
// (a saved file may only report up to its last used column/row).
const padSheet = (s) => {
  const nCols = Math.max(s.nCols, MIN_COLS);
  const nRows = Math.max(s.cells.length, MIN_ROWS);
  const cells = [];
  for (let r = 0; r < nRows; r++) {
    const row = s.cells[r] ? s.cells[r].slice() : [];
    while (row.length < nCols) row.push(blankCell());
    cells.push(row);
  }
  return { ...s, cells, nCols };
};

const SheetPreview = ({ doc, editable = true, onCreated, onClose }) => {
  const [sheets, setSheets] = useState(null);
  const [active, setActive] = useState(0);
  const [err, setErr] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState('');
  const [sel, setSel] = useState(null); // { ar, ac, fr, fc }
  const [fillAnchor, setFillAnchor] = useState(null);
  const [textAnchor, setTextAnchor] = useState(null);
  const [borderAnchor, setBorderAnchor] = useState(null);
  const [borderStyle, setBorderStyle] = useState('thin');
  const [borderColor, setBorderColor] = useState('#000000');
  const [gen, setGen] = useState(0); // bump to remount the grid (resets contentEditable)
  const [colW, setColW] = useState({}); // override widths, key `${si}:${ci}` -> px
  const [rowH, setRowH] = useState({}); // override heights, key `${si}:${ri}` -> px
  const [resizeMsg, setResizeMsg] = useState('');
  const [, force] = useState(0);
  const bufRef = useRef(null);
  const editsRef = useRef({});
  const styleEditsRef = useRef({});
  const mergeOpsRef = useRef({}); // { si: [{action, range}] }
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const undoFnRef = useRef(() => {});
  const redoFnRef = useRef(() => {});
  const selectingRef = useRef(false); // drag-to-select in progress
  const dragRef = useRef(null);
  const key = doc && doc.resourceId;

  useEffect(() => {
    let alive = true;
    setSheets(null); setErr(null); setActive(0); setDirty(false); setSel(null); setColW({}); setRowH({});
    editsRef.current = {}; styleEditsRef.current = {}; mergeOpsRef.current = {};
    undoRef.current = []; redoRef.current = [];
    (async () => {
      try {
        if (doc && doc.isNew && !doc.resourceId) { bufRef.current = null; if (alive) setSheets([blankSheet('Sheet1')]); return; }
        const url = await getDocUrl(doc);
        if (!url) throw new Error('Could not load file');
        const buf = await (await fetch(url)).arrayBuffer();
        bufRef.current = buf.slice(0);
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const out = wb.worksheets.map((ws) => {
          const nCols = Math.max(ws.columnCount, 1);
          const nRows = Math.max(ws.rowCount, 1);
          const merges = (ws.model.merges || []).map(parseRange);
          const covered = new Set(); const masters = {};
          merges.forEach((m) => {
            masters[`${m.top},${m.left}`] = { rowspan: m.bottom - m.top + 1, colspan: m.right - m.left + 1 };
            for (let r = m.top; r <= m.bottom; r++) for (let c = m.left; c <= m.right; c++) { if (!(r === m.top && c === m.left)) covered.add(`${r},${c}`); }
          });
          const cells = [];
          for (let r = 0; r < nRows; r++) {
            const row = [];
            for (let c = 0; c < nCols; c++) {
              const cell = ws.getCell(r + 1, c + 1);
              const fnt = cell.font || {};
              const bd = cell.border || {};
              row.push({
                text: cellText(cell), bg: cellBg(cell),
                fg: fnt.color ? argbToCss(fnt.color.argb) : null, bold: !!fnt.bold,
                align: (cell.alignment && cell.alignment.horizontal) || null,
                fontName: fnt.name || null, fontSize: fnt.size || null,
                bdr: { top: rdSide(bd.top), bottom: rdSide(bd.bottom), left: rdSide(bd.left), right: rdSide(bd.right) },
              });
            }
            cells.push(row);
          }
          const colW = {}; for (let c = 0; c < nCols; c++) { const w = ws.getColumn(c + 1).width; if (w) colW[c] = xlWidthToPx(w); }
          const rowH = {}; for (let r = 0; r < nRows; r++) { const h = ws.getRow(r + 1).height; if (h) rowH[r] = xlHeightToPx(h); }
          return { name: ws.name, cells, covered, masters, nCols, colW, rowH };
        });
        if (alive) setSheets(out.map(padSheet));
      } catch (e) { if (alive) setErr(e.message || 'Could not read spreadsheet'); }
    })();
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // End drag-select on any mouseup.
  useEffect(() => {
    const up = () => { selectingRef.current = false; document.body.style.userSelect = ''; };
    document.addEventListener('mouseup', up);
    return () => document.removeEventListener('mouseup', up);
  }, []);

  // Ctrl+Z / Ctrl+Y keyboard shortcuts (model-level undo/redo).
  useEffect(() => {
    if (!editable) return undefined;
    const h = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); undoFnRef.current(); }
      else if (k === 'y') { e.preventDefault(); redoFnRef.current(); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [editable]);

  const sh = sheets && (sheets[active] || sheets[0]);
  const cols = sh ? Array.from({ length: sh.nCols }, (_, i) => i) : [];
  const rng = norm(sel);

  // ---- undo / redo (snapshot the model + pending edits before each change) ----
  const snapshot = () => ({
    sheets: (sheets || []).map((s) => ({ ...s, cells: s.cells.map((row) => row.map((c) => ({ ...c }))), masters: { ...s.masters }, covered: new Set(s.covered), colW: { ...s.colW }, rowH: { ...s.rowH } })),
    edits: JSON.parse(JSON.stringify(editsRef.current)),
    styleEdits: JSON.parse(JSON.stringify(styleEditsRef.current)),
    mergeOps: JSON.parse(JSON.stringify(mergeOpsRef.current)),
  });
  const restore = (snap) => {
    setSheets(snap.sheets.map((s) => ({ ...s, cells: s.cells.map((row) => row.map((c) => ({ ...c }))), masters: { ...s.masters }, covered: new Set(s.covered), colW: { ...s.colW }, rowH: { ...s.rowH } })));
    editsRef.current = JSON.parse(JSON.stringify(snap.edits));
    styleEditsRef.current = JSON.parse(JSON.stringify(snap.styleEdits));
    mergeOpsRef.current = JSON.parse(JSON.stringify(snap.mergeOps));
    setDirty(!!(Object.keys(snap.edits).length || Object.keys(snap.styleEdits).length || Object.keys(snap.mergeOps).length));
    setGen((g) => g + 1);
  };
  const beginChange = () => { undoRef.current.push(snapshot()); if (undoRef.current.length > 60) undoRef.current.shift(); redoRef.current = []; };
  const undo = () => { if (!undoRef.current.length) return; redoRef.current.push(snapshot()); restore(undoRef.current.pop()); };
  const redo = () => { if (!redoRef.current.length) return; undoRef.current.push(snapshot()); restore(redoRef.current.pop()); };
  undoFnRef.current = undo; redoFnRef.current = redo;

  const onCellEdit = useCallback((ri, ci, value) => {
    if (!sh) return;
    if (sh.cells[ri][ci].text === value) return;
    beginChange();
    sh.cells[ri][ci].text = value;
    if (!editsRef.current[active]) editsRef.current[active] = {};
    editsRef.current[active][`${ri},${ci}`] = value;
    setDirty(true);
  }, [active, sh]);

  const targetCells = () => {
    if (!rng || !sh) return [];
    const out = [];
    for (let r = rng.r1; r <= rng.r2; r++) for (let c = rng.c1; c <= rng.c2; c++) out.push([r, c]);
    return out;
  };
  const applyStyle = (patch) => {
    const tc = targetCells();
    if (!tc.length) { setSnack('Select a cell / row number / column letter first'); return; }
    beginChange();
    if (!styleEditsRef.current[active]) styleEditsRef.current[active] = {};
    tc.forEach(([r, c]) => {
      const cell = sh.cells[r][c] || (sh.cells[r][c] = { text: '' });
      Object.assign(cell, patch);
      styleEditsRef.current[active][`${r},${c}`] = { ...(styleEditsRef.current[active][`${r},${c}`] || {}), ...patch };
    });
    setDirty(true); force((n) => n + 1);
  };
  // Apply borders to the selection. pos = all|outer|inner|horizontal|vertical|top|bottom|left|right|none.
  const applyBorder = (pos) => {
    if (!rng || !sh) { setSnack('Select a cell / range first'); return; }
    beginChange();
    if (!styleEditsRef.current[active]) styleEditsRef.current[active] = {};
    const line = pos === 'none' ? null : { style: borderStyle, color: borderColor };
    const setSide = (r, c, side, val) => {
      const cell = sh.cells[r][c] || (sh.cells[r][c] = { text: '' });
      cell.bdr = { ...(cell.bdr || {}), [side]: val };
      const prev = styleEditsRef.current[active][`${r},${c}`] || {};
      styleEditsRef.current[active][`${r},${c}`] = { ...prev, bdr: { ...(prev.bdr || cell.bdr) } };
      // keep edit record's bdr in sync with the live cell border
      styleEditsRef.current[active][`${r},${c}`].bdr = { ...cell.bdr };
    };
    for (let r = rng.r1; r <= rng.r2; r++) {
      for (let c = rng.c1; c <= rng.c2; c++) {
        if (pos === 'all') { ['top', 'bottom', 'left', 'right'].forEach((s) => setSide(r, c, s, line)); }
        else if (pos === 'none') { ['top', 'bottom', 'left', 'right'].forEach((s) => setSide(r, c, s, null)); }
        else if (pos === 'outer') { if (r === rng.r1) setSide(r, c, 'top', line); if (r === rng.r2) setSide(r, c, 'bottom', line); if (c === rng.c1) setSide(r, c, 'left', line); if (c === rng.c2) setSide(r, c, 'right', line); }
        else if (pos === 'inner') { if (r < rng.r2) setSide(r, c, 'bottom', line); if (c < rng.c2) setSide(r, c, 'right', line); }
        else if (pos === 'horizontal') { if (r < rng.r2) setSide(r, c, 'bottom', line); }
        else if (pos === 'vertical') { if (c < rng.c2) setSide(r, c, 'right', line); }
        else if (pos === 'top') { if (r === rng.r1) setSide(r, c, 'top', line); }
        else if (pos === 'bottom') { if (r === rng.r2) setSide(r, c, 'bottom', line); }
        else if (pos === 'left') { if (c === rng.c1) setSide(r, c, 'left', line); }
        else if (pos === 'right') { if (c === rng.c2) setSide(r, c, 'right', line); }
      }
    }
    setBorderAnchor(null); setDirty(true); force((n) => n + 1);
  };

  const selBold = rng && sh ? !!sh.cells[rng.r1][rng.c1].bold : false;
  const selFont = rng && sh ? (sh.cells[rng.r1][rng.c1].fontName || 'Default') : 'Default';
  const selSize = rng && sh ? (sh.cells[rng.r1][rng.c1].fontSize || 11) : 11;

  const doMerge = () => {
    if (!rng || (rng.r1 === rng.r2 && rng.c1 === rng.c2)) { setSnack('Select 2+ cells to merge (shift-click)'); return; }
    beginChange();
    sh.masters[`${rng.r1},${rng.c1}`] = { rowspan: rng.r2 - rng.r1 + 1, colspan: rng.c2 - rng.c1 + 1 };
    for (let r = rng.r1; r <= rng.r2; r++) for (let c = rng.c1; c <= rng.c2; c++) { if (!(r === rng.r1 && c === rng.c1)) sh.covered.add(`${r},${c}`); }
    if (!mergeOpsRef.current[active]) mergeOpsRef.current[active] = [];
    mergeOpsRef.current[active].push({ action: 'merge', range: `${a1(rng.r1, rng.c1)}:${a1(rng.r2, rng.c2)}` });
    setDirty(true); force((n) => n + 1);
  };
  const doUnmerge = () => {
    if (!rng) return;
    const k = `${rng.r1},${rng.c1}`; const span = sh.masters[k];
    if (!span) { setSnack('Select a merged cell to unmerge'); return; }
    beginChange();
    for (let r = rng.r1; r < rng.r1 + span.rowspan; r++) for (let c = rng.c1; c < rng.c1 + span.colspan; c++) sh.covered.delete(`${r},${c}`);
    const range = `${a1(rng.r1, rng.c1)}:${a1(rng.r1 + span.rowspan - 1, rng.c1 + span.colspan - 1)}`;
    delete sh.masters[k];
    if (!mergeOpsRef.current[active]) mergeOpsRef.current[active] = [];
    mergeOpsRef.current[active].push({ action: 'unmerge', range });
    setDirty(true); force((n) => n + 1);
  };

  // resize — React-state driven so the table reliably reflows.
  const onMove = useCallback((e) => {
    const d = dragRef.current; if (!d) return;
    if (d.type === 'col') { const w = Math.max(36, d.start + (e.clientX - d.pos)); setResizeMsg(`Column ${colLabel(d.i)} → ${Math.round(w)}px`); setColW((p) => ({ ...p, [`${d.si}:${d.i}`]: w })); }
    else { const h = Math.max(16, d.start + (e.clientY - d.pos)); setResizeMsg(`Row ${d.i + 1} → ${Math.round(h)}px`); setRowH((p) => ({ ...p, [`${d.si}:${d.i}`]: h })); }
  }, []);
  const onUp = useCallback(() => {
    dragRef.current = null; setDirty(true); setResizeMsg('');
    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
    document.body.style.cursor = ''; document.body.style.userSelect = '';
  }, [onMove]);
  const startDrag = (type, i, e) => {
    e.preventDefault(); e.stopPropagation();
    const k = `${active}:${i}`;
    const start = type === 'col' ? (colW[k] || (sh && sh.colW[i]) || DEFAULT_COL_W) : (rowH[k] || (sh && sh.rowH[i]) || DEFAULT_ROW_H);
    dragRef.current = { type, i, si: active, pos: type === 'col' ? e.clientX : e.clientY, start };
    setResizeMsg(type === 'col' ? `Column ${colLabel(i)}` : `Row ${i + 1}`);
    document.body.style.cursor = type === 'col' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  };
  const colWidth = (ci) => colW[`${active}:${ci}`] || (sh && sh.colW[ci]) || DEFAULT_COL_W;
  const rowHeight = (ri) => rowH[`${active}:${ri}`] || (sh && sh.rowH[ri]) || DEFAULT_ROW_H;

  // Extend the grid (mutates the active sheet model in place, like cell edits do).
  const addColumns = (n = 1) => {
    if (!sh) return;
    beginChange();
    sh.nCols += n;
    sh.cells.forEach((row) => { for (let i = 0; i < n; i++) row.push(blankCell()); });
    setDirty(true); setGen((g) => g + 1);
    setSnack(`Added ${n} column${n > 1 ? 's' : ''} — now up to ${colLabel(sh.nCols - 1)}`);
  };
  const addRows = (n = 1) => {
    if (!sh) return;
    beginChange();
    for (let i = 0; i < n; i++) sh.cells.push(Array.from({ length: sh.nCols }, () => blankCell()));
    setDirty(true); setGen((g) => g + 1);
    setSnack(`Added ${n} row${n > 1 ? 's' : ''} — now ${sh.cells.length} rows`);
  };
  const addSheet = () => {
    const list = sheets || [];
    const idx = list.length;
    beginChange();
    setSheets([...list, blankSheet(`Sheet${idx + 1}`)]);
    setActive(idx); setSel(null); setDirty(true); setGen((g) => g + 1);
    setSnack('Sheet added');
  };

  const coerce = (v) => { const s = String(v).trim(); if (s !== '' && /^-?\d+(\.\d+)?$/.test(s)) return Number(s); return v; };

  // Build a fresh workbook from the in-memory model (used when creating a NEW file).
  const buildWorkbook = () => {
    const wb = new ExcelJS.Workbook();
    (sheets || []).forEach((s, si) => {
      const ws = wb.addWorksheet((s.name || `Sheet${si + 1}`).slice(0, 31));
      s.cells.forEach((row, r) => row.forEach((cell, c) => {
        if (!cell) return;
        const xc = ws.getCell(r + 1, c + 1);
        if (cell.text !== '' && cell.text != null) xc.value = coerce(cell.text);
        if (cell.bg) xc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cssToArgb(cell.bg) } };
        const f = {}; if (cell.bold) f.bold = true; if (cell.fg) f.color = { argb: cssToArgb(cell.fg) }; if (cell.fontName && cell.fontName !== 'Default') f.name = cell.fontName; if (cell.fontSize) f.size = cell.fontSize;
        if (Object.keys(f).length) xc.font = f;
        if (cell.align) xc.alignment = { horizontal: cell.align };
        const b = cell.bdr; if (b && (b.top || b.bottom || b.left || b.right)) { const mk = (x) => (x ? { style: x.style, color: { argb: cssToArgb(x.color) } } : undefined); xc.border = { top: mk(b.top), bottom: mk(b.bottom), left: mk(b.left), right: mk(b.right) }; }
      }));
      Object.entries(s.masters).forEach(([k, span]) => { const [r, c] = k.split(',').map(Number); try { ws.mergeCells(r + 1, c + 1, r + span.rowspan, c + span.colspan); } catch (e) { /* skip */ } });
      Object.keys(colW).forEach((k) => { const [ksi, ci] = k.split(':').map(Number); if (ksi === si) ws.getColumn(ci + 1).width = Math.max(2, (colW[k] - 5) / 7); });
      Object.keys(rowH).forEach((k) => { const [ksi, ri] = k.split(':').map(Number); if (ksi === si) ws.getRow(ri + 1).height = Math.max(2, rowH[k] / 1.333); });
    });
    return wb;
  };

  const save = async () => {
    setSaving(true);
    try {
      // NEW file: build the workbook from scratch and create the document.
      if (!doc.resourceId) {
        const wb = buildWorkbook();
        const outBuf = await wb.xlsx.writeBuffer();
        const blob = new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fileName = /\.xlsx$/i.test(doc.name) ? doc.name : `${(doc.name || 'New Sheet').replace(/\.(xls|csv|ods)$/i, '')}.xlsx`;
        const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const newDoc = await uploadDocument(doc.drawingId, doc.docType, file, fileName);
        editsRef.current = {}; styleEditsRef.current = {}; mergeOpsRef.current = {}; setColW({}); setRowH({});
        setDirty(false); alertCreated('File created successfully!');
        if (onCreated) onCreated(newDoc);
        return;
      }
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(bufRef.current);
      // Add any sheets the user created in-app that aren't in the original file
      // (use a unique name — ExcelJS throws on a duplicate worksheet name).
      (sheets || []).forEach((s, si) => {
        if (wb.worksheets[si]) return;
        let nm = (s.name || `Sheet${si + 1}`).slice(0, 31);
        let k = 2; while (wb.getWorksheet(nm)) nm = `${(s.name || 'Sheet').slice(0, 27)}_${k++}`;
        wb.addWorksheet(nm);
      });
      Object.entries(editsRef.current).forEach(([si, edits]) => {
        const ws = wb.worksheets[+si]; if (!ws) return;
        Object.entries(edits).forEach(([rc, val]) => { const [r, c] = rc.split(',').map(Number); ws.getCell(r + 1, c + 1).value = coerce(val); });
      });
      Object.entries(styleEditsRef.current).forEach(([si, edits]) => {
        const ws = wb.worksheets[+si]; if (!ws) return;
        Object.entries(edits).forEach(([rc, s]) => {
          const [r, c] = rc.split(',').map(Number); const cell = ws.getCell(r + 1, c + 1); let f = { ...(cell.font || {}) };
          if ('bg' in s) cell.fill = s.bg ? { type: 'pattern', pattern: 'solid', fgColor: { argb: cssToArgb(s.bg) } } : { type: 'pattern', pattern: 'none' };
          if ('bold' in s) f.bold = !!s.bold;
          if ('fg' in s) f.color = { argb: cssToArgb(s.fg) };
          if ('fontName' in s) f.name = s.fontName === 'Default' ? undefined : s.fontName;
          if ('fontSize' in s) f.size = s.fontSize;
          if ('bold' in s || 'fg' in s || 'fontName' in s || 'fontSize' in s) cell.font = f;
          if ('align' in s) cell.alignment = { ...(cell.alignment || {}), horizontal: s.align };
          if ('bdr' in s) {
            const b = s.bdr; const mk = (x) => (x ? { style: x.style, color: { argb: cssToArgb(x.color) } } : undefined);
            cell.border = { top: mk(b.top), bottom: mk(b.bottom), left: mk(b.left), right: mk(b.right) };
          }
        });
      });
      Object.entries(mergeOpsRef.current).forEach(([si, ops]) => {
        const ws = wb.worksheets[+si]; if (!ws) return;
        ops.forEach((op) => { try { if (op.action === 'merge') ws.mergeCells(op.range); else ws.unMergeCells(op.range); } catch (e) { /* skip conflicting */ } });
      });
      Object.entries(colW).forEach(([k, w]) => { const [si, ci] = k.split(':').map(Number); const ws = wb.worksheets[si]; if (ws) ws.getColumn(ci + 1).width = Math.max(2, (w - 5) / 7); });
      Object.entries(rowH).forEach(([k, h]) => { const [si, ri] = k.split(':').map(Number); const ws = wb.worksheets[si]; if (ws) ws.getRow(ri + 1).height = Math.max(2, h / 1.333); });
      const outBuf = await wb.xlsx.writeBuffer();
      const blob = new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fileName = /\.xlsx$/i.test(doc.name) ? doc.name : doc.name.replace(/\.(xls|csv|ods)$/i, '.xlsx');
      await replaceDocumentFile(doc.drawingId, doc.id, blob, fileName, 'Spreadsheet edited');
      editsRef.current = {}; styleEditsRef.current = {}; mergeOpsRef.current = {}; setDirty(false); alertSaved('Saved successfully!');
    } catch (e) { alertError(e?.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  if (err) return <Box sx={{ p: 3, color: '#ef4444' }}>Could not read spreadsheet: {err}</Box>;
  if (!sheets) return <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><CircularProgress sx={{ color: '#ec6e17' }} /></Box>;

  const hdr = { border: '1px solid #c7ced9', background: '#f1f5f9', color: '#475569', fontWeight: 600, fontSize: 11, padding: '1px 4px', position: 'relative', textAlign: 'center', userSelect: 'none', cursor: editable ? 'cell' : 'default' };
  const inRange = (r, c) => rng && r >= rng.r1 && r <= rng.r2 && c >= rng.c1 && c <= rng.c2;
  const selectCell = (ri, ci, e) => {
    if (!editable) return;
    if (e && e.shiftKey && sel) setSel({ ...sel, fr: ri, fc: ci });
    else { setSel({ ar: ri, ac: ci, fr: ri, fc: ci }); selectingRef.current = true; } // begin drag-select
  };
  // Extend the selection rectangle while dragging with the button held.
  const onCellEnter = (ri, ci, e) => {
    if (!editable || !selectingRef.current || e.buttons !== 1) return;
    document.body.style.userSelect = 'none';
    const s = window.getSelection && window.getSelection(); if (s) s.removeAllRanges();
    setSel((prev) => (prev ? { ...prev, fr: ri, fc: ci } : { ar: ri, ac: ci, fr: ri, fc: ci }));
  };

  const ColorMenu = ({ anchor, onClose, onPick, allowNone }) => (
    <Menu anchorEl={anchor} open={!!anchor} onClose={onClose}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gap: 0.5, p: 1 }}>
        {PALETTE.map((c) => (<Box key={c} onClick={() => { onPick(c); onClose(); }} sx={{ width: 22, height: 22, bgcolor: c, border: '1px solid #cbd5e1', borderRadius: 0.5, cursor: 'pointer' }} />))}
      </Box>
      <Divider />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75 }}>
        <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', fontSize: 13, color: '#1a73e8' }}>
          <input type="color" onChange={(e) => { onPick(e.target.value); onClose(); }} style={{ width: 26, height: 22, padding: 0, border: '1px solid #cbd5e1', borderRadius: 3, background: 'none', cursor: 'pointer' }} />
          Custom…
        </Box>
        {allowNone && <Button size="small" onClick={() => { onPick(null); onClose(); }} sx={{ textTransform: 'none', ml: 'auto' }}>No fill</Button>}
      </Box>
    </Menu>
  );
  const selStyle = { fontSize: 12, padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fff', minHeight: 0, position: 'relative' }}>
      {/* Toolbar */}
      {editable && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 1, py: 0.5, borderBottom: '1px solid #e5e7eb', flexShrink: 0, flexWrap: 'wrap' }}>
          <Tooltip title="Undo (Ctrl+Z)"><span><IconButton size="small" disabled={!undoRef.current.length} onClick={undo}><UndoIcon fontSize="small" /></IconButton></span></Tooltip>
          <Tooltip title="Redo (Ctrl+Y)"><span><IconButton size="small" disabled={!redoRef.current.length} onClick={redo}><RedoIcon fontSize="small" /></IconButton></span></Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <select value={selFont} onChange={(e) => applyStyle({ fontName: e.target.value })} style={{ ...selStyle, minWidth: 120, fontFamily: selFont === 'Default' ? 'inherit' : selFont }}>
            {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f === 'Default' ? 'inherit' : f, fontSize: 14 }}>{f}</option>)}
          </select>
          <select value={selSize} onChange={(e) => applyStyle({ fontSize: Number(e.target.value) })} style={{ ...selStyle, width: 56 }}>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Bold"><IconButton size="small" color={selBold ? 'primary' : 'default'} onClick={() => applyStyle({ bold: !selBold })}><FormatBoldIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Fill color"><IconButton size="small" onClick={(e) => setFillAnchor(e.currentTarget)}><FormatColorFillIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Text color"><IconButton size="small" onClick={(e) => setTextAnchor(e.currentTarget)}><FormatColorTextIcon fontSize="small" /></IconButton></Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Align left"><IconButton size="small" onClick={() => applyStyle({ align: 'left' })}><FormatAlignLeftIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Align center"><IconButton size="small" onClick={() => applyStyle({ align: 'center' })}><FormatAlignCenterIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Align right"><IconButton size="small" onClick={() => applyStyle({ align: 'right' })}><FormatAlignRightIcon fontSize="small" /></IconButton></Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Merge cells (shift-click to select a range first)"><IconButton size="small" onClick={doMerge}><CallMergeIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Unmerge"><IconButton size="small" onClick={doUnmerge}><CallSplitIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Borders"><IconButton size="small" onClick={(e) => setBorderAnchor(e.currentTarget)}><BorderAllIcon fontSize="small" /></IconButton></Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Add a column on the right"><Button size="small" onClick={() => addColumns(1)} sx={{ textTransform: 'none', minWidth: 0, px: 0.75, color: '#475569' }}>+ Col</Button></Tooltip>
          <Tooltip title="Add a row at the bottom"><Button size="small" onClick={() => addRows(1)} sx={{ textTransform: 'none', minWidth: 0, px: 0.75, color: '#475569' }}>+ Row</Button></Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          {rng && (
            <Typography sx={{ fontSize: 11, color: '#94a3b8', mr: 1 }}>
              {rng.r1 === rng.r2 && rng.c1 === rng.c2 ? `${a1(rng.r1, rng.c1)}` : `${a1(rng.r1, rng.c1)}:${a1(rng.r2, rng.c2)}`}
            </Typography>
          )}
          <Button size="small" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={saving || (!dirty && !!(doc && doc.resourceId))}
            onClick={save} sx={{ textTransform: 'none', bgcolor: '#ec6e17', whiteSpace: 'nowrap' }}>
            {saving ? 'Saving…' : (doc && !doc.resourceId) ? 'Save' : dirty ? 'Save changes' : 'Saved'}
          </Button>
          {onClose && (
            <Button size="small" onClick={onClose} sx={{ textTransform: 'none', ml: 0.5, color: '#475569' }}>Close</Button>
          )}
          <ColorMenu anchor={fillAnchor} onClose={() => setFillAnchor(null)} onPick={(c) => applyStyle({ bg: c })} allowNone />
          <ColorMenu anchor={textAnchor} onClose={() => setTextAnchor(null)} onPick={(c) => applyStyle({ fg: c || '#000000' })} />
          <Menu anchorEl={borderAnchor} open={!!borderAnchor} onClose={() => setBorderAnchor(null)}>
            <Box sx={{ p: 1, width: 230 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.25 }}>
                {[
                  ['all', 'All', <BorderAllIcon fontSize="small" />], ['inner', 'Inner', <BorderInnerIcon fontSize="small" />],
                  ['horizontal', 'Horizontal', <BorderHorizontalIcon fontSize="small" />], ['vertical', 'Vertical', <BorderVerticalIcon fontSize="small" />],
                  ['outer', 'Outer', <BorderOuterIcon fontSize="small" />], ['top', 'Top', <BorderTopIcon fontSize="small" />],
                  ['bottom', 'Bottom', <BorderBottomIcon fontSize="small" />], ['left', 'Left', <BorderLeftIcon fontSize="small" />],
                  ['right', 'Right', <BorderRightIcon fontSize="small" />], ['none', 'Clear', <BorderClearIcon fontSize="small" />],
                ].map(([pos, label, icon]) => (
                  <Tooltip key={pos} title={label}><IconButton size="small" onClick={() => applyBorder(pos)}>{icon}</IconButton></Tooltip>
                ))}
              </Box>
              <Divider sx={{ my: 1 }} />
              <Typography sx={{ fontSize: 11, color: '#64748b', mb: 0.5 }}>Line style / thickness</Typography>
              <select value={borderStyle} onChange={(e) => setBorderStyle(e.target.value)} style={{ ...selStyle, width: '100%', marginBottom: 6 }}>
                {BORDER_STYLES.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
              </select>
              <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, color: '#475569' }}>
                Line color
                <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} style={{ width: 28, height: 22, padding: 0, border: '1px solid #cbd5e1', borderRadius: 3, cursor: 'pointer' }} />
              </Box>
            </Box>
          </Menu>
        </Box>
      )}

      {resizeMsg && (
        <Box sx={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 1300,
          bgcolor: '#1a73e8', color: '#fff', px: 1.5, py: 0.5, borderRadius: 1, fontSize: 12, fontWeight: 600, boxShadow: 2 }}>
          {resizeMsg}
        </Box>
      )}
      {/* Grid */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', minHeight: 0 }}>
        <table key={`${active}-${gen}`} style={{ tableLayout: 'fixed', borderCollapse: 'collapse', width: GUTTER_W + cols.reduce((s, ci) => s + colWidth(ci), 0) }}>
          <colgroup>
            <col style={{ width: GUTTER_W }} />
            {cols.map((ci) => (<col key={ci} style={{ width: colWidth(ci) }} />))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...hdr, position: 'sticky', top: 0, left: 0, zIndex: 7, cursor: 'default' }} />
              {cols.map((ci) => (
                <th key={ci}
                  onMouseMove={editable ? (e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.cursor = (e.clientX >= r.right - 7) ? 'col-resize' : 'cell'; } : undefined}
                  onMouseDown={editable ? (e) => { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX >= r.right - 7) startDrag('col', ci, e); } : undefined}
                  onClick={() => editable && !dragRef.current && setSel({ ar: 0, ac: ci, fr: sh.cells.length - 1, fc: ci })}
                  style={{ ...hdr, position: 'sticky', top: 0, zIndex: 5, background: rng && rng.c1 <= ci && ci <= rng.c2 ? '#dbeafe' : hdr.background }}>
                  {colLabel(ci)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sh.cells.map((r, ri) => (
              <tr key={ri} style={{ height: rowHeight(ri) }}>
                <td
                  onMouseMove={editable ? (e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.cursor = (e.clientY >= r.bottom - 7) ? 'row-resize' : 'cell'; } : undefined}
                  onMouseDown={editable ? (e) => { const r = e.currentTarget.getBoundingClientRect(); if (e.clientY >= r.bottom - 7) startDrag('row', ri, e); } : undefined}
                  onClick={() => editable && !dragRef.current && setSel({ ar: ri, ac: 0, fr: ri, fc: sh.nCols - 1 })}
                  style={{ ...hdr, position: 'sticky', left: 0, zIndex: 4, background: rng && rng.r1 <= ri && ri <= rng.r2 ? '#dbeafe' : hdr.background }}>
                  {ri + 1}
                </td>
                {cols.map((ci) => {
                  if (sh.covered.has(`${ri},${ci}`)) return null;
                  const span = sh.masters[`${ri},${ci}`];
                  const cell = r[ci] || { text: '' };
                  const bd = cell.bdr || {};
                  const GRID = '1px solid #e2e8f0';
                  return (
                    <td key={ci} colSpan={span ? span.colspan : undefined} rowSpan={span ? span.rowspan : undefined}
                      contentEditable={editable} suppressContentEditableWarning
                      onMouseDown={editable ? (e) => selectCell(ri, ci, e) : undefined}
                      onMouseEnter={editable ? (e) => onCellEnter(ri, ci, e) : undefined}
                      onBlur={editable ? (e) => onCellEdit(ri, ci, e.currentTarget.textContent) : undefined}
                      style={{
                        borderTop: cssBorder(bd.top) || GRID, borderBottom: cssBorder(bd.bottom) || GRID,
                        borderLeft: cssBorder(bd.left) || GRID, borderRight: cssBorder(bd.right) || GRID,
                        padding: '1px 6px',
                        fontSize: cell.fontSize ? `${cell.fontSize}pt` : '12px',
                        fontFamily: cell.fontName || 'inherit',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', outline: 'none',
                        background: cell.bg || '#fff', color: cell.fg || '#111827',
                        fontWeight: cell.bold ? 700 : 400, textAlign: cell.align || (span ? 'center' : 'left'),
                        boxShadow: inRange(ri, ci) ? 'inset 0 0 0 2px #1a73e8' : 'none',
                      }}>
                      {cell.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      {/* Sheet tabs at the BOTTOM (like Google Sheets) */}
      <Box sx={{ borderTop: '1px solid #e5e7eb', bgcolor: '#f8fafc', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {editable && (
          <Tooltip title="Add sheet">
            <IconButton size="small" onClick={addSheet} sx={{ mx: 0.25, color: '#475569' }}><AddIcon fontSize="small" /></IconButton>
          </Tooltip>
        )}
        <Tabs value={active} onChange={(_, v) => { setActive(v); setSel(null); force((n) => n + 1); }} variant="scrollable" scrollButtons="auto"
          sx={{ flexGrow: 1, minHeight: 34, '& .MuiTab-root': { minHeight: 34, textTransform: 'none', fontSize: 12, fontWeight: 600 } }}>
          {sheets.map((s, i) => (<Tab key={i} label={s.name} />))}
        </Tabs>
      </Box>
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
};

export default SheetPreview;
