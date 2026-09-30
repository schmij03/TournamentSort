"""Holt Follower, Beiträge und Profilbild für die Accounts in data/accounts-list.txt.

Läuft in der GitHub Action (.github/workflows/update-accounts.yml).
Ergebnis: data/accounts.json und img/accounts/<plattform>_<handle>.jpg
Schlägt ein Abruf fehl, bleiben die bisherigen Werte erhalten.
"""
import datetime
import io
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIST = ROOT / "data" / "accounts-list.txt"
OUT = ROOT / "data" / "accounts.json"
IMG_DIR = ROOT / "img" / "accounts"

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def http_get(url, headers=None, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": BROWSER_UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def read_list():
    items = []
    for line in LIST.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        platform, handle = parts[0].lower(), parts[1].lstrip("@")
        manual = [int(x.replace("'", "").replace("’", "")) for x in parts[2:4]]
        items.append((platform, handle, manual))
    return items


def parse_en_count(txt):
    """«670M», «1.2K», «3,925» -> int"""
    txt = txt.strip().replace(",", "")
    mult = {"K": 1e3, "M": 1e6, "B": 1e9}.get(txt[-1:].upper(), 1)
    if mult > 1:
        txt = txt[:-1]
    return int(round(float(txt) * mult))


def instagram_api(handle, host):
    url = f"https://{host}/api/v1/users/web_profile_info/?username=" + urllib.parse.quote(handle)
    data = json.loads(http_get(url, {"x-ig-app-id": "936619743392459", "Accept": "application/json"}))
    u = data["data"]["user"]
    return {
        "name": u.get("full_name") or "",
        "followers": u["edge_followed_by"]["count"],
        "posts": u["edge_owner_to_timeline_media"]["count"],
        "pic": u.get("profile_pic_url_hd") or u.get("profile_pic_url"),
    }


def instagram_meta(handle):
    """Liest die Vorschau-Daten, die Instagram für Link-Vorschauen ausliefert (Zahlen gerundet)."""
    html = http_get(
        f"https://www.instagram.com/{urllib.parse.quote(handle)}/",
        {"User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
         "Accept-Language": "en-US,en;q=0.9"},
    ).decode("utf-8", "replace")
    html = html.replace("&quot;", '"').replace("&#064;", "@").replace("&amp;", "&")
    m = re.search(r"([\d.,]+[KMB]?) Followers, [\d.,]+[KMB]? Following, ([\d.,]+[KMB]?) Posts", html)
    if not m:
        raise ValueError("keine Zahlen in der Vorschau")
    name = re.search(r'<meta property="og:title" content="([^"(]*?)\s*\(@', html)
    pic = re.search(r'<meta property="og:image" content="([^"]+)"', html)
    return {
        "name": name.group(1).strip() if name else "",
        "followers": parse_en_count(m.group(1)),
        "posts": parse_en_count(m.group(2)),
        "pic": pic.group(1) if pic else None,
    }


def fetch_instagram(handle):
    errors = []
    for fn in (lambda: instagram_api(handle, "i.instagram.com"),
               lambda: instagram_api(handle, "www.instagram.com"),
               lambda: instagram_meta(handle)):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            errors.append(str(e))
    raise RuntimeError(" | ".join(errors))


def fetch_tiktok(handle):
    html = http_get(
        "https://www.tiktok.com/@" + urllib.parse.quote(handle),
        {"Accept-Language": "de-CH,de;q=0.9,en;q=0.8", "Accept": "text/html"},
    ).decode("utf-8", "replace")
    m = re.search(r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        raise ValueError("keine Profildaten im HTML")
    info = json.loads(m.group(1))["__DEFAULT_SCOPE__"]["webapp.user-detail"]["userInfo"]
    user, stats = info["user"], info.get("statsV2") or info["stats"]
    # Nur verifizierte Konten (blauer Haken), damit keine Fake-Accounts in die Liste kommen
    if not user.get("verified"):
        raise ValueError("Konto ist nicht verifiziert")
    return {
        "name": user.get("nickname") or "",
        "followers": int(stats["followerCount"]),
        "posts": int(stats["videoCount"]),
        "pic": user.get("avatarLarger") or user.get("avatarMedium"),
    }


def save_image(raw, path):
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    s = min(img.size)
    left, top = (img.width - s) // 2, (img.height - s) // 2
    img = img.crop((left, top, left + s, top + s)).resize((160, 160), Image.LANCZOS)
    img.save(path, "JPEG", quality=82, optimize=True)


def main():
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    old = {}
    if OUT.exists():
        for a in json.loads(OUT.read_text(encoding="utf-8")).get("accounts", []):
            old[(a["platform"], a["handle"].lower())] = a

    today = datetime.date.today().isoformat()
    result, ok, failed = [], 0, []
    for platform, handle, manual in read_list():
        key = (platform, handle.lower())
        entry = dict(old.get(key, {"platform": platform, "handle": handle, "name": "", "followers": None, "posts": None, "img": None}))
        entry["platform"], entry["handle"] = platform, handle
        img_path = IMG_DIR / f"{platform}_{handle}.jpg"
        pic = None
        try:
            info = fetch_instagram(handle) if platform == "instagram" else fetch_tiktok(handle)
            entry.update(name=info["name"], followers=info["followers"], posts=info["posts"], updated=today)
            pic = info["pic"]
            ok += 1
            print(f"OK   {platform:9} @{handle}: {info['followers']} Follower, {info['posts']} Beiträge")
        except Exception as e:  # noqa: BLE001
            if manual:
                entry.update(followers=manual[0], posts=manual[1] if len(manual) > 1 else None)
                print(f"HAND {platform:9} @{handle}: Werte aus der Liste ({e})")
            else:
                failed.append(f"{platform} @{handle}")
                print(f"FAIL {platform:9} @{handle}: {e}")

        # Profilbild: zuerst direkt, sonst über unavatar.io
        for src in [pic, f"https://unavatar.io/{platform}/{urllib.parse.quote(handle)}?fallback=false"]:
            if not src:
                continue
            try:
                save_image(http_get(src), img_path)
                break
            except Exception as e:  # noqa: BLE001
                print(f"     Bild nicht geladen ({src[:40]}…): {e}")
        if img_path.exists():
            entry["img"] = f"img/accounts/{img_path.name}"
        result.append(entry)
        time.sleep(2.5)

    # Bilder von Accounts, die nicht mehr in der Liste stehen, entfernen
    keep = {pathlib.Path(e["img"]).name for e in result if e.get("img")}
    for f in IMG_DIR.glob("*.jpg"):
        if f.name not in keep:
            f.unlink()

    OUT.write_text(json.dumps({"updated": today, "accounts": result}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n{ok} von {len(result)} Accounts aktualisiert.")
    if failed:
        print("Nicht aktualisiert: " + ", ".join(failed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
