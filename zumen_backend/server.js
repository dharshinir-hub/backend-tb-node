const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const ZumenAIService = require('./services/aiService');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ==================== DOCUMENT STORAGE: ThingsBoard ONLY ====================
// Documents (file bytes + metadata + change history) are stored ENTIRELY in
// ThingsBoard by the frontend (react2024/src/app/Services/app/zumendocservice.js):
//   - file bytes        -> TB resource library
//   - immutable metadata -> drawing asset SERVER_SCOPE "documents" attribute
//   - mutable state      -> TB telemetry (per-doc snapshots, full history)
// NO files are written to disk here. The old multer/disk upload routes and the
// /uploads static server were removed so nothing can ever land on the file system.

// ==================== DATABASE / MOCK DATA ====================

const db = {
  projects: [
    { id: 1, name: 'Flange Assembly', status: 'In Progress', progress: 75, dueDate: '2026-06-15', components: 8, startDate: '2026-05-20' },
    { id: 2, name: 'Smartphone PCB', status: 'Completed', progress: 100, dueDate: '2026-06-10', components: 12, startDate: '2026-04-15' },
    { id: 3, name: 'Motor Assembly', status: 'Pending', progress: 20, dueDate: '2026-06-20', components: 15, startDate: '2026-06-01' },
    { id: 4, name: 'Bearing Housing', status: 'In Progress', progress: 60, dueDate: '2026-06-18', components: 6, startDate: '2026-05-25' },
  ],

  drawings: [
    { id: 1, name: 'Main Assembly', format: 'PDF', status: 'Approved', date: '2026-05-28', projectId: 1, size: '2.4 MB' },
    { id: 2, name: 'Part Detail A', format: 'DWG', status: 'Pending', date: '2026-05-29', projectId: 1, size: '1.8 MB' },
    { id: 3, name: 'Specification Sheet', format: 'PDF', status: 'Approved', date: '2026-05-27', projectId: 2, size: '3.1 MB' },
    { id: 4, name: 'Assembly Guide', format: 'PDF', status: 'Approved', date: '2026-05-26', projectId: 3, size: '2.0 MB' },
  ],

  instructions: [
    { id: 1, title: 'Assembly Guide', projectId: 1, steps: 12, time: '45 mins', difficulty: 'Medium', components: ['Part A', 'Part B', 'Fastener'], createdDate: '2026-05-25' },
    { id: 2, title: 'QC Checklist', projectId: 1, steps: 8, time: '20 mins', difficulty: 'Easy', components: ['Test Equipment'], createdDate: '2026-05-26' },
    { id: 3, title: 'PCB Assembly Steps', projectId: 2, steps: 15, time: '60 mins', difficulty: 'Hard', components: ['PCB', 'Components', 'Solder'], createdDate: '2026-04-20' },
  ],

  reports: [
    { id: 1, projectId: 1, title: 'Inspection Report 001', date: '2026-05-30', inspector: 'John Smith', status: 'Pass', score: 98 },
    { id: 2, projectId: 1, title: 'Inspection Report 002', date: '2026-05-28', inspector: 'Jane Doe', status: 'Pass', score: 95 },
    { id: 3, projectId: 2, title: 'Final QC Report', date: '2026-06-01', inspector: 'Mike Johnson', status: 'Pass', score: 100 },
  ],

  specifications: [
    { id: 1, name: 'Flange Part A', material: 'Stainless Steel 316', tolerance: '±0.5mm', weight: '250g', projectId: 1 },
    { id: 2, name: 'Housing Component', material: 'Aluminum 6061', tolerance: '±0.2mm', weight: '180g', projectId: 1 },
    { id: 3, name: 'PCB Assembly', material: 'FR-4', tolerance: '±0.1mm', weight: '45g', projectId: 2 },
  ],

  approvals: [
    { id: 1, drawingId: 1, title: 'Main Assembly Approval', status: 'Approved', requestedBy: 'Engineer 1', approvedBy: 'Manager A', date: '2026-05-28' },
    { id: 2, drawingId: 2, title: 'Part Detail Approval', status: 'Pending', requestedBy: 'Engineer 2', approvedBy: null, date: '2026-05-29' },
    { id: 3, drawingId: 3, title: 'Spec Sheet Approval', status: 'Approved', requestedBy: 'Engineer 1', approvedBy: 'Manager B', date: '2026-05-27' },
  ]
};

// ==================== ROUTES ====================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running!', timestamp: new Date() });
});

// ==================== PROJECTS ====================
app.get('/api/projects', (req, res) => {
  res.json(db.projects);
});

