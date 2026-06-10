#!/usr/bin/env python3
"""Seed ZUMEN sample data into the local ThingsBoard + document backend.
Idempotent: skips drawings that already exist (by drawing number / asset name)."""
import json, os, subprocess, tempfile, urllib.request as u, urllib.error

TB = "http://192.168.0.97:8080"
DOC = "http://localhost:5000"
USER, PW = "pms@gmail.com", "pmspms"


def req(method, path, tok=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = u.Request(TB + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if tok:
        r.add_header("X-Authorization", "Bearer " + tok)
    try:
        with u.urlopen(r, timeout=25) as resp:
            t = resp.read().decode()
            return resp.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]


tok = req("POST", "/api/auth/login", body={"username": USER, "password": PW})[1]["token"]
print("logged in as tenant")

# Drawing profile
profs = req("GET", "/api/assetProfiles?pageSize=200&page=0", tok)[1]
prof = next((p for p in profs["data"] if p["name"] == "Drawing"), None)
if not prof:
    prof = req("POST", "/api/assetProfile", tok,
               {"name": "Drawing", "description": "ZUMEN drawing/part", "default": False})[1]
pid = prof["id"]["id"]

# Customers -> pick client ids by title
custs = req("GET", "/api/customers?pageSize=200&page=0", tok)[1]["data"]
def client(title_part):
    c = next((c for c in custs if title_part.lower() in c["title"].lower()), None)
    return (c["id"]["id"], c["title"]) if c else ("", title_part)

# Existing Drawing assets (name -> id) for idempotency
existing = {a["name"]: a["id"]["id"]
            for a in req("GET", "/api/tenant/assets?pageSize=1000&page=0&type=Drawing", tok)[1]["data"]}

DRAWINGS = [
    ("FB002-M002", "Cover Plate",     "SMC",    "New Model",     "SUS304",         "CNC"),
    ("ZU-M00-123", "Socket-Z",        "SMC",    "In Production", "Aluminum 6061",  "CNC"),
    ("KM-6978",    "Roller Guide",    "MARKS",  "Hold",          "Brass",          "SPM"),
    ("435741",     "Hopper Flange",   "Makino", "New Model",     "SUS316",         "IMM"),
    ("e112-550",   "Brackets Slider", "MARKS",  "Approved",      "Carbon Steel",   "ASM"),
    ("MJ-12234",   "Mounting Joints", "Makino", "In Production", "SS304",          "CNC"),
]

ids = {}
for num, prod, cl, status, mat, proc in DRAWINGS:
    if num in existing:
        ids[num] = existing[num]
        print(f"  = exists  {num} ({prod})")
        continue
    cid, cname = client(cl)
    asset = req("POST", "/api/asset", tok,
                {"name": num, "label": prod,
                 "assetProfileId": {"entityType": "ASSET_PROFILE", "id": pid}})[1]
    aid = asset["id"]["id"]
    ids[num] = aid
    req("POST", f"/api/plugins/telemetry/ASSET/{aid}/attributes/SERVER_SCOPE", tok,
        {"drawingNumber": num, "productName": prod, "clientId": cid, "clientName": cname,
         "status": status, "material": mat, "processType": proc, "revision": "A"})
    print(f"  + created {num} ({prod}) -> {cname}")

# BOM hierarchy: Cover Plate contains Socket-Z, Roller Guide, Hopper Flange;
#                Socket-Z contains Brackets Slider, Mounting Joints.
BOM = [
    ("FB002-M002", "ZU-M00-123"), ("FB002-M002", "KM-6978"), ("FB002-M002", "435741"),
    ("ZU-M00-123", "e112-550"),   ("ZU-M00-123", "MJ-12234"),
]
for parent, child in BOM:
    req("POST", "/api/relation", tok,
        {"from": {"id": ids[parent], "entityType": "ASSET"},
         "to": {"id": ids[child], "entityType": "ASSET"},
         "type": "Contains", "typeGroup": "COMMON"})
print(f"BOM relations set ({len(BOM)} links)")

# Sample documents on the Cover Plate, across several tabs.
DOCS = [
    ("2d-cad",           "FB002-M002_2D.pdf",       "2D drawing of Cover Plate FB002-M002\nMaterial: SUS304\nScale 1:1"),
    ("3d-cad",           "FB002-M002_model.step",   "ISO-10303-21 STEP placeholder for Cover Plate"),
    ("quotation",        "Quotation_FB002.pdf",     "QUOTATION\nPart: Cover Plate\nQty 100 @ 1000 = 100000"),
    ("purchase-order",   "PO_FB002.pdf",            "PURCHASE ORDER 2026-001\nCover Plate x100\nDelivery 2026-07-01"),
    ("inspection-report","Inspection_FB002.pdf",    "INSPECTION REPORT\nOuter dia 50+-0.1 PASS\nThickness 10+-0.05 PASS"),
    ("program",          "FB002_CNC.nc",            "%\nO0001 (COVER PLATE)\nG21 G90\nM30\n%"),
]
parent_id = ids["FB002-M002"]
for dtype, fname, content in DOCS:
    p = os.path.join(tempfile.gettempdir(), fname)
    open(p, "w").write(content)
    out = subprocess.run(
        ["curl", "-s", "-F", f"file=@{p}", f"{DOC}/api/zumen/documents/{parent_id}/{dtype}"],
        capture_output=True, text=True).stdout
    ok = '"id"' in out
    print(f"  doc {dtype:18s} {fname:24s} {'ok' if ok else 'FAIL: '+out[:80]}")

print("\nSEED DONE. Parent Cover Plate id:", parent_id)
