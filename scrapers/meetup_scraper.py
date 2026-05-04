"""
Meetup.com scraper for London events.
Uses Meetup's public GraphQL API. No account needed for public events.
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

GQL = 'https://api.meetup.com/gql'

# London coordinates
LONDON_LAT = 51.5074
LONDON_LNG = -0.1278

TOPIC_MAP = {
    'tech': ['tech', 'software', 'python', 'javascript', 'ai', 'machine learning', 'data science', 'startup'],
    'art': ['art', 'photography', 'design', 'creative'],
    'music': ['music', 'jazz', 'classical', 'electronic'],
    'talk': ['philosophy', 'science', 'politics', 'literature', 'book'],
    'other': [],
}


def guess_categories(title: str, description: str) -> list[str]:
    text = (title + ' ' + description).lower()
    cats = []
    for cat, keywords in TOPIC_MAP.items():
        if any(k in text for k in keywords):
            cats.append(cat)
    return cats[:2] or ['other']


QUERY = """
query($lat: Float!, $lon: Float!, $radius: Int!, $after: String) {
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
            venue {
              name
              address
              city
              lat
              lng
            }
            group { name }
            images { baseUrl }
            going
            maxTickets
            eventType
          }
        }
      }
    }
  }
}
"""


def fetch_page(after: str = None) -> dict:
    variables = {
        'lat': LONDON_LAT,
        'lon': LONDON_LNG,
        'radius': 25,
        'after': after,
    }
    resp = requests.post(GQL, json={'query': QUERY, 'variables': variables}, timeout=30)
    resp.raise_for_status()
    return resp.json()


def normalise(ev: dict) -> dict | None:
    try:
        if ev.get('isOnline'):
            return None

        venue = ev.get('venue') or {}
        images = ev.get('images') or []
        image_url = images[0]['baseUrl'] if images else None

        start = ev['dateTime']
        if datetime.fromisoformat(start.rstrip('Z')) < datetime.now():
            return None

        title = ev.get('title', '')
        desc = ev.get('description', '')[:2000]

        return {
            'title': title[:500],
            'description': desc,
            'start_datetime': start,
            'end_datetime': ev.get('endTime'),
            'venue_name': venue.get('name') or ev.get('group', {}).get('name'),
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
            'is_free': True,  # Most Meetup events are free
        }
    except Exception as e:
        print(f'  Normalise error: {e}')
        return None


def run(max_pages: int = 5):
    total = 0
    after = None
    for page in range(max_pages):
        try:
            data = fetch_page(after)
            edges = data.get('data', {}).get('keywordSearch', {}).get('edges', [])
            page_info = data.get('data', {}).get('keywordSearch', {}).get('pageInfo', {})

            events = [e['node']['result'] for e in edges if e.get('node', {}).get('result')]
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
