"""Repair only the player assets explicitly listed in the repair request.

The script uses Wikimedia Commons search metadata, skips all good/non-target
assets, applies a portrait-oriented square crop, and writes metadata-free WebP.
Run from the repository root with network access:
    python repair_player_photos.py
"""
import json
import math
import random
import re
import sys
import time
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image, ImageOps

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
BASE = Path(__file__).resolve().parent
OUT = BASE / "public" / "players"
OUT.mkdir(parents=True, exist_ok=True)
TARGETS = [
    ("arda-turan", "Arda Turan"),
    ("dany", "Dany Nounkeu"),
    ("gomis", "Bafetimbi Gomis"),
    ("ergun-penbe", "Ergün Penbe"),
    ("hasan-sas", "Hasan Şaş"),
    ("umit-karan", "Ümit Karan"),
    ("mondragon", "Faryd Mondragón"),
    ("nonda", "Shabani Nonda"),
    ("stjepan-tomas", "Stjepan Tomas"),
    ("capone", "Capone Galatasaray footballer"),
    ("filipescu", "Iulian Filipescu"),
]
OVERRIDES = {
    # Search ranking prefers action shots for these names; these Commons files
    # are more suitable single-person alternatives.
    "dany": "File:Dany Nounkeu'13.JPG",
    "gomis": "File:Bafetimbi Gomis 2015 (cropped).jpg",
    "stjepan-tomas": "File:Tomas driver licence pic.png",
    "umit-karan": "File:Galatasaray-VFB Homberg 13.07.2008 075.jpg",
}
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "GalatasarayMemoryGame/1.3 local Wikimedia asset repair"})


def get_with_retry(url, *, params=None, timeout=60, attempts=6):
    delay = 10.0
    for attempt in range(1, attempts + 1):
        response = SESSION.get(url, params=params, timeout=timeout)
        if response.status_code != 429:
            response.raise_for_status()
            return response
        retry_after = response.headers.get("Retry-After")
        try:
            wait = max(delay, float(retry_after)) if retry_after else max(60.0, delay)
        except ValueError:
            wait = max(60.0, delay)
        if attempt == attempts:
            response.raise_for_status()
        wait += random.uniform(1.0, 3.0)
        print(f"  429; waiting {wait:.1f}s before retry {attempt + 1}/{attempts}")
        time.sleep(wait)
        delay = min(delay * 2, 120.0)


def metadata_value(meta, key):
    value = (meta or {}).get(key, {})
    return (value.get("value") or "").strip()


def search_files(name, limit=20):
    params = {
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": f'filetype:bitmap "{name}"', "gsrnamespace": 6,
        "gsrlimit": limit, "prop": "imageinfo", "iiprop": "url|size|extmetadata",
    }
    data = get_with_retry(COMMONS_API, params=params).json()
    return list((data.get("query", {}).get("pages") or {}).values())


def get_file_by_title(title):
    data = get_with_retry(COMMONS_API, params={
        "action": "query", "format": "json", "titles": title,
        "prop": "imageinfo", "iiprop": "url|size|extmetadata",
    }).json()
    return next(iter((data.get("query", {}).get("pages") or {}).values()), None)


def candidate_score(page, name):
    info = (page.get("imageinfo") or [{}])[0]
    width, height = info.get("width", 0), info.get("height", 0)
    if min(width, height) < 300:
        return -999
    title = page.get("title", "")
    meta = info.get("extmetadata") or {}
    description = re.sub(r"<[^>]+>", " ", metadata_value(meta, "ImageDescription"))
    blob = f"{title} {description}".lower()
    normalized_name = re.sub(r"[^a-z0-9 ]", " ", name.lower())
    words = [word for word in normalized_name.split() if len(word) > 2]
    score = sum(14 for word in words if word in blob)
    score += 10 if name.lower() in blob else 0
    ratio = width / height
    score += 8 if 0.62 <= ratio <= 1.15 else (3 if 0.45 <= ratio <= 1.45 else -5)
    score += min(8, math.log10(max(width * height, 1)))
    license_name = metadata_value(meta, "LicenseShortName").upper()
    score += 3 if "CC" in license_name or "PUBLIC DOMAIN" in license_name else 0
    score -= 40 if any(word in blob for word in ("team", "squad", "group", "match", "players", "football team")) else 0
    score -= 12 if any(word in blob for word in ("painting", "illustration", "statue", "logo")) else 0
    return score


