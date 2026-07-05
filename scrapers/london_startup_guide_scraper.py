"""
London Startup Guide scraper.
Pulls events from the community Luma calendars listed at london-startup.guide
(Events & Communities section) and adds the upcoming conferences/hackathons
from the Conferences & Hackathons section of the same guide.
"""
import os, re, json, time, requests
from datetime import datetime, timezone
from html import unescape
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

LUMA_API = 'https://api.lu.ma'

# Calendar slugs from london-startup.guide Events & Communities section
CALENDAR_SLUGS = [
    'incident',         # incident.io events
    'granola',          # Granola
    'fin',              # Fin
    'cursorcommunity',  # Cursor
    'claudecommunity',  # Anthropic / Claude community
    'coloop',           # CoLoop
    'techgames',        # Tech Games
    'ldn',              # Future: UK
    'ft-ldn',           # Frontier Towers
    'lfh',              # London Founder House
    'aiengine',         # AI Engine
    'redwood',          # Redwood Founders
    'plugged',          # Plugged
]

# User-based calendar slugs (different API path)
USER_SLUGS = ['joinef', 'kickstart']

# Upcoming conferences & hackathons from london-startup.guide (isPast=False only)
# Dates without exact times default to 09:00 UTC
CONFERENCES = [
    {
        'title': 'GTM in GMT',
        'event_url': 'https://events.clay.com/event/gtm-in-gmt',
        'start_datetime': '2026-06-04T09:00:00+00:00',
        'categories': ['talk'],
        'description': 'Go-to-market conference in London.',
        'source_id': 'conf-gtm-in-gmt-2026',
    },
    {
        'title': 'London Tech Week',
        'event_url': 'https://londontechweek.com/',
        'start_datetime': '2026-06-08T09:00:00+00:00',
        'categories': ['tech'],
        'description': 'One of the largest technology festivals in the world, held annually in London.',
        'source_id': 'conf-london-tech-week-2026',
    },
    {
        'title': 'Vercel Ship London',
        'event_url': 'https://vercel.com/ship/london',
        'start_datetime': '2026-06-17T09:00:00+00:00',
        'categories': ['tech'],
        'description': 'Vercel Ship developer conference in London.',
        'source_id': 'conf-vercel-ship-london-2026',
    },
    {
        'title': 'Cerebral Valley AI Summit',
        'event_url': 'https://cerebralvalley.com/',
        'start_datetime': '2026-06-24T09:00:00+00:00',
        'categories': ['talk'],
        'description': 'AI Summit bringing together leading researchers, founders, and investors in London.',
        'source_id': 'conf-cerebral-valley-london-2026',
    },
    {
        'title': 'SEV0',
        'event_url': 'https://go.incident.io/ldn-startup-sev0',
        'start_datetime': '2026-10-20T09:00:00+00:00',
        'categories': ['tech'],
        'description': 'Conference on incident management and reliability engineering, hosted by incident.io in London.',
        'source_id': 'conf-sev0-london-2026',
    },
]

