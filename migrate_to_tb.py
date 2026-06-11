#!/usr/bin/env python3
"""Migrate documents from the old zumen_backend (documents.json + uploads/) into
ThingsBoard (resources + asset 'documents' attribute), for assets that exist on
the target TB. One-time migration of real uploaded files.

  ZUMEN_TB_URL=http://192.168.0.97:8080 python migrate_to_tb.py
"""
import json, os, base64, time, urllib.request as u, urllib.error

TB = os.environ.get("ZUMEN_TB_URL", "http://192.168.0.97:8080").rstrip("/")
BACKEND = os.path.join(os.path.dirname(__file__), "zumen_backend")
UPLOADS = os.path.join(BACKEND, "uploads")
_uid = [0]


def req(method, path, tok=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = u.Request(TB + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if tok:
        r.add_header("X-Authorization", "Bearer " + tok)
    try:
        with u.urlopen(r, timeout=40) as resp:
            t = resp.read().decode()
            return resp.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]


def is_image(name):
    return name.lower().rsplit(".", 1)[-1] in ("png", "jpg", "jpeg", "webp", "gif", "bmp")


tok = req("POST", "/api/auth/login", body={"username": "pms@gmail.com", "password": "pmspms"})[1]["token"]
print("TB:", TB)

docs_all = json.load(open(os.path.join(BACKEND, "documents.json"), encoding="utf-8"))
by_drawing = {}
for d in docs_all:
    by_drawing.setdefault(d["drawingId"], []).append(d)
print("drawings in documents.json:", len(by_drawing))

for aid, docs in by_drawing.items():
    st, asset = req("GET", f"/api/asset/{aid}", tok)
    if st != 200:
        print(f"  skip {aid[:8]} (not on this TB)")
        continue
    out = []
    thumb = None
    for d in docs:
        path = os.path.join(UPLOADS, d.get("filePath", ""))
        if not os.path.exists(path):
            print(f"    missing file {d.get('name')}")
            continue
        raw = open(path, "rb").read()
        _uid[0] += 1
        st, res = req("POST", "/api/resource", tok, {
            "resourceType": "JS_MODULE", "title": d["name"],
            "fileName": f"{int(time.time()*1000)}-{_uid[0]}-{d['name']}",
            "data": base64.b64encode(raw).decode(),
        })
        if st != 200:
            print(f"    FAIL {d['name']} ({len(raw)//1024}KB): {res}")
            continue
        rid = res["id"]["id"]
        if thumb is None and d["docType"] == "drawing" and is_image(d["name"]):
            thumb = rid
        out.append({
            "id": d.get("id") or f"{aid[:8]}-{_uid[0]}",
            "drawingId": aid, "docType": d["docType"], "name": d["name"],
            "size": len(raw), "sizeLabel": f"{len(raw)/1048576:.2f} MB",
            "resourceId": rid, "uploadedAt": d.get("uploadedAt", "2026-06-10T00:00:00.000Z"),
            "remarks": d.get("remarks"),
        })
    attrs = {"documents": json.dumps(out)}
    if thumb:
        attrs["thumbnailResourceId"] = thumb
    req("POST", f"/api/plugins/telemetry/ASSET/{aid}/attributes/SERVER_SCOPE", tok, attrs)
    print(f"  {asset.get('name'):14s} migrated {len(out)} docs" + (" (+thumb)" if thumb else ""))

print("DONE")
