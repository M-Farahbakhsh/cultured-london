"""
Master scraper runner. Run this to populate the events database.
Usage: python scrapers/run_all.py [--seed-only] [--no-browser]

Options:
  --seed-only    Only insert the curated seed events (fastest, good for dev)
  --no-browser   Skip the venue scraper (which needs Playwright/Chromium)
  (no flag)      Run all scrapers: seed + Eventbrite + Meetup + venues
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

def main():
    seed_only = '--seed-only' in sys.argv
    no_browser = '--no-browser' in sys.argv

    print('=' * 55)
    print('  Cultured London — Event Data Pipeline')
    print('=' * 55)

    # 1. Always run seed data (curated events)
    print('\n[1/4] Loading curated seed events...')
    try:
        from seed_data import run as seed_run
        seed_run()
    except Exception as e:
        print(f'  Seed error: {e}')

    if seed_only:
        print('\n--seed-only flag set. Done.')
        return

    # 2. Eventbrite (needs API key)
    print('\n[2/4] Eventbrite API...')
    try:
        from eventbrite_scraper import run as eb_run
        eb_run()
    except Exception as e:
        print(f'  Eventbrite error: {e}')

    # 3. Meetup
    print('\n[3/4] Meetup.com...')
    try:
        from meetup_scraper import run as meetup_run
        meetup_run()
    except Exception as e:
        print(f'  Meetup error: {e}')

    # 4. Venue websites (requires Playwright/Chromium)
    if no_browser:
        print('\n[4/4] Venue websites skipped (--no-browser)')
    else:
        print('\n[4/4] London venue websites...')
        try:
            from london_venues_scraper import run as venue_run
            venue_run()
        except Exception as e:
            print(f'  Venue scraper error: {e}')

    print('\n' + '=' * 55)
    print('  Pipeline complete.')
    print('  Run again daily to keep events fresh.')
    print('=' * 55)


if __name__ == '__main__':
    main()
