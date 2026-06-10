import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Chip, Button, Dialog,
    DialogTitle, DialogContent, Checkbox, FormControlLabel, FormGroup
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';

const InspectionReports = ({ searchQuery }) => {
    const [reports, setReports] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [checklist, setChecklist] = useState({});

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        setIsLoading(true);
        try {
            const mockReports = [
                {
                    id: 1,
                    partNumber: 'FL-2024-001',
                    partName: 'Flange Assembly',
                    inspectionDate: '2026-05-21',
                    inspector: 'Sarah Johnson',
                    status: 'passed',
                    score: '95%',
                    items: [
                        { name: 'Diameter Check', value: '50.02mm', expected: '50±0.1mm', status: 'pass' },
                        { name: 'Thickness Check', value: '9.98mm', expected: '10±0.05mm', status: 'pass' },
                        { name: 'Holes Diameter', value: '6.51mm', expected: '6.5±0.05mm', status: 'pass' },
                        { name: 'Surface Finish', value: 'Ra 0.7μm', expected: 'Ra 0.8μm Max', status: 'pass' },
                        { name: 'Visual Defects', value: 'None', expected: 'None', status: 'pass' }
                    ]
                },
                {
                    id: 2,
                    partNumber: 'SMA-2024-016',
                    partName: 'Display Screen',
                    inspectionDate: '2026-05-26',
                    inspector: 'Mike Davis',
                    status: 'failed',
                    score: '60%',
                    items: [
                        { name: 'Screen Brightness', value: '350 nits', expected: '400 nits', status: 'fail' },
                        { name: 'Color Accuracy', value: '92%', expected: '95%', status: 'fail' },
                        { name: 'Touch Sensitivity', value: 'Working', expected: 'Working', status: 'pass' },
                        { name: 'Display Cracks', value: 'None', expected: 'None', status: 'pass' }
                    ]
                },
                {
                    id: 3,
                    partNumber: 'MDU-2024-008',
                    partName: 'Motor Assembly',
                    inspectionDate: '2026-05-16',
                    inspector: 'John Smith',
                    status: 'passed',
                    score: '98%',
                    items: [
                        { name: 'Motor Shaft Alignment', status: 'pass' },
                        { name: 'Bearing Tolerance', status: 'pass' },
                        { name: 'Housing Fit', status: 'pass' },
                        { name: 'Electrical Test', status: 'pass' },
                        { name: 'Vibration Test', status: 'pass' },
                        { name: 'Noise Level', status: 'pass' }
                    ]
                }
            ];
            setReports(mockReports);
        } catch (error) {
            console.error('Error loading reports:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewDetails = (report) => {
        setSelectedReport(report);
        const initialChecklist = {};
        report.items.forEach((item, idx) => {
            initialChecklist[idx] = item.status === 'pass';
        });
        setChecklist(initialChecklist);
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedReport(null);
    };

    const handleChecklistChange = (idx) => {
        setChecklist(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    const getStatusColor = (status) => {
        return status === 'passed' ? '#10b981' : '#ef4444';
    };

    const filteredReports = reports.filter(r =>
        r.partName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.partNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <Typography color="textSecondary">Loading inspection reports...</Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 2 }}>
                Inspection Reports ({filteredReports.length})
            </Typography>

            {filteredReports.length > 0 ? (
                <Grid container spacing={2}>
                    {filteredReports.map(report => (
                        <Grid item xs={12} key={report.id}>
                            <Card sx={{ borderLeft: `4px solid ${getStatusColor(report.status)}` }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 0.5 }}>
                                                {report.partName} ({report.partNumber})
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                                                Inspected by {report.inspector} on {report.inspectionDate}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            icon={report.status === 'passed' ? <CheckCircleIcon /> : <ErrorIcon />}
                                            label={report.status === 'passed' ? 'PASSED' : 'FAILED'}
                                            sx={{
                                                background: getStatusColor(report.status),
                                                color: 'white',
                                                fontWeight: 'bold'
                                            }}
                                        />
                                    </Box>

                                    <Box sx={{ background: '#f8fafc', p: 2, borderRadius: '6px', mb: 2 }}>
                                        <Grid container spacing={2}>
                                            <Grid item xs={6} sm={3}>
                                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                    Overall Score
                                                </Typography>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: getStatusColor(report.status) }}>
                                                    {report.score}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                    Items Checked
                                                </Typography>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                                                    {report.items.length}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                    Passed
                                                </Typography>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#10b981' }}>
                                                    {report.items.filter(i => i.status === 'pass').length}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                    Failed
                                                </Typography>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ef4444' }}>
                                                    {report.items.filter(i => i.status === 'fail').length}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button
                                            size="small"
                                            startIcon={<VisibilityIcon />}
                                            onClick={() => handleViewDetails(report)}
                                            sx={{ textTransform: 'none', color: '#3b82f6' }}
                                        >
                                            View Details
                                        </Button>
                                        <Button
                                            size="small"
                                            startIcon={<DownloadIcon />}
                                            sx={{ textTransform: 'none', color: '#3b82f6' }}
                                        >
                                            Download PDF
                                        </Button>
                                        <Button
                                            size="small"
                                            startIcon={<PrintIcon />}
                                            sx={{ textTransform: 'none', color: '#3b82f6' }}
                                        >
                                            Print
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Box sx={{ textAlign: 'center', py: 8, background: '#f8fafc', borderRadius: '8px' }}>
                    <Typography variant="h6" sx={{ color: '#64748b', mb: 1 }}>
                        No inspection reports found
                    </Typography>
                </Box>
            )}

            {/* Details Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {selectedReport?.partName} - Inspection Checklist
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    {selectedReport && (
                        <Box>
                            <FormGroup>
                                {selectedReport.items.map((item, idx) => (
                                    <FormControlLabel
                                        key={idx}
                                        control={
                                            <Checkbox
                                                checked={checklist[idx] || false}
                                                onChange={() => handleChecklistChange(idx)}
                                                sx={{
                                                    color: item.status === 'pass' ? '#10b981' : '#ef4444'
                                                }}
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography variant="body2" sx={{ fontWeight: '500' }}>
                                                    {item.name}
                                                </Typography>
                                                {item.value && (
                                                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                        Value: {item.value} | Expected: {item.expected}
                                                    </Typography>
                                                )}
                                            </Box>
                                        }
                                        sx={{ mb: 1 }}
                                    />
                                ))}
                            </FormGroup>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default InspectionReports;
