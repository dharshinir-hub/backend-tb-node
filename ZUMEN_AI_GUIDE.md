# 🤖 Zumen AI Auto-Generation System - Complete Guide

## Overview

The Zumen AI system automatically generates **Work Instructions**, **Specifications**, and **Inspection Templates** when a drawing is approved. This eliminates manual document creation and ensures consistency across your manufacturing workflow.

---

## **How It Works**

### Workflow Flow

```
1. Engineer uploads drawing (DRAWINGS tab)
   ↓
2. Manager approves drawing (APPROVALS tab)
   ↓
3. Manager provides drawing details:
   - Material (Stainless Steel, Aluminum, etc.)
   - Complexity (Simple, Medium, Complex)
   - Key dimensions (optional)
   - Notes/comments
   ↓
4. 🤖 Zumen AI processes the information
   ↓
5. AI automatically generates 3 documents:
   ✅ Work Instructions (with steps)
   ✅ Specifications (with tolerances)
   ✅ Inspection Template (for QC)
   ↓
6. Documents appear in their respective tabs:
   - INSTRUCTIONS tab → Work instructions (draft, can be edited)
   - SPECIFICATIONS tab → Product specs (active)
   - REPORTS tab → QC template (ready to use)
   ↓
7. Manufacturing can proceed using AI-generated documents
```

---

## **Step-by-Step Usage**

### **Step 1: Upload Drawing**

1. Go to **DRAWINGS** tab
2. Click **"+ Upload Drawing"**
3. Select file (PDF, DWG, STEP, IGES, DXF)
4. Fill in:
   - Drawing Name: "Flange Assembly"
   - Project ID: 1
5. Upload

Status: "Pending Review"

---

### **Step 2: Approve with AI**

1. Go to **APPROVALS** tab
2. Find the drawing you uploaded
3. Click **"Approve"** button
4. A dialog appears: **"AI-Powered Approval"**

---

### **Step 3: Provide Drawing Details**

Fill in the AI approval form:

#### **Material** (Required) ⭐
- Stainless Steel (304/316)
- SUS304 (Japanese Standard)
- Aluminum (6061-T6)
- Carbon Steel
- Brass
- Copper
- Custom material

**Why?** AI uses material properties to:
- Select appropriate manufacturing processes
- Recommend tolerances
- Set surface finish standards
- Suggest tools and cooling methods

#### **Complexity Level** (Optional)
- **Simple**: Basic shape, few features (4 steps, 15 min)
- **Medium**: Standard features (9 steps, 45 min)
- **Complex**: Multiple features (14 steps, 120 min)

**Why?** Complexity determines:
- Number of manufacturing steps
- Estimated time
- Tools required
- Quality check intensity

#### **Key Dimensions** (Optional)
Example: `50±0.1mm, 10±0.05mm, Φ6.5±0.05mm`

**Why?** Helps AI:
- Create accurate inspection items
- Set tolerance standards
- Generate dimensional checks

#### **Approval Notes** (Optional)
Add any special instructions or comments

---

### **Step 4: Generate Documents**

1. Click **"🤖 Approve & Generate"** button
2. AI processes (takes 1-2 seconds)
3. Shows success: "✅ Documents Generated Successfully!"
4. Displays generated count:
   - Work Instructions: 9 steps
   - Specifications: 8 items
   - Inspection Items: 6 checks

---

### **Step 5: View Generated Documents**

#### **Work Instructions**
- Go to **INSTRUCTIONS** tab
- Find "Flange Assembly - Manufacturing Instructions"
- Status: "Draft" (you can edit)
- Shows: 9 detailed steps, materials, tools, safety precautions
- Example:
  ```
  1. Prepare material according to specifications
  2. Cut blank to size
  3. Machine outer diameter to 50±0.1mm
  4. Machine thickness to 10±0.05mm
  5. Drill 4 mounting holes (6.5±0.05mm)
  6. Deburr edges
  7. Surface finish (Ra 0.8μm)
  8. Quality check
  9. Package
  ```

