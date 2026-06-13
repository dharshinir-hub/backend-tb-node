import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Button, IconButton, Tooltip, Divider, Typography, Snackbar, Menu } from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import FormatColorTextIcon from '@mui/icons-material/FormatColorText';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import GridOnIcon from '@mui/icons-material/GridOn';
import mammoth from 'mammoth/mammoth.browser';
import {
  Document as DocxDocument, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  PageOrientation, convertMillimetersToTwip, Table, TableRow, TableCell, WidthType, BorderStyle,
} from 'docx';
import { getDocUrl, replaceDocumentFile, uploadDocument, saveDocHtml, getDocHtml } from '../../../Services/app/zumendocservice';
import { alertCreated, alertSaved, alertError } from '../ppwAlerts';

// Page layout (Word/Google-Docs style). Dimensions in millimetres.
const PAGE_SIZES = {
  A5: { w: 148, h: 210 }, A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 },
  A2: { w: 420, h: 594 }, A1: { w: 594, h: 841 },
  Letter: { w: 215.9, h: 279.4 }, Legal: { w: 215.9, h: 355.6 },
};
const MARGINS = { narrow: 12.7, normal: 25.4, wide: 50.8 }; // mm
const MM_TO_PX = 3.7795; // ~96 dpi

// ---- HTML (contentEditable) -> docx paragraphs (native OOXML) ----
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };
const FONT_SIZE_HALFPT = { 1: 16, 2: 20, 3: 24, 4: 28, 5: 36, 6: 48, 7: 72 };
const toHex = (c) => {
  if (!c) return undefined;
  const s = String(c).trim();
  if (s[0] === '#') { const h = s.slice(1); return (h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6)).toUpperCase(); }
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) return [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
};
const runsFrom = (node, fmt) => {
  const runs = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      if (child.textContent) runs.push(new TextRun({ text: child.textContent, bold: fmt.bold, italics: fmt.italic, underline: fmt.underline ? {} : undefined, strike: fmt.strike, color: fmt.color, size: fmt.size, font: fmt.font }));
      return;
    }
    if (child.nodeType !== 1) return;
    const t = child.tagName.toLowerCase();
    if (t === 'br') { runs.push(new TextRun({ text: '', break: 1 })); return; }
    const f = { ...fmt };
    if (t === 'b' || t === 'strong') f.bold = true;
    if (t === 'i' || t === 'em') f.italic = true;
    if (t === 'u' || t === 'ins') f.underline = true;
    if (t === 's' || t === 'strike' || t === 'del') f.strike = true;
    const st = child.style || {};
    if (st.color) f.color = toHex(st.color) || f.color;
    if (st.fontFamily) f.font = st.fontFamily.replace(/['"]/g, '').split(',')[0].trim();
    if (st.fontSize) { const px = parseFloat(st.fontSize); if (px) f.size = Math.round(px * 1.5); }
    if (st.fontWeight === 'bold' || +st.fontWeight >= 600) f.bold = true;
    if (st.fontStyle === 'italic') f.italic = true;
    if (st.textDecoration && st.textDecoration.includes('underline')) f.underline = true;
    if (t === 'font') {
      if (child.getAttribute('color')) f.color = toHex(child.getAttribute('color')) || f.color;
      if (child.getAttribute('face')) f.font = child.getAttribute('face');
      const sz = child.getAttribute('size'); if (sz && FONT_SIZE_HALFPT[sz]) f.size = FONT_SIZE_HALFPT[sz];
    }
    runs.push(...runsFrom(child, f));
  });
  return runs;
};
const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const tableFrom = (tableEl) => {
  const rows = [];
  tableEl.querySelectorAll('tr').forEach((tr) => {
    const cells = [];
    Array.from(tr.children).forEach((cell) => {
      const tag = cell.tagName.toLowerCase();
      if (tag !== 'td' && tag !== 'th') return;
      cells.push(new TableCell({ children: [new Paragraph({ children: runsFrom(cell, tag === 'th' ? { bold: true } : {}) })] }));
    });
    if (cells.length) rows.push(new TableRow({ children: cells }));
  });
  if (!rows.length) return null;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: { top: TABLE_BORDER, bottom: TABLE_BORDER, left: TABLE_BORDER, right: TABLE_BORDER, insideHorizontal: TABLE_BORDER, insideVertical: TABLE_BORDER },
  });
};

