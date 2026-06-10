import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Chip, Button, Dialog,
    DialogTitle, DialogContent, TextField, MenuItem, List, ListItem, ListItemText
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Schedule';
import MessageIcon from '@mui/icons-material/Message';

const ApprovalWorkflow = ({ searchQuery }) => {
    const [approvals, setApprovals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedApproval, setSelectedApproval] = useState(null);
    const [actionType, setActionType] = useState(''); // 'approve' or 'reject'
    const [comments, setComments] = useState('');

    useEffect(() => {
        loadApprovals();
    }, []);

    const loadApprovals = async () => {
        setIsLoading(true);
        try {
            const mockApprovals = [
                {
                    id: 1,
                    partNumber: 'FL-2024-001',
                    partName: 'Flange Assembly',
                    drawingFile: 'Flange_Body_50mm_A02.pdf',
                    submittedBy: 'John Doe',
                    submittedDate: '2026-05-20',
                    status: 'pending',
                    type: 'design',
                    description: 'Final design for metal flange component'
                },
                {
                    id: 2,
                    partNumber: 'SMA-2024-015',
                    partName: 'Smartphone Assembly',
                    drawingFile: 'iPhone15_Assembly_A01.pdf',
                    submittedBy: 'Jane Smith',
                    submittedDate: '2026-05-25',
                    status: 'pending',
                    type: 'design',
                    description: 'Complete smartphone manufacturing workflow'
                },
                {
                    id: 3,
                    partNumber: 'FL-2024-002',
                    partName: 'Bolt M6x20',
                    drawingFile: 'Bolt_M6x20_A01.pdf',
                    submittedBy: 'Mike Johnson',
                    submittedDate: '2026-05-19',
                    status: 'approved',
                    approvedBy: 'Sarah Johnson',
                    approvalDate: '2026-05-21',
                    type: 'design',
                    description: 'Bolt specifications and manufacturing guide'
                },
                {
                    id: 4,
                    partNumber: 'SMA-2024-016',
                    partName: 'Display Screen',
                    drawingFile: 'Display_OLED_6.1inch_A01.pdf',
                    submittedBy: 'Tom Wilson',
                    submittedDate: '2026-05-25',
                    status: 'rejected',
                    rejectedBy: 'John Smith',
                    rejectionDate: '2026-05-26',
                    rejectionReason: 'Tolerance values need revision - please update and resubmit',
                    type: 'design',
                    description: 'Display screen assembly'
                },
                {
                    id: 5,
                    partNumber: 'MDU-2024-008',
                    partName: 'Motor Assembly',
                    drawingFile: 'Motor_Assembly_A03.pdf',
                    submittedBy: 'Lisa Brown',
                    submittedDate: '2026-05-15',
                    status: 'approved',
                    approvedBy: 'Mike Davis',
                    approvalDate: '2026-05-16',
                    type: 'design',
                    description: 'Motor assembly diagram and specifications'
                }
            ];
            setApprovals(mockApprovals);
        } catch (error) {
            console.error('Error loading approvals:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenDialog = (approval, type) => {
        setSelectedApproval(approval);
        setActionType(type);
        setComments('');
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedApproval(null);
        setActionType('');
        setComments('');
    };

    const handleSubmitAction = () => {
        // TODO: Call API to update approval status
        handleCloseDialog();
        loadApprovals();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return '#10b981';
            case 'rejected': return '#ef4444';
            case 'pending': return '#f59e0b';
            default: return '#64748b';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved': return <CheckCircleIcon sx={{ color: '#10b981' }} />;
            case 'rejected': return <CancelIcon sx={{ color: '#ef4444' }} />;
            case 'pending': return <PendingIcon sx={{ color: '#f59e0b' }} />;
            default: return <MessageIcon />;
        }
    };

    const filteredApprovals = approvals.filter(a =>
        a.partName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.partNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <Typography color="textSecondary">Loading approvals...</Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 2 }}>
                Approval Workflow ({filteredApprovals.length})
            </Typography>

            {filteredApprovals.length > 0 ? (
                <Grid container spacing={2}>
                    {filteredApprovals.map(approval => (
                        <Grid item xs={12} key={approval.id}>
                            <Card sx={{ borderLeft: `4px solid ${getStatusColor(approval.status)}` }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                        <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
                                            <Box sx={{ mt: 0.5 }}>
                                                {getStatusIcon(approval.status)}
                                            </Box>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 0.5 }}>
                                                    {approval.partName}
                                                </Typography>
                                                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                                                    {approval.description}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                                    Part #: <strong>{approval.partNumber}</strong> | Submitted by {approval.submittedBy} on {approval.submittedDate}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Chip
                                            label={approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                                            size="small"
                                            sx={{
                                                background: getStatusColor(approval.status),
                                                color: 'white',
                                                fontWeight: '500'
                                            }}
                                        />
                                    </Box>

                                    {/* Status Info */}
                                    {approval.status === 'approved' && (
                                        <Box sx={{ background: '#dcfce7', p: 1.5, borderRadius: '6px', mb: 2 }}>
                                            <Typography variant="caption" sx={{ color: '#166534', display: 'block' }}>
                                                ✓ Approved by {approval.approvedBy} on {approval.approvalDate}
                                            </Typography>
                                        </Box>
                                    )}
                                    {approval.status === 'rejected' && (
                                        <Box sx={{ background: '#fee2e2', p: 1.5, borderRadius: '6px', mb: 2 }}>
                                            <Typography variant="caption" sx={{ color: '#991b1b', display: 'block', mb: 0.5 }}>
                                                ✗ Rejected by {approval.rejectedBy} on {approval.rejectionDate}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#991b1b', display: 'block' }}>
                                                Reason: {approval.rejectionReason}
                                            </Typography>
                                        </Box>
                                    )}
                                    {approval.status === 'pending' && (
                                        <Box sx={{ background: '#fef3c7', p: 1.5, borderRadius: '6px', mb: 2 }}>
                                            <Typography variant="caption" sx={{ color: '#92400e', display: 'block' }}>
                                                ⏳ Awaiting approval - Submitted on {approval.submittedDate}
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Action Buttons */}
                                    {approval.status === 'pending' && (
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                onClick={() => handleOpenDialog(approval, 'approve')}
                                                sx={{
                                                    background: '#10b981',
                                                    textTransform: 'none',
                                                    '&:hover': { background: '#059669' }
                                                }}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                onClick={() => handleOpenDialog(approval, 'reject')}
                                                sx={{
                                                    background: '#ef4444',
                                                    textTransform: 'none',
                                                    '&:hover': { background: '#dc2626' }
                                                }}
                                            >
                                                Reject
                                            </Button>
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Box sx={{ textAlign: 'center', py: 8, background: '#f8fafc', borderRadius: '8px' }}>
                    <Typography variant="h6" sx={{ color: '#64748b', mb: 1 }}>
                        No approvals found
                    </Typography>
                </Box>
            )}

            {/* Action Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {actionType === 'approve' ? 'Approve Drawing' : 'Reject Drawing'}
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    {selectedApproval && (
                        <Box>
                            <List>
                                <ListItem>
                                    <ListItemText
                                        primary="Part Number"
                                        secondary={selectedApproval.partNumber}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Part Name"
                                        secondary={selectedApproval.partName}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Drawing File"
                                        secondary={selectedApproval.drawingFile}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Submitted By"
                                        secondary={selectedApproval.submittedBy}
                                    />
                                </ListItem>
                            </List>

                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                label={actionType === 'approve' ? 'Approval Comments (Optional)' : 'Reason for Rejection'}
                                placeholder={actionType === 'approve' ? 'Add any approval notes...' : 'Explain what needs to be fixed...'}
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                margin="normal"
                                variant="outlined"
                                sx={{ mt: 2 }}
                            />

                            <Box sx={{ display: 'flex', gap: 1, mt: 3, justifyContent: 'flex-end' }}>
                                <Button onClick={handleCloseDialog} sx={{ textTransform: 'none' }}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={handleSubmitAction}
                                    sx={{
                                        textTransform: 'none',
                                        background: actionType === 'approve' ? '#10b981' : '#ef4444'
                                    }}
                                >
                                    {actionType === 'approve' ? 'Approve' : 'Reject'}
                                </Button>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default ApprovalWorkflow;
