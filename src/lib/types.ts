export type Category =
  | 'music' | 'art' | 'talk' | 'film' | 'tech'
  | 'literature' | 'theatre' | 'comedy' | 'exhibition' | 'other'

export type InterestType = 'artist' | 'author' | 'person' | 'topic' | 'venue' | 'genre'

export interface Event {
  id: string
  title: string
  description: string | null
  start_datetime: string
  end_datetime: string | null
  venue_name: string | null
  venue_address: string | null
  area: string | null
  lat: number | null
  lng: number | null
  categories: Category[]
  tags: string[]
  people: string[]
  image_url: string | null
  event_url: string | null
  source: string
  price_min: number | null
  price_max: number | null
  is_free: boolean
  created_at: string
  // computed client-side
  match_score?: number
  match_reason?: string
  saved?: boolean
  save_count?: number
}

export interface Profile {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  is_public: boolean
  created_at: string
}

export interface Interest {
  id: string
  user_id: string
  type: InterestType
  name: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface SavedEvent {
  id: string
  user_id: string
  event_id: string
  saved_at: string
  event?: Event
}

export interface AttendedEvent {
  id: string
  user_id: string
  event_id: string | null
  manual_title: string | null
  manual_venue: string | null
  manual_date: string | null
  enjoyed: boolean | null
  notes: string | null
  created_at: string
  event?: Event
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  profile?: Profile
  shared_interest_count?: number
}

export interface SimilarProfile extends Profile {
  shared_interests: string[]
  overlap_score: number
}

export type DateFilter = 'all' | 'today' | 'this_week' | 'this_weekend' | 'this_month'

export interface EventFilters {
  category?: Category | 'all'
  date?: DateFilter
  free?: boolean
  search?: string
}
