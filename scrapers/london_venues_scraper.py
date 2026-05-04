"""
Scraper for major London cultural venues.
Uses public event listing pages — no login required.
Requires: pip install playwright && playwright install chromium
"""
import os, re, asyncio
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client
from playwright.async_api import async_playwright
import json

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

sb = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
)

# Venue configs: url, CSS selectors, category hints
VENUES = [
    {
        'name': 'Barbican Centre',
        'url': 'https://www.barbican.org.uk/whats-on',
        'area': 'City',
        'default_categories': ['music', 'art', 'theatre', 'film'],
        'selectors': {
            'events': '.listing-item, [class*="event-card"], article.event',
            'title': 'h3, h2, [class*="title"]',
            'date': '[class*="date"], time',
            'venue_detail': '[class*="venue"], [class*="location"]',
            'link': 'a',
            'image': 'img',
        }
    },
    {
        'name': 'Southbank Centre',
        'url': 'https://www.southbankcentre.co.uk/whats-on',
        'area': 'South Bank',
        'default_categories': ['music', 'art', 'talk', 'literature'],
        'selectors': {
            'events': '[class*="event"], [class*="listing"], .card',
            'title': 'h3, h2',
            'date': 'time, [class*="date"]',
            'link': 'a',
            'image': 'img',
        }
    },
    {
        'name': 'ICA',
        'url': 'https://www.ica.art/whats-on',
        'area': 'Westminster',
        'default_categories': ['art', 'film', 'talk', 'exhibition'],
        'selectors': {
            'events': 'article, [class*="event-item"], li.event',
            'title': 'h3, h2, [class*="title"]',
            'date': 'time, [class*="date"]',
            'link': 'a',
            'image': 'img',
        }
    },
    {
        'name': "Sadler's Wells",
        'url': 'https://www.sadlerswells.com/whats-on/',
        'area': 'Islington',
        'default_categories': ['theatre'],
        'selectors': {
            'events': '[class*="show"], [class*="event"], article',
            'title': 'h3, h2',
            'date': 'time, [class*="date"]',
            'link': 'a',
            'image': 'img',
        }
    },
]


def make_source_id(venue_name: str, title: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', (venue_name + '-' + title).lower())[:80]
    return f'venue-{slug}'


async def scrape_venue(page, venue: dict) -> list[dict]:
    events = []
    try:
        await page.goto(venue['url'], timeout=30000, wait_until='domcontentloaded')
        await page.wait_for_timeout(2000)

        # Use JSON-LD structured data if available (most modern venue sites have this)
        json_ld_data = await page.evaluate("""
            () => {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                const results = [];
                for (const s of scripts) {
                    try { results.push(JSON.parse(s.textContent)); } catch {}
                }
                return results;
            }
        """)

        for block in json_ld_data:
            items = block if isinstance(block, list) else [block]
            for item in items:
                if item.get('@type') in ('Event', 'MusicEvent', 'TheaterEvent', 'ScreeningEvent', 'ExhibitionEvent'):
                    try:
                        start = item.get('startDate', '')
                        if start and datetime.fromisoformat(start.rstrip('Z')) < datetime.now():
                            continue
                        ev = {
                            'title': item.get('name', '')[:500],
                            'description': (item.get('description') or '')[:2000],
                            'start_datetime': start,
                            'end_datetime': item.get('endDate'),
                            'venue_name': venue['name'],
                            'venue_address': item.get('location', {}).get('address', {}).get('streetAddress'),
                            'area': venue['area'],
                            'categories': venue['default_categories'][:1],
                            'tags': [],
                            'people': [],
                            'image_url': (item.get('image') or [None])[0] if isinstance(item.get('image'), list) else item.get('image'),
                            'event_url': item.get('url'),
                            'source': 'venue_scrape',
                            'source_id': make_source_id(venue['name'], item.get('name', '')),
                            'is_free': False,
                        }
                        events.append(ev)
                    except Exception as e:
                        print(f'    JSON-LD parse error: {e}')

        print(f'  {venue["name"]}: found {len(events)} events via JSON-LD')

    except Exception as e:
        print(f'  {venue["name"]} scrape error: {e}')

    return events


async def run_async():
    total = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )

        for venue in VENUES:
            print(f'Scraping: {venue["name"]}...')
            events = await scrape_venue(page, venue)
            if events:
                try:
                    sb.table('events').upsert(events, on_conflict='source,source_id').execute()
                    total += len(events)
                except Exception as e:
                    print(f'  DB insert error: {e}')

        await browser.close()

    print(f'\nVenue scraper done. Total: {total}')


def run():
    asyncio.run(run_async())


if __name__ == '__main__':
    run()
