"""
Luma (lu.ma) scraper for London events.
Scrapes the public London discovery page — no API key required.
Mostly tech, AI, startup, and community events.
"""
import os, re, json, time, requests
from html import unescape
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

sb = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
)

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'en-GB,en;q=0.9',
}

TOPIC_MAP = {
    'tech': ['tech', 'software', 'code', 'coding', 'developer', 'dev', 'engineer', 'engineering',
             'startup', 'saas', 'product', 'founder', 'hackathon', 'hack', 'app', 'agent', 'api'],
    'talk': ['ai', 'artificial intelligence', 'machine learning', 'data', 'panel', 'workshop', 'seminar', 'conference', 'summit', 'keynote', 'talk', 'networking', 'meetup', 'breakfast', 'lunch', 'dinner', 'venture', 'vc', 'investment'],
    'art': ['art', 'design', 'creative', 'photography', 'film', 'exhibition', 'gallery'],
    'music': ['music', 'concert', 'jazz', 'classical', 'electronic', 'gig'],
}


def guess_category(name: str) -> str:
    # Whole-word matching only — a raw substring check let short keywords like
    # "ai" match "email"/"chair"/"maintain", "app" match "happy"/"apple", etc.
    # "hackathon"/"app"/"agent"/"api" were also just missing from `tech`
    # entirely, which is why an event literally titled "... Agent Hackathon"
    # fell all the way through to "other".
    text = name.lower()
    for cat, keywords in TOPIC_MAP.items():
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r's?\b', text):
                return cat
    return 'other'


