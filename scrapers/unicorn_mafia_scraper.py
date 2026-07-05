"""
Unicorn Mafia scraper.
Fetches events from the Unicorn Mafia /api/calendar endpoint.
Unicorn Mafia is a London startup community that curates events from across the ecosystem.
"""
import os, re, requests, time
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
    'Referer': 'https://www.unicrnmafia.com/',
}

TOPIC_MAP = {
    'tech': ['tech', 'software', 'code', 'coding', 'developer', 'dev', 'engineer', 'engineering',
             'startup', 'saas', 'product', 'founder', 'cursor', 'vercel', 'hackathon', 'hack', 'app', 'agent', 'api'],
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


def normalise(item: dict) -> dict | None:
    try:
        title = (item.get('summary') or '').strip()
        if not title:
            return None

        start = (item.get('start') or {}).get('dateTime')
        end = (item.get('end') or {}).get('dateTime')
        if not start:
            return None

        try:
            start_dt = datetime.fromisoformat(start)
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            if start_dt < datetime.now(timezone.utc):
                return None
        except Exception:
            return None

        location = (item.get('location') or 'London').strip()
        event_url = item.get('externalUrl') or item.get('htmlLink') or ''

        return {
            'title': title[:500],
            'description': '',
            'start_datetime': start,
            'end_datetime': end,
            'venue_name': location,
            'venue_address': location,
            'area': 'London',
            'lat': None,
            'lng': None,
            'categories': [guess_category(title)],
            'tags': [],
            'people': [],
            'image_url': item.get('imageUrl'),
            'event_url': event_url,
            'source': 'unicorn_mafia',
            'source_id': item.get('id', ''),
            'is_free': True,
            'price_min': None,
        }
    except Exception as e:
        print(f'  Unicorn Mafia normalise error: {e}')
        return None


def _is_luma_url(url: str) -> bool:
    return 'lu.ma/' in url or 'luma.com/' in url


def _resolve_luma_evt_id(luma_url: str) -> str | None:
    """Fetch a Luma event page and extract the evt- ID for deduplication.
    Handles both lu.ma/SLUG and luma.com/SLUG URL formats."""
    try:
        # Extract slug — works for both lu.ma/SLUG and luma.com/SLUG
        slug = re.split(r'(?:lu\.ma|luma\.com)/', luma_url)[-1].rstrip('/')
        resp = requests.get(f'https://lu.ma/{slug}', headers=HEADERS, timeout=10, allow_redirects=True)
        if resp.status_code != 200:
            return None
        m = re.search(r'evt-[A-Za-z0-9]{10,}', resp.text)
        return m.group(0) if m else None
    except Exception:
        return None


def run():
    try:
        resp = requests.get(
            'https://www.unicrnmafia.com/api/calendar',
            headers=HEADERS,
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        raw = data.get('events', data) if isinstance(data, dict) else data
    except Exception as e:
        print(f'  Unicorn Mafia fetch error: {e}')
        return

    to_insert = [n for item in raw if (n := normalise(item)) is not None]

    # For events that link to Luma, resolve the evt- ID so they deduplicate
    # cleanly against events already stored by the Luma scraper.
    luma_events = [e for e in to_insert if _is_luma_url(e.get('event_url') or '')]
    if luma_events:
        print(f'  Resolving Luma evt-IDs for {len(luma_events)} events...')
        resolved = 0
        for e in luma_events:
            evt_id = _resolve_luma_evt_id(e['event_url'])
            if evt_id:
                e['source'] = 'luma'
                e['source_id'] = evt_id
                resolved += 1
            time.sleep(0.3)
        print(f'  Resolved {resolved}/{len(luma_events)} to luma source')

    if to_insert:
        try:
            sb.table('events').upsert(to_insert, on_conflict='source,source_id').execute()
            print(f'  Unicorn Mafia: +{len(to_insert)} events')
        except Exception as e:
            print(f'  Unicorn Mafia DB insert error: {e}')
    else:
        print('  Unicorn Mafia: 0 events')

    print(f'Unicorn Mafia done. Total inserted: {len(to_insert)}')


if __name__ == '__main__':
    run()
