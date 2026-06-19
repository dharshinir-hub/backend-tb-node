# V3 Changes — Paperless Factory (ZUMEN)

## Completed

### Drawing Detail — cover image pin
- Added a star icon (★) per image file in the left file strip.
- Clicking the star saves that file as the fixed cover thumbnail for the Drawings library card (`thumbnailResourceId` + `thumbnailPinned: true`).
- Auto-thumbnail logic is disabled once a file is explicitly pinned.
- Filled orange star = currently pinned; outline star = not pinned.

### Drawing Detail — image fill (smart fit, revised)
- Preview image fills the box edge-to-edge (no padding, `width/height: 100%`).
- **Fit is now docType-aware** so documents are never cropped:
  - Document tabs (Quotation, Purchase order, Inspection report, Tools, Program, Packing Std., Defect report, Customer List, Work instruction details) → `contain` (whole sheet visible, never crops the header off).
  - Visual tabs (Drawing, 2D CAD, Product sample) → `cover` only when the image is roughly square (a centred product photo like the flange), else `contain`.
- Added a **Fit / Fill toggle** button (top-right of the image) so the user can override per image.
- Scroll-to-zoom minimum lowered from 1× to 0.25× so you can zoom out.
- **Regression fixed:** the earlier blanket `objectFit: cover` cropped the top off document images (Quotation showed only the bottom totals; Tool list hid the first rows). Now resolved.

### MarkupEditor — stamp list matches Stamp Settings
- Stamp gallery now reads `zumenStamps` from ThingsBoard settings at open time.
- Only **enabled** stamps are shown in "Select Stamp"; names and colours come from the Settings page.
- Falls back to built-in STAMPS list if settings not yet saved.

### MarkupEditor (Write/edit view) — document fits the page (ROOT CAUSE FIXED: SVG rasterised)
This took several iterations; below is the **final** behaviour.
- **Root cause:** the documents are **SVG files**, and Fabric.js reports an **unreliable width/height for SVG** — so the editor canvas never matched how the SVG actually rendered, and the right side was always clipped. (A plain `<img>`, i.e. the front preview, handles SVG fine, which is why only the editor cropped.)
- **Fix:** `rasterizeImage()` loads the source into a plain `<Image>` (browser renders the SVG correctly), draws it to an offscreen canvas at **exact pixel dimensions** (~1600 px long edge, white background), and hands Fabric that **PNG raster**. Fabric's dimensions are now correct, so the canvas matches the image exactly → **whole document fits, no crop**.
- The raster is scaled to fit (`scaleX/scaleY = fitScale`), the canvas is sized to match, and zoom = 1; `fc.backgroundVpt = true` so the +/- zoom scales it too.
- Opens **fit-to-page** at 100% (the entire sheet visible, centred); fit uses deterministic window dimensions minus the fixed chrome.
- **Fit page** button (next to the zoom +/-) snaps back to the full-page view anytime.
- **Wheel:** plain scroll **navigates** the document; **Ctrl/⌘ + scroll zooms** (0.1×–4×). The toolbar +/- and % dropdown also zoom; the dropdown always includes the current % so it never shows blank.
- **Save** exports at full raster resolution via a `multiplier`, so the annotated file isn't downscaled.
- Canvas backdrop light gray; container has `minWidth/minHeight: 0` and the page is centred with `margin:auto` so it scrolls cleanly to every edge when zoomed in.
- *(Iteration trail: 1st opened tiny — scroll-zoom hijack; 2nd filled width & overflowed; 3rd a leftover 50% zoom shrank it; 4th container-measurement opened it too big/cropped; 5th forced-100% + window fit still cropped; root cause = SVG sizing, fixed by rasterising.)*

### Drawing Detail — removed "Project for this file" button
- Removed the **Project for this file** link button from the file toolbar (it was a "coming soon" placeholder); removed the now-unused `LinkIcon` import.

### MarkupEditor — QR encodes the component details (and actually scans)
- The QR tool used to encode only the file name. It now encodes the **component details** so scanning it (any phone QR app) shows them: drawing number, product, client, status, revision, inventory, project, assembly, delivery date.
- `DrawingDetail` builds this from `drawing`/`meta` (`qrInfo`, memoised) and passes it to `MarkupEditor` as `qrData`.
- **Scannability fix (iterated):** the first version crammed in a doc list + full URL (368 chars → **77×77**, v15) — far too dense to read from a screen. Trimmed in two steps to the essential fields (96 chars → **37×37**, v5), error-correction **L**, wide quiet zone (`margin: 4`), and a larger placement (**280 px**) so it stays big enough to scan even when the drawing is viewed zoomed-out.
- **Note:** the QR is still text-in-image, so it must be scanned at adequate size (zoom in on screen, or scan a print at close range) and an existing saved QR must be **re-generated** to pick up the new compact payload. A no-login `/p/<id>` info page (QR = short URL) is the more robust option if needed.
- Verified payloads/versions with the `qrcode` lib (77×77 → 49×49 → 37×37).

