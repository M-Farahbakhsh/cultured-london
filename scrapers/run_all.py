"""
Master scraper runner. Run this to populate the events database.
Usage: python scrapers/run_all.py [--seed-only] [--no-browser]

Options:
  --seed-only    Only insert the curated seed events (fastest, good for dev)
  --no-browser   Skip the venue scraper (which needs Playwright/Chromium)
  (no flag)      Run all scrapers: Ticketmaster + Eventbrite + Luma + Skiddle + Songkick + Meetup + venues
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))


def _remove_non_uk_events():
    """Delete any stored events whose coordinates fall outside the UK bounding box."""
    from dotenv import load_dotenv
    from supabase import create_client
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))
    sb = create_client(
        os.environ['NEXT_PUBLIC_SUPABASE_URL'],
        os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    )
    # UK eastern boundary ~1.8°E; Frankfurt sits at ~8.7°E — safe filter
    result = sb.table('events').delete().gt('lng', 1.8).execute()
    removed = len(result.data or [])
    if removed:
        print(f'  Removed {removed} non-UK events (lng > 1.8)')
    else:
        print('  No non-UK events found')

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

    print('\n[cleanup] Removing any non-UK events...')
    try:
        _remove_non_uk_events()
    except Exception as e:
        print(f'  Cleanup error: {e}')

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
    print('\n[5/7] Skiddle...')
    try:
        from skiddle_scraper import run as skiddle_run
        skiddle_run()
    except Exception as e:
        print(f'  Skiddle error: {e}')

    # 6. Songkick (London concerts and live music — no key needed)
    print('\n[6/8] Songkick...')
    try:
        from songkick_scraper import run as sk_run
        sk_run()
    except Exception as e:
        print(f'  Songkick error: {e}')

    # 7. London Startup Guide (community Luma calendars + conferences)
    print('\n[7/11] London Startup Guide community calendars + conferences...')
    try:
        from london_startup_guide_scraper import run as lsg_run
        lsg_run()
    except Exception as e:
        print(f'  London Startup Guide error: {e}')

    # 8. London Calling (curated London tech events aggregator)
    print('\n[8/11] London Calling...')
    try:
        from london_calling_scraper import run as lc_run
        lc_run()
    except Exception as e:
        print(f'  London Calling error: {e}')

    # 9. Unicorn Mafia (London startup community events)
    print('\n[9/11] Unicorn Mafia...')
    try:
        from unicorn_mafia_scraper import run as um_run
        um_run()
    except Exception as e:
        print(f'  Unicorn Mafia error: {e}')

    # 10. Meetup
    print('\n[10/11] Meetup.com...')
    try:
        from meetup_scraper import run as meetup_run
        meetup_run()
    except Exception as e:
        print(f'  Meetup error: {e}')

    # 11. Venue websites (requires Playwright/Chromium)
    if no_browser:
        print('\n[11/11] Venue websites skipped (--no-browser)')
    else:
        print('\n[11/11] London venue websites...')
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
