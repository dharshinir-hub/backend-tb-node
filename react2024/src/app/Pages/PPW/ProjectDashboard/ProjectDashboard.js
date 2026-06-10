import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    Chip,
    LinearProgress,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';

const ProjectDashboard = ({ searchQuery }) => {
    const [projects, setProjects] = useState([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        status: 'active',
        progress: 0
    });

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        setIsLoading(true);
        try {
            // TODO: Replace with actual API call
            const mockProjects = [
                {
                    id: 1,
                    name: 'Flange Assembly FL-2024-001',
                    description: 'Metal flange component manufacturing',
                    status: 'in-progress',
                    progress: 65,
                    components: 5,
                    drawings: 6,
                    inspections: 2,
                    createdDate: '2026-05-20',
                    dueDate: '2026-06-15'
                },
                {
                    id: 2,
                    name: 'Smartphone Assembly SMA-2024-015',
                    description: 'Complete smartphone manufacturing workflow',
                    status: 'active',
                    progress: 45,
                    components: 247,
                    drawings: 200,
                    inspections: 5,
                    createdDate: '2026-05-25',
                    dueDate: '2026-07-20'
                },
                {
                    id: 3,
                    name: 'Motor Drive Unit MDU-2024-008',
                    description: 'Electric motor assembly and testing',
                    status: 'completed',
                    progress: 100,
                    components: 12,
                    drawings: 15,
                    inspections: 8,
                    createdDate: '2026-04-10',
                    dueDate: '2026-05-20'
                },
                {
                    id: 4,
                    name: 'Bearing Block BBK-2024-022',
                    description: 'Precision bearing component',
                    status: 'pending',
                    progress: 0,
                    components: 3,
                    drawings: 4,
                    inspections: 0,
                    createdDate: '2026-05-28',
                    dueDate: '2026-06-30'
                }
            ];
            setProjects(mockProjects);
        } catch (error) {
            console.error('Error loading projects:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenDialog = () => {
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setFormData({ name: '', description: '', status: 'active', progress: 0 });
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCreateProject = () => {
        // TODO: Call API to create project
        handleCloseDialog();
        loadProjects();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return '#10b981';
            case 'in-progress': return '#3b82f6';
            case 'pending': return '#f59e0b';
            case 'active': return '#8b5cf6';
            default: return '#64748b';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'in-progress': return 'In Progress';
            case 'completed': return 'Completed';
            case 'pending': return 'Pending';
            case 'active': return 'Active';
            default: return status;
        }
    };

    const filteredProjects = projects.filter(project =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <Typography color="textSecondary">Loading projects...</Typography>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header with Create Button */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                    All Projects ({filteredProjects.length})
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleOpenDialog}
                    sx={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        textTransform: 'none',
                        borderRadius: '6px',
                        fontWeight: '500'
                    }}
                >
                    New Project
                </Button>
            </Box>

            {/* Projects Grid */}
            {filteredProjects.length > 0 ? (
                <Grid container spacing={2}>
                    {filteredProjects.map(project => (
                        <Grid item xs={12} key={project.id}>
                            <Card sx={{ borderLeft: `4px solid ${getStatusColor(project.status)}` }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 0.5 }}>
                                                {project.name}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                                                {project.description}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={getStatusLabel(project.status)}
                                            size="small"
                                            sx={{
                                                background: getStatusColor(project.status),
                                                color: 'white',
                                                fontWeight: '500'
                                            }}
                                        />
                                    </Box>

                                    {/* Progress Bar */}
                                    <Box sx={{ mb: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                Progress
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#1e293b', fontWeight: '600' }}>
                                                {project.progress}%
                                            </Typography>
                                        </Box>
                                        <LinearProgress
                                            variant="determinate"
                                            value={project.progress}
                                            sx={{
                                                height: '8px',
                                                borderRadius: '4px',
                                                backgroundColor: '#e2e8f0',
                                                '& .MuiLinearProgress-bar': {
                                                    backgroundColor: getStatusColor(project.status)
                                                }
                                            }}
                                        />
                                    </Box>

                                    {/* Project Stats */}
                                    <Grid container spacing={2} sx={{ mb: 2 }}>
                                        <Grid item xs={6} sm={3}>
                                            <Box sx={{ p: 1, background: '#f8fafc', borderRadius: '6px' }}>
                                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                    Components
                                                </Typography>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                                                    {project.components}
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={6} sm={3}>
                                            <Box sx={{ p: 1, background: '#f8fafc', borderRadius: '6px' }}>
                                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                    Drawings
                                                </Typography>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                                                    {project.drawings}
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={6} sm={3}>
                                            <Box sx={{ p: 1, background: '#f8fafc', borderRadius: '6px' }}>
                                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                    Inspections
                                                </Typography>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                                                    {project.inspections}
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={6} sm={3}>
                                            <Box sx={{ p: 1, background: '#f8fafc', borderRadius: '6px' }}>
                                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                    Due
                                                </Typography>
                                                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#1e293b', display: 'block' }}>
                                                    {project.dueDate}
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    </Grid>

                                    {/* Actions */}
                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                        <Button size="small" startIcon={<EditIcon />} sx={{ textTransform: 'none' }}>
                                            Edit
                                        </Button>
                                        <Button size="small" startIcon={<DeleteIcon />} sx={{ textTransform: 'none', color: '#ef4444' }}>
                                            Delete
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography variant="h6" sx={{ color: '#64748b', mb: 1 }}>
                        No projects found
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
                        Create a new project to get started with your paperless workflow
                    </Typography>
                    <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={handleOpenDialog}
                        sx={{ textTransform: 'none' }}
                    >
                        Create New Project
                    </Button>
                </Box>
            )}

            {/* Create Project Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <TextField
                        fullWidth
                        label="Project Name"
                        name="name"
                        value={formData.name}
                        onChange={handleFormChange}
                        placeholder="e.g., Flange Assembly FL-2024-001"
                        margin="normal"
                    />
                    <TextField
                        fullWidth
                        label="Description"
                        name="description"
                        value={formData.description}
                        onChange={handleFormChange}
                        placeholder="Brief description of the project"
                        margin="normal"
                        multiline
                        rows={3}
                    />
                    <TextField
                        fullWidth
                        select
                        label="Status"
                        name="status"
                        value={formData.status}
                        onChange={handleFormChange}
                        margin="normal"
                    >
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="in-progress">In Progress</MenuItem>
                        <MenuItem value="completed">Completed</MenuItem>
                    </TextField>
                    <Box sx={{ display: 'flex', gap: 1, mt: 3, justifyContent: 'flex-end' }}>
                        <Button onClick={handleCloseDialog} sx={{ textTransform: 'none' }}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleCreateProject}
                            sx={{ textTransform: 'none', background: '#3b82f6' }}
                        >
                            Create
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default ProjectDashboard;
