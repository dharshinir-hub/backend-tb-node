# Role-Based Data Filtering Guide

## Architecture

```
Frontend: Shows ALL dashboards
          ↓
User clicks → Backend API
          ↓
Backend checks user role
          ↓
Returns role-specific data only
```

---

## User Roles & Their Access

### 1️⃣ **ENGINEER**

**Visibility**: All dashboards visible
**Data Access**:
```javascript
GET /api/drawings
→ Returns: Only drawings uploaded by THIS engineer
→ Shows: Approval status (Approved/Rejected/Pending)
→ Cannot: See other engineer's drawings

GET /api/instructions
→ Returns: All instructions (read-only)

GET /api/approvals
→ Returns: Approvals for their own drawings
```

### 2️⃣ **MANAGER**

**Visibility**: All dashboards visible
**Data Access**:
```javascript
GET /api/drawings
→ Returns: ALL drawings with status = "Pending"
→ Shows: Pending for approval only
→ Can: Approve/Reject with comments

GET /api/approvals
→ Returns: All pending approvals
→ Can: Change status to Approved/Rejected

GET /api/reports
→ Returns: All reports
→ Can: View analytics
```

### 3️⃣ **OPERATOR**

**Visibility**: All dashboards visible
**Data Access**:
```javascript
GET /api/drawings
→ Returns: Only APPROVED drawings
→ Cannot: Upload or modify

GET /api/instructions
→ Returns: All instructions
→ Can: View and download

GET /api/specifications
→ Returns: All specifications
→ Can: View and reference

Cannot access: Approval workflow, QC reports
```

### 4️⃣ **QC_TEAM**

**Visibility**: All dashboards visible
**Data Access**:
```javascript
GET /api/drawings
→ Returns: All drawings (for inspection)
→ Can: View and create inspection reports

GET /api/approvals
→ Returns: Drawings pending QC approval
→ Can: Approve/Reject with QC results

GET /api/reports
→ Returns: Inspection reports created by THIS QC member
```

---

## Implementation Examples

### Backend Filtering (Node.js/Express)

```javascript
// User object from JWT token
const user = {
  id: 1,
  role: 'engineer',  // or 'manager', 'operator', 'qc'
  name: 'John Engineer'
};

// ==================== DRAWINGS API ====================

app.get('/api/drawings', (req, res) => {
  const userRole = req.user.role;
  const userId = req.user.id;
  
  let query = {};
  
  switch(userRole) {
    case 'engineer':
      // Engineers see only their uploads
      query = { uploadedBy: userId };
      break;
      
    case 'manager':
      // Managers see only pending drawings
      query = { status: 'Pending' };
      break;
      
    case 'operator':
      // Operators see only approved
      query = { status: 'Approved' };
      break;
      
    case 'qc':
      // QC sees all for inspection
      query = {};
      break;
  }
  
  const drawings = db.drawings.find(query);
  res.json(drawings);
});

// ==================== APPROVALS API ====================

app.get('/api/approvals', (req, res) => {
  const userRole = req.user.role;
  const userId = req.user.id;
  
  let approvals = [];
  
  switch(userRole) {
    case 'engineer':
      // See approvals for their own drawings
      approvals = db.approvals.find({ 
        drawingId: { $in: db.drawings.find({ uploadedBy: userId }).map(d => d.id) }
      });
      break;
      
    case 'manager':
      // See all pending approvals
      approvals = db.approvals.find({ status: 'Pending' });
      break;
      
    case 'qc':
      // See approvals assigned to QC
      approvals = db.approvals.find({ assignedTo: userId });
      break;
      
    case 'operator':
      // Operators don't see approvals
      approvals = [];
      break;
  }
  
  res.json(approvals);
});

// ==================== UPLOAD DRAWING ====================

app.post('/api/drawings/upload', upload.single('file'), (req, res) => {
  const userRole = req.user.role;
  
  // Only engineers can upload
  if (userRole !== 'engineer' && userRole !== 'manager') {
    return res.status(403).json({ error: 'Only engineers can upload drawings' });
  }
  
  const newDrawing = {
    id: Math.max(...db.drawings.map(d => d.id), 0) + 1,
    name: req.body.name,
    uploadedBy: req.user.id,
    uploadedByName: req.user.name,
    status: 'Pending',
    date: new Date().toISOString().split('T')[0],
    filePath: req.file.filename
  };
  
  db.drawings.push(newDrawing);
  res.status(201).json(newDrawing);
});

// ==================== APPROVE/REJECT ====================

app.put('/api/approvals/:id', (req, res) => {
  const userRole = req.user.role;
  const approvalId = req.params.id;
  
  // Only manager and QC can approve/reject
  if (!['manager', 'qc'].includes(userRole)) {
    return res.status(403).json({ error: 'Only managers/QC can approve' });
  }
  
  const approval = db.approvals.find(a => a.id === parseInt(approvalId));
  if (!approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }
  
  // Update approval
  approval.status = req.body.status;  // 'Approved' or 'Rejected'
  approval.approvedBy = req.user.id;
  approval.comment = req.body.comment;
  approval.date = new Date().toISOString().split('T')[0];
  
  res.json(approval);
});

// ==================== INSTRUCTIONS ====================

app.get('/api/instructions', (req, res) => {
  const userRole = req.user.role;
  
  // All roles can see instructions except engineers (maybe)
  if (userRole === 'engineer') {
    return res.json([]);  // Engineers don't need instructions
  }
  
  res.json(db.instructions);
});
```