### Sequence Report — All Machines fix
- `machinesParam[0]` → `machinesParam.join(',')` in `report.js` so all selected machines are sent.
- Removed `encodeURIComponent` from `sequence-report` URL path in `reportservice.js` to match other report types.

### Settings screens wired to their pages
Every Settings screen now actually affects its page (previously most were stored-only):

- **Drawing info settings** + **Drawing detail info** → the drawing's right‑side **info panel** ([DrawingDetail.js](react2024/src/app/Pages/PPW/Drawings/DrawingDetail.js)). A field registry (`PANEL_FIELDS`) renders only the **Visible** fields, uses the **renamed** labels, and **enforces Required** fields on *Save changes*. Removed the four obsolete detail fields (Quality Check No., Inspection sheet, EC No., Excel sheet) from the settings so they don't reappear.
- **New drawing registration** → the **Add new drawing** dialog ([DrawingsLibrary.js](react2024/src/app/Pages/PPW/Drawings/DrawingsLibrary.js)). Auto‑numbers the drawing number with **prefix + zero‑padded sequence**, applies the **default status / revision**, and enforces **Require product / client / material**.
- **Project info (stages)** → the **Projects / Orders** pipeline ([ProjectsOrders.js](react2024/src/app/Pages/PPW/Orders/ProjectsOrders.js)). The stage **tabs** and the new‑order **Status** dropdown come from `zumenProjectStages`; custom stages get a stable palette colour.
- **Assembly drawing settings** → the **assembly tree** ([AssemblyTree.js](react2024/src/app/Pages/PPW/Drawings/AssemblyTree.js)): **Max tree depth** limits the tree, **Auto‑number** shows BOM numbers (1, 1.1, 1.2…), **Show quantity** toggles the stock line, **Show thumbnails** toggles the node image. (Relation type left on `Contains` — changing it would orphan existing links; that's a service‑level migration.)
- **Form template settings** → the **Create file** menu on a drawing tab now lists the **enabled templates** whose document type matches the tab (creates a pre‑named sheet).
- **Stamp settings** → already wired (editor stamp gallery shows enabled stamps).
- **Notification settings** → already wired (sends in‑app notifications to the chosen roles).
- **IP address settings** → kept as a saved **policy**; the page note now states blocking must be enforced server‑side (a browser can't reliably restrict by IP, and doing it client‑side would be fake security + a lock‑out risk).

All six edited files parse clean (`@babel/parser`).

### Remaining Settings tiles wired (Accounts group)
- **Document type** → the drawing **document tabs** ([DrawingDetail.js](react2024/src/app/Pages/PPW/Drawings/DrawingDetail.js)) now honour `zumenDocTypes`: a hidden type's tab disappears and a renamed type shows its new label. Falls back to all tabs if everything is hidden. (Settings note updated from "follow-up" to "applied live".)
- **User management** → per-user **page access** is now enforced. New `isPfPageAllowed(pageKey)` helper ([zumensettings.js](react2024/src/app/Services/app/zumensettings.js)) + a reusable `PfAccessGuard` ([PfAccessGuard.js](react2024/src/app/Pages/PPW/PfAccessGuard.js)) gate the **Drawings** and **Projects/Orders** pages. **Safe by default:** Admin/Super Admin are always allowed, and no-policy / no-entry / errors all resolve to *allowed* — only an explicit unchecked box denies a specific non-admin user (who then sees a "restricted" screen).
- **Operation logs** → already functional (reads the live ThingsBoard **audit trail** via `getAuditLogs`); no wiring needed.

---

## Upcoming / Requested (not yet built)

- Stamp "Checked" circle shape preserved from Settings page shape override
- Draw date auto-fill from login user's name (replaces hardcoded "Sanjeev")
- Settings pages: wire Drawing info fields, Document types, Project stages to actual UI
- Notification bell badge count from ThingsBoard unread count
- Projects/Orders: status-based row colour coding
