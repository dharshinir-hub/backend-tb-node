# Drawing File Upload Guide

Complete setup for uploading technical drawings to PPW.

## 🎯 Where to Upload Drawings?

Users can upload drawings in the **PPW Dashboard → DRAWINGS Tab → "Upload Drawing" button**

## 📋 What Happens When You Upload?

1. User clicks **"Upload Drawing" button**
2. Dialog opens with file upload form
3. User drags-and-drops file OR clicks to browse
4. File is uploaded to backend
5. File is saved in `/zumen_backend/uploads/` folder
6. Drawing entry is created in database
7. Drawing appears in the table

## 🚀 Setup Instructions

### Step 1: Install Backend Dependencies

```bash
cd zumen_backend
npm install
```

This installs `multer` which handles file uploads.

### Step 2: Start Backend Server

```bash
npm start
```

Backend will:
- Create `/uploads` folder automatically
- Listen on `http://localhost:5000`
- Accept file uploads at `/api/drawings/upload`

### Step 3: Verify Frontend Components

Frontend files should be created:
- ✅ `react2024/src/app/Pages/PPW/DrawingUpload/DrawingUpload.js`
- ✅ `react2024/src/app/Pages/PPW/ppw.js` (updated with upload button)

### Step 4: Start React App

```bash
cd react2024
npm start
```

Go to: `http://localhost:3000/ppw`

## 📂 Folder Structure

```
Zumen_PPW/
├── zumen_backend/
│   ├── server.js           (Has file upload endpoint)
│   ├── uploads/            (Created automatically - stores files)
│   └── package.json        (multer added)
│
└── react2024/
    └── src/app/Pages/PPW/
        ├── ppw.js          (Updated with upload button)
        └── DrawingUpload/
            └── DrawingUpload.js  (Upload component)
```

## ✅ How to Use

### Upload a Drawing

1. Go to `localhost:3000/ppw`
2. Click **DRAWINGS** tab
3. Click **"+ Upload Drawing"** button
4. Fill in:
   - **Drawing Name** (e.g., "Main Assembly")
   - **Project ID** (e.g., 1)
5. Drag-and-drop file OR click to browse
6. File is uploaded ✅

### Supported Formats

- ✅ PDF (`.pdf`)
- ✅ AutoCAD (`.dwg`)
- ✅ STEP (`.step`)
- ✅ IGES (`.iges`)
- ✅ DXF (`.dxf`)

### Limitations

- Max file size: **50MB**
- Only technical drawing formats allowed
- All files stored in `/uploads` folder

## 🔧 Backend API

### Upload Endpoint

```
POST /api/drawings/upload
```

**Request:**
```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('name', 'Main Assembly');
formData.append('projectId', 1);

fetch('http://localhost:5000/api/drawings/upload', {
  method: 'POST',
  body: formData
});
```

**Response:**
```json
{
  "id": 5,
  "name": "Main Assembly",
  "format": "PDF",
  "status": "Pending",
  "date": "2026-06-01",
  "projectId": 1,
  "size": "2.5 MB",
  "filePath": "1654099200000-main-assembly.pdf",
  "uploadedBy": "Current User",
  "fileUrl": "/uploads/1654099200000-main-assembly.pdf"
}
```

## 📥 Access Uploaded Files

Files are stored in: `zumen_backend/uploads/`

To download a file:
```
http://localhost:5000/uploads/{filename}
```

Example:
```
http://localhost:5000/uploads/1654099200000-main-assembly.pdf
```

## 🐛 Troubleshooting

### Upload Button Not Visible
- Make sure you updated `ppw.js` with the new code
- Check browser console for errors (F12)

### "Unsupported file format" Error
- Only `.pdf`, `.dwg`, `.step`, `.iges`, `.dxf` are allowed
- Check file extension is correct

### "File too large" Error
- Max file size is 50MB
- Reduce file size and try again

### Upload Hangs/Freezes
- Check backend is running: `http://localhost:5000/api/health`
- Check port 5000 is not blocked
- Check network tab in DevTools (F12)

### CORS Error
- Backend has CORS enabled
- Verify backend URL is `http://localhost:5000`
- Restart backend server

## 🔄 File Storage Flow

```
User Upload → React Component → Backend API → Multer Handler → Disk Storage
                                              ↓
                                        Database Entry
                                              ↓
                                        Appears in Table
```

## 📊 File Upload Statistics

- Uploaded files: `zumen_backend/uploads/{filename}`
- Database entries: In-memory or database
- Max concurrent uploads: System dependent
- Storage location: Local disk

## 🚀 Production Ready?

### For Development ✅
- Current setup works great for testing
- Files stored locally
- In-memory database

### For Production 🔧
Need to add:
- [ ] MongoDB/PostgreSQL for persistent data
- [ ] Cloud storage (AWS S3, Azure, GCP)
- [ ] File scanning for viruses
- [ ] Authentication/authorization
- [ ] File versioning
- [ ] Backup strategy
- [ ] Rate limiting

## 📞 Support

If upload doesn't work:

1. **Check backend is running**
   ```bash
   curl http://localhost:5000/api/health
   ```

2. **Check browser console** (F12 → Console tab)

3. **Check network requests** (F12 → Network tab)

4. **Verify file format** (only PDF, DWG, STEP, IGES, DXF)

5. **Check file size** (max 50MB)

---

**Status**: File upload ready for use ✅
