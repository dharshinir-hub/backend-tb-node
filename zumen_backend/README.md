# Zumen PPW Backend

Backend API for the **Paperless Workflow & Part Program (PPW)** system.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd zumen_backend
npm install
```

### 2. Start the Server
```bash
npm start
# Or for development with auto-reload:
npm run dev
```

You should see:
```
✅ PPW Backend Server running on http://localhost:5000
```

## 📚 API Endpoints

### Health Check
```
GET /api/health
```

### Projects
```
GET    /api/projects              # Get all projects
GET    /api/projects/:id          # Get single project
POST   /api/projects              # Create new project
PUT    /api/projects/:id          # Update project
DELETE /api/projects/:id          # Delete project
```

### Drawings
```
GET    /api/drawings              # Get all drawings
GET    /api/drawings/:id          # Get single drawing
POST   /api/drawings              # Upload new drawing
PUT    /api/drawings/:id          # Update drawing
```

### Work Instructions
```
GET    /api/instructions          # Get all instructions
GET    /api/instructions/:id      # Get single instruction
POST   /api/instructions          # Create instruction
```

### Inspection Reports
```
GET    /api/reports               # Get all reports
GET    /api/reports/:id           # Get single report
POST   /api/reports               # Create new report
```

### Specifications
```
GET    /api/specifications        # Get all specs
GET    /api/specifications/:id    # Get single spec
POST   /api/specifications        # Create new spec
```

### Approvals
```
GET    /api/approvals             # Get all approvals
GET    /api/approvals/:id         # Get single approval
POST   /api/approvals             # Create approval request
PUT    /api/approvals/:id         # Approve/Reject
```

## 💾 Data Structure

### Project
```json
{
  "id": 1,
  "name": "Flange Assembly",
  "status": "In Progress",
  "progress": 75,
  "dueDate": "2026-06-15",
  "components": 8,
  "startDate": "2026-05-20"
}
```

### Drawing
```json
{
  "id": 1,
  "name": "Main Assembly",
  "format": "PDF",
  "status": "Approved",
  "date": "2026-05-28",
  "projectId": 1,
  "size": "2.4 MB"
}
```

### Instruction
```json
{
  "id": 1,
  "title": "Assembly Guide",
  "projectId": 1,
  "steps": 12,
  "time": "45 mins",
  "difficulty": "Medium",
  "components": ["Part A", "Part B"],
  "createdDate": "2026-05-25"
}
```

### Report
```json
{
  "id": 1,
  "projectId": 1,
  "title": "Inspection Report 001",
  "date": "2026-05-30",
  "inspector": "John Smith",
  "status": "Pass",
  "score": 98
}
```

### Specification
```json
{
  "id": 1,
  "name": "Flange Part A",
  "material": "Stainless Steel 316",
  "tolerance": "±0.5mm",
  "weight": "250g",
  "projectId": 1
}
```

### Approval
```json
{
  "id": 1,
  "drawingId": 1,
  "title": "Main Assembly Approval",
  "status": "Approved",
  "requestedBy": "Engineer 1",
  "approvedBy": "Manager A",
  "date": "2026-05-28"
}
```

## 🔄 Frontend Integration

Connect your React frontend to this backend:

```javascript
// Example API call from React
const fetchProjects = async () => {
  const response = await fetch('http://localhost:5000/api/projects');
  const data = await response.json();
  return data;
};
```

## 📝 Test API

Use any API client (Postman, Insomnia, etc.) or curl:

```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Get all projects
curl http://localhost:5000/api/projects

# Create new project
curl -X POST http://localhost:5000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Project",
    "dueDate": "2026-07-01",
    "components": 5
  }'
```

## 🛠️ Current Features

- ✅ Mock data (in-memory database)
- ✅ Full CRUD operations for all modules
- ✅ CORS enabled for frontend integration
- ✅ JSON request/response format
- ✅ Error handling

## 📦 Future Enhancements

- [ ] Connect to MongoDB/PostgreSQL database
- [ ] User authentication (JWT)
- [ ] File upload for drawings
- [ ] Email notifications
- [ ] Advanced filtering and search
- [ ] Data validation and sanitization
- [ ] Request logging and monitoring
- [ ] API rate limiting

## 🔧 Environment Variables

Create `.env` file:
```
PORT=5000
NODE_ENV=development
```

## 📞 Support

For issues, check the console output and verify:
1. Backend is running on port 5000
2. Frontend is configured to use correct API URL
3. CORS is properly enabled
4. No port conflicts

---

**Backend Status**: ✅ Ready for Development & Testing