#### **Specifications**
- Go to **SPECIFICATIONS** tab
- Find "Flange Assembly"
- Status: "Active"
- Shows: Material properties, tolerances, dimensions, hardness, density
- Example:
  ```
  Outer Diameter: Φ50 ±0.1 mm
  Thickness: 10 ±0.05 mm
  Mounting Holes: 4 × Φ6.5 ±0.05 mm
  Surface Finish: Ra 0.8 μm
  Material Grade: JIS SUS304
  Hardness: Max 217 HV
  Tensile Strength: Min 520 MPa
  ```

#### **Inspection Template**
- Go to **REPORTS** tab
- Find "Flange Assembly - InspectionTemplate"
- Status: "Template Ready"
- QC inspector uses this template when inspecting the part
- Items include:
  ```
  1. Outer Diameter (Expected: 50±0.1mm, Method: Caliper)
  2. Thickness (Expected: 10±0.05mm, Method: Micrometer)
  3. Holes Diameter (Expected: 6.5±0.05mm, Method: Plug Gauge)
  4. Surface Finish (Expected: Ra 0.8μm, Method: Roughness Meter)
  5. Visual Inspection (Expected: No defects, Method: Visual)
  6. Completeness Check (Expected: All features, Method: Visual & dimensional)
  ```

---

## **AI System Architecture**

### Backend Components

#### **1. AI Service Module** (`aiService.js`)
```javascript
ZumenAIService.generateAllDocuments(drawingData)
```

**Input:**
```javascript
{
  drawingName: "Flange Assembly",
  partNumber: "FL-2024-001",
  material: "SUS304",
  projectId: 1,
  complexity: "Medium",
  dimensions: { }
}
```

**Output:**
```javascript
{
  success: true,
  instructions: { /* instruction object */ },
  specifications: { /* specification object */ },
  reportTemplate: { /* report template object */ },
  summary: {
    instructionSteps: 9,
    specificationCount: 8,
    inspectionItems: 6
  }
}
```

#### **2. Backend Endpoints**

**Approve Drawing with AI:**
```
PUT /api/approvals/:id
```
Automatically triggers AI when status = "Approved"

**Manual Document Generation:**
```
POST /api/ai/generate-documents
Body: { drawingName, material, complexity, dimensions, projectId }
```

**AI Service Status:**
```
GET /api/ai/status
```
Returns AI capabilities and supported materials

---

## **Supported Materials & Specifications**

| Material | Grade | Density | Tensile Strength | Hardness | Temp Range |
|----------|-------|---------|------------------|----------|-----------|
| Stainless Steel | 304/316 | 8.0 g/cm³ | Min 515 MPa | Max 217 HV | -50°C to 400°C |
| SUS304 | JIS | 7.93 g/cm³ | Min 520 MPa | Max 217 HV | -50°C to 425°C |
| Aluminum | 6061-T6 | 2.7 g/cm³ | Min 310 MPa | Max 95 HB | -50°C to 120°C |
| Carbon Steel | - | 7.85 g/cm³ | Min 400 MPa | Varies | -50°C to 400°C |

---

## **Complexity Levels & Outputs**

### **Simple**
- **Steps**: 4
- **Time**: 15 minutes
- **Difficulty**: Easy
- **Best for**: Basic shapes, minimal features
- **Example**: Simple plate, basic mounting block

### **Medium**
- **Steps**: 9
- **Time**: 45 minutes
- **Difficulty**: Medium
- **Best for**: Standard parts, 5-10 features
- **Example**: Flange, gear, housing component

### **Complex**
- **Steps**: 14
- **Time**: 120 minutes
- **Difficulty**: Hard
- **Best for**: Multi-feature parts, precision required
- **Example**: Motor assembly, precision bearings, complex assemblies

---

## **AI Generation Process**

