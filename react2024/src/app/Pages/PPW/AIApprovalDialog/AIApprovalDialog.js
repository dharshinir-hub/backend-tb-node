import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  Grid,
  CircularProgress,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SmartToyIcon from '@mui/icons-material/SmartToy';

const AIApprovalDialog = ({ open, onClose, approval, onApprove }) => {
  const [material, setMaterial] = useState('Stainless Steel');
  const [complexity, setComplexity] = useState('Medium');
  const [dimensions, setDimensions] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);

  const handleApproveWithAI = async () => {
    setIsProcessing(true);

    try {
      // Call AI generation endpoint
      const aiResponse = await fetch('http://localhost:5000/api/ai/generate-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drawingName: approval?.title || 'Unknown',
          partNumber: approval?.partNumber || 'N/A',
          material,
          complexity,
          dimensions: dimensions ? dimensions.split(',').map(d => d.trim()) : [],
          projectId: approval?.projectId || 1
        })
      });

      const aiResult = await aiResponse.json();

      if (aiResult.success) {
        setGenerationResult(aiResult.documents);

        // Now approve the drawing with AI metadata
        await onApprove({
          status: 'Approved',
          approvedBy: 'Current User',
          comment: notes,
          material,
          complexity,
          dimensions,
          aiGenerated: true,
          aiGenerationSummary: aiResult.documents.summary,
          generatedDocuments: {
            instructionId: aiResult.documents.instructions.id,
            specificationId: aiResult.documents.specifications.id,
            reportTemplateId: aiResult.documents.reportTemplate.id
          }
        });

        // Show success message and close after 2 seconds
        setTimeout(() => {
          setIsProcessing(false);
          onClose();
          resetForm();
        }, 2000);
      } else {
        alert('❌ AI generation failed: ' + aiResult.error);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error during AI generation');
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setMaterial('Stainless Steel');
    setComplexity('Medium');
    setDimensions('');
    setNotes('');
    setGenerationResult(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!approval) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, background: '#f0f4ff' }}>
        <SmartToyIcon sx={{ color: '#3b82f6' }} />
        <span>AI-Powered Approval</span>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {!generationResult ? (
          <Box>
            <Typography variant="body2" sx={{ color: '#6b7280', mb: 3 }}>
              ✨ Provide details below to let Zumen AI automatically generate work instructions, specifications, and inspection templates.
            </Typography>

            <Grid container spacing={2}>
              {/* Drawing Info */}
              <Grid item xs={12}>
                <Card sx={{ background: '#f9fafb' }}>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Drawing Details
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                      <strong>Title:</strong> {approval.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                      <strong>Status:</strong> Pending Review
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Material Selection */}
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Material *</InputLabel>
                  <Select
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    label="Material"
                  >
                    <MenuItem value="Stainless Steel">Stainless Steel (304/316)</MenuItem>
                    <MenuItem value="SUS304">SUS304 (Japanese Standard)</MenuItem>
                    <MenuItem value="Aluminum">Aluminum (6061-T6)</MenuItem>
                    <MenuItem value="Carbon Steel">Carbon Steel</MenuItem>
                    <MenuItem value="Brass">Brass</MenuItem>
                    <MenuItem value="Copper">Copper</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Complexity Level */}
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Complexity Level</InputLabel>
                  <Select
                    value={complexity}
                    onChange={(e) => setComplexity(e.target.value)}
                    label="Complexity Level"
                  >
                    <MenuItem value="Simple">Simple (Basic shape, few features)</MenuItem>
                    <MenuItem value="Medium">Medium (Standard features, ~10 steps)</MenuItem>
                    <MenuItem value="Complex">Complex (Multiple features, 15+ steps)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Dimensions */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Key Dimensions (Optional)"
                  placeholder="e.g., 50±0.1mm, 10±0.05mm, Φ6.5mm"
                  value={dimensions}
                  onChange={(e) => setDimensions(e.target.value)}
                  size="small"
                  multiline
                  rows={2}
                  helperText="Separate dimensions with commas. AI will extract from drawing if not provided."
                />
              </Grid>

              {/* Notes/Comments */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Approval Notes"
                  placeholder="Add any comments or special instructions for AI generation..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  size="small"
                  multiline
                  rows={3}
                />
              </Grid>

              {/* Info Box */}
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mt: 2 }}>
                  🤖 <strong>Zumen AI will auto-generate:</strong>
                  <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    <li>✅ Work instructions (9 detailed steps)</li>
                    <li>✅ Specifications (material properties & tolerances)</li>
                    <li>✅ QC inspection template</li>
                  </ul>
                </Alert>
              </Grid>
            </Grid>
          </Box>
        ) : (
          // Success State
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircleIcon sx={{ fontSize: 60, color: '#10b981', mb: 2 }} />

            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#10b981', mb: 2 }}>
              ✅ Documents Generated Successfully!
            </Typography>

            <Card sx={{ background: '#f0fdf4', border: '2px solid #10b981', mb: 2 }}>
              <CardContent>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Work Instructions:</strong> {generationResult?.instructions?.steps?.length} steps
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Specifications:</strong> {generationResult?.specifications?.specs ? Object.keys(generationResult.specifications.specs).length : 0} items
                </Typography>
                <Typography variant="body2">
                  <strong>Inspection Items:</strong> {generationResult?.reportTemplate?.inspectionItems?.length} checks
                </Typography>
              </CardContent>
            </Card>

            <Typography variant="caption" sx={{ color: '#6b7280' }}>
              Documents are ready in their respective tabs
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={isProcessing}>
          Cancel
        </Button>
        {!generationResult && (
          <Button
            variant="contained"
            sx={{ bgcolor: '#3b82f6' }}
            onClick={handleApproveWithAI}
            disabled={isProcessing || !material}
          >
            {isProcessing ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Generating...
              </>
            ) : (
              '🤖 Approve & Generate'
            )}
          </Button>
        )}
        {generationResult && (
          <Button
            variant="contained"
            sx={{ bgcolor: '#10b981' }}
            onClick={handleClose}
          >
            Done ✓
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AIApprovalDialog;
