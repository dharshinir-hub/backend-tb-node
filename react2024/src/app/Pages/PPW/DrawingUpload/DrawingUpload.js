import React, { useState } from 'react';
import { Box, Button, Card, Typography, CircularProgress, Alert, Grid, TextField } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const DrawingUpload = ({ onUploadSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState('');
  const [drawingName, setDrawingName] = useState('');
  const [projectId, setProjectId] = useState('1');

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file) => {
    const allowedFormats = ['pdf', 'dwg', 'step', 'iges', 'dxf'];
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (!allowedFormats.includes(fileExtension)) {
      setError(`Only ${allowedFormats.join(', ')} files are allowed`);
      return;
    }

    setFileName(file.name);
    setError(null);
    setSuccess(false);

    // Auto-fill drawing name from file name if not set
    if (!drawingName) {
      setDrawingName(file.name.split('.')[0]);
    }

    await uploadFile(file);
  };

  const uploadFile = async (file) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', drawingName || file.name.split('.')[0]);
      formData.append('projectId', projectId);
      formData.append('uploadedBy', 'Current User');

      const response = await fetch('http://localhost:5000/api/drawings/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setSuccess(true);
      setFileName('');
      setDrawingName('');

      setTimeout(() => setSuccess(false), 3000);

      if (onUploadSuccess) {
        onUploadSuccess(data);
      }
    } catch (err) {
      setError('Upload failed. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      {/* Upload Form */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Drawing Name"
            value={drawingName}
            onChange={(e) => setDrawingName(e.target.value)}
            placeholder="e.g., Main Assembly"
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Project ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            type="number"
            size="small"
          />
        </Grid>
      </Grid>

      {/* Drag & Drop Zone */}
      <Card
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        sx={{
          p: 4,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: dragActive ? '#3b82f6' : '#d1d5db',
          bgcolor: dragActive ? '#eff6ff' : '#fafafa',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          '&:hover': {
            borderColor: '#3b82f6',
            bgcolor: '#eff6ff'
          }
        }}
      >
        <input
          type="file"
          id="file-input"
          onChange={handleFileInput}
          style={{ display: 'none' }}
          accept=".pdf,.dwg,.step,.iges,.dxf"
        />

        <Box sx={{ cursor: 'pointer', width: '100%' }}>
          <CloudUploadIcon sx={{ fontSize: '48px', color: '#3b82f6', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: '#1f2937' }}>
            Drag & drop your drawing here
          </Typography>
          <Typography variant="body2" sx={{ color: '#6b7280', mb: 2 }}>
            or click to browse (PDF, DWG, STEP, IGES, DXF)
          </Typography>

          {fileName && (
            <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 500 }}>
              📄 {fileName}
            </Typography>
          )}

          {uploading && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!fileName && !uploading && (
            <Button
              component="label"
              variant="contained"
              sx={{
                mt: 2,
                bgcolor: '#3b82f6',
                textTransform: 'none',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#2563eb' }
              }}
            >
              Browse Files
              <input
                type="file"
                hidden
                onChange={handleFileInput}
                accept=".pdf,.dwg,.step,.iges,.dxf"
              />
            </Button>
          )}
        </Box>
      </Card>

      {/* Messages */}
      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          ✅ Drawing uploaded successfully!
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          ❌ {error}
        </Alert>
      )}

      {uploading && (
        <Alert severity="info" sx={{ mt: 2 }}>
          ⏳ Uploading file...
        </Alert>
      )}
    </Box>
  );
};

export default DrawingUpload;
