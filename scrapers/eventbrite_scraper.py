"""
Eventbrite scraper for London events.
Scrapes eventbrite.co.uk public listing pages — no API key required.
The old v3/events/search/ API endpoint was deprecated in 2023 for free accounts.
"""
import os, re, json, requests
from datetime import datetime, timezone
from dateutil import parser as dateutil_parser
from bs4 import BeautifulSoup
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
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
}

MAX_PAGES = 3  # pages to scrape per category

CATEGORY_PAGES = [
    ('music',   'https://www.eventbrite.co.uk/d/united-kingdom--london/music/'),
    ('art',     'https://www.eventbrite.co.uk/d/united-kingdom--london/visual-arts/'),
    ('tech',    'https://www.eventbrite.co.uk/d/united-kingdom--london/science-and-tech/'),
    ('comedy',  'https://www.eventbrite.co.uk/d/united-kingdom--london/comedy/'),
    ('film',    'https://www.eventbrite.co.uk/d/united-kingdom--london/film-media/'),
    ('talk',    'https://www.eventbrite.co.uk/d/united-kingdom--london/community/'),
    ('theatre', 'https://www.eventbrite.co.uk/d/united-kingdom--london/performing-arts/'),
    ('other',   'https://www.eventbrite.co.uk/d/united-kingdom--london/food-and-drink/'),
    ('talk',    'https://www.eventbrite.co.uk/d/united-kingdom--london/business/'),
    ('other',   'https://www.eventbrite.co.uk/d/united-kingdom--london/health/'),
]


def clean_description(raw: str) -> str:
    if not raw:
        return ''
    text = re.sub(r'<[^>]+>', ' ', raw)
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>') \
               .replace('&nbsp;', ' ').replace('&quot;', '"').replace('&#39;', "'")
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:2000]


def extract_json_ld(soup: BeautifulSoup) -> list[dict]:
    events = []
    for tag in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(tag.string or '')
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get('@type') in ('Event', 'MusicEvent', 'TheaterEvent', 'ScreeningEvent'):
                    events.append(item)
        except Exception:
            pass
    return events


def extract_server_data(html: str) -> list[dict]:
    """Try to pull events from the React server-data JSON blob."""
    match = re.search(r'window\.__SERVER_DATA__\s*=\s*(\{.+?\});\s*</script>', html, re.DOTALL)
    if not match:
        return []
    try:
        data = json.loads(match.group(1))
        # Navigate common paths — Eventbrite's schema changes over time
        for path in [
            ['components', 'search_results', 'events'],
            ['components', 'eventSearch', 'events'],
            ['page', 'value', 'search_data', 'events'],
        ]:
            node = data
            for key in path:
                node = node.get(key) if isinstance(node, dict) else None
                if node is None:
                    break
            if isinstance(node, list):
                return node
    except Exception:
        pass
    return []


def extract_event_links(soup: BeautifulSoup) -> list[str]:
    """Collect individual event page URLs from a listing page."""
    links = set()
    for a in soup.find_all('a', href=True):
        href = a['href']
        if re.match(r'https://www\.eventbrite\.co\.uk/e/[^?]+', href):
            links.add(href.split('?')[0])
    return list(links)[:30]


