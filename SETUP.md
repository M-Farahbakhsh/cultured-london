# Cultured London — Setup Guide

## What you have

A complete Next.js web app for discovering London events matched to your taste. Every file has been written and TypeScript-checked clean. You need to do 3 things to run it:

---

## Step 1 — Create a Supabase project (10 minutes)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New project** — call it `cultured-london`, choose the EU (London) region
3. Once it's ready, go to **Settings → API** and copy:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Go to **SQL Editor** and paste the entire contents of `supabase/schema.sql`, then click **Run**
   - This creates all tables, security rules, and indexes

---

## Step 2 — Add environment variables

Copy `.env.local.example` to `.env.local`:
```
cp .env.local.example .env.local
```
Fill in your Supabase URL and key. The other API keys (Eventbrite, Ticketmaster) are optional for now.

---

## Step 3 — Run the app

```bash
npm install          # already done if you're reading this
npm run dev          # starts the app at http://localhost:3000
```

---

## Step 4 — Populate events (seed data)

The app needs events in the database. To add 30 hand-picked London events immediately:

```bash
pip install -r scrapers/requirements.txt
python scrapers/run_all.py --seed-only
```

This inserts events like:
- Brian Eno at Barbican
- Zadie Smith at the British Library
- Tarkovsky at BFI
- Ted Chiang at Foyles
- AI safety meetup at DeepMind
- (27 more across all categories)

To run the full scrapers (adds hundreds more from Eventbrite, Meetup, venues):
```bash
python scrapers/run_all.py
```

---

## Pages in the app

| URL | What it does |
|---|---|
| `/` | Sign in / sign up |
| `/explore` | Browse all London events with filters |
| `/events/[id]` | Full event detail + save button |
| `/onboarding` | Set up your taste profile (artists, authors, topics) |
| `/saved` | Your saved event directory |
| `/past-events` | Log events you've attended, mark enjoyed/not |
| `/profile` | View and edit your interests |
| `/friends` | My friends, discover similar people, manage requests |

---

## Costs (long-term estimate)

| Service | Free tier | Paid starts at |
|---|---|---|
| **Supabase** | 500MB database, 2GB transfer/month, 50K auth users | $25/month |
| **Vercel** (hosting) | 100GB bandwidth, unlimited deploys | $20/month |
| **Eventbrite API** | 1,000 calls/day | Free for discovery use |
| **Ticketmaster API** | 5,000 calls/day | Free |
| **Meetup API** | Limited free tier | ~$99/month for full access |
| **MusicBrainz** | Fully free, open data | — |
| **OpenLibrary** | Fully free, open data | — |

**For development and early users (0–500 people):** ~£0/month  
**For a real small product (1,000–5,000 users):** ~£40–60/month  
**For a grown product (10,000+ users):** £150–300/month depending on traffic

The main cost driver at scale is database reads (events loaded on explore page). Adding caching with Redis (~£15/month) would keep Supabase costs low much longer.

---

## What to build next (v2 ideas)

1. **Connect Spotify** — one OAuth flow gives you artist graph immediately
2. **Email/push notifications** — "3 events this week for you"
3. **Better matching** — use OpenAI embeddings for semantic event-interest matching
4. **Ticket links** — affiliate links to Eventbrite/Ticketmaster
5. **Recurring scraper** — run `run_all.py` on a daily cron job (Railway.app or Render.com, ~£5/month)
