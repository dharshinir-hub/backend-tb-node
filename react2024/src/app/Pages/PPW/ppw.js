import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, Card, CardContent, Grid, Tabs, Tab, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, TextField } from '@mui/material';
import DrawingUpload from './DrawingUpload/DrawingUpload';
import InspectionReports from './InspectionReports/InspectionReports';
import Specifications from './Specifications/Specifications';
import AIApprovalDialog from './AIApprovalDialog/AIApprovalDialog';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

const SimpleTabPanel = ({ children, value, index }) => {
    return value === index ? <Box sx={{ p: 3 }}>{children}</Box> : null;
};

const PPW = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [openUploadDialog, setOpenUploadDialog] = useState(false);
    const [drawings, setDrawings] = useState([]);
    const [loadingDrawings, setLoadingDrawings] = useState(false);
    const [approvals, setApprovals] = useState([]);
    const [loadingApprovals, setLoadingApprovals] = useState(false);
    const [selectedApproval, setSelectedApproval] = useState(null);
    const [approvalComment, setApprovalComment] = useState('');
    const [selectedInstruction, setSelectedInstruction] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch data on component mount
    useEffect(() => {
        fetchDrawings();
        fetchApprovals();
    }, []);

    const fetchDrawings = async () => {
        try {
            setLoadingDrawings(true);
            const response = await fetch('http://localhost:5000/api/drawings');
            const data = await response.json();
            setDrawings(data);
        } catch (error) {
            console.error('Error fetching drawings:', error);
        } finally {
            setLoadingDrawings(false);
        }
    };

    const fetchApprovals = async () => {
        try {
            setLoadingApprovals(true);
            const response = await fetch('http://localhost:5000/api/approvals');
            const data = await response.json();
            setApprovals(data);
        } catch (error) {
            console.error('Error fetching approvals:', error);
        } finally {
            setLoadingApprovals(false);
        }
    };

    const handleApprove = async (approvalData) => {
        try {
            const response = await fetch(`http://localhost:5000/api/approvals/${selectedApproval.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'Approved',
                    approvedBy: 'Current User',
                    comment: approvalData.comment || approvalComment,
                    date: new Date().toISOString().split('T')[0],
                    ...approvalData
                })
            });
            if (response.ok) {
                const result = await response.json();

                // Check if AI generated documents
                if (result.aiGeneration && result.aiGeneration.success) {
                    alert('✅ Drawing Approved! AI Generated:\n✓ Work Instructions\n✓ Specifications\n✓ Inspection Template');
                } else {
                    alert('✅ Drawing Approved!');
                }

                setSelectedApproval(null);
                setApprovalComment('');
                fetchApprovals();
            }
        } catch (error) {
            console.error('Error approving:', error);
            alert('❌ Error approving drawing');
        }
    };

    const handleReject = async (approvalId) => {
        try {
            const response = await fetch(`http://localhost:5000/api/approvals/${approvalId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'Rejected',
                    approvedBy: 'Current User',
                    comment: approvalComment,
                    date: new Date().toISOString().split('T')[0]
                })
            });
            if (response.ok) {
                alert('❌ Drawing Rejected!');
                setSelectedApproval(null);
                setApprovalComment('');
                fetchApprovals();
            }
        } catch (error) {
            console.error('Error rejecting:', error);
            alert('❌ Error rejecting drawing');
        }
    };

    const handleDownloadPDF = (instruction) => {
        const content = `
WORK INSTRUCTION - ${instruction.title}
========================================

Steps: ${instruction.steps}
Estimated Time: ${instruction.time}
Difficulty: ${instruction.difficulty}
Created: ${instruction.createdDate}

Components Required:
${instruction.components && instruction.components.length > 0
    ? instruction.components.map(c => `• ${c}`).join('\n')
    : 'None listed'}

---
Generated: ${new Date().toLocaleDateString()}
        `;

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
        element.setAttribute('download', `${instruction.title.replace(/\s+/g, '_')}.txt`);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);

        alert('✅ Downloaded: ' + instruction.title);
    };

    const mockProjects = [
        { id: 1, name: 'Flange Assembly', status: 'In Progress', progress: 75, dueDate: '2026-06-15' },
        { id: 2, name: 'Smartphone PCB', status: 'Completed', progress: 100, dueDate: '2026-06-10' },
        { id: 3, name: 'Motor Assembly', status: 'Pending', progress: 20, dueDate: '2026-06-20' },
    ];


    const mockInstructions = [
        { id: 1, title: 'Assembly Guide', steps: 12, time: '45 mins', difficulty: 'Medium', components: ['Flange Part A', 'Bolt M8', 'Washer', 'Fastener'], createdDate: '2026-05-25' },
        { id: 2, title: 'QC Checklist', steps: 8, time: '20 mins', difficulty: 'Easy', components: ['Torque Wrench', 'Dial Gauge', 'Calipers'], createdDate: '2026-05-26' },
    ];

    const getStatusColor = (status) => {
        switch(status) {
            case 'Completed': return '#10b981';
            case 'In Progress': return '#3b82f6';
            case 'Pending': return '#f59e0b';
            case 'Approved': return '#10b981';
            case 'Rejected': return '#ef4444';
            default: return '#6b7280';
        }
    };

    return (
        <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', py: 4 }}>
            <Container maxWidth="xl">
                {/* Header Section */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: '#1f2937' }}>
                        Paperless Workflow & Part Program
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#6b7280', mb: 3 }}>
                        Digitize your entire manufacturing workflow - From drawings to approval to production
                    </Typography>

                    {/* Quick Stats */}
                    <Grid container spacing={2}>
                        {[
                            { label: 'Total Projects', value: '12', color: '#3b82f6', lightColor: '#dbeafe' },
                            { label: 'Active', value: '8', color: '#10b981', lightColor: '#d1fae5' },
                            { label: 'Pending', value: '3', color: '#f59e0b', lightColor: '#fef3c7' },
                            { label: 'In QC', value: '15', color: '#8b5cf6', lightColor: '#ede9fe' },
                            { label: 'Completed', value: '4', color: '#ec4899', lightColor: '#fce7f3' },
                        ].map((stat, idx) => (
                            <Grid item xs={12} sm={6} md={2.4} key={idx}>
                                <Card sx={{
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    border: 'none',
                                    bgcolor: stat.lightColor,
                                    transition: 'transform 0.2s',
                                    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
                                }}>
                                    <CardContent sx={{ p: '20px !important', textAlign: 'center' }}>
                                        <Typography sx={{ color: stat.color, fontSize: '32px', fontWeight: 'bold', mb: 0.5 }}>
                                            {stat.value}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#4b5563', fontWeight: 500 }}>
                                            {stat.label}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                {/* Tabs Section */}
                <Card sx={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                    <Box sx={{ borderBottom: '1px solid #e5e7eb' }}>
                        <Tabs
                            value={activeTab}
                            onChange={(e, val) => setActiveTab(val)}
                            sx={{ px: 3 }}
                        >
                            <Tab label="DASHBOARD" />
                            <Tab label="DRAWINGS" />
                            <Tab label="INSTRUCTIONS" />
                            <Tab label="REPORTS" />
                            <Tab label="SPECIFICATIONS" />
                            <Tab label="APPROVALS" />
                        </Tabs>
                    </Box>

                    {/* Tab Content */}
                    <Box sx={{ p: 4, bgcolor: '#fff' }}>
                        {/* Dashboard Tab */}
                        <SimpleTabPanel value={activeTab} index={0}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#1f2937' }}>
                                Active Projects
                            </Typography>
                            <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e5e7eb' }}>
                                <Table>
                                    <TableHead sx={{ bgcolor: '#f9fafb' }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Project Name</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Status</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Progress</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Due Date</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {mockProjects.map((project) => (
                                            <TableRow key={project.id} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                                                <TableCell sx={{ color: '#374151' }}>{project.name}</TableCell>
                                                <TableCell>
                                                    <Chip label={project.status} sx={{ bgcolor: getStatusColor(project.status), color: '#fff' }} size="small" />
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Box sx={{ width: '100px', height: '6px', bgcolor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                                                            <Box sx={{ height: '100%', width: `${project.progress}%`, bgcolor: '#3b82f6' }} />
                                                        </Box>
                                                        <Typography variant="body2">{project.progress}%</Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ color: '#374151' }}>{project.dueDate}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </SimpleTabPanel>

                        {/* Drawings Tab */}
                        <SimpleTabPanel value={activeTab} index={1}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
                                    Recent Drawings
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        sx={{ textTransform: 'none' }}
                                        onClick={fetchDrawings}
                                    >
                                        🔄 Refresh
                                    </Button>
                                    <Button
                                        variant="contained"
                                        sx={{ bgcolor: '#3b82f6', textTransform: 'none' }}
                                        onClick={() => setOpenUploadDialog(true)}
                                    >
                                        + Upload Drawing
                                    </Button>
                                </Box>
                            </Box>

                            {loadingDrawings ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                    <CircularProgress />
                                </Box>
                            ) : drawings.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4, color: '#6b7280' }}>
                                    <Typography>No drawings uploaded yet. Click "+ Upload Drawing" to get started!</Typography>
                                </Box>
                            ) : (
                                <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e5e7eb' }}>
                                    <Table>
                                        <TableHead sx={{ bgcolor: '#f9fafb' }}>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Name</TableCell>
                                                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Format</TableCell>
                                                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Status</TableCell>
                                                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Date</TableCell>
                                                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Size</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {drawings.map((drawing) => (
                                                <TableRow key={drawing.id} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                                                    <TableCell sx={{ color: '#374151' }}>{drawing.name}</TableCell>
                                                    <TableCell sx={{ color: '#6b7280' }}>{drawing.format}</TableCell>
                                                    <TableCell>
                                                        <Chip label={drawing.status} sx={{ bgcolor: getStatusColor(drawing.status), color: '#fff' }} size="small" />
                                                    </TableCell>
                                                    <TableCell sx={{ color: '#374151' }}>{drawing.date}</TableCell>
                                                    <TableCell sx={{ color: '#6b7280' }}>{drawing.size || 'N/A'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </SimpleTabPanel>

                        {/* Instructions Tab */}
                        <SimpleTabPanel value={activeTab} index={2}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#1f2937' }}>
                                Work Instructions
                            </Typography>
                            <Grid container spacing={2}>
                                {mockInstructions.map((instr) => (
                                    <Grid item xs={12} sm={6} key={instr.id}>
                                        <Card sx={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                            <CardContent>
                                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: '#1f2937' }}>
                                                    {instr.title}
                                                </Typography>
                                                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                                    <Chip label={`${instr.steps} Steps`} size="small" sx={{ bgcolor: '#dbeafe', color: '#1e40af' }} />
                                                    <Chip label={instr.time} size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e' }} />
                                                    <Chip label={instr.difficulty} size="small" sx={{ bgcolor: '#d1fae5', color: '#065f46' }} />
                                                </Box>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    sx={{ textTransform: 'none' }}
                                                    onClick={() => setSelectedInstruction(instr)}
                                                >
                                                    View Details
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </SimpleTabPanel>

                        {/* Reports Tab */}
                        <SimpleTabPanel value={activeTab} index={3}>
                            <InspectionReports searchQuery={searchQuery} />
                        </SimpleTabPanel>

                        {/* Specifications Tab */}
                        <SimpleTabPanel value={activeTab} index={4}>
                            <Specifications searchQuery={searchQuery} />
                        </SimpleTabPanel>

                        {/* Approvals Tab */}
                        <SimpleTabPanel value={activeTab} index={5}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
                                    Pending Approvals
                                </Typography>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    sx={{ textTransform: 'none' }}
                                    onClick={fetchApprovals}
                                >
                                    🔄 Refresh
                                </Button>
                            </Box>

                            {loadingApprovals ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                    <CircularProgress />
                                </Box>
                            ) : approvals.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4, color: '#6b7280' }}>
                                    <Typography>No approvals pending.</Typography>
                                </Box>
                            ) : (
                                <Grid container spacing={2}>
                                    {approvals.map((approval) => (
                                        <Grid item xs={12} sm={6} md={4} key={approval.id}>
                                            <Card sx={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)', height: '100%' }}>
                                                <CardContent>
                                                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: '#1f2937' }}>
                                                        {approval.title}
                                                    </Typography>
                                                    <Chip
                                                        label={approval.status}
                                                        sx={{ bgcolor: getStatusColor(approval.status), color: '#fff', mb: 2 }}
                                                        size="small"
                                                    />
                                                    <Typography variant="body2" sx={{ color: '#6b7280', mb: 1 }}>
                                                        <strong>Requested by:</strong> {approval.requestedBy}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#6b7280', mb: 2 }}>
                                                        <strong>Date:</strong> {approval.date}
                                                    </Typography>
                                                    {approval.status === 'Pending' && (
                                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                                            <Button
                                                                variant="contained"
                                                                size="small"
                                                                sx={{ bgcolor: '#10b981', flex: 1, textTransform: 'none' }}
                                                                onClick={() => setSelectedApproval(approval)}
                                                            >
                                                                ✓ Approve
                                                            </Button>
                                                            <Button
                                                                variant="contained"
                                                                size="small"
                                                                sx={{ bgcolor: '#ef4444', flex: 1, textTransform: 'none' }}
                                                                onClick={() => {
                                                                    setSelectedApproval(approval);
                                                                    setApprovalComment('');
                                                                }}
                                                            >
                                                                ✗ Reject
                                                            </Button>
                                                        </Box>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </SimpleTabPanel>
                    </Box>
                </Card>

                {/* Upload Dialog */}
                <Dialog open={openUploadDialog} onClose={() => setOpenUploadDialog(false)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{ fontWeight: 600, color: '#1f2937' }}>
                        Upload Drawing
                    </DialogTitle>
                    <DialogContent sx={{ pt: 2 }}>
                        <DrawingUpload
                            onUploadSuccess={() => {
                                setOpenUploadDialog(false);
                                fetchDrawings(); // Refresh drawings list after upload
                            }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenUploadDialog(false)} sx={{ color: '#6b7280' }}>
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Instruction Details Dialog */}
                <Dialog open={!!selectedInstruction} onClose={() => setSelectedInstruction(null)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{ fontWeight: 600, color: '#1f2937' }}>
                        {selectedInstruction?.title}
                    </DialogTitle>
                    <DialogContent sx={{ pt: 2 }}>
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                <strong>Steps:</strong> {selectedInstruction?.steps}
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                <strong>Estimated Time:</strong> {selectedInstruction?.time}
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                <strong>Difficulty:</strong> {selectedInstruction?.difficulty}
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                <strong>Components Required:</strong>
                            </Typography>
                            <Box sx={{ ml: 2 }}>
                                {selectedInstruction?.components && selectedInstruction.components.length > 0 ? (
                                    selectedInstruction.components.map((comp, idx) => (
                                        <Typography key={idx} variant="body2" sx={{ color: '#6b7280' }}>
                                            • {comp}
                                        </Typography>
                                    ))
                                ) : (
                                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                        No components listed
                                    </Typography>
                                )}
                            </Box>
                            <Typography variant="body2" sx={{ mt: 2 }}>
                                <strong>Created:</strong> {selectedInstruction?.createdDate || 'N/A'}
                            </Typography>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setSelectedInstruction(null)} sx={{ color: '#6b7280' }}>
                            Close
                        </Button>
                        <Button
                            variant="contained"
                            sx={{ bgcolor: '#3b82f6', textTransform: 'none' }}
                            onClick={() => handleDownloadPDF(selectedInstruction)}
                        >
                            Download PDF
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* AI-Powered Approval Dialog */}
                <AIApprovalDialog
                    open={!!selectedApproval}
                    onClose={() => setSelectedApproval(null)}
                    approval={selectedApproval}
                    onApprove={handleApprove}
                />
            </Container>
        </Box>
    );
};

export default PPW;
