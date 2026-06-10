# Sample Drawing Files for Testing

These are sample drawing files you can use to test the PPW file upload feature.

## 📁 Available Sample Files

### 1. MAIN_ASSEMBLY.pdf
- **Format**: PDF
- **Size**: ~2.5 KB
- **Project**: Flange Assembly
- **Status**: APPROVED
- **Use Case**: Main assembly drawing

### 2. PART_DETAIL_A.dwg
- **Format**: DWG (AutoCAD)
- **Size**: ~1 KB
- **Project**: Flange Assembly
- **Status**: PENDING
- **Use Case**: Detailed part specification
- **Material**: Stainless Steel 316

### 3. ASSEMBLY_3D.step
- **Format**: STEP (3D Model)
- **Size**: ~1.5 KB
- **Project**: Flange Assembly
- **Status**: APPROVED
- **Use Case**: 3D model for visualization

### 4. SPECIFICATION_SHEET.iges
- **Format**: IGES (Graphics Exchange)
- **Size**: ~2 KB
- **Project**: Flange Assembly
- **Status**: APPROVED
- **Use Case**: Technical specifications

### 5. DESIGN_BLUEPRINT.dxf
- **Format**: DXF (Drawing Exchange)
- **Size**: ~1.5 KB
- **Project**: Flange Assembly
- **Status**: APPROVED
- **Use Case**: Design blueprint

## 🚀 How to Upload

1. **Start Backend Server** (if not running):
   ```bash
   npm start
   ```

2. **Go to PPW Dashboard**:
   ```
   http://localhost:3000/ppw
   ```

3. **Click DRAWINGS Tab**

4. **Click "+ Upload Drawing" Button**

5. **Choose a sample file**:
   - Navigate to: `zumen_backend/sample-drawings/`
   - Select any file (e.g., `MAIN_ASSEMBLY.pdf`)
   - Or drag-and-drop into the upload area

6. **Fill in the form**:
   - Drawing Name: (auto-filled or customize)
   - Project ID: 1 (for Flange Assembly project)

7. **Click Upload**

## ✅ Expected Results

After uploading, you should see:
- ✅ Success message: "Drawing uploaded successfully!"
- ✅ File appears in the drawings table
- ✅ Status shows as "Pending"
- ✅ File is stored in `zumen_backend/uploads/`

## 📊 Test Workflow

### Test 1: Upload All Formats
1. Upload each file one by one
2. Verify all appear in the table
3. Check that different formats display correctly

### Test 2: Update Status
1. Upload a drawing
2. Go to backend and change status to "Approved"
3. Verify it shows in the UI

### Test 3: Error Handling
1. Try uploading wrong format (e.g., .txt file)
2. Verify error message appears
3. Try again with correct format

## 🔍 Files Location

```
zumen_backend/
├── sample-drawings/          ← You are here
│   ├── MAIN_ASSEMBLY.pdf
│   ├── PART_DETAIL_A.dwg
│   ├── ASSEMBLY_3D.step
│   ├── SPECIFICATION_SHEET.iges
│   ├── DESIGN_BLUEPRINT.dxf
│   └── README.md
├── uploads/                  ← Uploaded files go here
└── server.js
```

## 📝 File Details

| File | Format | Status | Use Case |
|------|--------|--------|----------|
| MAIN_ASSEMBLY.pdf | PDF | Approved | Main drawing |
| PART_DETAIL_A.dwg | DWG | Pending | Detail view |
| ASSEMBLY_3D.step | STEP | Approved | 3D model |
| SPECIFICATION_SHEET.iges | IGES | Approved | Specs |
| DESIGN_BLUEPRINT.dxf | DXF | Approved | Blueprint |

## 🎯 Next Steps After Upload

1. **View uploaded files** in the DRAWINGS tab
2. **Approve/Reject** drawings (future feature)
3. **Download files** from the uploads folder
4. **Link to projects** via Project ID
5. **Add comments** and notes

## 💡 Tips

- All sample files are text-based (for easy creation)
- They contain realistic drawing metadata
- Project ID 1 = Flange Assembly project
- Files can be re-uploaded multiple times
- Each upload gets a unique filename

## 🐛 Troubleshooting

**File won't upload?**
- Check format is in: PDF, DWG, STEP, IGES, DXF
- Check file size < 50 MB
- Verify backend is running

**File uploaded but not in table?**
- Refresh browser: F5
- Check browser console: F12
- Check backend logs

**Wrong file appearing?**
- Files are uploaded to `uploads/` folder
- Check backend has permission to write files
- Verify disk space available

---

**Ready to test?** Pick a file and upload! 🎉