### What AI Analyzes

1. **Part Geometry**
   - Shape complexity
   - Number of features
   - Tolerance requirements

2. **Material Properties**
   - Density
   - Tensile strength
   - Hardness rating
   - Temperature range
   - Corrosion resistance

3. **Manufacturing Requirements**
   - Cutting methods
   - Machining operations
   - Surface finishing
   - Heat treatment needs
   - Quality standards

4. **Safety Considerations**
   - Material handling precautions
   - Tool safety
   - Chemical hazards
   - Environmental controls

### What AI Generates

#### **Work Instructions**
- Step-by-step manufacturing procedure
- Required components and tools
- Safety precautions
- Quality checkpoints
- Estimated completion time

#### **Specifications**
- Extracted dimensions from drawing
- Material grade and properties
- Tolerances and fits
- Surface finish standards
- Hardness and strength requirements
- Weight and density

#### **Inspection Template**
- QC inspection items
- Expected values from specifications
- Inspection methods (caliper, micrometer, etc.)
- Pass/fail criteria
- Critical vs. non-critical items
- Allowable defects

---

## **Customization & Refinement**

After AI generates documents, you can:

### **Edit Instructions**
- Modify steps
- Add special processes
- Update tools
- Change time estimates
- Status stays "Draft" until finalized

### **Edit Specifications**
- Add more details
- Adjust tolerances
- Include additional properties
- Change material grade

### **Edit Inspection Template**
- Add more inspection items
- Modify acceptance criteria
- Define critical items
- Set inspection frequencies

---

## **Error Handling**

### **If AI Generation Fails**

Error message: `"AI generation failed"`

**Solutions:**
1. Check material selection (must be valid)
2. Verify drawing name is provided
3. Check backend server is running
4. Try again

### **If Documents Don't Appear**

1. Refresh the page (F5)
2. Go to respective tab (INSTRUCTIONS, SPECIFICATIONS, REPORTS)
3. Scroll down to find newly created documents
4. Check approval dialog for any error messages

---

## **Backend Server Startup**

```bash
cd zumen_backend
npm install
npm start
```

Expected output:
```
✅ PPW Backend Server running on http://localhost:5000
🤖 Zumen AI Integration: ACTIVE
📚 API Documentation:
   GET    /api/health
   GET    /api/ai/status
   POST   /api/ai/generate-documents
   ...
```

---

## **Frontend Usage**

**Import AI Dialog:**
```javascript
import AIApprovalDialog from './AIApprovalDialog/AIApprovalDialog';
```

**Use in component:**
```javascript
<AIApprovalDialog
  open={!!selectedApproval}
  onClose={() => setSelectedApproval(null)}
  approval={selectedApproval}
  onApprove={handleApprove}
/>
```

---

## **Advanced Features (Coming Soon)**

- 🔄 **Dimension Extraction**: Automatically extract dimensions from CAD files
- 🧠 **Process Optimization**: AI suggests optimal manufacturing sequence
- 📊 **Analytics**: Track AI-generated document quality and usage
- 🔧 **Custom Templates**: Create material-specific templates
- 🌐 **Multi-language Support**: Generate documents in multiple languages
- 📱 **Mobile QC**: AI-generated templates on mobile devices

---

## **Troubleshooting**

| Issue | Solution |
|-------|----------|
| AI not responding | Check backend server is running on localhost:5000 |
| Documents not appearing | Refresh page, check approval status |
| Wrong material selected | Re-approve with correct material |
| Need to edit generated content | Go to respective tab and click edit |
| Missing specifications | Manually add in Specifications tab |

---

## **Support**

For issues or feature requests:
1. Check this guide
2. Review server logs
3. Verify all inputs are correct
4. Restart backend server if needed

---

**Version:** 1.0  
**Last Updated:** 2026-06-09  
**Status:** ✅ Active & Operational

🎉 **Enjoy automated document generation with Zumen AI!**