const htmlToParagraphs = (html) => {
  const div = window.document.createElement('div');
  div.innerHTML = html;
  const paras = [];
  const handle = (el) => {
    if (el.nodeType === 3) { if (el.textContent.trim()) paras.push(new Paragraph({ children: [new TextRun(el.textContent)] })); return; }
    if (el.nodeType !== 1) return;
    const t = el.tagName.toLowerCase();
    const align = ALIGN[(el.style && el.style.textAlign) || ''];
    if (['h1', 'h2', 'h3', 'h4'].includes(t)) {
      const hl = { h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3, h4: HeadingLevel.HEADING_4 }[t];
      paras.push(new Paragraph({ children: runsFrom(el, {}), heading: hl, alignment: align }));
    } else if (t === 'ul' || t === 'ol') {
      Array.from(el.children).forEach((li) => { if (li.tagName.toLowerCase() === 'li') paras.push(new Paragraph({ children: runsFrom(li, {}), bullet: t === 'ul' ? { level: 0 } : undefined, numbering: t === 'ol' ? { reference: 'ol', level: 0 } : undefined })); });
    } else if (t === 'table') {
      const tbl = tableFrom(el);
      if (tbl) { paras.push(tbl); paras.push(new Paragraph({ children: [] })); } // trailing para keeps Word happy
    } else if (t === 'p' || t === 'div') {
      const hasBlocks = Array.from(el.children).some((c) => ['p', 'div', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'table'].includes(c.tagName.toLowerCase()));
      if (hasBlocks) Array.from(el.childNodes).forEach(handle);
      else paras.push(new Paragraph({ children: runsFrom(el, {}), alignment: align }));
    } else {
      paras.push(new Paragraph({ children: runsFrom(el, {}), alignment: align }));
    }
  };
  Array.from(div.childNodes).forEach(handle);
  if (!paras.length) paras.push(new Paragraph({ children: [] }));
  return paras;
};

