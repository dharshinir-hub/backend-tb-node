# PPW Backend Integration Guide

How to connect the React frontend to the backend API.

## 1. Start the Backend Server

First, run the backend:

```bash
cd zumen_backend
npm install
npm start
```

You should see:
```
✅ PPW Backend Server running on http://localhost:5000
```

## 2. Create API Service File (Frontend)

Create a new file: `react2024/src/app/services/ppwApi.js`

```javascript
const API_BASE_URL = 'http://localhost:5000/api';

// Projects
export const fetchProjects = async () => {
  const response = await fetch(`${API_BASE_URL}/projects`);
  return response.json();
};

export const createProject = async (projectData) => {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData),
  });
  return response.json();
};

export const updateProject = async (id, projectData) => {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData),
  });
  return response.json();
};

// Drawings
export const fetchDrawings = async () => {
  const response = await fetch(`${API_BASE_URL}/drawings`);
  return response.json();
};

export const createDrawing = async (drawingData) => {
  const response = await fetch(`${API_BASE_URL}/drawings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(drawingData),
  });
  return response.json();
};

// Instructions
export const fetchInstructions = async () => {
  const response = await fetch(`${API_BASE_URL}/instructions`);
  return response.json();
};

// Reports
export const fetchReports = async () => {
  const response = await fetch(`${API_BASE_URL}/reports`);
  return response.json();
};

// Specifications
export const fetchSpecifications = async () => {
  const response = await fetch(`${API_BASE_URL}/specifications`);
  return response.json();
};

// Approvals
export const fetchApprovals = async () => {
  const response = await fetch(`${API_BASE_URL}/approvals`);
  return response.json();
};

export const updateApproval = async (id, approvalData) => {
  const response = await fetch(`${API_BASE_URL}/approvals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(approvalData),
  });
  return response.json();
};
```

## 3. Update PPW Component to Use API

Update `react2024/src/app/Pages/PPW/ppw.js`:

```javascript
import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, Card, CardContent, Grid, Tabs, Tab, Button, CircularProgress } from '@mui/material';
import { fetchProjects, fetchDrawings, fetchInstructions } from '../../services/ppwApi';

const PPW = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [projects, setProjects] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, drawingsData, instructionsData] = await Promise.all([
        fetchProjects(),
        fetchDrawings(),
        fetchInstructions(),
      ]);
      setProjects(projectsData);
      setDrawings(drawingsData);
      setInstructions(instructionsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ... rest of component uses projects, drawings, instructions from state
};

export default PPW;
```

## 4. Test the Connection

1. **Start Backend**:
   ```bash
   cd zumen_backend
   npm start
   ```

2. **In another terminal, start React**:
   ```bash
   cd react2024
   npm start
   ```

3. **Go to** `localhost:3000/ppw`
4. **Open DevTools (F12)** and check Network tab
5. **Look for API calls** to `http://localhost:5000/api/*`

## 5. Common Issues

### CORS Error
**Problem**: `Access to XMLHttpRequest has been blocked by CORS policy`

**Solution**: Backend has CORS enabled, make sure:
- Backend is running on port 5000
- Frontend API URL is `http://localhost:5000/api`

### API Not Responding
**Problem**: `Failed to fetch`

**Solution**:
- Verify backend is running: `http://localhost:5000/api/health`
- Check port 5000 is not in use
- Restart backend server

### Data Not Loading
**Problem**: Tables show but no data

**Solution**:
- Check browser console for fetch errors
- Verify API endpoint returns data:
  ```bash
  curl http://localhost:5000/api/projects
  ```

## 6. API Response Examples

### Get All Projects
```
GET http://localhost:5000/api/projects

Response:
[
  {
    "id": 1,
    "name": "Flange Assembly",
    "status": "In Progress",
    "progress": 75,
    "dueDate": "2026-06-15",
    "components": 8,
    "startDate": "2026-05-20"
  },
  ...
]
```

### Create New Project
```
POST http://localhost:5000/api/projects

Body:
{
  "name": "New Project",
  "dueDate": "2026-07-15",
  "components": 10,
  "startDate": "2026-06-15"
}

Response:
{
  "id": 5,
  "name": "New Project",
  "status": "Pending",
  "progress": 0,
  "dueDate": "2026-07-15",
  "components": 10,
  "startDate": "2026-06-15"
}
```

## 7. Next Steps

- [ ] Replace mock data with real database (MongoDB/PostgreSQL)
- [ ] Add authentication/authorization
- [ ] Add file upload for drawings
- [ ] Add validation and error handling
- [ ] Add logging and monitoring
- [ ] Deploy to production

---

**Status**: Backend ready for frontend integration ✅
