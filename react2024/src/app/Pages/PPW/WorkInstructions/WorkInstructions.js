import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Chip, Button,
    Dialog, DialogTitle, DialogContent, TextField, List, ListItem, ListItemText
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';

const WorkInstructions = ({ searchQuery }) => {
    const [instructions, setInstructions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedInstruction, setSelectedInstruction] = useState(null);

    useEffect(() => {
        loadInstructions();
    }, []);

    const loadInstructions = async () => {
        setIsLoading(true);
        try {
            const mockInstructions = [
                {
                    id: 1,
                    partNumber: 'FL-2024-001',
                    title: 'Flange Body Manufacturing',
                    description: 'Step-by-step guide for manufacturing metal flange',
                    status: 'published',
                    createdDate: '2026-05-20',
                    generatedBy: 'AI Auto-Generate',
                    steps: [
                        'Prepare Material - Cut stainless steel to Φ50mm × 10mm',
                        'Clean Surface - Use brush to clean surface',
                        'Setup Lathe - Configure lathe at 800 RPM',
                        'Machine Part - Use CNC lathe for precision',
                        'Polish Surface - Sand with 220 grit',
                        'Final Check - Verify dimensions'
                    ],
                    estimatedTime: '45 minutes',
                    difficulty: 'Advanced'
                },
                {
                    id: 2,
                    partNumber: 'FL-2024-002',
                    title: 'Bolt Assembly Instructions',
                    description: 'Assembly guide for M6x20 bolts',
                    status: 'draft',
                    createdDate: '2026-05-19',
                    generatedBy: 'AI Auto-Generate',
                    steps: [
                        'Gather all bolts M6x20',
                        'Inspect for defects',
                        'Organize by batch',
                        'Package for shipment'
                    ],
                    estimatedTime: '20 minutes',
                    difficulty: 'Basic'
                },
                {
                    id: 3,
                    partNumber: 'SMA-2024-015',
                    title: 'Smartphone Final Assembly',
                    description: 'Complete assembly procedure for smartphone',
                    status: 'published',
                    createdDate: '2026-05-25',
                    generatedBy: 'AI Auto-Generate',
                    steps: [
                        'Pre-Assembly Verification - Check all components',
                        'Install Battery - Secure inside frame',
                        'Install Processor - Connect motherboard',
                        'Install Camera - Attach camera module',
                        'Connect Display - Align screen',
                        'Assemble Housing - Screw all components',
                        'Power Test - Verify functionality',
                        'Final Check - Quality assurance'
                    ],
                    estimatedTime: '30 minutes',
                    difficulty: 'Advanced'
                }
            ];
            setInstructions(mockInstructions);
        } catch (error) {
            console.error('Error loading instructions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewDetails = (instruction) => {
        setSelectedInstruction(instruction);
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedInstruction(null);
    };

    const getStatusColor = (status) => {
        return status === 'published' ? '#10b981' : '#f59e0b';
    };

    const getDifficultyColor = (difficulty) => {
        switch (difficulty) {
            case 'Basic': return '#10b981';
            case 'Intermediate': return '#f59e0b';
            case 'Advanced': return '#ef4444';
            default: return '#64748b';
        }
    };

    const filteredInstructions = instructions.filter(i =>
        i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.partNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <Typography color="textSecondary">Loading work instructions...</Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 2 }}>
                Work Instructions ({filteredInstructions.length})
            </Typography>

            {filteredInstructions.length > 0 ? (
                <Grid container spacing={2}>
                    {filteredInstructions.map(instruction => (
                        <Grid item xs={12} key={instruction.id}>
                            <Card sx={{ borderLeft: `4px solid ${getStatusColor(instruction.status)}` }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 0.5 }}>
                                                {instruction.title}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                                                {instruction.description}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Chip
                                                label={instruction.status}
                                                size="small"
                                                sx={{
                                                    background: getStatusColor(instruction.status),
                                                    color: 'white',
                                                    fontWeight: '500'
                                                }}
                                            />
                                            <Chip
                                                label={instruction.difficulty}
                                                size="small"
                                                sx={{
                                                    background: getDifficultyColor(instruction.difficulty),
                                                    color: 'white',
                                                    fontWeight: '500'
                                                }}
                                            />
                                        </Box>
                                    </Box>

                                    <Grid container spacing={2} sx={{ mb: 2 }}>
                                        <Grid item xs={6} sm={3}>
                                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                Part Number
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                                                {instruction.partNumber}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6} sm={3}>
                                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                Estimated Time
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                                                {instruction.estimatedTime}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6} sm={3}>
                                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                Steps
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                                                {instruction.steps.length}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6} sm={3}>
                                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                Generated
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                                                {instruction.generatedBy}
                                            </Typography>
                                        </Grid>
                                    </Grid>

                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button
                                            size="small"
                                            startIcon={<VisibilityIcon />}
                                            onClick={() => handleViewDetails(instruction)}
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
                                        {instruction.status === 'draft' && (
                                            <Button
                                                size="small"
                                                startIcon={<EditIcon />}
                                                sx={{ textTransform: 'none', color: '#3b82f6' }}
                                            >
                                                Edit
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
                    <Typography variant="h6" sx={{ color: '#64748b', mb: 1 }}>
                        No work instructions found
                    </Typography>
                </Box>
            )}

            {/* Details Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {selectedInstruction?.title}
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    {selectedInstruction && (
                        <Box>
                            <List>
                                <ListItem>
                                    <ListItemText
                                        primary="Part Number"
                                        secondary={selectedInstruction.partNumber}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Estimated Time"
                                        secondary={selectedInstruction.estimatedTime}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Difficulty Level"
                                        secondary={selectedInstruction.difficulty}
                                    />
                                </ListItem>
                            </List>

                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 2, mb: 1 }}>
                                Steps:
                            </Typography>
                            <Box component="ol" sx={{ pl: 2 }}>
                                {selectedInstruction.steps.map((step, idx) => (
                                    <Typography component="li" key={idx} variant="body2" sx={{ mb: 1 }}>
                                        {step}
                                    </Typography>
                                ))}
                            </Box>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default WorkInstructions;
