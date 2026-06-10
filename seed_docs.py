#!/usr/bin/env python3
"""Seed one sample file into EVERY document-type tab for each Drawing, storing
files in ThingsBoard (resource library) + metadata in the asset 'documents'
attribute. Matches the TB-backed zumendocservice. Overwrites existing docs attr.

  ZUMEN_TB_URL=http://yantra24x7.cloud:8080 python seed_docs.py
"""
import json, os, base64, subprocess, tempfile, time, urllib.request as u, urllib.error
import imageio_ffmpeg

TB = os.environ.get("ZUMEN_TB_URL", "http://yantra24x7.cloud:8080").rstrip("/")
FF = imageio_ffmpeg.get_ffmpeg_exe()
TMP = tempfile.gettempdir()
_uid = [0]


def req(method, path, tok=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = u.Request(TB + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if tok:
        r.add_header("X-Authorization", "Bearer " + tok)
    with u.urlopen(r, timeout=30) as resp:
        t = resp.read().decode()
        return json.loads(t) if t else None


def make_pdf(path, text):
    objs = [b"<</Type/Catalog/Pages 2 0 R>>", b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
            b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 260]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>"]
    stream = ("BT /F1 20 Tf 40 160 Td (%s) Tj ET" % text).encode()
    objs.append(b"<</Length %d>>stream\n%s\nendstream" % (len(stream), stream))
    objs.append(b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>")
    pdf = b"%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(pdf)); pdf += ("%d 0 obj\n" % i).encode() + o + b"\nendobj\n"
    xref = len(pdf)
    pdf += ("xref\n0 %d\n" % (len(objs) + 1)).encode() + b"0000000000 65535 f \n"
    for off in offs:
        pdf += ("%010d 00000 n \n" % off).encode()
    pdf += ("trailer\n<</Size %d/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF" % (len(objs) + 1, xref)).encode()
    open(path, "wb").write(pdf)


def make_png(path, color):
    subprocess.run([FF, "-y", "-f", "lavfi", "-i", "color=c=%s:s=480x320" % color, "-frames:v", "1", path], capture_output=True)


def make_mp4(path):
    subprocess.run([FF, "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=2", "-pix_fmt", "yuv420p", path], capture_output=True)


CUBE = "solid c\n" + "".join(
    "facet normal 0 0 0\n outer loop\n  vertex %d %d %d\n  vertex %d %d %d\n  vertex %d %d %d\n endloop\nendfacet\n" % t
    for t in [(0,0,0,1,1,0,1,0,0),(0,0,0,0,1,0,1,1,0),(0,0,1,1,0,1,1,1,1),(0,0,1,1,1,1,0,1,1),
              (0,0,0,1,0,0,1,0,1),(0,0,0,1,0,1,0,0,1),(0,1,0,0,1,1,1,1,1),(0,1,0,1,1,1,1,1,0),
              (0,0,0,0,0,1,0,1,1),(0,0,0,0,1,1,0,1,0),(1,0,0,1,1,0,1,1,1),(1,0,0,1,1,1,1,0,1)]) + "endsolid c\n"

SPECS = [
    ("drawing", "drawing.png", "png:#5b7da6"),
    ("assembly-drawing", "assembly_drawing.png", "png:#6a8caf"),
    ("work-instruction-video", "work_instruction.mp4", "mp4"),
    ("work-instruction-details", "work_instruction_details.txt", "text:WORK INSTRUCTION\n1. Mount the part.\n2. Spindle 1200 rpm.\n3. Run O0001.\n4. Deburr + inspect."),
    ("2d-cad", "part_2d.pdf", "pdf:2D CAD - Sample Part"),
    ("3d-cad", "part_3d.stl", "stl"),
    ("customer-list", "customer_list.csv", "text:Customer,Contact,Email\nSMC,Mr. Tanaka,tanaka@smc.co.jp\nMARKS,Mr. Rao,rao@marks.in"),
    ("quotation", "quotation.pdf", "pdf:QUOTATION - Qty 100 @ 1000"),
    ("purchase-order", "purchase_order.pdf", "pdf:PURCHASE ORDER 2026-001"),
    ("video", "demo_video.mp4", "mp4"),
    ("inspection-report", "inspection_report.pdf", "pdf:INSPECTION REPORT - PASS"),
    ("tools", "tooling_list.txt", "text:TOOLING\n- End mill 6mm\n- Drill 4.0mm\n- Tap M5"),
    ("product-sample", "product_sample.png", "png:#7a9a5b"),
    ("defect-report", "defect_report.txt", "text:DEFECT REPORT\nLot 2026-001\nDefects: 0/100\nStatus: OK"),
    ("program", "cnc_program.nc", "text:%\nO0001 (SAMPLE)\nG21 G90 G54\nG0 X0 Y0\nG1 Z-2 F100\nM30\n%"),
    ("packing-std", "packing_standard.txt", "text:PACKING STANDARD\nBox 300x200x100 mm\nQty/box 50"),
]


def build_bytes(spec):
    if spec.startswith("png:"):
        p = os.path.join(TMP, "s.png"); make_png(p, spec.split(":", 1)[1]); return open(p, "rb").read()
    if spec == "mp4":
        p = os.path.join(TMP, "s.mp4"); make_mp4(p); return open(p, "rb").read()
    if spec == "stl":
        return CUBE.encode()
    if spec.startswith("pdf:"):
        p = os.path.join(TMP, "s.pdf"); make_pdf(p, spec.split(":", 1)[1]); return open(p, "rb").read()
    if spec.startswith("text:"):
        return spec.split(":", 1)[1].encode()
    return b""


tok = req("POST", "/api/auth/login", body={"username": "pms@gmail.com", "password": "pmspms"})["token"]
print("TB:", TB)
drawings = req("GET", "/api/tenant/assets?pageSize=200&page=0&type=Drawing", tok)["data"]
print("drawings:", len(drawings))

# pre-build base bytes per type
blobs = {dt: build_bytes(spec) for (dt, fn, spec) in SPECS}


def upload_resource(name, raw):
    _uid[0] += 1
    res = req("POST", "/api/resource", tok, {
        "resourceType": "JS_MODULE", "title": name,
        "fileName": f"{int(time.time()*1000)}-{_uid[0]}-{name}",
        "data": base64.b64encode(raw).decode(),
    })
    return res["id"]["id"]


for d in drawings:
    aid = d["id"]["id"]
    docs = []
    thumb = None
    for (dt, fn, spec) in SPECS:
        raw = blobs[dt]
        rid = upload_resource(fn, raw)
        if dt == "drawing":
            thumb = rid
        docs.append({
            "id": f"{aid[:8]}-{dt}", "drawingId": aid, "docType": dt, "name": fn,
            "size": len(raw), "sizeLabel": f"{len(raw)/1048576:.2f} MB",
            "resourceId": rid, "uploadedAt": "2026-06-10T00:00:00.000Z",
        })
    attrs = {"documents": json.dumps(docs)}
    if thumb:
        attrs["thumbnailResourceId"] = thumb
    req("POST", f"/api/plugins/telemetry/ASSET/{aid}/attributes/SERVER_SCOPE", tok, attrs)
    print(f"  {d['name']:14s} -> {len(docs)} docs in TB")

print("DONE")
