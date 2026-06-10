import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import QRCode from 'qrcode';
import {
  Box, Button, Typography, IconButton, Tooltip, Slider, TextField, MenuItem, Menu, Dialog,
  DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import RemoveIcon from '@mui/icons-material/Remove';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CreateIcon from '@mui/icons-material/Create';
import BorderColorIcon from '@mui/icons-material/BorderColor';
import TitleIcon from '@mui/icons-material/Title';
import ImageIcon from '@mui/icons-material/Image';
import ApprovalIcon from '@mui/icons-material/Approval';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import LooksOneIcon from '@mui/icons-material/LooksOne';
import NearMeIcon from '@mui/icons-material/NearMe';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

const COLORS = ['#000000', '#6b7280', '#ffffff', '#ef4444', '#2563eb', '#22c55e', '#f59e0b', '#ec6e17', '#d946ef'];
const FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Tahoma', 'Comic Sans MS'];

// Approval stamps from the ZUMEN reference. {date} is replaced with the chosen date.
const STAMPS = [
  { id: 'new-model', shape: 'rect', color: '#2563eb', lines: ['NEW MODEL', '{date}'] },
  { id: 'no-access', shape: 'rect', color: '#ef4444', lines: ['No Access', '{date}'] },
  { id: 'old-drawing', shape: 'rect', color: '#2563eb', lines: ['OLD DRAWING', 'DO NOT USE', '{date}'] },
  { id: 'quotation', shape: 'rect', color: '#ef4444', lines: ['Quotation Verified', 'Start production', '{date}'] },
  { id: 'cancelled', shape: 'rect', color: '#ef4444', lines: ['Cancelled', '{date}'] },
  { id: 'checked', shape: 'circle', color: '#2563eb', lines: ['Checked', '{date}', 'Sanjeev'] },
];

// Tool groups for the toolbar (separated by dividers, Sheets-style).
const TOOL_GROUPS = [
  ['select'],
  ['line', 'arrow', 'rect', 'circle'],
  ['pen', 'marker'],
  ['text', 'image', 'stamp', 'qr', 'seq'],
];
const VDivider = () => <Box sx={{ width: '1px', height: 24, bgcolor: '#e5e7eb', mx: 0.75 }} />;

const TOOLS = [
  { key: 'select', label: 'Select', icon: <NearMeIcon /> },
  { key: 'line', label: 'Line', icon: <RemoveIcon /> },
  { key: 'arrow', label: 'Arrow', icon: <ArrowRightAltIcon /> },
  { key: 'rect', label: 'Square', icon: <CropSquareIcon /> },
  { key: 'circle', label: 'Circle', icon: <RadioButtonUncheckedIcon /> },
  { key: 'pen', label: 'Pen', icon: <CreateIcon /> },
  { key: 'marker', label: 'Marker', icon: <BorderColorIcon /> },
  { key: 'text', label: 'Text', icon: <TitleIcon /> },
  { key: 'image', label: 'Image', icon: <ImageIcon /> },
  { key: 'stamp', label: 'Stamp', icon: <ApprovalIcon /> },
  { key: 'qr', label: 'QR', icon: <QrCode2Icon /> },
  { key: 'seq', label: 'Seq', icon: <LooksOneIcon /> },
];

const isTextObj = (o) => o && (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox');

// Rotate glyph (circular arrow) for the rotation handle. Module-level so HMR
// can't leave the prototype pointing at an undefined render function.
const drawRotateIcon = (ctx, left, top) => {
  ctx.save();
  ctx.translate(left, top);
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, 2 * Math.PI); ctx.fillStyle = '#ec6e17'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, 5, Math.PI * 0.35, Math.PI * 1.75); ctx.stroke();
  const a = Math.PI * 0.35; const ex = 5 * Math.cos(a); const ey = 5 * Math.sin(a);
  ctx.beginPath();
  ctx.moveTo(ex, ey); ctx.lineTo(ex + 4, ey - 1);
  ctx.moveTo(ex, ey); ctx.lineTo(ex + 1, ey + 4);
  ctx.stroke();
  ctx.restore();
};