---

## Database Schema (with Role Filtering)

```javascript
// Drawings Table
{
  id: 1,
  name: "Main Assembly",
  format: "PDF",
  status: "Pending",         // Engineer uploads → Pending
  uploadedBy: 5,             // User ID
  uploadedByName: "John",    // User name
  date: "2026-06-01",
  filePath: "filename.pdf"
}

// Approvals Table
{
  id: 1,
  drawingId: 1,
  title: "Main Assembly Approval",
  status: "Pending",         // Manager can change
  requestedBy: 5,            // Engineer ID
  approvedBy: null,          // Manager/QC ID (null until approved)
  comment: "Needs revision",
  date: "2026-06-01"
}

// Instructions Table
{
  id: 1,
  title: "Assembly Guide",
  projectId: 1,
  steps: 12,
  time: "45 mins",
  difficulty: "Medium",
  createdFor: "Operator",    // Role-specific
  createdDate: "2026-05-25"
}
```

---

## Frontend Integration

```javascript
// In React component
const [userRole, setUserRole] = useState(null);
const [drawings, setDrawings] = useState([]);

useEffect(() => {
  const user = JSON.parse(localStorage.getItem('userDetails'));
  setUserRole(user.role);
  fetchData(user.role);
}, []);

const fetchData = async (role) => {
  try {
    const response = await fetch('http://localhost:5000/api/drawings', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Role': role
      }
    });
    const data = await response.json();
    setDrawings(data);
    // Backend filtered based on role!
  } catch (error) {
    console.error('Error:', error);
  }
};

// UI shows different buttons based on role
{userRole === 'manager' && (
  <Button onClick={handleApprove}>Approve</Button>
)}

{userRole === 'engineer' && (
  <Button onClick={handleUpload}>Upload Drawing</Button>
)}
```

---

## Testing the Role-Based System

### Test 1: Engineer Login
```bash
curl -H "Authorization: Bearer engineer-token" \
     http://localhost:5000/api/drawings
# Returns only drawings uploaded by this engineer
```

### Test 2: Manager Login
```bash
curl -H "Authorization: Bearer manager-token" \
     http://localhost:5000/api/drawings
# Returns only PENDING drawings
```

### Test 3: Operator Login
```bash
curl -H "Authorization: Bearer operator-token" \
     http://localhost:5000/api/drawings
# Returns only APPROVED drawings
```

---

## Summary

| Role | Can Upload | Can Approve | Can View Instructions | Can Inspect |
|------|------------|-------------|----------------------|-------------|
| Engineer | ✅ | ❌ | ❌ | ❌ |
| Manager | ❌ | ✅ | ❌ | ❌ |
| Operator | ❌ | ❌ | ✅ | ❌ |
| QC | ❌ | ✅ | ❌ | ✅ |

---

**Key Principle**: Frontend shows everything, Backend controls access!
