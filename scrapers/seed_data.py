"""
Seed realistic London events into Supabase for development.
Run: python scrapers/seed_data.py
"""
import os, sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
key = os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if not url or not key:
    sys.exit('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')

sb = create_client(url, key)

def d(days: int, hour: int = 19, minute: int = 30) -> str:
    dt = datetime.now() + timedelta(days=days)
    return dt.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()

EVENTS = [
    # ── MUSIC ─────────────────────────────────────────────────────────────
    {
        'title': 'Brian Eno: Ambient Music in the Age of AI',
        'description': 'A rare evening conversation with Brian Eno exploring generative music, artificial intelligence, and the future of creativity. Moderated by Will Self. One of the most influential figures in modern music discusses how AI is transforming composition.',
        'start_datetime': d(5), 'end_datetime': d(5, 21, 30),
        'venue_name': 'Barbican Centre', 'venue_address': 'Silk St, London EC2Y 8DS', 'area': 'City',
        'categories': ['music', 'talk'], 'tags': ['ambient', 'AI', 'generative music', 'electronic', 'creativity'],
        'people': ['Brian Eno', 'Will Self'], 'is_free': False, 'price_min': 18.0, 'price_max': 30.0,
        'event_url': 'https://www.barbican.org.uk', 'source': 'seed', 'source_id': 'seed-001',
    },
    {
        'title': 'Floating Points: Live at Fabric',
        'description': 'Sam Shepherd (Floating Points) plays a rare live electronic set in the legendary Room 1 at Fabric. Expect his signature fusion of jazz, house, and electronic exploration.',
        'start_datetime': d(3, 22, 0), 'end_datetime': d(4, 5, 0),
        'venue_name': 'Fabric', 'venue_address': '77a Charterhouse St, London EC1M 6HJ', 'area': 'Farringdon',
        'categories': ['music'], 'tags': ['electronic', 'jazz', 'house', 'club night'],
        'people': ['Floating Points'], 'is_free': False, 'price_min': 20.0, 'price_max': 25.0,
        'event_url': 'https://www.fabriclondon.com', 'source': 'seed', 'source_id': 'seed-002',
    },
    {
        'title': 'London Symphony Orchestra: Mahler Symphony No. 9',
        'description': 'Sir Simon Rattle conducts the LSO in a landmark performance of Mahler\'s final completed symphony — a profound meditation on life, memory, and mortality.',
        'start_datetime': d(8, 19, 30),
        'venue_name': 'Barbican Centre', 'venue_address': 'Silk St, London EC2Y 8DS', 'area': 'City',
        'categories': ['music'], 'tags': ['classical', 'orchestral', 'Mahler', 'symphony'],
        'people': ['Simon Rattle', 'London Symphony Orchestra'], 'is_free': False, 'price_min': 22.0, 'price_max': 65.0,
        'event_url': 'https://www.barbican.org.uk', 'source': 'seed', 'source_id': 'seed-003',
    },
    {
        'title': 'Caroline Polachek: New Album Tour',
        'description': 'Caroline Polachek brings her critically acclaimed avant-pop to Brixton Academy. Known for her ethereal vocals and genre-defying compositions.',
        'start_datetime': d(12, 19, 0),
        'venue_name': 'O2 Academy Brixton', 'venue_address': '211 Stockwell Rd, London SW9 9SL', 'area': 'Brixton',
        'categories': ['music'], 'tags': ['pop', 'avant-pop', 'indie', 'live music'],
        'people': ['Caroline Polachek'], 'is_free': False, 'price_min': 30.0, 'price_max': 40.0,
        'event_url': 'https://www.academymusicgroup.com', 'source': 'seed', 'source_id': 'seed-004',
    },
    {
        'title': 'Free Jazz Afternoon: New Directions in Improvisation',
        'description': 'An afternoon of experimental jazz featuring three emerging London-based ensembles pushing the boundaries of improvisation and collective composition. Free entry.',
        'start_datetime': d(2, 15, 0), 'end_datetime': d(2, 18, 0),
        'venue_name': 'Café OTO', 'venue_address': '18-22 Ashwin St, London E8 3DL', 'area': 'Dalston',
        'categories': ['music'], 'tags': ['jazz', 'free jazz', 'improvisation', 'experimental'],
        'people': [], 'is_free': True, 'price_min': 0.0,
        'event_url': 'https://www.cafeoto.co.uk', 'source': 'seed', 'source_id': 'seed-005',
    },
    # ── ART ───────────────────────────────────────────────────────────────
    {
        'title': 'Digital Wilderness — AI-Generated Ecologies',
        'description': 'A major new exhibition at Serpentine exploring how artists are using machine learning and generative AI to imagine alternative ecosystems. Features works by Refik Anadol, Holly Herndon, and three emerging artists.',
        'start_datetime': d(1, 10, 0), 'end_datetime': d(90, 18, 0),
        'venue_name': 'Serpentine Gallery', 'venue_address': 'Kensington Gardens, London W2 3XA', 'area': 'Kensington',
        'categories': ['art', 'exhibition'], 'tags': ['AI art', 'generative', 'ecology', 'digital', 'machine learning'],
        'people': ['Refik Anadol', 'Holly Herndon'], 'is_free': True, 'price_min': 0.0,
        'event_url': 'https://www.serpentinegalleries.org', 'source': 'seed', 'source_id': 'seed-006',
    },
    {
        'title': 'Zanele Muholi: Eye Me',
        'description': 'A major retrospective of South African visual activist Zanele Muholi at Tate Modern — 260 works spanning portraiture, landscapes, and still life exploring race, gender, and sexuality.',
        'start_datetime': d(1, 10, 0), 'end_datetime': d(60, 18, 0),
        'venue_name': 'Tate Modern', 'venue_address': 'Bankside, London SE1 9TG', 'area': 'South Bank',
        'categories': ['art', 'exhibition'], 'tags': ['photography', 'portraiture', 'activism', 'queer', 'Africa'],
        'people': ['Zanele Muholi'], 'is_free': False, 'price_min': 18.0,
        'event_url': 'https://www.tate.org.uk', 'source': 'seed', 'source_id': 'seed-007',
    },
    {
        'title': 'Hackney Wick Open Studios Weekend',
        'description': 'Over 200 artists open their studios across the Hackney Wick and Fish Island creative quarter. Free to attend — one of London\'s best annual art events.',
        'start_datetime': d(6, 11, 0), 'end_datetime': d(7, 18, 0),
        'venue_name': 'Hackney Wick', 'venue_address': 'Hackney Wick, London E9', 'area': 'Hackney Wick',
        'categories': ['art', 'exhibition'], 'tags': ['open studios', 'painting', 'sculpture', 'installation'],
        'people': [], 'is_free': True,
        'event_url': 'https://www.hwickos.com', 'source': 'seed', 'source_id': 'seed-008',
    },
    {
        'title': 'Mycelium Network: A Living Archive',
        'description': 'An immersive sound and light installation at ICA exploring the intelligence of forest networks. The artist has created a data sculpture from 10 years of mycelium research, translating fungal communication into generative sound.',
        'start_datetime': d(1, 11, 0), 'end_datetime': d(45, 18, 0),
        'venue_name': 'ICA', 'venue_address': 'The Mall, London SW1Y 5AH', 'area': 'Westminster',
        'categories': ['art', 'exhibition'], 'tags': ['installation', 'sound art', 'mycology', 'ecology', 'generative'],
        'people': [], 'is_free': False, 'price_min': 8.0,
        'event_url': 'https://www.ica.art', 'source': 'seed', 'source_id': 'seed-009',
    },
    # ── TALKS ─────────────────────────────────────────────────────────────
    {
        'title': 'Zadie Smith in Conversation: The New Novel',
        'description': 'Zadie Smith discusses her long-awaited new novel with journalist Nesrine Malik. An intimate evening exploring fiction, politics, and what it means to write in 2026.',
        'start_datetime': d(4, 19, 0),
        'venue_name': 'British Library', 'venue_address': '96 Euston Rd, London NW1 2DB', 'area': 'Kings Cross',
        'categories': ['talk', 'literature'], 'tags': ['fiction', 'writing', 'contemporary literature', 'politics'],
        'people': ['Zadie Smith', 'Nesrine Malik'], 'is_free': False, 'price_min': 12.0,
        'event_url': 'https://www.bl.uk', 'source': 'seed', 'source_id': 'seed-010',
    },
    {
        'title': 'Yuval Noah Harari: AI and the Future of Human Consciousness',
        'description': 'Yuval Noah Harari returns to London for a major talk on how AI is reshaping human cognition, democracy, and meaning-making — drawing on his forthcoming book.',
        'start_datetime': d(9, 19, 30),
        'venue_name': 'Royal Festival Hall', 'venue_address': 'Belvedere Rd, London SE1 8XX', 'area': 'South Bank',
        'categories': ['talk'], 'tags': ['AI', 'consciousness', 'history', 'future', 'philosophy'],
        'people': ['Yuval Noah Harari'], 'is_free': False, 'price_min': 25.0, 'price_max': 40.0,
        'event_url': 'https://www.southbankcentre.co.uk', 'source': 'seed', 'source_id': 'seed-011',
    },
    {
        'title': 'Robin Wall Kimmerer: Braiding Sweetgrass Live',
        'description': 'Robin Wall Kimmerer, botanist and Potawatomi scholar, in conversation about plant intelligence, indigenous wisdom, and what science can learn from other ways of knowing.',
        'start_datetime': d(11, 19, 0),
        'venue_name': 'Southbank Centre', 'venue_address': 'Belvedere Rd, London SE1 8XX', 'area': 'South Bank',
        'categories': ['talk'], 'tags': ['ecology', 'botany', 'indigenous knowledge', 'nature', 'philosophy'],
        'people': ['Robin Wall Kimmerer'], 'is_free': False, 'price_min': 20.0,
        'event_url': 'https://www.southbankcentre.co.uk', 'source': 'seed', 'source_id': 'seed-012',
    },
    {
        'title': 'Adam Curtis: New Documentary Preview + Q&A',
        'description': 'ICA screens the first 45 minutes of Adam Curtis\'s new documentary series, followed by a rare extended Q&A with the filmmaker about power, narrative, and the modern world.',
        'start_datetime': d(7, 19, 0),
        'venue_name': 'ICA Cinema', 'venue_address': 'The Mall, London SW1Y 5AH', 'area': 'Westminster',
        'categories': ['film', 'talk'], 'tags': ['documentary', 'politics', 'media', 'BBC', 'Q&A'],
        'people': ['Adam Curtis'], 'is_free': False, 'price_min': 14.0,
        'event_url': 'https://www.ica.art', 'source': 'seed', 'source_id': 'seed-013',
    },
    {
        'title': 'Kate Crawford: AI Atlas — Power and Planetary Cost',
        'description': 'AI researcher Kate Crawford presents new findings on the environmental and political costs of AI infrastructure, drawing from her Atlas of AI research.',
        'start_datetime': d(14, 18, 30),
        'venue_name': 'LSE Old Theatre', 'venue_address': 'Houghton St, London WC2A 2AE', 'area': 'Strand',
        'categories': ['talk', 'tech'], 'tags': ['AI', 'climate', 'tech ethics', 'data centres', 'politics'],
        'people': ['Kate Crawford'], 'is_free': True,
        'event_url': 'https://www.lse.ac.uk/Events', 'source': 'seed', 'source_id': 'seed-014',
    },
    {
        'title': 'Intelligence Squared: Does Consciousness Exist Outside the Brain?',
        'description': 'Leading neuroscientists and philosophers debate one of the hardest questions in science. With Anil Seth, Philip Goff, and Annaka Harris. Chaired by James Harding.',
        'start_datetime': d(10, 19, 0),
        'venue_name': 'Emmanuel Centre', 'venue_address': '9-23 Marsham St, London SW1P 3DW', 'area': 'Westminster',
        'categories': ['talk'], 'tags': ['consciousness', 'neuroscience', 'philosophy', 'debate'],
        'people': ['Anil Seth', 'Philip Goff', 'Annaka Harris'], 'is_free': False, 'price_min': 22.0,
        'event_url': 'https://www.intelligencesquared.com', 'source': 'seed', 'source_id': 'seed-015',
    },
    # ── FILM ─────────────────────────────────────────────────────────────
    {
        'title': 'Tarkovsky Season: Stalker (1979) — 4K Restoration',
        'description': 'BFI screens the landmark 4K restoration of Andrei Tarkovsky\'s Stalker. New introductory essay by geophysicist and Tarkovsky scholar Robert Macfarlane.',
        'start_datetime': d(2, 20, 0),
        'venue_name': 'BFI Southbank', 'venue_address': 'Belvedere Rd, London SE1 8XT', 'area': 'South Bank',
        'categories': ['film'], 'tags': ['Tarkovsky', 'Soviet cinema', 'sci-fi', 'restoration', 'classic'],
        'people': ['Andrei Tarkovsky', 'Robert Macfarlane'], 'is_free': False, 'price_min': 12.50, 'price_max': 16.50,
        'event_url': 'https://www.bfi.org.uk', 'source': 'seed', 'source_id': 'seed-016',
    },
    {
        'title': 'Agnès Varda: Cléo from 5 to 7 — Restored Print',
        'description': 'BFI screens the newly restored print of Agnès Varda\'s masterpiece of the French New Wave — a real-time portrait of a woman awaiting medical results in 1960s Paris.',
        'start_datetime': d(4, 18, 30),
        'venue_name': 'BFI Southbank', 'venue_address': 'Belvedere Rd, London SE1 8XT', 'area': 'South Bank',
        'categories': ['film'], 'tags': ['French New Wave', 'Varda', 'classic cinema', 'feminism'],
        'people': ['Agnès Varda'], 'is_free': False, 'price_min': 12.50,
        'event_url': 'https://www.bfi.org.uk', 'source': 'seed', 'source_id': 'seed-017',
    },
    {
        'title': 'Werner Herzog in Conversation',
        'description': 'An evening with Werner Herzog at Curzon Mayfair — the legendary filmmaker discusses his career, creative process, and new projects. Tickets include a drink.',
        'start_datetime': d(15, 19, 0),
        'venue_name': 'Curzon Mayfair', 'venue_address': '38 Curzon St, London W1J 7TY', 'area': 'Mayfair',
        'categories': ['film', 'talk'], 'tags': ['documentary', 'cinema', 'Herzog', 'conversation'],
        'people': ['Werner Herzog'], 'is_free': False, 'price_min': 28.0,
        'event_url': 'https://www.curzon.com', 'source': 'seed', 'source_id': 'seed-018',
    },
    # ── TECH / AI ─────────────────────────────────────────────────────────
    {
        'title': 'London AI Safety Research Meetup',
        'description': 'Monthly gathering of AI safety researchers, engineers, and policy people. This month\'s speaker presents work on interpretability in large language models. Open to all.',
        'start_datetime': d(3, 18, 30),
        'venue_name': 'Google DeepMind London', 'venue_address': '6 Pancras Square, London N1C 4AG', 'area': 'Kings Cross',
        'categories': ['tech', 'talk'], 'tags': ['AI safety', 'alignment', 'interpretability', 'machine learning'],
        'people': [], 'is_free': True,
        'event_url': 'https://lu.ma/london-ai-safety', 'source': 'seed', 'source_id': 'seed-019',
    },
    {
        'title': 'AI & Creativity: Can Machines Be Artists?',
        'description': 'Somerset House hosts a panel discussion with AI artists, researchers, and critics exploring whether generative AI creates or merely remixes — and what this means for human creativity.',
        'start_datetime': d(6, 18, 0),
        'venue_name': 'Somerset House', 'venue_address': 'Strand, London WC2R 1LA', 'area': 'Strand',
        'categories': ['tech', 'talk', 'art'], 'tags': ['AI', 'creativity', 'generative art', 'ethics', 'future'],
        'people': [], 'is_free': False, 'price_min': 15.0,
        'event_url': 'https://www.somersethouse.org.uk', 'source': 'seed', 'source_id': 'seed-020',
    },
    {
        'title': 'React London: Advanced Patterns & Server Components',
        'description': 'Monthly React London meetup. This month: deep dive into React Server Components, Server Actions, and the future of the React model with core team member.',
        'start_datetime': d(5, 18, 0),
        'venue_name': 'Skills Matter', 'venue_address': '10 South Place, London EC2M 2RB', 'area': 'Moorgate',
        'categories': ['tech'], 'tags': ['React', 'JavaScript', 'frontend', 'web development'],
        'people': [], 'is_free': True,
        'event_url': 'https://lu.ma/react-london', 'source': 'seed', 'source_id': 'seed-021',
    },
    # ── LITERATURE ────────────────────────────────────────────────────────
    {
        'title': 'Ted Chiang: Stories of Your Life — Discussion Evening',
        'description': 'An intimate evening with Ted Chiang, author of Stories of Your Life (the basis for the film Arrival). He reads from a new story and discusses AI, language, and what it means to be human.',
        'start_datetime': d(8, 19, 0),
        'venue_name': 'Foyles Bookshop', 'venue_address': '107 Charing Cross Rd, London WC2H 0DT', 'area': 'Soho',
        'categories': ['literature', 'talk'], 'tags': ['science fiction', 'short stories', 'AI', 'language', 'Ted Chiang'],
        'people': ['Ted Chiang'], 'is_free': False, 'price_min': 10.0,
        'event_url': 'https://www.foyles.co.uk/events', 'source': 'seed', 'source_id': 'seed-022',
    },
    {
        'title': 'N.K. Jemisin: The World We Make — Book Launch',
        'description': 'Hugo Award-winning author N.K. Jemisin launches her new novel at Waterstones Piccadilly. She will be in conversation with Ursula K. Le Guin scholar discussing Afrofuturism and speculative world-building.',
        'start_datetime': d(10, 18, 30),
        'venue_name': 'Waterstones Piccadilly', 'venue_address': '203-206 Piccadilly, London W1J 9HD', 'area': 'Piccadilly',
        'categories': ['literature', 'talk'], 'tags': ['science fiction', 'Afrofuturism', 'book launch', 'fantasy'],
        'people': ['N.K. Jemisin'], 'is_free': False, 'price_min': 8.0,
        'event_url': 'https://www.waterstones.com/events', 'source': 'seed', 'source_id': 'seed-023',
    },
    {
        'title': 'Ocean Vuong: Poetry Reading',
        'description': 'LRB Bookshop hosts an intimate poetry reading with Ocean Vuong, followed by Q&A and book signing. Vuong reads from his celebrated collections and new unpublished work.',
        'start_datetime': d(13, 19, 0),
        'venue_name': 'LRB Bookshop', 'venue_address': '14 Bury Place, London WC1A 2JL', 'area': 'Bloomsbury',
        'categories': ['literature'], 'tags': ['poetry', 'reading', 'LGBTQ+', 'American literature'],
        'people': ['Ocean Vuong'], 'is_free': False, 'price_min': 12.0,
        'event_url': 'https://lrbshop.co.uk/events', 'source': 'seed', 'source_id': 'seed-024',
    },
    {
        'title': 'Olga Tokarczuk: New Novel — The Empusium',
        'description': 'Nobel Prize winner Olga Tokarczuk discusses her gothic novel The Empusium with translator Antonia Lloyd-Jones, exploring darkness, mythology, and the limits of rationalism.',
        'start_datetime': d(16, 19, 0),
        'venue_name': 'The Barbican Library', 'venue_address': 'Silk St, London EC2Y 8DS', 'area': 'City',
        'categories': ['literature', 'talk'], 'tags': ['Polish literature', 'gothic', 'Nobel Prize', 'translation', 'mythology'],
        'people': ['Olga Tokarczuk', 'Antonia Lloyd-Jones'], 'is_free': False, 'price_min': 10.0,
        'event_url': 'https://www.barbican.org.uk', 'source': 'seed', 'source_id': 'seed-025',
    },
    # ── THEATRE ───────────────────────────────────────────────────────────
    {
        'title': 'Tanztheater Wuppertal Pina Bausch: Café Müller',
        'description': 'The legendary Tanztheater Wuppertal brings Pina Bausch\'s haunting masterpiece Café Müller to Sadler\'s Wells. One of the most important works in 20th-century dance.',
        'start_datetime': d(7, 19, 30),
        'venue_name': "Sadler's Wells", 'venue_address': 'Rosebery Ave, London EC1R 4TN', 'area': 'Islington',
        'categories': ['theatre'], 'tags': ['dance', 'contemporary dance', 'Pina Bausch', 'theatre'],
        'people': ['Pina Bausch'], 'is_free': False, 'price_min': 25.0, 'price_max': 65.0,
        'event_url': 'https://www.sadlerswells.com', 'source': 'seed', 'source_id': 'seed-026',
    },
    {
        'title': 'New Writing Night: Voices from the Margins',
        'description': 'Bush Theatre\'s monthly new writing showcase — five short plays by emerging playwrights, each under 20 minutes. Cheap tickets and a free drink on arrival.',
        'start_datetime': d(4, 19, 30),
        'venue_name': 'Bush Theatre', 'venue_address': '7 Uxbridge Rd, London W12 8LJ', 'area': 'Shepherd\'s Bush',
        'categories': ['theatre'], 'tags': ['new writing', 'emerging playwrights', 'short plays'],
        'people': [], 'is_free': False, 'price_min': 8.0,
        'event_url': 'https://www.bushtheatre.co.uk', 'source': 'seed', 'source_id': 'seed-027',
    },
    # ── COMEDY ───────────────────────────────────────────────────────────
    {
        'title': 'Nish Kumar: My Favourite Shapes — Live',
        'description': 'Nish Kumar brings his acclaimed stand-up show to Leicester Square Theatre. Political, personal, and very funny.',
        'start_datetime': d(9, 20, 0),
        'venue_name': 'Leicester Square Theatre', 'venue_address': '6 Leicester Place, London WC2H 7BX', 'area': 'West End',
        'categories': ['comedy'], 'tags': ['stand-up', 'political comedy', 'live comedy'],
        'people': ['Nish Kumar'], 'is_free': False, 'price_min': 20.0,
        'event_url': 'https://www.leicestersquaretheatre.com', 'source': 'seed', 'source_id': 'seed-028',
    },
    # ── MIXED ────────────────────────────────────────────────────────────
    {
        'title': 'Jon Hopkins Live Score to Koyaanisqatsi',
        'description': 'Jon Hopkins performs a live electronic score to Godfrey Reggio\'s landmark 1982 film Koyaanisqatsi — an immersive evening of music, image, and meditation on industrial civilisation.',
        'start_datetime': d(18, 19, 30),
        'venue_name': 'Royal Festival Hall', 'venue_address': 'Belvedere Rd, London SE1 8XX', 'area': 'South Bank',
        'categories': ['music', 'film'], 'tags': ['electronic', 'live score', 'film', 'ambient', 'Jon Hopkins'],
        'people': ['Jon Hopkins'], 'is_free': False, 'price_min': 30.0, 'price_max': 55.0,
        'event_url': 'https://www.southbankcentre.co.uk', 'source': 'seed', 'source_id': 'seed-029',
    },
    {
        'title': 'Ursula K. Le Guin Reading Circle: The Dispossessed',
        'description': 'Monthly Le Guin reading circle discussing The Dispossessed — her anarchist utopia and critique of capitalism. All welcome. Free, just turn up.',
        'start_datetime': d(6, 18, 30),
        'venue_name': 'Housmans Bookshop', 'venue_address': '5 Caledonian Rd, London N1 9DX', 'area': 'Kings Cross',
        'categories': ['literature'], 'tags': ['science fiction', 'Le Guin', 'anarchism', 'book club', 'reading circle'],
        'people': [], 'is_free': True,
        'event_url': 'https://www.housmans.com', 'source': 'seed', 'source_id': 'seed-030',
    },
    {
        'title': 'Robert Macfarlane: Landmarks — Walking, Writing, Wilderness',
        'description': 'Robert Macfarlane in conversation about landscape, language, and the words we use to describe the natural world. Discussing his new walking essays and the relationship between writing and place.',
        'start_datetime': d(20, 19, 0),
        'venue_name': 'Royal Geographical Society', 'venue_address': '1 Kensington Gore, London SW7 2AR', 'area': 'Kensington',
        'categories': ['talk', 'literature'], 'tags': ['nature writing', 'landscape', 'wilderness', 'ecology', 'walking'],
        'people': ['Robert Macfarlane'], 'is_free': False, 'price_min': 15.0,
        'event_url': 'https://www.rgs.org', 'source': 'seed', 'source_id': 'seed-031',
    },
]

def run():
    print(f'Inserting {len(EVENTS)} seed events...')
    for i, ev in enumerate(EVENTS):
        try:
            sb.table('events').upsert(ev, on_conflict='source,source_id').execute()
            print(f'  [{i+1}/{len(EVENTS)}] ✓ {ev["title"][:60]}')
        except Exception as e:
            print(f'  [{i+1}/{len(EVENTS)}] ✗ {ev["title"][:60]} — {e}')
    print(f'\nDone. {len(EVENTS)} events seeded.')

if __name__ == '__main__':
    run()
