-- ============================================================
-- Cultured London — Database Schema
-- Run this in your Supabase SQL editor to set up the database
-- ============================================================

-- Extend the built-in Supabase auth.users with public profile data
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  bio         TEXT,
  is_public   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- All London events (populated by scrapers)
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  start_datetime  TIMESTAMPTZ NOT NULL,
  end_datetime    TIMESTAMPTZ,
  venue_name      TEXT,
  venue_address   TEXT,
  area            TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  categories      TEXT[] DEFAULT '{}',
  tags            TEXT[] DEFAULT '{}',
  people          TEXT[] DEFAULT '{}',
  image_url       TEXT,
  event_url       TEXT,
  source          TEXT NOT NULL,
  source_id       TEXT,
  price_min       NUMERIC(10,2),
  price_max       NUMERIC(10,2),
  is_free         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, source_id)
);

-- User interest graph: artists, authors, topics, people, venues
CREATE TABLE IF NOT EXISTS interests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('artist','author','person','topic','venue','genre')),
  name        TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, type, name)
);

-- Events the user has saved to their directory
CREATE TABLE IF NOT EXISTS saved_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);

-- Events the user has attended (past events log)
CREATE TABLE IF NOT EXISTS attended_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  -- If event isn't in our database, store manually entered details
  manual_title    TEXT,
  manual_venue    TEXT,
  manual_date     DATE,
  enjoyed         BOOLEAN,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Friend connections between users
CREATE TABLE IF NOT EXISTS friendships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  addressee_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE interests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attended_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships    ENABLE ROW LEVEL SECURITY;

-- Profiles: public profiles readable by all, own profile editable by owner
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (is_public = true OR auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Events: fully public (no RLS needed, or allow all reads)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events are public" ON events FOR SELECT USING (true);
CREATE POLICY "Service role can manage events" ON events
  FOR ALL USING (auth.role() = 'service_role');

-- Interests: own only
CREATE POLICY "Users manage own interests"
  ON interests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public interests viewable"
  ON interests FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND is_public = true)
    OR auth.uid() = user_id
  );

-- Saved events: own only
CREATE POLICY "Users manage own saved events"
  ON saved_events FOR ALL USING (auth.uid() = user_id);

-- Attended events: own only (with option to view friend's if public)
CREATE POLICY "Users manage own attended events"
  ON attended_events FOR ALL USING (auth.uid() = user_id);

-- Friendships: users can see their own connections
CREATE POLICY "Users see own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users can send friend requests"
  ON friendships FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Addressee can update (accept/decline)"
  ON friendships FOR UPDATE USING (auth.uid() = addressee_id);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 4)
    ),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_events_start        ON events (start_datetime);
CREATE INDEX IF NOT EXISTS idx_events_categories   ON events USING gin (categories);
CREATE INDEX IF NOT EXISTS idx_events_people       ON events USING gin (people);
CREATE INDEX IF NOT EXISTS idx_events_tags         ON events USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_interests_user      ON interests (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_user          ON saved_events (user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_users   ON friendships (requester_id, addressee_id);
