"""
Eventbrite scraper for London events.
Uses the public Eventbrite API — requires EVENTBRITE_API_KEY in .env.local.
Free tier allows 1000 calls/day which is plenty.

Docs: https://www.eventbrite.com/platform/api
"""
import os, requests, re
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

sb = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
)

API_KEY = os.environ.get('EVENTBRITE_API_KEY', '')
BASE = 'https://www.eventbriteapi.com/v3'

# Eventbrite category IDs → our categories
CATEGORY_MAP = {
    '103': 'music',         # Music
    '105': 'film',          # Film, Media & Entertainment
    '108': 'tech',          # Science & Technology
    '110': 'other',         # Travel & Outdoor
    '111': 'comedy',        # Comedy
    '113': 'art',           # Fine Art
    '105': 'art',           # Performing Arts
    '107': 'talk',          # Fashion
    '109': 'talk',          # Sports & Fitness
    '116': 'talk',          # Community & Culture
    '101': 'other',         # Business & Professional
    '102': 'other',         # Science & Technology (alt)
}

HEADERS = {'Authorization': f'Bearer {API_KEY}'}


def fetch_events(category_id: str = None, page: int = 1) -> dict:
    params = {
        'location.address': 'London, United Kingdom',
        'location.within': '30km',
        'start_date.range_start': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'expand': 'venue,ticket_availability',
        'page': page,
        'page_size': 50,
    }
    if category_id:
        params['categories'] = category_id
    resp = requests.get(f'{BASE}/events/search/', headers=HEADERS, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def clean_description(html: str) -> str:
    clean = re.sub(r'<[^>]+>', ' ', html or '')
    return re.sub(r'\s+', ' ', clean).strip()[:2000]


def normalise(ev: dict) -> dict | None:
    try:
        venue = ev.get('venue') or {}
        addr = venue.get('address') or {}
        ta = ev.get('ticket_availability') or {}

        start = ev['start']['utc']
        end = ev['end']['utc'] if ev.get('end') else None

        cat_id = str(ev.get('category_id', ''))
        category = CATEGORY_MAP.get(cat_id, 'other')

        # Rough price detection
        is_free = ev.get('is_free', False)
        price_min = None
        if not is_free and ta.get('minimum_ticket_price'):
            price_min = float(ta['minimum_ticket_price']['major_value'])

        image_url = None
        if ev.get('logo'):
            image_url = ev['logo'].get('url')

        return {
            'title': ev['name']['text'][:500],
            'description': clean_description(ev.get('description', {}).get('html', '')),
            'start_datetime': start,
            'end_datetime': end,
            'venue_name': venue.get('name'),
            'venue_address': addr.get('localized_address_display'),
            'area': addr.get('city') or addr.get('region'),
            'lat': float(addr['latitude']) if addr.get('latitude') else None,
            'lng': float(addr['longitude']) if addr.get('longitude') else None,
            'categories': [category],
            'tags': [],
            'people': [],
            'image_url': image_url,
            'event_url': ev.get('url'),
            'source': 'eventbrite',
            'source_id': ev['id'],
            'is_free': is_free,
            'price_min': price_min,
        }
    except Exception as e:
        print(f'  Normalise error: {e}')
        return None


def run(max_pages: int = 5):
    if not API_KEY:
        print('WARNING: No EVENTBRITE_API_KEY — skipping Eventbrite scraper')
        return

    total = 0
    # Fetch across key categories
    for cat_id in ['103', '105', '108', '111', '116']:
        for page in range(1, max_pages + 1):
            try:
                data = fetch_events(cat_id, page)
                events = data.get('events', [])
                if not events:
                    break

                to_insert = [n for ev in events if (n := normalise(ev))]
                if to_insert:
                    sb.table('events').upsert(to_insert, on_conflict='source,source_id').execute()
                    total += len(to_insert)
                    print(f'  Eventbrite cat={cat_id} page={page}: +{len(to_insert)} events')

                if not data.get('pagination', {}).get('has_more_items'):
                    break
            except Exception as e:
                print(f'  Eventbrite error cat={cat_id} page={page}: {e}')
                break

    print(f'Eventbrite done. Total inserted: {total}')


if __name__ == '__main__':
    run()
