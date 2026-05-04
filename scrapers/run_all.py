"""
Master scraper runner. Run this to populate the events database.
Usage: python scrapers/run_all.py [--seed-only] [--no-browser]

Options:
  --seed-only    Only insert the curated seed events (fastest, good for dev)
  --no-browser   Skip the venue scraper (which needs Playwright/Chromium)
  (no flag)      Run all scrapers: seed + Ticketmaster + Eventbrite + Meetup + venues
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

def main():
    seed_only = '--seed-only' in sys.argv
    no_browser = '--no-browser' in sys.argv

    print('=' * 55)
    print('  Cultured London — Event Data Pipeline')
    print('=' * 55)

    # 1. Seed data (only when --seed-only flag is given; skipped in production)
    if seed_only:
        print('\n[1/5] Loading curated seed events...')
        try:
            from seed_data import run as seed_run
            seed_run()
        except Exception as e:
            print(f'  Seed error: {e}')
        print('\n--seed-only flag set. Done.')
        return
    else:
        print('\n[1/5] Seed events skipped (real scrapers active)')

    # 2. Ticketmaster (concerts, shows, major events — free API key)
    print('\n[2/5] Ticketmaster Discovery API...')
    try:
        from ticketmaster_scraper import run as tm_run
        tm_run()
    except Exception as e:
        print(f'  Ticketmaster error: {e}')

    # 3. Eventbrite (community events, arts, tech — web scraping)
    print('\n[3/5] Eventbrite...')
    try:
        from eventbrite_scraper import run as eb_run
        eb_run()
    except Exception as e:
        print(f'  Eventbrite error: {e}')

    # 4. Meetup
    print('\n[4/5] Meetup.com...')
    try:
        from meetup_scraper import run as meetup_run
        meetup_run()
    except Exception as e:
        print(f'  Meetup error: {e}')

    # 5. Venue websites (requires Playwright/Chromium)
    if no_browser:
        print('\n[5/5] Venue websites skipped (--no-browser)')
    else:
        print('\n[5/5] London venue websites...')
        try:
            from london_venues_scraper import run as venue_run
            venue_run()
        except Exception as e:
            print(f'  Venue scraper error: {e}')

    print('\n' + '=' * 55)
    print('  Pipeline complete.')
    print('  Run again weekly to keep events fresh.')
    print('=' * 55)


if __name__ == '__main__':
    main()
