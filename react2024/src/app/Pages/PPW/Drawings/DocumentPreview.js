import React, { useState, useEffect, Suspense } from 'react';
import {
  Dialog, DialogTitle, DialogContent, IconButton, Box, Typography, Button, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useDocPreview } from '../../../Services/app/zumendocservice';

// three.js + occt and SheetJS are heavy — only pulled in when actually opened.
const Model3DViewer = React.lazy(() => import('./Model3DViewer'));
const SheetPreview = React.lazy(() => import('./SheetPreview'));
const WordEditor = React.lazy(() => import('./WordEditor'));

const ext = (name = '') => (name.split('.').pop() || '').toLowerCase();

const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
const VIDEO = ['mp4', 'webm', 'ogg', 'mov'];
const AUDIO = ['mp3', 'wav'];
const THREED = ['step', 'stp', 'stl', 'iges', 'igs', 'brep'];
const SHEET = ['xlsx', 'xls', 'csv', 'ods'];
const WORD = ['docx', 'doc'];
const TEXT = ['txt', 'json', 'md', 'log', 'xml', 'yaml', 'yml', 'js', 'html',
  'nc', 'gcode', 'scad', 'dxf'];

export const kindOf = (name) => {
  const e = ext(name);
  if (IMAGE.includes(e)) return 'image';
  if (e === 'pdf') return 'pdf';
  if (VIDEO.includes(e)) return 'video';
  if (AUDIO.includes(e)) return 'audio';
  if (THREED.includes(e)) return '3d';
  if (SHEET.includes(e)) return 'sheet';
  if (WORD.includes(e)) return 'word';
  if (TEXT.includes(e)) return 'text';
  return 'other';
};

// In-app preview for a document. Handles images, PDF, video, audio and text/
// source files (so .scad / .step / NC programs are readable); falls back to a
// download prompt for binary CAD formats (.dwg, .stl, .sldprt, …).
const DocumentPreview = ({ doc, onClose }) => {
  const [text, setText] = useState(null);
  const [loadingText, setLoadingText] = useState(false);
  const open = !!doc;
  const { url, kind: detectedKind } = useDocPreview(doc);
  // Prefer the REAL content type (magic-byte sniff); fall back to the extension.
  const kind = doc ? (detectedKind || kindOf(doc.name)) : 'other';

  useEffect(() => {
    if (!doc || kind !== 'text' || !url) { setText(null); return; }
    let alive = true;
    setLoadingText(true);
    fetch(url)
      .then((r) => r.text())
      .then((t) => { if (alive) setText(t.slice(0, 200000)); })
      .catch(() => { if (alive) setText('(could not load file)'); })
      .finally(() => { if (alive) setLoadingText(false); });
    return () => { alive = false; };
  }, [doc, url, kind]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <Typography sx={{ fontWeight: 600, flexGrow: 1 }} noWrap>{doc.name}</Typography>
        <Button size="small" startIcon={<DownloadIcon />} component="a" href={url || undefined}
          download={doc.name} disabled={!url} sx={{ textTransform: 'none' }}>
          Download
        </Button>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, bgcolor: '#0f172a', display: 'flex', flexDirection: 'column' }}>
        {!url && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}><CircularProgress /></Box>
        )}
        {url && kind === 'image' && (
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto', p: 2 }}>
            <img src={url} alt={doc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </Box>
        )}
        {url && kind === 'pdf' && (
          <iframe title={doc.name} src={url} style={{ width: '100%', height: '100%', flexGrow: 1, border: 'none' }} />
        )}
        {url && kind === '3d' && (
          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            <Suspense fallback={(
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            )}>
              <Model3DViewer url={url} name={doc.name} />
            </Suspense>
          </Box>
        )}
        {url && kind === 'sheet' && (
          <Box sx={{ flexGrow: 1, minHeight: 0, bgcolor: '#fff' }}>
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>}>
              <SheetPreview doc={doc} />
            </Suspense>
          </Box>
        )}
        {url && kind === 'word' && (
          <Box sx={{ flexGrow: 1, minHeight: 0, bgcolor: '#fff' }}>
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>}>
              <WordEditor doc={doc} editable={false} />
            </Suspense>
          </Box>
        )}
        {url && kind === 'video' && (
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <video src={url} controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
          </Box>
        )}
        {url && kind === 'audio' && (
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><audio src={url} controls /></Box>
        )}
        {url && kind === 'text' && (
          loadingText
            ? <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><CircularProgress /></Box>
            : <Box component="pre" sx={{
                m: 0, p: 2, flexGrow: 1, bgcolor: '#ffffff', color: '#1e293b',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 12.5, lineHeight: 1.6, overflow: 'auto',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>{text}</Box>
        )}
        {url && kind === 'other' && (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', color: '#cbd5e1' }}>
            <InsertDriveFileIcon sx={{ fontSize: 64, mb: 1, mx: 'auto' }} />
            <Typography sx={{ mb: 0.5 }}>
              In-app preview isn’t available for <b>.{ext(doc.name)}</b> files.
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
              (3D/CAD formats like DWG, STL, SLDPRT need a dedicated viewer.)
            </Typography>
            <Button variant="contained" startIcon={<DownloadIcon />} component="a"
              href={url || undefined} download={doc.name} sx={{ textTransform: 'none' }}>
              Download to open
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreview;
