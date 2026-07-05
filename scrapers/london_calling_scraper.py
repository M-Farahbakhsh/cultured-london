"""
London Calling scraper.
londoncalling.guide/events is a curated list of London tech events, mostly Luma links.
This scraper extracts each linked Luma event and fetches its details directly.
Uses source='luma' + evt-ID so events deduplicate cleanly against other Luma scrapers.
"""
import os, re, time, requests
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

LONDON_CALLING_URL = 'https://www.londoncalling.guide/events'

TOPIC_MAP = {
    'tech': ['tech', 'software', 'code', 'coding', 'developer', 'dev', 'engineer', 'engineering',
             'startup', 'saas', 'product', 'founder', 'hackathon', 'hack', 'app', 'agent', 'api'],
    'talk': ['ai', 'artificial intelligence', 'machine learning', 'data', 'panel', 'workshop', 'seminar',
             'conference', 'summit', 'keynote', 'talk', 'networking', 'meetup', 'breakfast', 'lunch',
             'dinner', 'venture', 'vc', 'investment'],
    'art': ['art', 'design', 'creative', 'photography', 'film', 'exhibition'],
    'music': ['music', 'concert', 'jazz', 'classical', 'electronic', 'gig'],
}


def guess_category(name: str) -> str:
    # Whole-word (plus simple plural) matching — a raw substring check let
    # short keywords like "ai" match "email"/"chair", "app" match "happy".
    text = name.lower()
    for cat, keywords in TOPIC_MAP.items():
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r's?\b', text):
                return cat
    return 'other'


def fetch_slugs() -> list[str]:
    """Fetch the London Calling events page and extract Luma event slugs."""
    try:
        resp = requests.get(LONDON_CALLING_URL, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        slugs = re.findall(r'lu\.ma/([A-Za-z0-9][A-Za-z0-9\-]{3,20})', resp.text)
        unique = list(dict.fromkeys(slugs))
        print(f'  London Calling: found {len(unique)} Luma slugs on page')
        return unique
    except Exception as e:
        print(f'  London Calling page fetch error: {e}')
        return []


def parse_luma_event_page(slug: str) -> dict | None:
    """
    Fetch an individual lu.ma/SLUG page and parse event data from the embedded HTML.
    Returns None if the page is not an event (user/org page) or is past/online.
    """
    try:
        resp = requests.get(
            f'https://lu.ma/{slug}',
            headers=HEADERS,
            timeout=15,
            allow_redirects=True,
        )
        if resp.status_code != 200:
            return None

        html = resp.text

        # Must have start_at — if not, it's a user/org page, not an event
        start_m = re.search(r'"start_at":"([^"]+)"', html)
        if not start_m:
            return None

        start = start_m.group(1)

        # Skip past events
        try:
            start_dt = datetime.fromisoformat(start.rstrip('Z')).replace(tzinfo=timezone.utc)
            if start_dt < datetime.now(timezone.utc):
                return None
        except Exception:
            return None

        # Skip online-only events
        loc_m = re.search(r'"location_type":"([^"]+)"', html)
        if loc_m and loc_m.group(1) == 'online':
            return None

        end_m = re.search(r'"end_at":"([^"]+)"', html)
        evt_m = re.search(r'evt-[A-Za-z0-9]{10,}', html)
        coord_m = re.search(r'"coordinate":\{"latitude":([^,]+),"longitude":([^}]+)\}', html)
        city_m = re.search(r'"city":"([^"]+)"', html)
        cover_m = re.search(r'"cover_url":"([^"]+)"', html)

        lat = float(coord_m.group(1)) if coord_m else None
        lng = float(coord_m.group(2).rstrip('}').strip()) if coord_m else None

        # UK bounding box filter
        if lat is not None and lng is not None:
            if not (-8.2 <= lng <= 1.8 and 49.9 <= lat <= 58.7):
                return None

        # Title: strip " · Luma" suffix from og:title
        og_title_m = re.search(r'og:title" content="([^"]+)"', html)
        name = og_title_m.group(1) if og_title_m else slug
        name = re.sub(r'\s*[·•]\s*Luma\s*$', '', name).strip()

        # Description from og:description
        og_desc_m = re.search(r'og:description" content="([^"]+)"', html)
        desc = og_desc_m.group(1)[:2000] if og_desc_m else ''

        evt_id = evt_m.group(0) if evt_m else f'lc-{slug}'

        return {
            'title': name[:500],
            'description': desc,
            'start_datetime': start,
            'end_datetime': end_m.group(1) if end_m else None,
            'venue_name': None,
            'venue_address': None,
            'area': city_m.group(1) if city_m else 'London',
            'lat': lat,
            'lng': lng,
            'categories': [guess_category(name)],
            'tags': [],
            'people': [],
            'image_url': cover_m.group(1) if cover_m else None,
            'event_url': f'https://lu.ma/{slug}',
            'source': 'luma',
            'source_id': evt_id,
            'is_free': True,
            'price_min': None,
        }
    except Exception as e:
        print(f'    Error parsing lu.ma/{slug}: {e}')
        return None


def run():
    slugs = fetch_slugs()
    if not slugs:
        print('London Calling done. Total inserted: 0')
        return

    to_insert = []
    skipped = 0
    for i, slug in enumerate(slugs):
        event = parse_luma_event_page(slug)
        if event:
            to_insert.append(event)
        else:
            skipped += 1
        time.sleep(0.4)

        if (i + 1) % 20 == 0:
            print(f'    [{i+1}/{len(slugs)}] {len(to_insert)} events so far...')

    print(f'  London Calling: {len(to_insert)} upcoming London events, {skipped} skipped (past/online/non-event pages)')

    if to_insert:
        try:
            sb.table('events').upsert(to_insert, on_conflict='source,source_id').execute()
            print(f'  London Calling: +{len(to_insert)} events')
        except Exception as e:
            print(f'  London Calling DB insert error: {e}')

    print(f'London Calling done. Total inserted: {len(to_insert)}')


if __name__ == '__main__':
    run()
