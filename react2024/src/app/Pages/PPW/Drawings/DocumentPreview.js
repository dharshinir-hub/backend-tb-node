import React, { useState, useEffect, Suspense } from 'react';
import {
  Dialog, DialogTitle, DialogContent, IconButton, Box, Typography, Button, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { fileUrl } from '../../../Services/app/zumendocservice';

// three.js + occt are heavy — only pulled in when a 3D file is actually opened.
const Model3DViewer = React.lazy(() => import('./Model3DViewer'));

const ext = (name = '') => (name.split('.').pop() || '').toLowerCase();

const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
const VIDEO = ['mp4', 'webm', 'ogg', 'mov'];
const AUDIO = ['mp3', 'wav'];
const THREED = ['step', 'stp', 'stl', 'iges', 'igs', 'brep'];
const TEXT = ['txt', 'csv', 'json', 'md', 'log', 'xml', 'yaml', 'yml', 'js', 'html',
  'nc', 'gcode', 'scad', 'dxf'];

export const kindOf = (name) => {
  const e = ext(name);
  if (IMAGE.includes(e)) return 'image';
  if (e === 'pdf') return 'pdf';
  if (VIDEO.includes(e)) return 'video';
  if (AUDIO.includes(e)) return 'audio';
  if (THREED.includes(e)) return '3d';
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
  const url = doc ? fileUrl(doc) : '';
  const kind = doc ? kindOf(doc.name) : 'other';

  useEffect(() => {
    if (!doc || kind !== 'text') { setText(null); return; }
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
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <Typography sx={{ fontWeight: 600, flexGrow: 1 }} noWrap>{doc.name}</Typography>
        <Button size="small" startIcon={<DownloadIcon />} component="a" href={url}
          target="_blank" rel="noreferrer" sx={{ textTransform: 'none' }}>
          Download
        </Button>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ minHeight: 360, bgcolor: '#0f172a08' }}>
        {kind === 'image' && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <img src={url} alt={doc.name} style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain' }} />
          </Box>
        )}
        {kind === 'pdf' && (
          <iframe title={doc.name} src={url} style={{ width: '100%', height: '72vh', border: 'none' }} />
        )}
        {kind === '3d' && (
          <Suspense fallback={(
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '72vh' }}>
              <CircularProgress />
            </Box>
          )}>
            <Model3DViewer url={url} name={doc.name} />
          </Suspense>
        )}
        {kind === 'video' && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <video src={url} controls style={{ maxWidth: '100%', maxHeight: '72vh' }} />
          </Box>
        )}
        {kind === 'audio' && (
          <Box sx={{ py: 4, textAlign: 'center' }}><audio src={url} controls /></Box>
        )}
        {kind === 'text' && (
          loadingText
            ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            : <Box component="pre" sx={{
                m: 0, p: 2, bgcolor: '#0b1020', color: '#e2e8f0', borderRadius: 1,
                fontSize: 12, lineHeight: 1.5, overflow: 'auto', maxHeight: '72vh',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>{text}</Box>
        )}
        {kind === 'other' && (
          <Box sx={{ textAlign: 'center', py: 8, color: '#475569' }}>
            <InsertDriveFileIcon sx={{ fontSize: 64, mb: 1 }} />
            <Typography sx={{ mb: 0.5 }}>
              In-app preview isn’t available for <b>.{ext(doc.name)}</b> files.
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
              (3D/CAD formats like DWG, STL, SLDPRT need a dedicated viewer.)
            </Typography>
            <Button variant="contained" startIcon={<DownloadIcon />} component="a"
              href={url} target="_blank" rel="noreferrer" sx={{ textTransform: 'none' }}>
              Download to open
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreview;