def scrape_event_page(url: str, category: str) -> dict | None:
    """Fetch an individual event page and extract JSON-LD."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, 'lxml')
        ld_events = extract_json_ld(soup)
        if ld_events:
            item = ld_events[0]
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

            location = item.get('location') or {}
            address = location.get('address') or {}
            venue_name = location.get('name') or address.get('name')
            venue_addr = address.get('streetAddress') or address.get('addressLocality')

            image = item.get('image')
            if isinstance(image, list):
                image = image[0] if image else None
            elif isinstance(image, dict):
                image = image.get('url')

            offers = item.get('offers') or {}
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            is_free = offers.get('price') in ('0', '0.00', 0, 0.0)
            try:
                price_min = float(offers.get('price', 0)) if not is_free else None
            except Exception:
                price_min = None

            title = item.get('name', '')[:500]
            slug = re.sub(r'[^a-z0-9]+', '-', title.lower())[:60]
            return {
                'title': title,
                'description': clean_description(item.get('description') or ''),
                'start_datetime': start_iso,
                'end_datetime': item.get('endDate'),
                'venue_name': venue_name,
                'venue_address': venue_addr,
                'area': address.get('addressLocality') or 'London',
                'lat': None,
                'lng': None,
                'categories': [category],
                'tags': [],
                'people': [],
                'image_url': image,
                'event_url': url,
                'source': 'eventbrite',
                'source_id': f'eb-{slug}',
                'is_free': is_free,
                'price_min': price_min,
            }
    except Exception as e:
        print(f'    Event page error {url}: {e}')
    return None


def scrape_category(category: str, base_url: str) -> list[dict]:
    events = []
    seen_ids = set()

    for page_num in range(1, MAX_PAGES + 1):
        url = f'{base_url}?page={page_num}' if page_num > 1 else base_url
        page_events = _scrape_page(category, url, seen_ids)
        if not page_events:
            break
        events.extend(page_events)

    return events


def _scrape_page(category: str, url: str, seen_ids: set) -> list[dict]:
    events = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code != 200:
            return []

        soup = BeautifulSoup(resp.text, 'lxml')

        # Try JSON-LD on the listing page first (sometimes present)
        for item in extract_json_ld(soup):
            start_raw = item.get('startDate', '')
            if not start_raw:
                continue
            try:
                start_dt = dateutil_parser.parse(start_raw)
                if start_dt.tzinfo is None:
                    start_dt = start_dt.replace(tzinfo=timezone.utc)
                if start_dt < datetime.now(timezone.utc):
                    continue
            except Exception:
                continue
            location = item.get('location') or {}
            address = location.get('address') or {}
            image = item.get('image')
            if isinstance(image, list):
                image = image[0] if image else None
            elif isinstance(image, dict):
                image = image.get('url')
            title = (item.get('name') or '')[:500]
            slug = re.sub(r'[^a-z0-9]+', '-', title.lower())[:60]
            events.append({
                'title': title,
                'description': clean_description(item.get('description') or ''),
                'start_datetime': start_dt.isoformat(),
                'end_datetime': item.get('endDate'),
                'venue_name': location.get('name'),
                'venue_address': address.get('streetAddress'),
                'area': address.get('addressLocality') or 'London',
                'lat': None,
                'lng': None,
                'categories': [category],
                'tags': [],
                'people': [],
                'image_url': image,
                'event_url': item.get('url'),
                'source': 'eventbrite',
                'source_id': f'eb-{slug}',
                'is_free': False,
                'price_min': None,
            })

        # Deduplicate by source_id within this run
        events = [e for e in events if e['source_id'] not in seen_ids]
        for e in events:
            seen_ids.add(e['source_id'])

        if events:
            return events

        # Fall back: collect individual event links and scrape each
        links = [l for l in extract_event_links(soup) if l not in seen_ids]
        for link in links:
            seen_ids.add(link)
            ev = scrape_event_page(link, category)
            if ev and ev['source_id'] not in seen_ids:
                seen_ids.add(ev['source_id'])
                events.append(ev)

    except Exception as e:
        print(f'  Eventbrite {category} error: {e}')

    return events


def run():
    total = 0
    for category, url in CATEGORY_PAGES:
        events = scrape_category(category, url)
        if events:
            try:
                sb.table('events').upsert(events, on_conflict='source,source_id').execute()
                total += len(events)
                print(f'  Eventbrite {category}: +{len(events)} events')
            except Exception as e:
                print(f'  Eventbrite DB insert error ({category}): {e}')
        else:
            print(f'  Eventbrite {category}: 0 events (page may require JS)')

    print(f'Eventbrite done. Total inserted: {total}')


if __name__ == '__main__':
    run()
