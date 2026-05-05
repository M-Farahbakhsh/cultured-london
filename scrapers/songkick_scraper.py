"""
Songkick scraper for London live music and concert events.
Scrapes the public London metro-area calendar — no API key required.
Covers gigs, concerts, festivals across all London venues.
"""
import os, re, json, time, requests
from datetime import datetime, timezone
from dateutil import parser as dateutil_parser
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
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
}

PAGE1_URL = 'https://www.songkick.com/metro-areas/24426-uk-london/calendar'
PAGED_URL = 'https://www.songkick.com/metro-areas/24426-uk-london'
MAX_PAGES = 20  # 20 × 50 = up to 1000 events


def fetch_page(page: int) -> list[dict]:
    # Page 1 uses the /calendar path; subsequent pages use the base URL with ?page=N
    url = PAGE1_URL if page == 1 else f'{PAGED_URL}?page={page}'
    for attempt in range(2):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
            if resp.status_code == 200:
                break
            if resp.status_code == 406 and attempt == 0:
                time.sleep(4)  # rate-limited, back off and retry
                continue
            return []
        except Exception as e:
            print(f'  Songkick fetch error page {page}: {e}')
            return []
    else:
        return []

    ld_blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', resp.text, re.DOTALL)
    events = []
    for block in ld_blocks:
        try:
            items = json.loads(block)
            if not isinstance(items, list):
                items = [items]
            for item in items:
                if item.get('@type') in ('Event', 'MusicEvent', 'Concert', 'TheaterEvent'):
                    events.append(item)
        except Exception:
            pass
    return events


def normalise(item: dict) -> dict | None:
    try:
        start_raw = item.get('startDate', '')
        if not start_raw:
            return None

        try:
            start_dt = dateutil_parser.parse(start_raw)
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            if start_dt < datetime.now(timezone.utc):
                return None
            start_iso = start_dt.isoformat()
        except Exception:
            return None

        end_raw = item.get('endDate')
        end_iso = None
        if end_raw:
            try:
                end_dt = dateutil_parser.parse(end_raw)
                if end_dt.tzinfo is None:
                    end_dt = end_dt.replace(tzinfo=timezone.utc)
                end_iso = end_dt.isoformat()
            except Exception:
                pass

        location = item.get('location') or {}
        address = location.get('address') or {}
        venue_name = location.get('name')
        street = address.get('streetAddress')
        locality = address.get('addressLocality') or 'London'

        # Build a description from performers + venue
        performers = item.get('performer', [])
        if isinstance(performers, dict):
            performers = [performers]
        people = [p.get('name') for p in performers if p.get('name')]

        raw_desc = (item.get('description') or '').strip()
        # Songkick auto-descriptions are useless; build a better one from performers
        if people and (not raw_desc or raw_desc.endswith(start_raw)):
            raw_desc = f'Live: {", ".join(people[:5])}.'
            if venue_name:
                raw_desc += f' At {venue_name}.'

        offers = item.get('offers', {})
        if isinstance(offers, list):
            offers = offers[0] if offers else {}
        price = offers.get('price')
        is_free = price in (0, '0', '0.00', 'Free', 'free', None) and offers.get('availability') != 'SoldOut'
        try:
            price_min = float(price) if price and price not in ('0', '0.00', 'Free', 'free') else None
        except (ValueError, TypeError):
            price_min = None

        name = item.get('name', '')
        event_url = item.get('url', '')
        # Use Songkick event URL as source_id basis
        source_id_match = re.search(r'/id/(\d+)', event_url)
        source_id = f'sk-{source_id_match.group(1)}' if source_id_match else f'sk-{hash(name + start_iso)}'

        image = item.get('image')
        if isinstance(image, list):
            image = image[0] if image else None

        return {
            'title': name[:500],
            'description': raw_desc[:2000],
            'start_datetime': start_iso,
            'end_datetime': end_iso,
            'venue_name': venue_name,
            'venue_address': street,
            'area': locality,
            'lat': None,
            'lng': None,
            'categories': ['music'],
            'tags': [],
            'people': people[:5],
            'image_url': image,
            'event_url': event_url.split('?')[0] if event_url else None,
            'source': 'songkick',
            'source_id': source_id,
            'is_free': is_free,
            'price_min': price_min,
        }
    except Exception as e:
        print(f'  Songkick normalise error: {e}')
        return None


def run():
    total = 0
    seen = set()
    consecutive_failures = 0

    for page in range(1, MAX_PAGES + 1):
        raw = fetch_page(page)
        if not raw:
            consecutive_failures += 1
            print(f'  Songkick page {page}: no events (failure {consecutive_failures})')
            if consecutive_failures >= 3:
                print('  Songkick: 3 consecutive failures, stopping')
                break
            time.sleep(2.0)
            continue

        consecutive_failures = 0
        to_insert = []
        for item in raw:
            n = normalise(item)
            if n and n['source_id'] not in seen:
                seen.add(n['source_id'])
                to_insert.append(n)

        if to_insert:
            try:
                sb.table('events').upsert(to_insert, on_conflict='source,source_id').execute()
                total += len(to_insert)
                print(f'  Songkick page {page}: +{len(to_insert)} events')
            except Exception as e:
                print(f'  Songkick DB error page {page}: {e}')
        else:
            print(f'  Songkick page {page}: 0 new events')

        if page < MAX_PAGES:
            time.sleep(1.5)

    print(f'Songkick done. Total inserted: {total}')


if __name__ == '__main__':
    run()
