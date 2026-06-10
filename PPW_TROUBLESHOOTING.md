# PPW Dashboard - Troubleshooting Guide

## ❌ "I Can't See PPW Dashboard"

### ✅ Quick Fix Checklist

#### Step 1: Access PPW Directly
Try going to this URL in your browser:
```
http://localhost:3000/ppw
```
Replace `localhost:3000` with your actual app URL.

**If it works**: PPW is installed! You just need to add it to sidebar.

**If it doesn't work**: Continue to Step 2.

---

#### Step 2: Check Browser Console for Errors
1. Open browser developer tools: **F12** or **Right-click → Inspect**
2. Go to **Console** tab
3. Look for red error messages
4. Take a screenshot and share

**Common Errors:**
- `Cannot find module 'DrawingManagement'` → Missing component files
- `ComponentRegistry is not defined` → Registry not imported
- `ppw is not a component` → Registration issue

---

#### Step 3: Verify Files Are Created
Check if all PPW files exist in your project:

```bash
# Copy this command to your terminal:
ls -la "C:\Users\yantra\Downloads\Zumen_PPW\react2024\src\app\Pages\PPW\"
```

You should see:
```
✓ ppw.js
✓ ppw.css
✓ README.md
✓ ProjectDashboard/ProjectDashboard.js
✓ DrawingManagement/DrawingManagement.js
✓ WorkInstructions/WorkInstructions.js
✓ InspectionReports/InspectionReports.js
✓ Specifications/Specifications.js
✓ ApprovalWorkflow/ApprovalWorkflow.js
```

**If files are missing**: Run the creation commands again.

---

#### Step 4: Check ComponentRegistry Registration
Open this file:
```
react2024/src/app/Shared/constants/ComponentRegistry.js
```

Look for these lines:
```javascript
import PPW from '../../Pages/PPW/ppw';

export const COMPONENT_REGISTRY = {
  ...
  "ppw": PPW,  // ← Should be there
  ...
};
```

**If missing**: Add them manually.

---

#### Step 5: Add PPW to Sidebar Menu (Backend)

For PPW to appear in the sidebar, your backend needs to add `"ppw"` to the user's `pageList`.

**Tell your backend team:**
```
Please add "ppw" to the user's pageList in the authentication response:

{
  "pageList": [
    "machines",
    "analytics", 
    "ppw",        // ← ADD THIS
    "bluecard",
    ...
  ]
}
```

---

## 🔍 Detailed Troubleshooting

### Issue: "Cannot find module DrawingManagement"

**Cause**: Import paths are wrong

**Solution**:
1. Check folder structure exists:
   ```
   PPW/
   ├── DrawingManagement/
   │   └── DrawingManagement.js
   ├── WorkInstructions/
   │   └── WorkInstructions.js
   ├── InspectionReports/
   │   └── InspectionReports.js
   ├── Specifications/
   │   └── Specifications.js
   ├── ApprovalWorkflow/
   │   └── ApprovalWorkflow.js
   └── ProjectDashboard/
       └── ProjectDashboard.js
   ```

2. Verify file paths in ppw.js:
   ```javascript
   import DrawingManagement from './DrawingManagement/DrawingManagement';
   import WorkInstructions from './WorkInstructions/WorkInstructions';
   // etc.
   ```

---

### Issue: Page loads but shows blank/error

**Possible Causes:**
1. Component syntax error
2. Missing Material-UI components
3. CSS file not loading

**Solution:**
1. Check browser console (F12) for error messages
2. Verify all imports at top of ppw.js
3. Check ppw.css exists

---

### Issue: "Route not found" error

**Possible Causes:**
1. Route not configured in routes.js
2. ComponentRegistry not using PPW

**Solution:**
The PPW should work through ComponentRegistry. Check:
```javascript
// In routes.js, this should exist:
const Component = COMPONENT_REGISTRY[page];  // This picks up PPW

// And PPW should be in ComponentRegistry:
// In ComponentRegistry.js:
export const COMPONENT_REGISTRY = {
  "ppw": PPW,  // ✓ Should be here
}
```

---

## 🧪 Testing Steps

### Step 1: Browser Console Test
Open your browser console and type:
```javascript
// Check if React is loaded
console.log(typeof React);  // Should output: "object"

// Check if app is running
console.log(document.querySelector('#root'));  // Should find element
```

### Step 2: Direct URL Test
```
http://yourapp.com/ppw
```

**Expected result**: 
- Page loads with "Paperless Workflow & Part Program" header
- 6 tabs visible (Dashboard, Drawing Management, etc.)
- Quick stats cards showing (0 values with mock data)

### Step 3: Search Functionality Test
1. Type something in search box
2. Should filter results
3. Clear search = shows all results

---

## 📋 What to Check If PPW Still Won't Show

| Issue | Check | Solution |
|-------|-------|----------|
| PPW not in sidebar | Backend pageList | Add "ppw" to pageList |
| 404 when accessing `/ppw` | Routes configuration | Check ComponentRegistry |
| Blank page | Console errors (F12) | Fix JavaScript errors |
| Tabs don't work | ppw.css loaded | Check CSS file exists |
| Can't upload files | File input handling | Test file drag/drop |
| Mock data not showing | Mock data in components | Check useEffect loading |

---

## 🛠️ Manual Installation (If Something Broke)

If components are missing, here's what to create:

### File: `react2024/src/app/Pages/PPW/ppw.js`
```javascript
// Full main dashboard - see PPW_SETUP_GUIDE.md
```

### File: `react2024/src/app/Pages/PPW/ppw.css`
```css
/* Full styles - already created */
```

### File: `react2024/src/app/Pages/PPW/ProjectDashboard/ProjectDashboard.js`
```javascript
// Project management component
```

**Similarly for:**
- `DrawingManagement/DrawingManagement.js`
- `WorkInstructions/WorkInstructions.js`
- `InspectionReports/InspectionReports.js`
- `Specifications/Specifications.js`
- `ApprovalWorkflow/ApprovalWorkflow.js`

---

## ✅ Success Indicators

Your PPW is working correctly if:

- [x] Direct URL `/ppw` works
- [x] Page loads without errors
- [x] You see the PPW header
- [x] 6 tabs are visible
- [x] Quick stats cards display
- [x] Clicking tabs switches content
- [x] Search box works
- [x] Buttons are clickable
- [x] Mock data displays correctly

---

## 📞 Getting Help

**If you get an error message:**
1. Note the exact error
2. Check browser console (F12)
3. Share the error with your team

**Common Questions:**

**Q: Why doesn't PPW appear in my sidebar?**
A: Your backend needs to add "ppw" to your user's pageList.

**Q: Can I access PPW without sidebar?**
A: Yes! Go directly to `/ppw` URL.

**Q: Where are the actual API endpoints?**
A: Currently using mock data. See PPW_SETUP_GUIDE.md for API integration.

**Q: Can I modify PPW?**
A: Yes! All code is in `react2024/src/app/Pages/PPW/`

---

## 🎯 Next Steps

### Immediate (Now)
1. Test `/ppw` URL directly
2. Share any errors with team
3. Verify files exist

### Short Term (This Week)
1. Have backend add "ppw" to pageList
2. Verify PPW shows in sidebar
3. Test all 6 modules

### Medium Term (Next Week)
1. Connect backend API endpoints
2. Replace mock data with real data
3. Test full workflow

---

**Last Updated**: June 2026
**PPW Status**: Ready for Testing & Deployment
