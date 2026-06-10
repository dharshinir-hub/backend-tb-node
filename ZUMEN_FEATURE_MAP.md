# ZUMEN — Feature Map (reverse-engineered from the demo video)

Source: `reference video/Meet - ... ZUMEN service, Fact Base Inc. Tokyo Japan, Mr. Sanjeev ...mp4`
(14:10, live demo of **demo.zume-n.com** in the first half, marketing slides in the second half.)

Method: audio transcribed (faster-whisper) + key UI frames extracted (ffmpeg) and read. Working files in `analysis/`.

---

## What ZUMEN actually is

A **drawing-centric (図面 = "zumen" = drawing) manufacturing data-management SaaS**. Every part/drawing is one record that aggregates *all* documents across its lifecycle — CAD, quotations, POs, inspection reports, programs, defect reports, packing standards, etc. It replaces the traditional folder-of-files chaos.

Marketing value prop (slides): solves **key-person risk**, slow **retrieval** of past data for repeat orders, and the **stress** of data buried in nested folders. Sold as SaaS direct sales with phone support, tutorials, on-site training, multi-language/overseas support.

---

## Core modules observed

### 1. Drawings library (`/drawings`)
- Grid ("Preview") + List toggle. Header shows count: "301 item(s)".
- Each card: CAD thumbnail, **Drawing number** (e.g. FB002-M002), **Product name** (Cover Plate), **Client** (Fact Base Inc.).
- Left **faceted search**: Drawing number, Product name, Client name, Quality Check No., Inspection report spread sheet, EC No., Excel Spread sheet, Inventory, Project. Plus global "Free word search".
- **+ Add new drawings** (drag-drop / file picker, multi-file), **Bulk Operations**.

### 2. Drawing detail = document hub (`/drawings/:id?documentTypeMasterId=...`)
One part record with many **document-type tabs**, each with a live count:
`Drawing · Assembly drawing · Work Instruction video · Work instruction details · 2D CAD · 3D CAD · Customer List · Quotation · Purchase order · Video · Inspection report · Tools · Product sample · Defect report · Program · Packing Std.`
Each tab holds the uploaded files of that type for the part.

### 3. Assembly / BOM hierarchy
- Visual **parent→child tree** of parts (Cover Plate → Socket-Z → Roller guide → Hopper flange → Frame → Spacer → …), each node = a drawing card (thumbnail + part no + "Zoom in").
- **Edit hierarchy** mode. Transcript: BOM shows "how many components/parts used for the assembly" and ties into **material stock**.

### 4. Drawing viewer + markup/annotation editor
Open a CAD/PDF and redline it. Toolbar: **Line, Arrow, Square, Circle, Pen, Marker, Text, Insert Image, Stamp, QR, Signature**, Back/Forward (undo/redo), Save.
- **Stamps** = predefined approval seals with auto-date: *NEW MODEL, No Access, OLD DRAWING DO NOT USE, Quotation Verified – Start production, Cancelled, verified by GM,* plus **company round seal** (Delhi/India + date) and **personal "Checked by" seal** (name + date).
- Supports **revision/version control** of drawings and **part programs** (transcript: "if you have five versions of the program, it is possible").

### 5. Projects / Orders lifecycle (`/orders`)
Order-to-delivery tracking tied to drawings. Table columns: Status, Client name, Drawing number, Delivery date, Quotation Number, Quotation Volume, Unit, Quot. unit price.
**Status pipeline (filter tabs):** All → Prototype → Pre Quotation → Post Quotation → Under check by commercial → PO received → Payment received → In Production → Inspection → In stock → Delivered → Lost.
Actions: **+ New project**, **Report list**, per-row **Detail**, filters (Client, Drawing no, Quotation no).

### 6. Platform-wide
- Top nav: **ZUMEN · Drawings · Projects · Settings · Help** + global search.
- **Multi-client / multi-company**, **multi-language** (Japanese + English UI seen), roles (GM approval stamps, commercial check stage), inventory/stock.

---

## Gap vs. the prototype already in this repo (`react2024` PPW + `zumen_backend`)

| Area | Real ZUMEN | This repo's prototype |
|---|---|---|
| Org model | Part/drawing record aggregates ~16 document types | 6 flat tabs (Dashboard/Drawings/Instructions/Reports/Specs/Approvals) |
| Drawings | Gallery + thumbnails + faceted search, 301 items | Flat table, mock rows |
| Doc types | 16 typed tabs per drawing w/ counts | none |
| BOM/assembly | Visual editable hierarchy tree | none |
| Markup editor | Full annotate + stamps + QR + signature + versions | none |
| Orders | 11-stage lifecycle pipeline | mock "projects" table |
| AI | (not in product) | rule-based doc generator (extra, not in real ZUMEN) |
| Persistence | real DB | in-memory mock, resets on restart |
| i18n / roles | JP+EN, role-based stamps/stages | none |

The existing PPW prototype is a **different, smaller app** (an AI document generator). To "build the exact ZUMEN features" we keep the upload/Express scaffolding but build the drawing-centric model around it.
</content>
</invoke>
