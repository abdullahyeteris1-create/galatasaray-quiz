
import os, re, json, time, math
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image, ImageOps

PLAYERS = [
    ("hagi","Gheorghe Hagi"),
    ("taffarel","Claudio Taffarel"),
    ("jardel","Mario Jardel"),
    ("mondragon","Faryd Mondragon"),
    ("hasan-sas","Hasan Sas"),
    ("ergun-penbe","Ergun Penbe"),
    ("umit-karan","Umit Karan"),
    ("necati-ates","Necati Ates"),
    ("arda-turan","Arda Turan"),
    ("baros","Milan Baros"),
    ("kewell","Harry Kewell"),
    ("keita","Abdul Kader Keita"),
    ("elano","Elano Blumer"),
    ("muslera","Fernando Muslera"),
    ("melo","Felipe Melo"),
    ("sneijder","Wesley Sneijder"),
    ("drogba","Didier Drogba"),
    ("burak-yilmaz","Burak Yilmaz"),
    ("donk","Ryan Donk"),
    ("linnes","Martin Linnes"),
    ("rodrigues","Garry Rodrigues"),
    ("gomis","Bafetimbi Gomis"),
    ("onyekuru","Henry Onyekuru"),
    ("torreira","Lucas Torreira"),
    ("mertens","Dries Mertens"),
    ("icardi","Mauro Icardi"),
    ("capone","Capone Galatasaray footballer"),
    ("filipescu","Iulian Filipescu"),
    ("nonda","Shabani Nonda"),
    ("linderoth","Tobias Linderoth"),
    ("tomas","Stjepan Tomas"),
    ("dany","Dany Nounkeu"),
]

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
OUT = Path(__file__).resolve().parent / "players"
OUT.mkdir(exist_ok=True)

S = requests.Session()
S.headers.update({"User-Agent":"GalatasarayMemoryGame/1.0 (private local use)"})

def search_files(name, limit=15):
    params = {
        "action":"query","format":"json","generator":"search",
        "gsrsearch": f'filetype:bitmap "{name}"',
        "gsrnamespace":6,"gsrlimit":limit,
        "prop":"imageinfo","iiprop":"url|size|extmetadata",
    }
    r = S.get(COMMONS_API, params=params, timeout=30)
    r.raise_for_status()
    pages = (r.json().get("query",{}).get("pages") or {}).values()
    return list(pages)

def text(meta, key):
    v = (meta or {}).get(key, {})
    return (v.get("value") or "").strip()

def candidate_score(page, query_name):
    ii = (page.get("imageinfo") or [{}])[0]
    w,h = ii.get("width",0), ii.get("height",0)
    title = page.get("title","")
    meta = ii.get("extmetadata") or {}
    lic = text(meta,"LicenseShortName")
    desc = re.sub("<[^>]+>"," ",text(meta,"ImageDescription"))
    blob = (title+" "+desc).lower()
    words = [x.lower() for x in query_name.split() if len(x)>2]
    name_hits = sum(1 for x in words if x in blob)
    if not w or not h: return -999
    ratio = w/h
    portrait_bonus = 4 if 0.55 <= ratio <= 1.15 else (2 if 0.4 <= ratio <= 1.5 else 0)
    size_bonus = min(5, math.log10(max(w*h,1)))
    license_bonus = 2 if ("CC" in lic.upper() or "PUBLIC DOMAIN" in lic.upper()) else 0
    return name_hits*5 + portrait_bonus + size_bonus + license_bonus

def choose(name):
    items = search_files(name)
    items.sort(key=lambda p: candidate_score(p,name), reverse=True)
    return items[0] if items else None

def crop_square(im):
    im = ImageOps.exif_transpose(im).convert("RGB")
    w,h = im.size
    side = min(w,h)
    # Slight upward bias helps football portraits keep the face in frame.
    left = max(0,(w-side)//2)
    top = max(0,int((h-side)*0.30)) if h>side else 0
    top = min(top,h-side)
    return im.crop((left,top,left+side,top+side)).resize((512,512), Image.Resampling.LANCZOS)

credits = []
failures = []

for idx,(pid,name) in enumerate(PLAYERS,1):
    print(f"[{idx}/{len(PLAYERS)}] Searching {name}...")
    try:
        page = choose(name)
        if not page:
            failures.append((pid,name,"no result"))
            continue
        ii = page["imageinfo"][0]
        url = ii.get("url")
        meta = ii.get("extmetadata") or {}
        if not url:
            failures.append((pid,name,"no image url"))
            continue
        img_resp = S.get(url, timeout=60)
        img_resp.raise_for_status()
        im = Image.open(BytesIO(img_resp.content))
        out = OUT / f"{pid}.webp"
        crop_square(im).save(out,"WEBP",quality=86,method=6)
        credits.append({
            "id":pid,
            "player":name,
            "commons_title":page.get("title"),
            "source_page":"https://commons.wikimedia.org/wiki/"+page.get("title","").replace(" ","_"),
            "image_url":url,
            "author":re.sub("<[^>]+>"," ",text(meta,"Artist")),
            "license":text(meta,"LicenseShortName"),
            "license_url":text(meta,"LicenseUrl"),
        })
        print("  ->", out.name)
    except Exception as e:
        failures.append((pid,name,str(e)))
        print("  FAILED:", e)
    time.sleep(0.3)

(Path(__file__).resolve().parent / "credits.json").write_text(
    json.dumps(credits, ensure_ascii=False, indent=2), encoding="utf-8"
)
(Path(__file__).resolve().parent / "failures.json").write_text(
    json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8"
)

print()
print(f"Done. {len(credits)} images created, {len(failures)} missing/failed.")
print("Output:", OUT)
print("Review credits.json before publishing or redistributing images.")