app.get('/api/projects/:id', (req, res) => {
  const project = db.projects.find(p => p.id === parseInt(req.params.id));
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

app.post('/api/projects', (req, res) => {
  const newProject = {
    id: Math.max(...db.projects.map(p => p.id), 0) + 1,
    ...req.body,
    status: req.body.status || 'Pending',
    progress: req.body.progress || 0,
  };
  db.projects.push(newProject);
  res.status(201).json(newProject);
});

app.put('/api/projects/:id', (req, res) => {
  const project = db.projects.find(p => p.id === parseInt(req.params.id));
  if (!project) return res.status(404).json({ error: 'Project not found' });
  Object.assign(project, req.body);
  res.json(project);
});

app.delete('/api/projects/:id', (req, res) => {
  const idx = db.projects.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Project not found' });
  const deleted = db.projects.splice(idx, 1);
  res.json(deleted[0]);
});

// ==================== DRAWINGS ====================
app.get('/api/drawings', (req, res) => {
  res.json(db.drawings);
});

app.get('/api/drawings/:id', (req, res) => {
  const drawing = db.drawings.find(d => d.id === parseInt(req.params.id));
  if (!drawing) return res.status(404).json({ error: 'Drawing not found' });
  res.json(drawing);
});

app.post('/api/drawings', (req, res) => {
  const newDrawing = {
    id: Math.max(...db.drawings.map(d => d.id), 0) + 1,
    ...req.body,
    date: req.body.date || new Date().toISOString().split('T')[0],
  };
  db.drawings.push(newDrawing);
  res.status(201).json(newDrawing);
});

app.put('/api/drawings/:id', (req, res) => {
  const drawing = db.drawings.find(d => d.id === parseInt(req.params.id));
  if (!drawing) return res.status(404).json({ error: 'Drawing not found' });
  Object.assign(drawing, req.body);
  res.json(drawing);
});

// FILE UPLOAD: disabled. Drawings/documents are uploaded directly to ThingsBoard
// by the frontend (TB resource library + asset attributes/telemetry). No disk path.
app.post('/api/drawings/upload', (req, res) => {
  res.status(410).json({
    error: 'Disk upload removed. Files are stored in ThingsBoard via the frontend (zumendocservice).',
  });
});

// ==================== WORK INSTRUCTIONS ====================
app.get('/api/instructions', (req, res) => {
  res.json(db.instructions);
});

app.get('/api/instructions/:id', (req, res) => {
  const instruction = db.instructions.find(i => i.id === parseInt(req.params.id));
  if (!instruction) return res.status(404).json({ error: 'Instruction not found' });
  res.json(instruction);
});

app.post('/api/instructions', (req, res) => {
  const newInstruction = {
    id: Math.max(...db.instructions.map(i => i.id), 0) + 1,
    ...req.body,
    createdDate: req.body.createdDate || new Date().toISOString().split('T')[0],
  };
  db.instructions.push(newInstruction);
  res.status(201).json(newInstruction);
});

// ==================== INSPECTION REPORTS ====================
app.get('/api/reports', (req, res) => {
  res.json(db.reports);
});

app.get('/api/reports/:id', (req, res) => {
  const report = db.reports.find(r => r.id === parseInt(req.params.id));
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
});

app.post('/api/reports', (req, res) => {
  const newReport = {
    id: Math.max(...db.reports.map(r => r.id), 0) + 1,
    ...req.body,
    date: req.body.date || new Date().toISOString().split('T')[0],
  };
  db.reports.push(newReport);
  res.status(201).json(newReport);
});

// ==================== SPECIFICATIONS ====================
app.get('/api/specifications', (req, res) => {
  res.json(db.specifications);
});

app.get('/api/specifications/:id', (req, res) => {
  const spec = db.specifications.find(s => s.id === parseInt(req.params.id));
  if (!spec) return res.status(404).json({ error: 'Specification not found' });
  res.json(spec);
});

app.post('/api/specifications', (req, res) => {
  const newSpec = {
    id: Math.max(...db.specifications.map(s => s.id), 0) + 1,
    ...req.body,
  };
  db.specifications.push(newSpec);
  res.status(201).json(newSpec);
});

// ==================== APPROVALS ====================
app.get('/api/approvals', (req, res) => {
  res.json(db.approvals);
});

app.get('/api/approvals/:id', (req, res) => {
  const approval = db.approvals.find(a => a.id === parseInt(req.params.id));
  if (!approval) return res.status(404).json({ error: 'Approval not found' });
  res.json(approval);
});

app.post('/api/approvals', (req, res) => {
  const newApproval = {
    id: Math.max(...db.approvals.map(a => a.id), 0) + 1,
    ...req.body,
    date: req.body.date || new Date().toISOString().split('T')[0],
  };
  db.approvals.push(newApproval);
  res.status(201).json(newApproval);
});

app.put('/api/approvals/:id', (req, res) => {
  try {
    const approval = db.approvals.find(a => a.id === parseInt(req.params.id));
    if (!approval) return res.status(404).json({ error: 'Approval not found' });

    Object.assign(approval, req.body);

    // ✅ NEW: If drawing is APPROVED, trigger AI to auto-generate documents
    if (req.body.status === 'Approved') {
      const drawing = db.drawings.find(d => d.id === approval.drawingId);

      if (drawing) {
        // Prepare data for AI
        const drawingData = {
          drawingName: drawing.name,
          partNumber: drawing.partNumber || drawing.name,
          material: req.body.material || drawing.material || 'Stainless Steel',
          projectId: drawing.projectId,
          complexity: req.body.complexity || 'Medium',
          dimensions: req.body.dimensions || {}
        };

        // 🤖 Call Zumen AI to generate all documents
        const aiResult = ZumenAIService.generateAllDocuments(drawingData);

        if (aiResult.success) {
          // Auto-create instruction
          db.instructions.push(aiResult.instructions);

          // Auto-create specification
          db.specifications.push(aiResult.specifications);

          // Auto-create report template
          db.reports.push(aiResult.reportTemplate);

          // Add AI generation info to approval
          approval.aiGenerated = true;
          approval.aiGenerationTime = new Date().toISOString();
          approval.generatedDocuments = {
            instructionId: aiResult.instructions.id,
            specificationId: aiResult.specifications.id,
            reportTemplateId: aiResult.reportTemplate.id
          };

          console.log(`✅ AI Generated documents for approval ${req.params.id}`);
          console.log(`   - Instruction: ${aiResult.instructions.id}`);
          console.log(`   - Specification: ${aiResult.specifications.id}`);
          console.log(`   - Report Template: ${aiResult.reportTemplate.id}`);

          return res.json({
            approval,
            aiGeneration: aiResult
          });
        } else {
          console.error('❌ AI Generation failed:', aiResult.error);
          return res.status(500).json({
            error: 'AI generation failed',
            details: aiResult.error
          });
        }
      }
    }

    res.json(approval);
  } catch (error) {
    console.error('Error in approval:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== AI GENERATION ====================
// Endpoint to manually trigger AI document generation
app.post('/api/ai/generate-documents', (req, res) => {
  try {
    const { drawingName, partNumber, material, projectId, complexity, dimensions } = req.body;

    if (!drawingName || !material) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['drawingName', 'material']
      });
    }

    const drawingData = {
      drawingName,
      partNumber: partNumber || drawingName,
      material,
      projectId: projectId || 1,
      complexity: complexity || 'Medium',
      dimensions: dimensions || {}
    };

    const aiResult = ZumenAIService.generateAllDocuments(drawingData);

    if (aiResult.success) {
      res.json({
        success: true,
        message: 'Documents generated successfully',
        documents: aiResult
      });
    } else {
      res.status(500).json({
        success: false,
        error: aiResult.error
      });
    }
  } catch (error) {
    console.error('AI Generation Error:', error);
    res.status(500).json({
      error: 'AI generation failed',
      details: error.message
    });
  }
});

// Get AI service status and capabilities
app.get('/api/ai/status', (req, res) => {
  res.json({
    status: 'operational',
    version: '1.0',
    capabilities: [
      'Auto-generate work instructions',
      'Extract and generate specifications',
      'Create inspection templates',
      'Material property recommendations',
      'Process optimization'
    ],
    supportedMaterials: [
      'Stainless Steel',
      'SUS304',
      'Aluminum',
      'Carbon Steel',
      'And custom materials'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ PPW Backend Server running on http://localhost:${PORT}`);
  console.log(`🤖 Zumen AI Integration: ACTIVE`);
  console.log(`📚 API Documentation:`);
  console.log(`   GET    /api/health`);
  console.log(`   GET    /api/ai/status`);
  console.log(`   POST   /api/ai/generate-documents`);
  console.log(`   GET    /api/projects`);
  console.log(`   GET    /api/drawings`);
  console.log(`   PUT    /api/approvals/:id (triggers AI on approval)`);
  console.log(`   GET    /api/instructions`);
  console.log(`   GET    /api/reports`);
  console.log(`   GET    /api/specifications`);
  console.log(`   GET    /api/approvals`);
});