const FONTS = ['Default', 'Arial', 'Calibri', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma'];
const SIZES = [{ v: '1', l: '8' }, { v: '2', l: '10' }, { v: '3', l: '12' }, { v: '4', l: '14' }, { v: '5', l: '18' }, { v: '6', l: '24' }, { v: '7', l: '36' }];
const PALETTE = ['#000000', '#cc0000', '#ec6e17', '#f59e0b', '#10b981', '#2563eb', '#7c3aed', '#ffffff', '#fde68a', '#bbf7d0'];
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// In-app Word document viewer/editor. Reads .docx -> HTML via mammoth, edits with
// a rich-text contentEditable, and writes HTML -> native .docx via html-to-docx.
const WordEditor = ({ doc, editable = true, onCreated, onClose }) => {
  const ref = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [snack, setSnack] = useState('');
  const [fillAnchor, setFillAnchor] = useState(null);
  const [textAnchor, setTextAnchor] = useState(null);
  const [tableAnchor, setTableAnchor] = useState(null);
  const savedRange = useRef(null);
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [margin, setMargin] = useState('normal');
  const key = doc && doc.resourceId;

  // Derived page geometry (used for both the on-screen page and the exported .docx).
  const dims = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
  const isLandscape = orientation === 'landscape';
  const pageWmm = isLandscape ? dims.h : dims.w;
  const pageHmm = isLandscape ? dims.w : dims.h;
  const marginMm = MARGINS[margin] ?? MARGINS.normal;
  const pageWpx = Math.round(pageWmm * MM_TO_PX);
  const pageHpx = Math.round(pageHmm * MM_TO_PX);
  const padPx = Math.round(marginMm * MM_TO_PX);

  useEffect(() => {
    let alive = true; setLoading(true); setErr(null);
    if (ref.current) ref.current.innerHTML = ''; // drop the previous doc's content while the new one loads
    (async () => {
      try {
        let html = '<p><br/></p>';
        if (doc && doc.resourceId) {
          // Prefer the in-app HTML sidecar (keeps colour/font/size/highlight); the
          // .docx via mammoth is only a fallback for files uploaded from outside.
          let sidecar = null;
          try { sidecar = doc.id ? await getDocHtml(doc.drawingId, doc.id) : null; } catch (e) { sidecar = null; }
          if (sidecar && sidecar.trim()) {
            html = sidecar;
          } else {
            const url = await getDocUrl(doc);
            if (url) {
              const buf = await (await fetch(url)).arrayBuffer();
              const res = await mammoth.convertToHtml({ arrayBuffer: buf });
              html = res.value && res.value.trim() ? res.value : '<p><br/></p>';
            }
          }
        }
        if (alive && ref.current) ref.current.innerHTML = html;
      } catch (e) { if (alive) setErr(e.message || 'Could not open document'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const cmd = (c, v = null) => { document.execCommand(c, false, v); if (ref.current) ref.current.focus(); };
  const keepFocus = (e) => e.preventDefault(); // stop toolbar from stealing the selection

  // Native <select> dropdowns and MUI menus blur the editor and drop its text
  // selection, so execCommand has nothing to act on. We snapshot the selection
  // when the control is pressed and restore it before running the command.
  const saveSelection = () => {
    const s = window.getSelection();
    if (s && s.rangeCount && ref.current && ref.current.contains(s.anchorNode)) savedRange.current = s.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    if (ref.current) ref.current.focus();
    const r = savedRange.current; if (!r) return;
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  };
  const cmdSel = (c, v = null) => { restoreSelection(); document.execCommand(c, false, v); if (ref.current) ref.current.focus(); saveSelection(); };

  const insertTable = (rows, cols) => {
    restoreSelection();
    let html = '<table style="border-collapse:collapse;width:100%"><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += '<td style="border:1px solid #cbd5e1;padding:4px 6px;min-width:48px">&nbsp;</td>';
      html += '</tr>';
    }
    html += '</tbody></table><p><br/></p>';
    document.execCommand('insertHTML', false, html);
    if (ref.current) ref.current.focus();
    setTableAnchor(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const html = ref.current ? ref.current.innerHTML : '<p></p>';
      const mt = convertMillimetersToTwip(marginMm);
      const docxDoc = new DocxDocument({
        numbering: { config: [{ reference: 'ol', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }] }] },
        sections: [{
          properties: {
            page: {
              size: {
                width: convertMillimetersToTwip(pageWmm),
                height: convertMillimetersToTwip(pageHmm),
                orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
              },
              margin: { top: mt, right: mt, bottom: mt, left: mt },
            },
          },
          children: htmlToParagraphs(html),
        }],
      });
      const blob = await Packer.toBlob(docxDoc);
      const base = (doc.name || 'New Document').replace(/\.(docx|doc)$/i, '');
      const fileName = `${base}.docx`;
      if (!doc.resourceId) {
        const file = new File([blob], fileName, { type: DOCX_MIME });
        const newDoc = await uploadDocument(doc.drawingId, doc.docType, file, fileName);
        await saveDocHtml(doc.drawingId, newDoc.id, html);
        alertCreated('File created successfully!'); if (onCreated) onCreated(newDoc);
      } else {
        await replaceDocumentFile(doc.drawingId, doc.id, blob, fileName, 'Document edited');
        await saveDocHtml(doc.drawingId, doc.id, html);
        alertSaved('Saved successfully!');
      }
    } catch (e) { alertError(e?.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const ColorMenu = ({ anchor, onClose: close, onPick }) => (
    <Menu anchorEl={anchor} open={!!anchor} onClose={close}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 22px)', gap: 0.5, p: 1 }}>
        {PALETTE.map((c) => (<Box key={c} onMouseDown={keepFocus} onClick={() => { onPick(c); close(); }} sx={{ width: 22, height: 22, bgcolor: c, border: '1px solid #cbd5e1', borderRadius: 0.5, cursor: 'pointer' }} />))}
      </Box>
      <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, pb: 1, fontSize: 13, color: '#1a73e8', cursor: 'pointer' }}>
        <input type="color" onMouseDown={keepFocus} onChange={(e) => { onPick(e.target.value); close(); }} style={{ width: 26, height: 22, border: '1px solid #cbd5e1', borderRadius: 3, cursor: 'pointer' }} />
        Custom…
      </Box>
    </Menu>
  );

  const selStyle = { fontSize: 12, padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fff', minHeight: 0 }}>
      {editable && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 1, py: 0.5, borderBottom: '1px solid #e5e7eb', flexShrink: 0, flexWrap: 'wrap' }}>
          <Tooltip title="Undo"><IconButton size="small" onMouseDown={keepFocus} onClick={() => cmd('undo')}><UndoIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Redo"><IconButton size="small" onMouseDown={keepFocus} onClick={() => cmd('redo')}><RedoIcon fontSize="small" /></IconButton></Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <select onMouseDown={saveSelection} defaultValue="P" onChange={(e) => cmdSel('formatBlock', e.target.value)} style={{ ...selStyle }} title="Paragraph style">
            <option value="P">Normal</option><option value="H1">Heading 1</option><option value="H2">Heading 2</option><option value="H3">Heading 3</option>
          </select>
          <select onMouseDown={saveSelection} defaultValue="Default" onChange={(e) => cmdSel('fontName', e.target.value)} style={{ ...selStyle, minWidth: 110 }}>
            {FONTS.map((f) => <option key={f} value={f === 'Default' ? 'inherit' : f} style={{ fontFamily: f === 'Default' ? 'inherit' : f }}>{f}</option>)}
          </select>
          <select onMouseDown={saveSelection} defaultValue="3" onChange={(e) => cmdSel('fontSize', e.target.value)} style={{ ...selStyle, width: 52 }}>
            {SIZES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Bold"><IconButton size="small" onMouseDown={keepFocus} onClick={() => cmd('bold')}><FormatBoldIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Italic"><IconButton size="small" onMouseDown={keepFocus} onClick={() => cmd('italic')}><FormatItalicIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Underline"><IconButton size="small" onMouseDown={keepFocus} onClick={() => cmd('underline')}><FormatUnderlinedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Strikethrough"><IconButton size="small" onMouseDown={keepFocus} onClick={() => cmd('strikeThrough')}><StrikethroughSIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Text color"><IconButton size="small" onMouseDown={(e) => { keepFocus(e); saveSelection(); }} onClick={(e) => setTextAnchor(e.currentTarget)}><FormatColorTextIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Highlight"><IconButton size="small" onMouseDown={(e) => { keepFocus(e); saveSelection(); }} onClick={(e) => setFillAnchor(e.currentTarget)}><FormatColorFillIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Insert table"><IconButton size="small" onMouseDown={(e) => { keepFocus(e); saveSelection(); }} onClick={(e) => setTableAnchor(e.currentTarget)}><GridOnIcon fontSize="small" /></IconButton></Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Align left"><IconButton size="small" onMouseDown={keepFocus} onClick={() => cmd('justifyLeft')}><FormatAlignLeftIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Center"><IconButton size="small" onMouseDown={keepFocus} onClick={() => cmd('justifyCenter')}><FormatAlignCenterIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Align right"><IconButton size="small" onMouseDown={keepFocus} onClick={() => cmd('justifyRight')}><FormatAlignRightIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Justify"><IconButton size="small" onMouseDown={keepFocus} onClick={() => cmd('justifyFull')}><FormatAlignJustifyIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Bulleted list"><IconButton size="small" onMouseDown={keepFocus} onClick={() => cmd('insertUnorderedList')}><FormatListBulletedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Numbered list"><IconButton size="small" onMouseDown={keepFocus} onClick={() => cmd('insertOrderedList')}><FormatListNumberedIcon fontSize="small" /></IconButton></Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} style={selStyle} title="Page size">
            {Object.keys(PAGE_SIZES).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={orientation} onChange={(e) => setOrientation(e.target.value)} style={selStyle} title="Orientation">
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
          <select value={margin} onChange={(e) => setMargin(e.target.value)} style={selStyle} title="Margins">
            <option value="narrow">Narrow</option>
            <option value="normal">Normal</option>
            <option value="wide">Wide</option>
          </select>
          <Box sx={{ flexGrow: 1 }} />
          <Button size="small" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={saving}
            onClick={save} sx={{ textTransform: 'none', bgcolor: '#ec6e17', whiteSpace: 'nowrap' }}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {onClose && <Button size="small" onClick={onClose} sx={{ textTransform: 'none', ml: 0.5, color: '#475569' }}>Close</Button>}
          <ColorMenu anchor={textAnchor} onClose={() => setTextAnchor(null)} onPick={(c) => cmdSel('foreColor', c)} />
          <ColorMenu anchor={fillAnchor} onClose={() => setFillAnchor(null)} onPick={(c) => cmdSel('hiliteColor', c)} />
          <Menu anchorEl={tableAnchor} open={!!tableAnchor} onClose={() => setTableAnchor(null)}>
            <Typography sx={{ fontSize: 11, color: '#64748b', px: 1.5, pt: 1 }}>Insert table (columns × rows)</Typography>
            <Box sx={{ p: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.5 }}>
              {[[2, 2], [3, 3], [3, 4], [4, 4], [2, 5], [5, 3]].map(([cols, rows]) => (
                <Button key={`${cols}x${rows}`} size="small" onMouseDown={keepFocus} onClick={() => insertTable(rows, cols)}
                  sx={{ textTransform: 'none', justifyContent: 'flex-start', color: '#334155' }}>
                  {cols} × {rows}
                </Button>
              ))}
            </Box>
          </Menu>
        </Box>
      )}
      <Box sx={{ flexGrow: 1, overflow: 'auto', minHeight: 0, bgcolor: '#f1f5f9', display: 'flex', justifyContent: 'center', py: 2, position: 'relative' }}>
        {err ? (
          <Typography sx={{ color: '#ef4444', p: 3 }}>Could not open document: {err}</Typography>
        ) : (
          <>
            {loading && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(241,245,249,0.7)', zIndex: 2 }}>
                <CircularProgress sx={{ color: '#ec6e17' }} />
              </Box>
            )}
            {/* Page sheet. The faint horizontal lines every page-height are
                page-break guides — the editor is one continuous flow on screen,
                but Word paginates the exported .docx at those boundaries.
                The contentEditable box is ALWAYS mounted (even while loading) so
                the load effect can inject HTML into a live ref. */}
            <Box sx={{
              width: pageWpx, maxWidth: '95%', bgcolor: '#fff', boxShadow: 1, height: 'fit-content',
              transition: 'width 0.15s',
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${pageHpx - 1}px, #dbe3ec ${pageHpx - 1}px, #dbe3ec ${pageHpx}px)`,
            }}>
              <Box
                ref={ref}
                contentEditable={editable}
                suppressContentEditableWarning
                sx={{
                  minHeight: pageHpx, p: `${padPx}px`, bgcolor: 'transparent', boxSizing: 'border-box',
                  outline: 'none', fontFamily: 'Calibri, Arial, sans-serif', fontSize: 15, lineHeight: 1.5, color: '#111827',
                  transition: 'min-height 0.15s, padding 0.15s',
                  '& h1': { fontSize: 28 }, '& h2': { fontSize: 22 }, '& h3': { fontSize: 18 },
                  '& p': { margin: '0 0 8px' }, '& ul, & ol': { paddingLeft: 28 }, '& table': { borderCollapse: 'collapse', width: '100%' }, '& td, & th': { border: '1px solid #cbd5e1', padding: '2px 6px' },
                }}
              />
            </Box>
          </>
        )}
      </Box>
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
};

export default WordEditor;
