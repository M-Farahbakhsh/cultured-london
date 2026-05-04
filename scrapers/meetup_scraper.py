"""
Meetup.com scraper for London events.
Uses Meetup's public keywordSearch GraphQL operation (no auth required for public events).
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

# Meetup's current GraphQL endpoint (moved from api.meetup.com/gql)
GQL_ENDPOINTS = [
    'https://www.meetup.com/gql',
    'https://api.meetup.com/gql2',
]

LONDON_LAT = 51.5074
LONDON_LNG = -0.1278

HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Origin': 'https://www.meetup.com',
    'Referer': 'https://www.meetup.com/',
}

TOPIC_MAP = {
    'tech': ['tech', 'software', 'python', 'javascript', 'ai', 'machine learning', 'data science', 'startup'],
    'art': ['art', 'photography', 'design', 'creative'],
    'music': ['music', 'jazz', 'classical', 'electronic'],
    'talk': ['philosophy', 'science', 'politics', 'literature', 'book'],
    'other': [],
}


def guess_categories(title: str, description: str) -> list[str]:
    text = (title + ' ' + description).lower()
    cats = [cat for cat, kws in TOPIC_MAP.items() if kws and any(k in text for k in kws)]
    return cats[:2] or ['other']


QUERY = """
query SearchEvents($lat: Float!, $lon: Float!, $radius: Int!, $after: String) {
  keywordSearch(
    filter: { query: "", lat: $lat, lon: $lon, radius: $radius }
    input: { first: 50, after: $after }
  ) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        result {
          ... on Event {
            id
            title
            description
            dateTime
            endTime
            eventUrl
            isOnline
            venue { name address city lat lng }
            group { name }
            images { baseUrl }
          }
        }
      }
    }
  }
}
"""


def fetch_page(endpoint: str, after: str = None) -> dict:
    variables = {'lat': LONDON_LAT, 'lon': LONDON_LNG, 'radius': 25, 'after': after}
    resp = requests.post(
        endpoint,
        json={'query': QUERY, 'variables': variables},
        headers=HEADERS,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def find_working_endpoint() -> str | None:
    for endpoint in GQL_ENDPOINTS:
        try:
            data = fetch_page(endpoint)
            # If we get back a dict with 'data' or 'errors', it responded
            if isinstance(data, dict) and ('data' in data or 'errors' in data):
                search = (data.get('data') or {}).get('keywordSearch')
                if search is not None:
                    return endpoint
        except Exception:
            pass
    return None


def normalise(ev: dict) -> dict | None:
    try:
        if ev.get('isOnline'):
            return None
        start = ev.get('dateTime', '')
        if not start:
            return None
        try:
            if datetime.fromisoformat(start.rstrip('Z')) < datetime.now():
                return None
        except Exception:
            return None

        venue = ev.get('venue') or {}
        images = ev.get('images') or []
        image_url = images[0]['baseUrl'] if images else None
        title = ev.get('title', '')
        desc = (ev.get('description') or '')[:2000]

        return {
            'title': title[:500],
            'description': desc,
            'start_datetime': start,
            'end_datetime': ev.get('endTime'),
            'venue_name': venue.get('name') or (ev.get('group') or {}).get('name'),
            'venue_address': venue.get('address'),
            'area': venue.get('city') or 'London',
            'lat': venue.get('lat'),
            'lng': venue.get('lng'),
            'categories': guess_categories(title, desc),
            'tags': [],
            'people': [],
            'image_url': image_url,
            'event_url': ev.get('eventUrl'),
            'source': 'meetup',
            'source_id': str(ev['id']),
            'is_free': True,
        }
    except Exception as e:
        print(f'  Normalise error: {e}')
        return None


def run(max_pages: int = 5):
    endpoint = find_working_endpoint()
    if not endpoint:
        print('  Meetup GraphQL endpoint not reachable — skipping.')
        print('  (Meetup now requires OAuth for most API access.)')
        return

    total = 0
    after = None
    for page in range(max_pages):
        try:
            data = fetch_page(endpoint, after)
            search = (data.get('data') or {}).get('keywordSearch') or {}
            edges = search.get('edges', [])
            page_info = search.get('pageInfo', {})

            events = [
                e['node']['result'] for e in edges
                if e.get('node', {}).get('result')
            ]
            to_insert = [n for ev in events if (n := normalise(ev))]

            if to_insert:
                sb.table('events').upsert(to_insert, on_conflict='source,source_id').execute()
                total += len(to_insert)
                print(f'  Meetup page {page + 1}: +{len(to_insert)} events')

            if not page_info.get('hasNextPage'):
                break
            after = page_info.get('endCursor')
        except Exception as e:
            print(f'  Meetup error page {page + 1}: {e}')
            break

    print(f'Meetup done. Total inserted: {total}')


if __name__ == '__main__':
    run()
