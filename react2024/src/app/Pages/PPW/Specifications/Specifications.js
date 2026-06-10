import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Grid, Chip, Button, Dialog, DialogTitle, DialogContent } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';

const Specifications = ({ searchQuery }) => {
    const [specs, setSpecs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedSpec, setSelectedSpec] = useState(null);

    useEffect(() => {
        loadSpecifications();
    }, []);

    const loadSpecifications = async () => {
        setIsLoading(true);
        try {
            const mockSpecs = [
                {
                    id: 1,
                    partNumber: 'FL-2024-001',
                    partName: 'Metal Flange',
                    material: 'SUS304 (Stainless Steel)',
                    specs: {
                        'Outer Diameter': 'Φ50 ±0.1 mm',
                        'Thickness': '10 ±0.05 mm',
                        'Mounting Holes': '4 × Φ6.5 ±0.05 mm',
                        'Hole Center Distance': '40 ±0.2 mm',
                        'Surface Finish': 'Ra 0.8 μm',
                        'Material Grade': 'JIS SUS304',
                        'Hardness': 'Max 217 HV',
                        'Density': '7.93 g/cm³',
                        'Tensile Strength': 'Min 520 MPa'
                    }
                },
                {
                    id: 2,
                    partNumber: 'SMA-2024-016',
                    partName: 'Display Screen',
                    material: 'OLED Glass Panel',
                    specs: {
                        'Display Size': '6.1 inches',
                        'Resolution': '2532 × 1170 pixels',
                        'Brightness': '400 nits (min)',
                        'Color Accuracy': '95% DCI-P3',
                        'Touch Sensitivity': '±5mm',
                        'Response Time': '<20ms',
                        'Operating Temperature': '0°C to 35°C',
                        'Storage Temperature': '-20°C to 60°C',
                        'Humidity': '10% to 90% RH'
                    }
                },
                {
                    id: 3,
                    partNumber: 'MDU-2024-008',
                    partName: 'Motor Assembly',
                    material: 'Steel/Copper',
                    specs: {
                        'Motor Type': '3-Phase AC Induction',
                        'Power': '2.2 kW',
                        'Voltage': '380V ±10%',
                        'Frequency': '50 Hz',
                        'Speed': '1450 RPM',
                        'Efficiency': '85%',
                        'Cooling': 'Air Cooled',
                        'Insulation Class': 'F',
                        'IP Rating': 'IP55'
                    }
                }
            ];
            setSpecs(mockSpecs);
        } catch (error) {
            console.error('Error loading specifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewDetails = (spec) => {
        setSelectedSpec(spec);
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedSpec(null);
    };

    const filteredSpecs = specs.filter(s =>
        s.partName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.material.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <Typography color="textSecondary">Loading specifications...</Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 2 }}>
                Specifications ({filteredSpecs.length})
            </Typography>

            {filteredSpecs.length > 0 ? (
                <Grid container spacing={2}>
                    {filteredSpecs.map(spec => (
                        <Grid item xs={12} key={spec.id}>
                            <Card sx={{ borderLeft: '4px solid #3b82f6' }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 0.5 }}>
                                                {spec.partName}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                                                Part #: <strong>{spec.partNumber}</strong> | Material: <strong>{spec.material}</strong>
                                            </Typography>
                                        </Box>
                                        <Chip
                                            icon={<DescriptionIcon />}
                                            label={`${Object.keys(spec.specs).length} Specs`}
                                            size="small"
                                            sx={{ background: '#3b82f6', color: 'white' }}
                                        />
                                    </Box>

                                    <Box sx={{ background: '#f8fafc', p: 2, borderRadius: '6px', mb: 2 }}>
                                        <Grid container spacing={2}>
                                            {Object.entries(spec.specs).slice(0, 4).map(([key, value]) => (
                                                <Grid item xs={6} sm={3} key={key}>
                                                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5 }}>
                                                        {key}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                                                        {value}
                                                    </Typography>
                                                </Grid>
                                            ))}
                                        </Grid>
                                        {Object.keys(spec.specs).length > 4 && (
                                            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1 }}>
                                                +{Object.keys(spec.specs).length - 4} more specifications
                                            </Typography>
                                        )}
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button
                                            size="small"
                                            startIcon={<VisibilityIcon />}
                                            onClick={() => handleViewDetails(spec)}
                                            sx={{ textTransform: 'none', color: '#3b82f6' }}
                                        >
                                            View All Specs
                                        </Button>
                                        <Button
                                            size="small"
                                            startIcon={<DownloadIcon />}
                                            sx={{ textTransform: 'none', color: '#3b82f6' }}
                                        >
                                            Download
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
                        No specifications found
                    </Typography>
                </Box>
            )}

            {/* Details Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {selectedSpec?.partName} - Complete Specifications
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    {selectedSpec && (
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {selectedSpec.partNumber} | {selectedSpec.material}
                            </Typography>
                            <Box sx={{ background: '#f8fafc', p: 2, borderRadius: '6px' }}>
                                {Object.entries(selectedSpec.specs).map(([key, value]) => (
                                    <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #e2e8f0' }}>
                                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                                            {key}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                                            {value}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default Specifications;
