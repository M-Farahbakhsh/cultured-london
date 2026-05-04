"""
Skiddle API scraper for London events.
Skiddle is a UK-focused events listing site with excellent London coverage.
Get a free API key at: https://www.skiddle.com/api/
Add SKIDDLE_API_KEY to .env.local and to GitHub Secrets.
"""
import os, requests
from datetime import datetime, timezone, date
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

sb = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
)

API_KEY = os.environ.get('SKIDDLE_API_KEY', '')
BASE = 'https://www.skiddle.com/api/v1/events/search/'

LONDON_LAT = 51.5074
LONDON_LNG = -0.1278

# Skiddle event type codes → our categories
EVENT_TYPES = [
    ('LIVE', 'music'),       # Live music
    ('CLUB', 'music'),       # Club nights
    ('COMEDY', 'comedy'),    # Comedy
    ('THEATRE', 'theatre'),  # Theatre / performing arts
    ('EXHIBITION', 'art'),   # Art exhibitions
    ('RAVE', 'music'),       # Raves / electronic
]


def fetch_page(eventcode: str, limit: int = 100, offset: int = 0) -> dict:
    params = {
        'api_key': API_KEY,
        'latitude': LONDON_LAT,
        'longitude': LONDON_LNG,
        'radius': 10,
        'limit': limit,
        'offset': offset,
        'order': 'date',
        'eventcode': eventcode,
        'minDate': date.today().isoformat(),
    }
    resp = requests.get(BASE, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def normalise(ev: dict, category: str) -> dict | None:
    try:
        start_date = ev.get('date', '')
        start_time = ev.get('starttime', '00:00:00')
        if not start_date:
            return None

        start_iso = f'{start_date}T{start_time}'
        try:
            dt = datetime.fromisoformat(start_iso)
            if dt < datetime.now():
                return None
        except Exception:
            return None

        venue = ev.get('venue') or {}

        image_url = ev.get('largeimageurl') or ev.get('imageurl')

        price_str = ev.get('entryprice', '').strip()
        is_free = price_str in ('', '0', '0.00', 'Free', 'free')
        try:
            price_min = float(price_str) if price_str and not is_free else None
        except ValueError:
            price_min = None

        title = ev.get('eventname', '')
        source_id = str(ev.get('id', ''))

        return {
            'title': title[:500],
            'description': (ev.get('description') or '')[:2000],
            'start_datetime': start_iso,
            'end_datetime': None,
            'venue_name': venue.get('name'),
            'venue_address': venue.get('address'),
            'area': venue.get('town') or 'London',
            'lat': float(venue['latitude']) if venue.get('latitude') else None,
            'lng': float(venue['longitude']) if venue.get('longitude') else None,
            'categories': [category],
            'tags': [],
            'people': [a['name'] for a in ev.get('artists', [])[:5] if a.get('name')],
            'image_url': image_url,
            'event_url': ev.get('link'),
            'source': 'skiddle',
            'source_id': source_id,
            'is_free': is_free,
            'price_min': price_min,
        }
    except Exception as e:
        print(f'  Skiddle normalise error: {e}')
        return None


def run(max_per_type: int = 200):
    if not API_KEY:
        print('  No SKIDDLE_API_KEY set.')
        print('  Get a free key at https://www.skiddle.com/api/')
        print('  Then add it to .env.local and GitHub Secrets as SKIDDLE_API_KEY')
        return

    total = 0
    for eventcode, category in EVENT_TYPES:
        offset = 0
        fetched = 0
        while fetched < max_per_type:
            try:
                data = fetch_page(eventcode, limit=100, offset=offset)
                results = data.get('results', [])
                if not results:
                    break

                to_insert = [n for ev in results if (n := normalise(ev, category))]
                if to_insert:
                    sb.table('events').upsert(to_insert, on_conflict='source,source_id').execute()
                    total += len(to_insert)
                    print(f'  Skiddle {eventcode} offset={offset}: +{len(to_insert)} events')

                fetched += len(results)
                if len(results) < 100:
                    break
                offset += 100
            except Exception as e:
                print(f'  Skiddle error {eventcode} offset={offset}: {e}')
                break

    print(f'Skiddle done. Total inserted: {total}')


if __name__ == '__main__':
    run()
