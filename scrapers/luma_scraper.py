"""
Luma (lu.ma) scraper for London events.
Scrapes the public London discovery page — no API key required.
Mostly tech, AI, startup, and community events.
"""
import os, re, json, requests
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
    'tech': ['tech', 'software', 'code', 'developer', 'engineer', 'startup', 'saas', 'product', 'founder'],
    'talk': ['ai', 'artificial intelligence', 'machine learning', 'data', 'panel', 'workshop', 'seminar', 'conference', 'summit', 'keynote', 'talk', 'networking', 'meetup', 'breakfast', 'lunch', 'dinner', 'venture', 'vc', 'investment'],
    'art': ['art', 'design', 'creative', 'photography', 'film', 'exhibition', 'gallery'],
    'music': ['music', 'concert', 'jazz', 'classical', 'electronic', 'gig'],
}


def guess_category(name: str) -> str:
    text = name.lower()
    for cat, keywords in TOPIC_MAP.items():
        if any(k in text for k in keywords):
            return cat
    return 'other'


def fetch_luma_events() -> list[dict]:
    url = 'https://lu.ma/london'
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception as e:
        print(f'  Luma fetch error: {e}')
        return []

    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.+?)</script>', resp.text, re.DOTALL)
    if not match:
        print('  Luma: no __NEXT_DATA__ found in page')
        return []

    try:
        data = json.loads(match.group(1))
        page_data = data['props']['pageProps']['initialData']['data']
        raw_events = page_data.get('events', []) + page_data.get('featured_events', [])
        return raw_events
    except Exception as e:
        print(f'  Luma JSON parse error: {e}')
        return []


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

        name = ev.get('name', '')

        # Extract and clean description (may be markdown or HTML)
        raw_desc = ev.get('description') or ev.get('desc_md') or item.get('description') or ''
        raw_desc = re.sub(r'<[^>]+>', ' ', raw_desc)           # strip HTML tags
        raw_desc = re.sub(r'\*{1,3}([^*\n]+)\*{1,3}', r'\1', raw_desc)  # strip bold/italic
        raw_desc = re.sub(r'^#+\s+', '', raw_desc, flags=re.MULTILINE)   # strip headings
        raw_desc = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', raw_desc)    # strip links
        raw_desc = re.sub(r'`[^`]+`', '', raw_desc)            # strip code
        raw_desc = re.sub(r'\s+', ' ', raw_desc).strip()
        description = raw_desc[:2000]

        ticket_info = item.get('ticket_info') or {}
        is_free = not ticket_info.get('is_paid', False)
        price_min = None
        if not is_free:
            price_min = ticket_info.get('price', {}).get('amount')

        event_url_slug = ev.get('url', '')
        event_url = f'https://lu.ma/{event_url_slug}' if event_url_slug else None

        return {
            'title': name[:500],
            'description': description,
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

    if to_insert:
        try:
            sb.table('events').upsert(to_insert, on_conflict='source,source_id').execute()
            print(f'  Luma: +{len(to_insert)} events')
        except Exception as e:
            print(f'  Luma DB insert error: {e}')
    else:
        print('  Luma: 0 events')

    print(f'Luma done. Total inserted: {len(to_insert)}')


if __name__ == '__main__':
    run()