TOPIC_MAP = {
    'tech': ['tech', 'software', 'code', 'coding', 'developer', 'dev', 'engineer', 'engineering',
             'startup', 'saas', 'product', 'founder', 'vercel', 'cursor', 'hackathon', 'hack', 'app', 'agent', 'api'],
    'talk': ['ai', 'artificial intelligence', 'machine learning', 'data', 'panel', 'workshop', 'seminar',
             'conference', 'summit', 'keynote', 'talk', 'networking', 'meetup', 'breakfast', 'lunch',
             'dinner', 'venture', 'vc', 'investment', 'gtm'],
    'art': ['art', 'design', 'creative', 'photography', 'film', 'exhibition', 'gallery'],
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


def clean_text(raw: str) -> str:
    if not raw:
        return ''
    text = unescape(raw)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\*{1,3}([^*\n]+)\*{1,3}', r'\1', text)
    text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    text = re.sub(r'`[^`]+`', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    for prefix in ('About the event ', 'About this event '):
        if text.startswith(prefix):
            text = text[len(prefix):]
    return text[:2000]


def _get_cal_api_id(slug: str) -> tuple[str, str] | tuple[None, None]:
    """
    Fetch the lu.ma/{slug} page and extract the calendar or user API ID from the HTML.
    Returns (kind, api_id) where kind is 'cal' or 'usr', or (None, None) on failure.
    """
    try:
        resp = requests.get(f'https://lu.ma/{slug}', headers=HEADERS, timeout=15, allow_redirects=True)
        if resp.status_code != 200:
            return None, None
        html = resp.text
        # Extract first cal-XXXX that isn't 'cal-padding'
        cal_match = re.search(r'\bcal-([A-Za-z0-9]{10,})\b', html)
        if cal_match:
            return 'cal', f'cal-{cal_match.group(1)}'
        usr_match = re.search(r'\busr-([A-Za-z0-9]{10,})\b', html)
        if usr_match:
            return 'usr', f'usr-{usr_match.group(1)}'
    except Exception as e:
        print(f'    Page fetch failed for {slug}: {e}')
    return None, None


def _fetch_entries(endpoint: str, params: dict) -> list[dict]:
    """Generic Luma paginated fetch."""
    try:
        resp = requests.get(
            f'{LUMA_API}/{endpoint}',
            params={**params, 'pagination_limit': 50},
            headers=HEADERS,
            timeout=20,
        )
        if resp.status_code == 200:
            return resp.json().get('entries', [])
    except Exception as e:
        print(f'    Fetch failed {endpoint} {params}: {e}')
    return []


def fetch_luma_community_events() -> list[dict]:
    all_entries = []
    all_slugs = CALENDAR_SLUGS + [f'user/{s}' for s in USER_SLUGS]

    for slug in all_slugs:
        kind, api_id = _get_cal_api_id(slug)
        if not api_id:
            print(f'  [{slug}] could not resolve ID — skipping')
            time.sleep(0.5)
            continue

        if kind == 'cal':
            entries = _fetch_entries('calendar/get-items', {'calendar_api_id': api_id})
        else:
            entries = _fetch_entries('event/get-by-host', {'api_id': api_id})

        print(f'  [{slug}] {len(entries)} entries')
        all_entries.extend(entries)
        time.sleep(0.7)

    return all_entries


def normalise_luma(item: dict) -> dict | None:
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

        if lat is not None and lng is not None:
            if not (-8.2 <= lng <= 1.8 and 49.9 <= lat <= 58.7):
                return None

        name = ev.get('name', '')
        description = clean_text(ev.get('description') or ev.get('desc_md') or item.get('description') or '')
        event_url_slug = ev.get('url', '')
        event_url = f'https://lu.ma/{event_url_slug}' if event_url_slug else None

        ticket_info = item.get('ticket_info') or {}
        is_free = not ticket_info.get('is_paid', False)
        price_min = ticket_info.get('price', {}).get('amount') if not is_free else None

        return {
            'title': name[:500],
            'description': description,
            '_slug': event_url_slug,
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
            'source': 'luma',            # deduplicates against main luma scraper
            'source_id': ev.get('api_id', ''),
            'is_free': is_free,
            'price_min': price_min,
        }
    except Exception as e:
        print(f'  normalise error: {e}')
        return None


def fetch_event_description(slug: str) -> str:
    """Fetch og:description from individual Luma event page."""
    try:
        resp = requests.get(f'https://lu.ma/{slug}', headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return ''
        for pattern in [
            r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']{20,})["\']',
            r'<meta[^>]+content=["\']([^"\']{20,})["\'][^>]+property=["\']og:description["\']',
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']{20,})["\']',
        ]:
            m = re.search(pattern, resp.text, re.IGNORECASE | re.DOTALL)
            if m:
                return clean_text(m.group(1))
    except Exception:
        pass
    return ''


def run():
    total = 0

    # --- Part 1: Luma community calendar events ---
    print('  Fetching Luma community calendars...')
    raw = fetch_luma_community_events()

    seen = set()
    to_insert = []
    for item in raw:
        ev = item.get('event', item)
        api_id = ev.get('api_id', '')
        if not api_id or api_id in seen:
            continue
        seen.add(api_id)
        n = normalise_luma(item)
        if n:
            to_insert.append(n)

    # Fetch descriptions for events with short/missing ones
    missing_desc = [e for e in to_insert if len(e.get('description') or '') < 150 and e.get('_slug')]
    if missing_desc:
        print(f'  Fetching descriptions for {len(missing_desc)} community events...')
        for e in missing_desc:
            desc = fetch_event_description(e['_slug'])
            if desc:
                e['description'] = desc
            time.sleep(0.4)

    db_community = [{k: v for k, v in e.items() if k != '_slug'} for e in to_insert]

    if db_community:
        try:
            sb.table('events').upsert(db_community, on_conflict='source,source_id').execute()
            print(f'  Community calendars: +{len(db_community)} events')
            total += len(db_community)
        except Exception as e:
            print(f'  Community calendar DB insert error: {e}')
    else:
        print('  Community calendars: 0 events')

    # --- Part 2: Conferences & Hackathons (static) ---
    now = datetime.now(timezone.utc)
    upcoming_confs = []
    for conf in CONFERENCES:
        try:
            start_dt = datetime.fromisoformat(conf['start_datetime'])
            if start_dt < now:
                continue
        except Exception:
            continue
        upcoming_confs.append({
            'title': conf['title'],
            'description': conf['description'],
            'start_datetime': conf['start_datetime'],
            'end_datetime': None,
            'venue_name': 'London',
            'venue_address': 'London, UK',
            'area': 'London',
            'lat': None,
            'lng': None,
            'categories': conf['categories'],
            'tags': [],
            'people': [],
            'image_url': None,
            'event_url': conf['event_url'],
            'source': 'london_startup_guide',
            'source_id': conf['source_id'],
            'is_free': False,
            'price_min': None,
        })

    if upcoming_confs:
        try:
            sb.table('events').upsert(upcoming_confs, on_conflict='source,source_id').execute()
            print(f'  Conferences/hackathons: +{len(upcoming_confs)} events')
            total += len(upcoming_confs)
        except Exception as e:
            print(f'  Conferences DB insert error: {e}')
    else:
        print('  Conferences/hackathons: 0 upcoming')

    print(f'London Startup Guide done. Total inserted: {total}')


if __name__ == '__main__':
    run()