const MarkupEditor = ({ doc, imageUrl, onClose, onSaved, uploadAnnotated }) => {
  const canvasElRef = useRef(null);
  const fcRef = useRef(null);
  const toolRef = useRef('select');
  const styleRef = useRef({ color: '#ef4444', thickness: 3, opacity: 1, fontSize: 24 });
  const drawRef = useRef({ down: false, shape: null, x: 0, y: 0 });
  const seqRef = useRef(1);
  const fileInputRef = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const snapshotRef = useRef(() => {});
  const openEditStampRef = useRef(() => {});
  const editTargetRef = useRef(null);

  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#ef4444');
  const [thickness, setThickness] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [fontSize, setFontSize] = useState(24);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [saving, setSaving] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [stampDate, setStampDate] = useState(new Date().toISOString().slice(0, 10));
  const [editStampOpen, setEditStampOpen] = useState(false);
  const [editLines, setEditLines] = useState('');
  const [customStamps, setCustomStamps] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createText, setCreateText] = useState('');
  const [createColor, setCreateColor] = useState('#ef4444');
  const [createShape, setCreateShape] = useState('rect');
  const [selectedObj, setSelectedObj] = useState(null);
  const [menu, setMenu] = useState(null); // { top, left } anchor for the object menu
  const menuTargetRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const baseDimsRef = useRef({ w: 0, h: 0 });

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { styleRef.current = { color, thickness, opacity, fontSize, bold, italic, fontFamily }; }, [color, thickness, opacity, fontSize, bold, italic, fontFamily]);

  const snapshot = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    undoStack.current.push(JSON.stringify(fc.toJSON()));
    if (undoStack.current.length > 40) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  // ---- init fabric + load background image ----
  useEffect(() => {
    let disposed = false;
    snapshotRef.current = snapshot;

    // Objects keep Fabric's default resize handles + rotation (mtr). The
    // Remove/Duplicate menu opens on double-click (see mouse:dblclick below).
    delete fabric.Object.prototype.controls.deleteControl;
    delete fabric.Object.prototype.controls.editControl;
    delete fabric.Object.prototype.controls.menuControl;
    // Draw the rotation handle as a rotate icon instead of a plain square.
    if (fabric.Object.prototype.controls.mtr) {
      fabric.Object.prototype.controls.mtr.withConnection = true;
      fabric.Object.prototype.controls.mtr.render = (ctx, left, top) => drawRotateIcon(ctx, left, top);
    }

    const fc = new fabric.Canvas(canvasElRef.current, { selection: true, preserveObjectStacking: true });
    fcRef.current = fc;

    // Keep the right "Selected object" panel in sync with the active object.
    const syncSel = () => {
      const o = fc.getActiveObject();
      setSelectedObj(o || null);
      if (o) {
        if (isTextObj(o) && o.fill) setColor(o.fill);
        else if (o.stroke) setColor(o.stroke);
        if (o.strokeWidth) setThickness(o.strokeWidth);
        if (typeof o.opacity === 'number') setOpacity(o.opacity);
        if (isTextObj(o)) {
          if (o.fontSize) setFontSize(o.fontSize);
          if (o.fontFamily) setFontFamily(o.fontFamily);
          setBold(o.fontWeight === 'bold');
          setItalic(o.fontStyle === 'italic');
        }
      }
    };
    fc.on('selection:created', syncSel);
    fc.on('selection:updated', syncSel);
    fc.on('selection:cleared', () => setSelectedObj(null));
    // Double-click an object to open its Remove / Duplicate menu.
    fc.on('mouse:dblclick', (o) => {
      if (o.target) {
        fc.setActiveObject(o.target);
        menuTargetRef.current = o.target;
        setMenu({ top: (o.e && o.e.clientY) || 200, left: (o.e && o.e.clientX) || 200 });
      }
    });

    fabric.Image.fromURL(imageUrl, (img) => {
      // StrictMode double-mounts this effect; the first canvas is disposed before
      // this async callback fires, so bail if it's gone.
      if (disposed || !fc.lowerCanvasEl) return;
      const maxW = window.innerWidth - 360;
      const maxH = window.innerHeight - 170;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      fc.setWidth(w);
      fc.setHeight(h);
      baseDimsRef.current = { w, h };
      img.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false });
      fc.setBackgroundImage(img, fc.renderAll.bind(fc));
      undoStack.current = [JSON.stringify(fc.toJSON())];
    }, { crossOrigin: 'anonymous' });

    // shape drawing handlers
    fc.on('mouse:down', (o) => {
      const t = toolRef.current;
      const s = styleRef.current;
      const p = fc.getPointer(o.e);
      // Clicked an existing annotation -> let it be selected/edited, don't draw a new one.
      if (o.target) return;
      if (t === 'text') {
        const it = new fabric.IText('Text', {
          left: p.x, top: p.y, fill: s.color, fontSize: s.fontSize, fontFamily: s.fontFamily,
          fontWeight: s.bold ? 'bold' : 'normal', fontStyle: s.italic ? 'italic' : 'normal',
        });
        fc.add(it); fc.setActiveObject(it); it.enterEditing();
        it.selectAll(); // highlight the placeholder so typing replaces it
        snapshot();
        return;
      }
      if (t === 'seq') {
        const n = seqRef.current; seqRef.current += 1;
        const r = 14 + s.thickness * 2;
        const circle = new fabric.Circle({ radius: r, fill: 'transparent', stroke: s.color, strokeWidth: s.thickness, originX: 'center', originY: 'center' });
        const txt = new fabric.Text(String(n), { fontSize: r, fill: s.color, originX: 'center', originY: 'center' });
        const g = new fabric.Group([circle, txt], { left: p.x, top: p.y, originX: 'center', originY: 'center' });
        fc.add(g); fc.setActiveObject(g); setSelectedObj(g); snapshot();
        return;
      }
      if (['line', 'arrow', 'rect', 'circle'].includes(t)) {
        drawRef.current = { down: true, x: p.x, y: p.y, shape: null };
        let shape;
        if (t === 'line' || t === 'arrow') {
          shape = new fabric.Line([p.x, p.y, p.x, p.y], { stroke: s.color, strokeWidth: s.thickness, opacity: s.opacity });
        } else if (t === 'rect') {
          shape = new fabric.Rect({ left: p.x, top: p.y, width: 0, height: 0, fill: 'transparent', stroke: s.color, strokeWidth: s.thickness, opacity: s.opacity });
        } else {
          shape = new fabric.Ellipse({ left: p.x, top: p.y, rx: 0, ry: 0, fill: 'transparent', stroke: s.color, strokeWidth: s.thickness, opacity: s.opacity });
        }
        drawRef.current.shape = shape;
        fc.add(shape);
      }
    });

    fc.on('mouse:move', (o) => {
      const d = drawRef.current;
      if (!d.down || !d.shape) return;
      const t = toolRef.current;
      const p = fc.getPointer(o.e);
      if (t === 'line' || t === 'arrow') {
        d.shape.set({ x2: p.x, y2: p.y });
      } else if (t === 'rect') {
        d.shape.set({ width: Math.abs(p.x - d.x), height: Math.abs(p.y - d.y), left: Math.min(p.x, d.x), top: Math.min(p.y, d.y) });
      } else if (t === 'circle') {
        d.shape.set({ rx: Math.abs(p.x - d.x) / 2, ry: Math.abs(p.y - d.y) / 2, left: Math.min(p.x, d.x), top: Math.min(p.y, d.y) });
      }
      fc.renderAll();
    });

    fc.on('mouse:up', () => {
      const d = drawRef.current;
      const t = toolRef.current;
      if (d.down && d.shape) {
        // Drop tiny/empty shapes from a click without dragging (no stray boxes).
        let tooSmall = false;
        if (t === 'line' || t === 'arrow') {
          tooSmall = Math.hypot(d.shape.x2 - d.shape.x1, d.shape.y2 - d.shape.y1) < 6;
        } else if (t === 'rect') {
          tooSmall = (d.shape.width || 0) < 6 || (d.shape.height || 0) < 6;
        } else if (t === 'circle') {
          tooSmall = (d.shape.rx || 0) < 4 || (d.shape.ry || 0) < 4;
        }
        if (tooSmall) {
          fc.remove(d.shape);
          fc.requestRenderAll();
        } else {
          let finalObj = d.shape;
          if (t === 'arrow') {
            const line = d.shape;
            const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI;
            const head = new fabric.Triangle({
              left: line.x2, top: line.y2, originX: 'center', originY: 'center',
              angle: angle + 90, width: 6 + line.strokeWidth * 3, height: 6 + line.strokeWidth * 3, fill: line.stroke,
            });
            fc.remove(line);
            const g = new fabric.Group([line, head]);
            fc.add(g);
            finalObj = g;
          }
          // Select the just-drawn shape so its move/rotate box shows immediately.
          fc.setActiveObject(finalObj);
          fc.requestRenderAll();
          setSelectedObj(finalObj);
          snapshot();
        }
      }
      drawRef.current = { down: false, shape: null, x: 0, y: 0 };
    });

    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && fc.getActiveObject() && !fc.getActiveObject().isEditing) {
        fc.getActiveObjects().forEach((ob) => fc.remove(ob));
        fc.discardActiveObject(); fc.renderAll(); snapshot();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      disposed = true;
      window.removeEventListener('keydown', onKey);
      try { fc.dispose(); } catch (e) { /* already disposed */ }
    };
  }, [imageUrl, snapshot]);

  // ---- apply tool mode ----
  useEffect(() => {
    const fc = fcRef.current;
    if (!fc) return;
    if (tool === 'pen' || tool === 'marker') {
      fc.isDrawingMode = true;
      const brush = new fabric.PencilBrush(fc);
      brush.color = tool === 'marker' ? hexA(color, 0.4) : color;
      brush.width = tool === 'marker' ? Math.max(thickness * 2, 8) : thickness;
      fc.freeDrawingBrush = brush;
    } else {
      fc.isDrawingMode = false;
      // Only the Select tool box-selects; but objects stay clickable in every tool
      // so you can click an existing one to edit it (✎/✕) without switching tools.
      fc.selection = tool === 'select';
      fc.forEachObject((o) => { o.selectable = true; o.evented = true; });
    }
    if (tool === 'image') fileInputRef.current && fileInputRef.current.click();
    if (tool === 'stamp') setStampOpen(true);
    if (tool === 'qr') addQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // Update the pen/marker brush live when color or thickness changes.
  useEffect(() => {
    const fc = fcRef.current;
    if (!fc || !fc.freeDrawingBrush) return;
    if (tool === 'pen' || tool === 'marker') {
      fc.freeDrawingBrush.color = tool === 'marker' ? hexA(color, 0.4) : color;
      fc.freeDrawingBrush.width = tool === 'marker' ? Math.max(thickness * 2, 8) : thickness;
    }
  }, [color, thickness, tool]);

  // record free-draw paths for undo
  useEffect(() => {
    const fc = fcRef.current; if (!fc) return undefined;
    const onPath = () => snapshot();
    fc.on('path:created', onPath);
    return () => fc.off('path:created', onPath);
  }, [snapshot]);

  const undo = () => {
    const fc = fcRef.current;
    if (undoStack.current.length <= 1) return;
    redoStack.current.push(undoStack.current.pop());
    fc.loadFromJSON(undoStack.current[undoStack.current.length - 1], () => fc.renderAll());
  };
  const redo = () => {
    const fc = fcRef.current;
    if (!redoStack.current.length) return;
    const st = redoStack.current.pop();
    undoStack.current.push(st);
    fc.loadFromJSON(st, () => fc.renderAll());
  };

  const addImageFromFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) { setTool('select'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      fabric.Image.fromURL(ev.target.result, (img) => {
        img.scaleToWidth(Math.min(220, fcRef.current.getWidth() / 3));
        img.set({ left: 40, top: 40 });
        fcRef.current.add(img); fcRef.current.setActiveObject(img); snapshot();
        setTool('select');
      });
    };
    reader.readAsDataURL(file);
  };

  const addQr = async () => {
    try {
      const url = await QRCode.toDataURL(doc?.name || window.location.href, { margin: 1, width: 200 });
      fabric.Image.fromURL(url, (img) => {
        img.scaleToWidth(120);
        img.set({ left: 40, top: 40 });
        fcRef.current.add(img); fcRef.current.setActiveObject(img); snapshot();
        setTool('select');
      });
    } catch (err) { setTool('select'); }
  };

  // Build a stamp group from explicit text lines, tagged so it can be re-edited.
  const makeStampGroup = (lines, color, shape) => {
    const text = new fabric.Text(lines.join('\n'), {
      fontSize: 14, fill: color, textAlign: 'center', originX: 'center', originY: 'center', fontWeight: 'bold',
    });
    const pad = 12;
    let border;
    if (shape === 'circle') {
      const r = Math.max(text.width, text.height) / 2 + pad;
      border = new fabric.Circle({ radius: r, fill: 'transparent', stroke: color, strokeWidth: 2, originX: 'center', originY: 'center' });
    } else {
      border = new fabric.Rect({
        width: text.width + pad * 2, height: text.height + pad * 2, fill: 'transparent',
        stroke: color, strokeWidth: 2, rx: 3, ry: 3, originX: 'center', originY: 'center',
      });
    }
    const g = new fabric.Group([border, text], { originX: 'center', originY: 'center' });
    g.data = { type: 'stamp', color, shape, lines };
    return g;
  };

  const addStamp = (stamp) => {
    const fc = fcRef.current;
    const lines = stamp.lines.map((l) => l.replace('{date}', stampDate.replace(/-/g, '.')));
    const g = makeStampGroup(lines, stamp.color, stamp.shape);
    g.set({ left: 140, top: 140 });
    fc.add(g); fc.setActiveObject(g); fc.requestRenderAll(); snapshot();
    setStampOpen(false); setTool('select');
  };

  const openCreateStamp = () => {
    setCreateText(''); setCreateColor('#ef4444'); setCreateShape('rect'); setCreateOpen(true);
  };
  const addCustomStamp = () => {
    const lines = createText.split('\n').filter((l) => l.length);
    if (!lines.length) { setCreateOpen(false); return; }
    const stamp = { id: 'custom-' + lines.join('|'), lines, color: createColor, shape: createShape, custom: true };
    setCustomStamps((prev) => [...prev, stamp]);
    addStamp(stamp);
    setCreateOpen(false);
  };

  const openEditStamp = (target) => {
    editTargetRef.current = target;
    setEditLines(((target.data && target.data.lines) || []).join('\n'));
    setEditStampOpen(true);
  };
  openEditStampRef.current = openEditStamp;

  const saveEditStamp = () => {
    const fc = fcRef.current;
    const target = editTargetRef.current;
    if (!target || !target.data) { setEditStampOpen(false); return; }
    const lines = editLines.split('\n').filter((l) => l.length);
    if (!lines.length) { setEditStampOpen(false); return; }
    const pos = { left: target.left, top: target.top, angle: target.angle, scaleX: target.scaleX, scaleY: target.scaleY };
    fc.remove(target);
    const g = makeStampGroup(lines, target.data.color, target.data.shape);
    g.set(pos);
    fc.add(g); fc.setActiveObject(g); fc.requestRenderAll(); snapshot();
    setEditStampOpen(false);
  };

  const deleteSelected = () => {
    const fc = fcRef.current;
    fc.getActiveObjects().forEach((o) => fc.remove(o));
    fc.discardActiveObject(); fc.renderAll(); setSelectedObj(null); snapshot();
  };

  // ≡ menu actions
  const menuRemove = () => {
    const fc = fcRef.current; const o = menuTargetRef.current;
    if (fc && o) { fc.remove(o); fc.discardActiveObject(); fc.requestRenderAll(); setSelectedObj(null); snapshot(); }
    setMenu(null);
  };
  const menuDuplicate = () => {
    const fc = fcRef.current; const o = menuTargetRef.current;
    if (fc && o) {
      o.clone((cloned) => {
        cloned.set({ left: (o.left || 0) + 24, top: (o.top || 0) + 24 });
        if (o.data) cloned.data = { ...o.data };
        fc.add(cloned); fc.setActiveObject(cloned); fc.requestRenderAll(); setSelectedObj(cloned); snapshot();
      });
    }
    setMenu(null);
  };
  const menuEditStamp = () => {
    const o = menuTargetRef.current;
    setMenu(null);
    if (o && o.data && o.data.type === 'stamp') openEditStamp(o);
  };
  const menuTargetIsStamp = !!(menu && menuTargetRef.current && menuTargetRef.current.data && menuTargetRef.current.data.type === 'stamp');

  const applyZoom = (z) => {
    const clamped = Math.min(3, Math.max(0.25, z));
    setZoom(clamped);
    const fc = fcRef.current; const { w, h } = baseDimsRef.current;
    if (fc && w) { fc.setZoom(clamped); fc.setDimensions({ width: w * clamped, height: h * clamped }); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const dataUrl = fcRef.current.toDataURL({ format: 'png' });
      const blob = await (await fetch(dataUrl)).blob();
      const base = (doc?.name || 'drawing').replace(/\.[^.]+$/, '');
      await uploadAnnotated(blob, `${base}_markup_${Date.now()}.png`);
      onSaved && onSaved();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert('Save failed: ' + err.message + '\n(If the image is cross-origin, CORS must allow it.)');
    } finally {
      setSaving(false);
    }
  };

  // Apply a style change to the currently-selected object (live edit), or just
  // update the defaults for the next drawn object when nothing is selected.
  const applyToSel = (mutate) => {
    const o = fcRef.current && fcRef.current.getActiveObject();
    if (o) { mutate(o); fcRef.current.requestRenderAll(); snapshot(); }
  };
  const onColor = (c) => { setColor(c); applyToSel((o) => o.set(isTextObj(o) ? 'fill' : 'stroke', c)); };
  const onThickness = (w) => { setThickness(w); applyToSel((o) => { if (!isTextObj(o)) o.set('strokeWidth', w); }); };
  const onOpacity = (op) => { setOpacity(op); applyToSel((o) => o.set('opacity', op)); };
  const onFontSize = (s) => { setFontSize(s); applyToSel((o) => { if (isTextObj(o)) o.set('fontSize', s); }); };
  const onFontFamily = (f) => { setFontFamily(f); applyToSel((o) => { if (isTextObj(o)) o.set('fontFamily', f); }); };
  const onBold = () => { const nb = !bold; setBold(nb); applyToSel((o) => { if (isTextObj(o)) o.set('fontWeight', nb ? 'bold' : 'normal'); }); };
  const onItalic = () => { const ni = !italic; setItalic(ni); applyToSel((o) => { if (isTextObj(o)) o.set('fontStyle', ni ? 'italic' : 'normal'); }); };

  const selText = isTextObj(selectedObj);
  const showShapeOpts = ['line', 'arrow', 'rect', 'circle', 'pen', 'marker', 'seq'].includes(tool);
  const showTextOpts = tool === 'text';
  const showThickness = showShapeOpts || (selectedObj && !selText);
  const showTransparency = showShapeOpts || !!selectedObj;
  const showFont = showTextOpts || selText;

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, bgcolor: 'rgba(15,23,42,0.6)', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar (grouped, Sheets-style) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, bgcolor: '#fff', px: 1, py: 0.5, borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        <Tooltip title="Undo"><span><IconButton size="small" onClick={undo}><UndoIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Redo"><span><IconButton size="small" onClick={redo}><RedoIcon fontSize="small" /></IconButton></span></Tooltip>
        <VDivider />

        {/* Zoom */}
        <Tooltip title="Zoom out"><IconButton size="small" onClick={() => applyZoom(zoom - 0.25)}><RemoveIcon fontSize="small" /></IconButton></Tooltip>
        <TextField select size="small" variant="standard" value={Math.round(zoom * 100)}
          onChange={(e) => applyZoom(Number(e.target.value) / 100)}
          sx={{ width: 64 }} InputProps={{ disableUnderline: true, sx: { fontSize: 13, textAlign: 'center' } }}>
          {[25, 50, 75, 100, 125, 150, 200, 300].map((p) => <MenuItem key={p} value={p}>{p}%</MenuItem>)}
        </TextField>
        <Tooltip title="Zoom in"><IconButton size="small" onClick={() => applyZoom(zoom + 0.25)}><AddIcon fontSize="small" /></IconButton></Tooltip>
        <VDivider />

        {/* Tool groups */}
        {TOOL_GROUPS.map((group, gi) => (
          <React.Fragment key={gi}>
            {group.map((key) => {
              const t = TOOLS.find((x) => x.key === key);
              return (
                <Tooltip key={key} title={t.label}>
                  <IconButton size="small" onClick={() => setTool(key)}
                    sx={{ color: tool === key ? '#ec6e17' : '#475569', bgcolor: tool === key ? '#fff7ed' : 'transparent', borderRadius: 1 }}>
                    {t.icon}
                  </IconButton>
                </Tooltip>
              );
            })}
            {gi < TOOL_GROUPS.length - 1 && <VDivider />}
          </React.Fragment>
        ))}

        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Delete selected"><IconButton size="small" onClick={deleteSelected}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
      </Box>

      {/* Body: canvas + right panel */}
      <Box sx={{ flexGrow: 1, display: 'flex', minHeight: 0 }}>
        <Box sx={{ flexGrow: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
          <Box sx={{ boxShadow: 4, bgcolor: '#fff' }}><canvas ref={canvasElRef} /></Box>
        </Box>

        {/* Right options panel */}
        <Box sx={{ width: 240, flexShrink: 0, bgcolor: '#fff', borderLeft: '1px solid #e5e7eb', p: 2, overflowY: 'auto' }}>
          {selectedObj && (
            <Box sx={{ mb: 1.5, p: 1, bgcolor: '#fff7ed', borderRadius: 1, border: '1px solid #fed7aa', display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#ec6e17', flexGrow: 1 }}>
                Editing selected {selText ? 'text' : 'object'}
              </Typography>
              <Button size="small" color="error" onClick={deleteSelected} sx={{ textTransform: 'none', minWidth: 0 }}>Remove</Button>
            </Box>
          )}

          <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>Color</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
            {COLORS.map((c) => (
              <Box key={c} onClick={() => onColor(c)} sx={{
                width: 26, height: 26, borderRadius: '4px', bgcolor: c, cursor: 'pointer',
                border: color === c ? '2px solid #ec6e17' : '1px solid #cbd5e1',
              }} />
            ))}
          </Box>
          <Box component="label" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2, cursor: 'pointer' }}>
            <Box sx={{
              width: 26, height: 26, borderRadius: '4px', position: 'relative', overflow: 'hidden',
              border: '1px solid #cbd5e1',
              background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
            }}>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#000000'}
                onChange={(e) => onColor(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </Box>
            <Typography sx={{ fontSize: 12, color: '#64748b' }}>Custom color ({color})</Typography>
          </Box>

          {showThickness && (
            <>
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Thickness</Typography>
              <Slider size="small" min={1} max={20} value={thickness} onChange={(e, v) => onThickness(v)} sx={{ color: '#ec6e17' }} />
            </>
          )}
          {showTransparency && (
            <>
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Transparency</Typography>
              <Slider size="small" min={0} max={1} step={0.05} value={1 - opacity}
                onChange={(e, v) => onOpacity(1 - v)} sx={{ color: '#ec6e17' }} />
            </>
          )}

          {showFont && (
            <>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>Font</Typography>
              <TextField select size="small" fullWidth value={fontFamily} onChange={(e) => onFontFamily(e.target.value)} sx={{ mb: 1.5 }}>
                {FONTS.map((f) => <MenuItem key={f} value={f} sx={{ fontFamily: f }}>{f}</MenuItem>)}
              </TextField>
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Font size</Typography>
              <Slider size="small" min={8} max={96} value={fontSize} onChange={(e, v) => onFontSize(v)} sx={{ color: '#ec6e17' }} />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button size="small" variant={bold ? 'contained' : 'outlined'} onClick={onBold}
                  sx={{ minWidth: 36, fontWeight: 700, bgcolor: bold ? '#ec6e17' : undefined }}>B</Button>
                <Button size="small" variant={italic ? 'contained' : 'outlined'} onClick={onItalic}
                  sx={{ minWidth: 36, fontStyle: 'italic', bgcolor: italic ? '#ec6e17' : undefined }}>I</Button>
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* Bottom bar */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, bgcolor: '#fff', px: 2, py: 1, borderTop: '1px solid #e5e7eb' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ textTransform: 'none', bgcolor: '#ec6e17' }}>
          {saving ? 'Saving…' : 'Save as new file'}
        </Button>
      </Box>

      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={addImageFromFile} />

      {/* Per-object ≡ menu */}
      <Menu open={!!menu} onClose={() => setMenu(null)} anchorReference="anchorPosition"
        anchorPosition={menu ? { top: menu.top, left: menu.left } : undefined}>
        {menuTargetIsStamp && <MenuItem onClick={menuEditStamp}>Edit text</MenuItem>}
        <MenuItem onClick={menuDuplicate}>Duplicate</MenuItem>
        <MenuItem onClick={menuRemove} sx={{ color: '#ef4444' }}>Remove</MenuItem>
      </Menu>

      {/* Stamp gallery */}
      <Dialog open={stampOpen} onClose={() => { setStampOpen(false); setTool('select'); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          Select Stamp
          <Box sx={{ flexGrow: 1 }} />
          <TextField type="date" size="small" label="Date" value={stampDate}
            onChange={(e) => setStampDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, pt: 1 }}>
            {[...STAMPS, ...customStamps].map((s) => (
              <Box key={s.id} onClick={() => addStamp(s)} sx={{
                border: '1px solid', p: 1.5, cursor: 'pointer', textAlign: 'center',
                minHeight: 76, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                color: s.color, fontWeight: 700, fontSize: 12,
                borderColor: s.color, '&:hover': { boxShadow: 2 },
                borderRadius: s.shape === 'circle' ? '50%' : 1,
              }}>
                {s.lines.map((l, i) => <div key={i}>{l.replace('{date}', stampDate.replace(/-/g, '.'))}</div>)}
              </Box>
            ))}
            {/* Create-your-own tile */}
            <Box onClick={openCreateStamp} sx={{
              border: '2px dashed #cbd5e1', borderRadius: 1, p: 1.5, cursor: 'pointer', textAlign: 'center',
              minHeight: 76, display: 'flex', flexDirection: 'column', justifyContent: 'center',
              color: '#64748b', fontWeight: 700, fontSize: 13, '&:hover': { borderColor: '#ec6e17', color: '#ec6e17' },
            }}>
              + Create your own
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setStampOpen(false); setTool('select'); }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit stamp dialog */}
      <Dialog open={editStampOpen} onClose={() => setEditStampOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Edit stamp</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 12, color: '#64748b', mt: 1, mb: 0.5 }}>Stamp text (one line each)</Typography>
          <TextField multiline minRows={3} size="small" fullWidth value={editLines}
            onChange={(e) => setEditLines(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditStampOpen(false)}>Cancel</Button>
          <Button variant="contained" sx={{ bgcolor: '#ec6e17' }} onClick={saveEditStamp}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Create custom stamp dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Create your own stamp</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 12, color: '#64748b', mt: 1, mb: 0.5 }}>Stamp text (one line each)</Typography>
          <TextField multiline minRows={3} size="small" fullWidth value={createText}
            onChange={(e) => setCreateText(e.target.value)} placeholder={'e.g.\nAPPROVED\n2026.06.10\nQA'} />

          <Typography sx={{ fontSize: 12, color: '#64748b', mt: 2, mb: 0.5 }}>Color</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
            {COLORS.filter((c) => c !== '#ffffff').map((c) => (
              <Box key={c} onClick={() => setCreateColor(c)} sx={{
                width: 26, height: 26, borderRadius: '4px', bgcolor: c, cursor: 'pointer',
                border: createColor === c ? '2px solid #ec6e17' : '1px solid #cbd5e1',
              }} />
            ))}
          </Box>
          <Box component="label" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mt: 1, cursor: 'pointer' }}>
            <Box sx={{
              width: 26, height: 26, borderRadius: '4px', position: 'relative', overflow: 'hidden',
              border: '1px solid #cbd5e1',
              background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
            }}>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(createColor) ? createColor : '#000000'}
                onChange={(e) => setCreateColor(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </Box>
            <Typography sx={{ fontSize: 12, color: '#64748b' }}>Custom color ({createColor})</Typography>
          </Box>

          <Typography sx={{ fontSize: 12, color: '#64748b', mt: 2, mb: 0.5 }}>Shape</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant={createShape === 'rect' ? 'contained' : 'outlined'}
              onClick={() => setCreateShape('rect')}
              sx={{ textTransform: 'none', bgcolor: createShape === 'rect' ? '#ec6e17' : undefined }}>Rectangle</Button>
            <Button size="small" variant={createShape === 'circle' ? 'contained' : 'outlined'}
              onClick={() => setCreateShape('circle')}
              sx={{ textTransform: 'none', bgcolor: createShape === 'circle' ? '#ec6e17' : undefined }}>Circle</Button>
          </Box>

          {/* Live preview */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Box sx={{
              border: '2px solid', borderColor: createColor, color: createColor, fontWeight: 700, fontSize: 12,
              px: 2, py: 1.5, textAlign: 'center', minWidth: 90,
              borderRadius: createShape === 'circle' ? '50%' : 1,
            }}>
              {(createText.split('\n').filter((l) => l.length).length ? createText.split('\n').filter((l) => l.length) : ['Preview'])
                .map((l, i) => <div key={i}>{l}</div>)}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" sx={{ bgcolor: '#ec6e17' }} onClick={addCustomStamp}>Add to drawing</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// hex + alpha -> rgba string
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default MarkupEditor;
