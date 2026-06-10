import React, { useState } from 'react';
import { Box, Container, Typography, Card, CardContent, Grid, Tabs, Tab } from '@mui/material';

const SimpleTabPanel = ({ children, value, index }) => {
    return value === index ? <Box sx={{ p: 3 }}>{children}</Box> : null;
};

const PPW = () => {
    const [activeTab, setActiveTab] = useState(0);

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            {/* Header */}
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                📋 Paperless Workflow & Part Program (PPW)
            </Typography>
            <Typography variant="body1" sx={{ color: '#666', mb: 3 }}>
                Digitize your manufacturing workflow - From drawings to approval to production
            </Typography>

            {/* Quick Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    { label: 'Total Projects', value: '12', color: '#3b82f6' },
                    { label: 'Active', value: '8', color: '#10b981' },
                    { label: 'Pending', value: '3', color: '#f59e0b' },
                    { label: 'In QC', value: '15', color: '#8b5cf6' },
                    { label: 'Completed', value: '4', color: '#ec4899' },
                ].map((stat, idx) => (
                    <Grid item xs={12} sm={6} md={2.4} key={idx}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center', p: '16px !important' }}>
                                <Typography sx={{ color: stat.color, fontSize: '24px', fontWeight: 'bold' }}>
                                    {stat.value}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#666' }}>
                                    {stat.label}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: '#ddd', mb: 2 }}>
                <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)}>
                    <Tab label="📊 Dashboard" />
                    <Tab label="📁 Drawings" />
                    <Tab label="📝 Instructions" />
                    <Tab label="✅ Reports" />
                    <Tab label="📋 Specs" />
                    <Tab label="🔏 Approvals" />
                </Tabs>
            </Box>

            {/* Content */}
            <Box sx={{ bgcolor: '#fff', p: 2, borderRadius: '8px' }}>
                <SimpleTabPanel value={activeTab} index={0}>
                    <Typography variant="h6">📊 Project Dashboard</Typography>
                    <Typography sx={{ mt: 2, color: '#666' }}>
                        Welcome to PPW Dashboard! View all your manufacturing projects here.
                    </Typography>
                </SimpleTabPanel>

                <SimpleTabPanel value={activeTab} index={1}>
                    <Typography variant="h6">📁 Drawing Management</Typography>
                    <Typography sx={{ mt: 2, color: '#666' }}>
                        Upload and manage your technical drawings here.
                    </Typography>
                </SimpleTabPanel>

                <SimpleTabPanel value={activeTab} index={2}>
                    <Typography variant="h6">📝 Work Instructions</Typography>
                    <Typography sx={{ mt: 2, color: '#666' }}>
                        Auto-generated assembly and manufacturing guides.
                    </Typography>
                </SimpleTabPanel>

                <SimpleTabPanel value={activeTab} index={3}>
                    <Typography variant="h6">✅ Inspection Reports</Typography>
                    <Typography sx={{ mt: 2, color: '#666' }}>
                        Quality control checklists and inspection results.
                    </Typography>
                </SimpleTabPanel>

                <SimpleTabPanel value={activeTab} index={4}>
                    <Typography variant="h6">📋 Specifications</Typography>
                    <Typography sx={{ mt: 2, color: '#666' }}>
                        Complete technical specifications for all parts.
                    </Typography>
                </SimpleTabPanel>

                <SimpleTabPanel value={activeTab} index={5}>
                    <Typography variant="h6">🔏 Approval Workflow</Typography>
                    <Typography sx={{ mt: 2, color: '#666' }}>
                        Digital approval process for drawings and documents.
                    </Typography>
                </SimpleTabPanel>
            </Box>
        </Container>
    );
};

export default PPW;
