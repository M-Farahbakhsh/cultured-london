"""
Master scraper runner. Run this to populate the events database.
Usage: python scrapers/run_all.py [--seed-only] [--no-browser]

Options:
  --seed-only    Only insert the curated seed events (fastest, good for dev)
  --no-browser   Skip the venue scraper (which needs Playwright/Chromium)
  (no flag)      Run all scrapers: Ticketmaster + Eventbrite + Luma + Skiddle + Meetup + venues
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

def main():
    seed_only = '--seed-only' in sys.argv
    no_browser = '--no-browser' in sys.argv

    print('=' * 55)
    print('  Cultured London — Event Data Pipeline')
    print('=' * 55)

    # 1. Seed data — always clear leftovers; optionally load curated seeds for dev
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
        print('\n[1/5] Clearing any leftover seed events...')
        try:
            from seed_data import run as seed_run
            seed_run()
        except Exception as e:
            print(f'  Seed clear error: {e}')

    # 2. Ticketmaster (concerts, shows, major events — free API key)
    print('\n[2/5] Ticketmaster Discovery API...')
    try:
        from ticketmaster_scraper import run as tm_run
        tm_run()
    except Exception as e:
        print(f'  Ticketmaster error: {e}')

    # 3. Eventbrite (community events, arts, tech — web scraping, 3 pages per category)
    print('\n[3/6] Eventbrite...')
    try:
        from eventbrite_scraper import run as eb_run
        eb_run()
    except Exception as e:
        print(f'  Eventbrite error: {e}')

    # 4. Luma (tech, AI, startup, community events — no key needed)
    print('\n[4/6] Luma...')
    try:
        from luma_scraper import run as luma_run
        luma_run()
    except Exception as e:
        print(f'  Luma error: {e}')

    # 5. Skiddle (UK music, club nights, comedy, theatre — free API key)
    print('\n[5/6] Skiddle...')
    try:
        from skiddle_scraper import run as skiddle_run
        skiddle_run()
    except Exception as e:
        print(f'  Skiddle error: {e}')

    # 6. Meetup
    print('\n[6/7] Meetup.com...')
    try:
        from meetup_scraper import run as meetup_run
        meetup_run()
    except Exception as e:
        print(f'  Meetup error: {e}')

    # 7. Venue websites (requires Playwright/Chromium)
    if no_browser:
        print('\n[7/7] Venue websites skipped (--no-browser)')
    else:
        print('\n[7/7] London venue websites...')
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
