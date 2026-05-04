"""
Ticketmaster Discovery API scraper for London events.
Free API key at: https://developer.ticketmaster.com  (sign up → My Apps → Create new key)
Add TICKETMASTER_API_KEY to .env.local and to GitHub Secrets.
"""
import os, requests
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

sb = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
)

API_KEY = os.environ.get('TICKETMASTER_API_KEY', '')
BASE = 'https://app.ticketmaster.com/discovery/v2'

# Greater London centre + 30-mile radius covers O2, Wembley, Alexandra Palace, etc.
LONDON_LAT = 51.5074
LONDON_LNG = -0.1278
RADIUS_MILES = 30

SEGMENT_MAP = {
    'Music': 'music',
    'Arts & Theatre': 'theatre',
    'Film': 'film',
    'Sports': 'other',
    'Miscellaneous': 'other',
    'Undefined': 'other',
}

GENRE_OVERRIDES = {
    'comedy': 'comedy',
    'stand-up': 'comedy',
    'jazz': 'music',
    'classical': 'music',
    'opera': 'music',
    'rock': 'music',
    'pop': 'music',
    'hip-hop': 'music',
    'electronic': 'music',
    'dance': 'theatre',
    'ballet': 'theatre',
    'musical': 'theatre',
    'exhibit': 'art',
    'gallery': 'art',
    'film': 'film',
    'cinema': 'film',
    'comedy/humour': 'comedy',
    'technology': 'tech',
    'conference': 'talk',
    'lecture': 'talk',
}


def get_category(ev: dict) -> str:
    for cls in ev.get('classifications', []):
        genre = cls.get('genre', {}).get('name', '').lower()
        subgenre = cls.get('subGenre', {}).get('name', '').lower()
        for key, cat in GENRE_OVERRIDES.items():
            if key in genre or key in subgenre:
                return cat
        segment = cls.get('segment', {}).get('name', '')
        if segment in SEGMENT_MAP:
            return SEGMENT_MAP[segment]
    return 'other'


def fetch_page(page: int = 0, segment: str = None) -> dict:
    params = {
        'apikey': API_KEY,
        'latlong': f'{LONDON_LAT},{LONDON_LNG}',
        'radius': RADIUS_MILES,
        'unit': 'miles',
        'countryCode': 'GB',
        'size': 200,
        'page': page,
        'sort': 'date,asc',
        'startDateTime': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    }
    if segment:
        params['segmentName'] = segment
    resp = requests.get(f'{BASE}/events.json', params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def normalise(ev: dict) -> dict | None:
    try:
        dates = ev.get('dates', {})
        start = dates.get('start', {})
        start_dt = start.get('dateTime')
        if not start_dt:
            date_str = start.get('localDate', '')
            time_str = start.get('localTime', '00:00:00')
            if not date_str:
                return None
            start_dt = f'{date_str}T{time_str}Z'

        venues = (ev.get('_embedded') or {}).get('venues', [])
        venue = venues[0] if venues else {}
        venue_name = venue.get('name')
        venue_addr = venue.get('address', {}).get('line1')
        city = venue.get('city', {}).get('name') or 'London'
        loc = venue.get('location') or {}
        lat = float(loc['latitude']) if loc.get('latitude') else None
        lng = float(loc['longitude']) if loc.get('longitude') else None

        people = [
            a['name'] for a in (ev.get('_embedded') or {}).get('attractions', [])[:5]
            if a.get('name')
        ]

        image_url = None
        for img in ev.get('images', []):
            if img.get('ratio') == '16_9' and img.get('width', 0) >= 640:
                image_url = img['url']
                break
        if not image_url and ev.get('images'):
            image_url = ev['images'][0]['url']

        price_ranges = ev.get('priceRanges', [])
        price_min = float(price_ranges[0]['min']) if price_ranges else None
        is_free = price_min == 0 if price_min is not None else False

        return {
            'title': ev['name'][:500],
            'description': '',
            'start_datetime': start_dt,
            'end_datetime': None,
            'venue_name': venue_name,
            'venue_address': venue_addr,
            'area': city,
            'lat': lat,
            'lng': lng,
            'categories': [get_category(ev)],
            'tags': [],
            'people': people,
            'image_url': image_url,
            'event_url': ev.get('url'),
            'source': 'ticketmaster',
            'source_id': ev['id'],
            'is_free': is_free,
            'price_min': price_min,
        }
    except Exception as e:
        print(f'  Normalise error: {e}')
        return None


def run():
    if not API_KEY:
        print('  No TICKETMASTER_API_KEY set.')
        print('  Get a free key at https://developer.ticketmaster.com')
        print('  Then add it to .env.local and GitHub Secrets as TICKETMASTER_API_KEY')
        return

    # Ticketmaster hard-caps at page*size <= 1000 per search.
    # Work around it by running separate searches per segment — each yields up to 1000 events.
    # None = no filter (catch-all for unlabelled events)
    segments = [None, 'Music', 'Arts & Theatre', 'Miscellaneous', 'Sports']
    MAX_PAGES_PER_SEGMENT = 5  # 5 × 200 = 1000 per segment

    total = 0
    for segment in segments:
        label = segment or 'All'
        seg_total = 0
        for page in range(MAX_PAGES_PER_SEGMENT):
            try:
                data = fetch_page(page, segment)
                embedded = data.get('_embedded') or {}
                events = embedded.get('events', [])
                if not events:
                    break

                to_insert = [n for ev in events if (n := normalise(ev))]
                if to_insert:
                    sb.table('events').upsert(to_insert, on_conflict='source,source_id').execute()
                    total += len(to_insert)
                    seg_total += len(to_insert)

                page_meta = data.get('page', {})
                if page >= min(page_meta.get('totalPages', 1), MAX_PAGES_PER_SEGMENT) - 1:
                    break
            except Exception as e:
                # 400 = hit the deep-pagination cap, stop this segment
                break

        if seg_total:
            print(f'  Ticketmaster [{label}]: +{seg_total} events')

    print(f'Ticketmaster done. Total inserted: {total}')


if __name__ == '__main__':
    run()
