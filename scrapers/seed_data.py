"""
Seed data — disabled. Real events come from the scrapers.
This file is kept so imports don't break but does nothing.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

sb = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
)

def run():
    """Remove any leftover seed/test events from the database."""
    try:
        result = sb.table('events').delete().eq('source', 'seed').execute()
        print('  Seed events cleared from database.')
    except Exception as e:
        print(f'  Could not clear seed events: {e}')

if __name__ == '__main__':
    run()