def clean_text(raw: str) -> str:
    if not raw:
        return ''
    text = unescape(raw)  # decode &#x27; &amp; etc.
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\*{1,3}([^*\n]+)\*{1,3}', r'\1', text)
    text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    text = re.sub(r'`[^`]+`', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    # Strip common boilerplate prefixes
    for prefix in ('About the event ', 'About this event '):
        if text.startswith(prefix):
            text = text[len(prefix):]
    return text[:2000]


def fetch_event_description(slug: str) -> str:
    """Fetch individual Luma event page to get the full description."""
    try:
        resp = requests.get(f'https://lu.ma/{slug}', headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return ''
        html = resp.text

        # Try __NEXT_DATA__ JSON (works when Luma serves SSR)
        nd_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.+?)</script>', html, re.DOTALL)
        if nd_match:
            try:
                data = json.loads(nd_match.group(1))
                for path in [
                    ['props', 'pageProps', 'initialData', 'data', 'event', 'description'],
                    ['props', 'pageProps', 'initialData', 'data', 'event', 'desc_md'],
                    ['props', 'pageProps', 'event', 'description'],
                    ['props', 'pageProps', 'data', 'event', 'description'],
                ]:
                    node = data
                    for key in path:
                        node = node.get(key) if isinstance(node, dict) else None
                        if node is None:
                            break
                    if isinstance(node, str) and node.strip():
                        return clean_text(node)
            except Exception:
                pass

        # Fall back to OpenGraph / meta description tags — always present
        for pattern in [
            r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']{20,})["\']',
            r'<meta[^>]+content=["\']([^"\']{20,})["\'][^>]+property=["\']og:description["\']',
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']{20,})["\']',
            r'<meta[^>]+content=["\']([^"\']{20,})["\'][^>]+name=["\']description["\']',
        ]:
            m = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
            if m:
                return clean_text(m.group(1))
    except Exception:
        pass
    return ''


LONDON_LAT = 51.5074
LONDON_LNG = -0.1278
LONDON_PLACE_ID = 'discplace-QCcNk3HXowOR97j'
API_BASE = 'https://api.lu.ma/discover/get-paginated-events'


def _fetch_api(params: dict) -> list[dict]:
    """Fetch events from the Luma discover API with the given params."""
    try:
        resp = requests.get(API_BASE, params=params, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        return resp.json().get('entries', [])
    except Exception as e:
        print(f'  Luma API fetch error {params}: {e}')
        return []


def fetch_luma_events() -> list[dict]:
    # Two different API calls return two different (non-overlapping) sets of London events.
    # Combining both gives ~68 events vs ~27 from either alone.
    place_events = _fetch_api({'place_api_id': LONDON_PLACE_ID})
    latlon_events = _fetch_api({'latitude': LONDON_LAT, 'longitude': LONDON_LNG})
    print(f'  Luma: {len(place_events)} from place API, {len(latlon_events)} from lat/lng API')
    return place_events + latlon_events


def normalise(item: dict) -> dict | None:
    try:
        ev = item.get('event', item)
        start = ev.get('start_at') or item.get('start_at')
        if not start:
            return None

        try:
            start_dt = datetime.fromisoformat(start.rstrip('Z')).replace(tzinfo=timezone.utc)
            if start_dt < datetime.now(timezone.utc):
                return None
        except Exception:
            return None

        if ev.get('location_type') == 'online':
            return None

        geo = ev.get('geo_address_info') or {}
        localized = (geo.get('localized') or {}).get('en-GB') or {}
        full_address = localized.get('full_address') or geo.get('full_address')
        venue_name = localized.get('address') or geo.get('address')
        city = localized.get('city') or geo.get('city') or 'London'

        coord = ev.get('coordinate') or {}
        lat = coord.get('latitude')
        lng = coord.get('longitude')

        # Reject events outside the UK bounding box (UK lng: -8.2 to 1.8; Frankfurt is at ~8.7)
        if lat is not None and lng is not None:
            if not (-8.2 <= lng <= 1.8 and 49.9 <= lat <= 58.7):
                return None

        name = ev.get('name', '')

        # Try to get description from listing data first
        description = clean_text(
            ev.get('description') or ev.get('desc_md') or item.get('description') or ''
        )

        event_url_slug = ev.get('url', '')
        event_url = f'https://lu.ma/{event_url_slug}' if event_url_slug else None

        ticket_info = item.get('ticket_info') or {}
        is_free = not ticket_info.get('is_paid', False)
        price_min = None
        if not is_free:
            price_min = ticket_info.get('price', {}).get('amount')

        return {
            'title': name[:500],
            'description': description,
            '_slug': event_url_slug,   # temporary, used to fetch description below
            'start_datetime': start,
            'end_datetime': ev.get('end_at'),
            'venue_name': venue_name,
            'venue_address': full_address,
            'area': city,
            'lat': lat,
            'lng': lng,
            'categories': [guess_category(name)],
            'tags': [],
            'people': [h['name'] for h in (item.get('hosts') or [])[:5] if h.get('name')],
            'image_url': ev.get('cover_url'),
            'event_url': event_url,
            'source': 'luma',
            'source_id': ev.get('api_id', ''),
            'is_free': is_free,
            'price_min': price_min,
        }
    except Exception as e:
        print(f'  Luma normalise error: {e}')
        return None


def run():
    raw = fetch_luma_events()
    seen = set()
    to_insert = []
    for item in raw:
        ev = item.get('event', item)
        api_id = ev.get('api_id', '')
        if api_id in seen:
            continue
        seen.add(api_id)
        n = normalise(item)
        if n:
            to_insert.append(n)

    # Fetch individual event pages for any event with a short or missing description
    missing = [e for e in to_insert if len(e.get('description') or '') < 150 and e.get('_slug')]
    if missing:
        print(f'  Luma: fetching descriptions for {len(missing)} events...')
        for e in missing:
            desc = fetch_event_description(e['_slug'])
            if desc:
                e['description'] = desc
            time.sleep(0.4)  # polite delay

    # Remove the temporary _slug field before inserting
    db_events = [{k: v for k, v in e.items() if k != '_slug'} for e in to_insert]

    if db_events:
        try:
            sb.table('events').upsert(db_events, on_conflict='source,source_id').execute()
            print(f'  Luma: +{len(db_events)} events')
        except Exception as e:
            print(f'  Luma DB insert error: {e}')
    else:
        print('  Luma: 0 events')

    print(f'Luma done. Total inserted: {len(db_events)}')


if __name__ == '__main__':
    run()