def crop_portrait(image):
    image = ImageOps.exif_transpose(image).convert("RGB")
    width, height = image.size
    side = min(width, height)
    left = max(0, (width - side) // 2)
    # Keep the face/upper body in frame when there is no face detector installed.
    top = min(max(0, int((height - side) * 0.16)), height - side)
    return image.crop((left, top, left + side, top + side)).resize((512, 512), Image.Resampling.LANCZOS)


def main():
    if "--discover" in sys.argv:
        for _, name in TARGETS:
            print(f"\n### {name}")
            pages = sorted(search_files(name), key=lambda page: candidate_score(page, name), reverse=True)
            for page in pages[:12]:
                info = (page.get("imageinfo") or [{}])[0]
                print(candidate_score(page, name), page.get("title"), info.get("width"), info.get("height"))
        return
    credits_path = BASE / "credits.json"
    credits = json.loads(credits_path.read_text(encoding="utf-8")) if credits_path.exists() else []
    by_id = {item.get("id"): item for item in credits if item.get("id")}
    successful = []
    failures = []
    targets = TARGETS
    if "--only" in sys.argv:
        only_id = sys.argv[sys.argv.index("--only") + 1]
        targets = [target for target in TARGETS if target[0] == only_id]
    for index, (player_id, name) in enumerate(targets, 1):
        print(f"[{index}/{len(TARGETS)}] Searching {name}...")
        try:
            candidates = sorted(search_files(name), key=lambda page: candidate_score(page, name), reverse=True)
            if not candidates:
                raise RuntimeError("no Wikimedia Commons candidates")
            page = get_file_by_title(OVERRIDES[player_id]) if player_id in OVERRIDES else candidates[0]
            if not page or "imageinfo" not in page:
                raise RuntimeError("selected Wikimedia Commons override was not found")
            info = page["imageinfo"][0]
            image_url = info.get("url")
            if not image_url:
                raise RuntimeError("candidate has no image URL")
            image = Image.open(BytesIO(get_with_retry(image_url).content))
            output = OUT / f"{player_id}.webp"
            crop_portrait(image).save(output, "WEBP", quality=86, method=6)
            meta = info.get("extmetadata") or {}
            by_id[player_id] = {
                "id": player_id, "player": name, "commons_title": page.get("title"),
                "source_page": "https://commons.wikimedia.org/wiki/" + page.get("title", "").replace(" ", "_"),
                "image_url": image_url, "author": re.sub(r"<[^>]+>", " ", metadata_value(meta, "Artist")),
                "license": metadata_value(meta, "LicenseShortName"), "license_url": metadata_value(meta, "LicenseUrl"),
            }
            successful.append(player_id)
            print(f"  -> {output.name} ({page.get('title')})")
        except Exception as error:
            failures.append({"id": player_id, "player": name, "error": str(error)})
            print(f"  FAILED: {error}")
        time.sleep(random.uniform(3.0, 6.0))

    credits_path.write_text(json.dumps(list(by_id.values()), ensure_ascii=False, indent=2), encoding="utf-8")
    (BASE / "repair_failures.json").write_text(json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8")
    if "stjepan-tomas" in successful:
        old = OUT / "tomas.webp"
        if old.exists():
            old.unlink()
            print("Removed legacy tomas.webp after stjepan-tomas.webp succeeded.")
    print(f"Finished: {len(successful)} repaired/downloaded, {len(failures)} failed.")


if __name__ == "__main__":
    main()
