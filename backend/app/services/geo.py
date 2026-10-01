"""Real geodata with no API key: Nominatim (search) + Overpass (nearby features), both OpenStreetMap.
To move to Google Geocoding/Places later, replace `search_place` and `nearby` only."""
import math
from datetime import datetime, timezone
from functools import lru_cache

import httpx

from ..config import settings

HEADERS = {"User-Agent": f"NilamLandAudit/1.0 ({settings.contact_email})"}


class GeoError(RuntimeError):
    pass


@lru_cache(maxsize=256)
def search_place(q: str) -> tuple[dict, ...]:
    try:
        r = httpx.get("https://nominatim.openstreetmap.org/search", params={"format": "jsonv2", "limit": 5, "countrycodes": "in", "q": q}, headers=HEADERS, timeout=15)
        r.raise_for_status()
    except httpx.HTTPError as e:
        raise GeoError(f"Geocoder unavailable: {e}") from e
    return tuple({"name": p["display_name"], "lat": float(p["lat"]), "lng": float(p["lon"])} for p in r.json())


def _dist(lat1, lng1, lat2, lng2) -> int:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return round(2 * 6371000 * math.asin(math.sqrt(h)))


def _kind(t: dict) -> str:
    if t.get("natural") == "water" or t.get("waterway"):
        return "water"
    a = t.get("amenity")
    return "health" if a in ("hospital", "clinic") else "education" if a in ("school", "college") else "transport"


def nearby(lat: float, lng: float) -> dict:
    q = f"""[out:json][timeout:25];(
      nwr(around:3000,{lat},{lng})[amenity~"^(hospital|clinic|school|college|bus_station)$"];
      node(around:1500,{lat},{lng})[highway=bus_stop];
      nwr(around:1000,{lat},{lng})[natural=water];
      way(around:1000,{lat},{lng})[waterway~"^(river|stream|canal)$"];
    );out center 80;"""
    try:
        r = httpx.post("https://overpass-api.de/api/interpreter", data={"data": q}, headers=HEADERS, timeout=40)
        r.raise_for_status()
    except httpx.HTTPError as e:
        raise GeoError(f"Map data service unavailable: {e}") from e
    items = []
    for e in r.json().get("elements", []):
        la, lo = e.get("lat", e.get("center", {}).get("lat")), e.get("lon", e.get("center", {}).get("lon"))
        if la is None or lo is None:
            continue
        t = e.get("tags", {})
        items.append({"kind": _kind(t), "name": t.get("name") or t.get("name:en") or t.get("amenity") or t.get("waterway") or t.get("natural"), "lat": la, "lng": lo, "distance": _dist(lat, lng, la, lo)})
    items.sort(key=lambda i: i["distance"])
    return {"fetched_at": datetime.now(timezone.utc).isoformat(), "source": "OpenStreetMap (Overpass)", "items": items}
