import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Grid,
    TextField,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Schedule';

const DrawingManagement = ({ searchQuery }) => {
    const [drawings, setDrawings] = useState([]);
    const [dragOver, setDragOver] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [openPreview, setOpenPreview] = useState(false);
    const [selectedDrawing, setSelectedDrawing] = useState(null);

    useEffect(() => {
        loadDrawings();
    }, []);

    const loadDrawings = async () => {
        setIsLoading(true);
        try {
            // TODO: Replace with actual API call
            const mockDrawings = [
                {
                    id: 1,
                    partNumber: 'FL-2024-001',
                    name: 'Flange Body Manufacturing',
                    fileName: 'Flange_Body_50mm_A02.pdf',
                    material: 'SUS304',
                    size: '2.4 MB',
                    uploadDate: '2026-05-20',
                    status: 'approved',
                    approvedBy: 'John Smith',
                    approvalDate: '2026-05-21'
                },
                {
                    id: 2,
                    partNumber: 'FL-2024-002',
                    name: 'Bolt M6x20 Specification',
                    fileName: 'Bolt_M6x20_A01.pdf',
                    material: 'Steel',
                    size: '1.1 MB',
                    uploadDate: '2026-05-19',
                    status: 'pending',
                    approvedBy: null,
                    approvalDate: null
                },
                {
                    id: 3,
                    partNumber: 'SMA-2024-015',
                    name: 'Smartphone Assembly Main',
                    fileName: 'iPhone15_Assembly_A01.pdf',
                    material: 'Mixed',
                    size: '5.8 MB',
                    uploadDate: '2026-05-25',
                    status: 'approved',
                    approvedBy: 'Sarah Johnson',
                    approvalDate: '2026-05-26'
                },
                {
                    id: 4,
                    partNumber: 'SMA-2024-016',
                    name: 'Display Screen Assembly',
                    fileName: 'Display_OLED_6.1inch_A01.pdf',
                    material: 'Glass/Electronics',
                    size: '3.2 MB',
                    uploadDate: '2026-05-25',
                    status: 'rejected',
                    approvedBy: 'John Smith',
                    approvalDate: '2026-05-26',
                    rejectReason: 'Tolerance values need revision'
                },
                {
                    id: 5,
                    partNumber: 'MDU-2024-008',
                    name: 'Motor Assembly Diagram',
                    fileName: 'Motor_Assembly_A03.pdf',
                    material: 'Steel',
                    size: '2.9 MB',
                    uploadDate: '2026-05-15',
                    status: 'approved',
                    approvedBy: 'Mike Davis',
                    approvalDate: '2026-05-16'
                }
            ];
            setDrawings(mockDrawings);
        } catch (error) {
            console.error('Error loading drawings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer.files;
        handleFiles(files);
    };

    const handleFileInput = (e) => {
        const files = e.target.files;
        handleFiles(files);
    };

    const handleFiles = (files) => {
        // TODO: Upload files to server
        console.log('Files to upload:', files);
        for (let file of files) {
            if (file.type === 'application/pdf' || file.name.endsWith('.dwg') || file.name.endsWith('.step')) {
                console.log('File ready for upload:', file.name);
            }
        }
    };

    const handlePreview = (drawing) => {
        setSelectedDrawing(drawing);
        setOpenPreview(true);
    };

    const handleClosePreview = () => {
        setOpenPreview(false);
        setSelectedDrawing(null);
    };

    const handleDelete = (id) => {
        // TODO: Call API to delete drawing
        setDrawings(drawings.filter(d => d.id !== id));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return '#10b981';
            case 'pending': return '#f59e0b';
            case 'rejected': return '#ef4444';
            default: return '#64748b';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved': return <CheckCircleIcon sx={{ color: '#10b981' }} />;
            case 'pending': return <PendingIcon sx={{ color: '#f59e0b' }} />;
            case 'rejected': return <DeleteIcon sx={{ color: '#ef4444' }} />;
            default: return <DescriptionIcon />;
        }
    };

    const filteredDrawings = drawings.filter(drawing =>
        drawing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        drawing.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        drawing.material.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <Typography color="textSecondary">Loading drawings...</Typography>
            </Box>
        );
    }

    return (
        <Box>
            {/* Upload Section */}
            <Box
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                sx={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: dragOver ? '#dbeafe' : '#f8fafc',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    mb: 4,
                    '&:hover': {
                        borderColor: '#3b82f6',
                        backgroundColor: '#eff6ff'
                    }
                }}
            >
                <CloudUploadIcon sx={{ fontSize: 48, color: '#3b82f6', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 1 }}>
                    Drag & Drop Your Drawings Here
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                    Supported formats: PDF, DWG, STEP, IGES
                </Typography>
                <input
                    type="file"
                    multiple
                    accept=".pdf,.dwg,.step,.iges"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                    id="file-input"
                />
                <label htmlFor="file-input">
                    <Button
                        variant="contained"
                        component="span"
                        sx={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            textTransform: 'none',
                            borderRadius: '6px'
                        }}
                    >
                        <CloudUploadIcon sx={{ mr: 1 }} />
                        Browse Files
                    </Button>
                </label>
            </Box>

            {/* Drawings List */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 2 }}>
                    All Drawings ({filteredDrawings.length})
                </Typography>

                {filteredDrawings.length > 0 ? (
                    <Grid container spacing={2}>
                        {filteredDrawings.map(drawing => (
                            <Grid item xs={12} key={drawing.id}>
                                <Card sx={{ borderLeft: `4px solid ${getStatusColor(drawing.status)}` }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'start', flex: 1 }}>
                                                <Box sx={{ mt: 0.5 }}>
                                                    {getStatusIcon(drawing.status)}
                                                </Box>
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 0.5 }}>
                                                        {drawing.name}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                                                        Part #: <strong>{drawing.partNumber}</strong> | Material: <strong>{drawing.material}</strong>
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                                        {drawing.fileName} ({drawing.size}) • Uploaded on {drawing.uploadDate}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Chip
                                                label={drawing.status.charAt(0).toUpperCase() + drawing.status.slice(1)}
                                                size="small"
                                                sx={{
                                                    background: getStatusColor(drawing.status),
                                                    color: 'white',
                                                    fontWeight: '500'
                                                }}
                                            />
                                        </Box>

                                        {/* Approval Info */}
                                        {drawing.approvedBy && (
                                            <Box sx={{ background: '#f8fafc', p: 1.5, borderRadius: '6px', mb: 2 }}>
                                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5 }}>
                                                    {drawing.status === 'approved' ? 'Approved' : 'Rejected'} by {drawing.approvedBy} on {drawing.approvalDate}
                                                </Typography>
                                                {drawing.rejectReason && (
                                                    <Typography variant="caption" sx={{ color: '#ef4444', display: 'block' }}>
                                                        Reason: {drawing.rejectReason}
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}

                                        {/* Actions */}
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                                size="small"
                                                startIcon={<VisibilityIcon />}
                                                onClick={() => handlePreview(drawing)}
                                                sx={{ textTransform: 'none', color: '#3b82f6' }}
                                            >
                                                Preview
                                            </Button>
                                            <Button
                                                size="small"
                                                startIcon={<DownloadIcon />}
                                                sx={{ textTransform: 'none', color: '#3b82f6' }}
                                            >
                                                Download
                                            </Button>
                                            {drawing.status === 'pending' && (
                                                <Button
                                                    size="small"
                                                    startIcon={<DeleteIcon />}
                                                    onClick={() => handleDelete(drawing.id)}
                                                    sx={{ textTransform: 'none', color: '#ef4444' }}
                                                >
                                                    Delete
                                                </Button>
                                            )}
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                ) : (
                    <Box sx={{ textAlign: 'center', py: 8, background: '#f8fafc', borderRadius: '8px' }}>
                        <DescriptionIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 2 }} />
                        <Typography variant="h6" sx={{ color: '#64748b', mb: 1 }}>
                            No drawings found
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                            Upload your first drawing to get started
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Preview Dialog */}
            <Dialog open={openPreview} onClose={handleClosePreview} maxWidth="md" fullWidth>
                <DialogTitle>
                    {selectedDrawing?.name}
                </DialogTitle>
                <DialogContent sx={{ py: 3 }}>
                    {selectedDrawing && (
                        <List>
                            <ListItem>
                                <ListItemText
                                    primary="Part Number"
                                    secondary={selectedDrawing.partNumber}
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemText
                                    primary="Material"
                                    secondary={selectedDrawing.material}
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemText
                                    primary="Status"
                                    secondary={selectedDrawing.status}
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemText
                                    primary="File Name"
                                    secondary={selectedDrawing.fileName}
                                />
                            </ListItem>
                            {selectedDrawing.approvedBy && (
                                <ListItem>
                                    <ListItemText
                                        primary="Approved By"
                                        secondary={`${selectedDrawing.approvedBy} on ${selectedDrawing.approvalDate}`}
                                    />
                                </ListItem>
                            )}
                        </List>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default DrawingManagement;
