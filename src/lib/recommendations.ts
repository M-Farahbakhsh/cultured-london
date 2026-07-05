import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category, Event } from './types'

// How much each signal contributes to a user's preference profile.
// Behavior (what they actually did) counts for more than a one-off save,
// and disliking something actively pushes similar events down.
const WEIGHTS = {
  interest: 3,
  enjoyedAttended: 3,
  saved: 1.5,
  notEnjoyedAttended: -2,
  dislikedSwipe: -2,
} as const

export interface PreferenceProfile {
  categoryScore: Partial<Record<Category, number>>
  termScore: Map<string, number>
  interestTerms: string[]
  hasSignal: boolean
  // Events swiped "nah" in the taste deck — hard-excluded from recommendations,
  // not just down-weighted, so the exact card never resurfaces.
  dislikedEventIds: Set<string>
  // Saved or enjoyed-attended — an explicit positive signal on the event
  // itself. Without this, an event with no categories/tags/people (common
  // for sparsely-tagged "Other" listings) contributes nothing when liked and
  // can never clear a score > 0 gate, even though the user directly said yes.
  likedEventIds: Set<string>
}

type EventSignal = { categories: Category[] | null; tags: string[] | null; people: string[] | null } | null

function addCategoryScore(profile: PreferenceProfile, categories: Category[] | null | undefined, weight: number) {
  for (const c of categories ?? []) {
    profile.categoryScore[c] = (profile.categoryScore[c] ?? 0) + weight
  }
}

function addTermScore(profile: PreferenceProfile, terms: (string[] | null | undefined)[], weight: number) {
  for (const list of terms) {
    for (const t of list ?? []) {
      const key = t.toLowerCase()
      profile.termScore.set(key, (profile.termScore.get(key) ?? 0) + weight)
    }
  }
}

export async function buildPreferenceProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<PreferenceProfile> {
  const profile: PreferenceProfile = {
    categoryScore: {},
    termScore: new Map(),
    interestTerms: [],
    hasSignal: false,
    dislikedEventIds: new Set(),
    likedEventIds: new Set(),
  }

  const [{ data: interests }, { data: saved }, { data: attended }, { data: disliked }] = await Promise.all([
    supabase.from('interests').select('name, type').eq('user_id', userId),
    supabase.from('saved_events').select('event_id, event:events(categories, tags, people)').eq('user_id', userId),
    supabase.from('attended_events').select('event_id, enjoyed, event:events(categories, tags, people)')
      .eq('user_id', userId).not('event_id', 'is', null),
    supabase.from('disliked_events').select('event_id, event:events(categories, tags, people)').eq('user_id', userId),
  ])

  const CATEGORY_NAMES = new Set<string>([
    'music', 'art', 'talk', 'film', 'tech', 'literature', 'theatre', 'comedy', 'exhibition', 'sports', 'other',
  ])
  for (const i of interests ?? []) {
    profile.hasSignal = true
    const lower = i.name.toLowerCase()
    // Genre picks from onboarding map directly onto event categories, so they
    // boost category scoring instead of going into free-text term matching.
    // They must NOT also join interestTerms: short genre words like "art",
    // "tech", or "talk" would then substring-match all kinds of unrelated
    // tags/people (biotech, TalkTalk, Bart...) via matchesInterest below.
    if (i.type === 'genre' && CATEGORY_NAMES.has(lower)) {
      profile.categoryScore[lower as Category] =
        (profile.categoryScore[lower as Category] ?? 0) + WEIGHTS.interest
    } else {
      profile.interestTerms.push(lower)
    }
  }

  for (const s of (saved ?? []) as unknown as { event_id: string; event: EventSignal }[]) {
    profile.hasSignal = true
    profile.likedEventIds.add(s.event_id)
    if (!s.event) continue
    addCategoryScore(profile, s.event.categories, WEIGHTS.saved)
    addTermScore(profile, [s.event.tags, s.event.people], WEIGHTS.saved)
  }

  for (const a of (attended ?? []) as unknown as { event_id: string; enjoyed: boolean | null; event: EventSignal }[]) {
    profile.hasSignal = true
    const weight = a.enjoyed === false ? WEIGHTS.notEnjoyedAttended : WEIGHTS.enjoyedAttended
    if (a.enjoyed !== false) profile.likedEventIds.add(a.event_id)
    if (!a.event) continue
    addCategoryScore(profile, a.event.categories, weight)
    addTermScore(profile, [a.event.tags, a.event.people], weight)
  }

  for (const d of (disliked ?? []) as unknown as { event_id: string; event: EventSignal }[]) {
    profile.hasSignal = true
    profile.dislikedEventIds.add(d.event_id)
    if (!d.event) continue
    addCategoryScore(profile, d.event.categories, WEIGHTS.dislikedSwipe)
    addTermScore(profile, [d.event.tags, d.event.people], WEIGHTS.dislikedSwipe)
  }

  return profile
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Raw `.includes()` here used to mean a short topic interest like "ai" would
// match "chair", "detail", "maintain", "captain" — any tag/person containing
// those letters in sequence, anywhere. Word-boundary matching means "ai"
// only matches when it (or the candidate) appears as a whole word/phrase.
function matchesInterest(term: string, interestTerms: string[]): string | null {
  const lower = term.toLowerCase().trim()
  return interestTerms.find(i => {
    if (lower === i) return true
    if (new RegExp(`\\b${escapeRegExp(i)}\\b`).test(lower)) return true
    if (new RegExp(`\\b${escapeRegExp(lower)}\\b`).test(i)) return true
    return false
  }) ?? null
}

// Naming the exact tag/person that drove a match ("Because you like Jai Khurmi")
// reads as uncannily specific when it's really just a loose substring hit against
// scraped event metadata — nobody remembers "liking" a name they never chose. These
// stay generic and vibey instead, keeping the personalization feel without the
// false precision. Picked deterministically per event so a reload doesn't flicker
// between phrasings for the same card.
const CATEGORY_VIBE_REASONS = [
  (cat: string) => `${cat} · matches your taste`,
  (cat: string) => `${cat} · picked for your feed`,
  (cat: string) => `${cat} · your kind of night`,
  (cat: string) => `${cat} · no black box, just taste`,
  (cat: string) => `${cat} · your algorithm said yes`,
  (cat: string) => `${cat} · main character energy`,
  (cat: string) => `${cat} · low-key made for you`,
  (cat: string) => `${cat} · this one's giving you`,
  (cat: string) => `${cat} · basically your love language`,
  (cat: string) => `${cat} · you'd tap yes on this`,
]

const GENERIC_VIBE_REASONS = [
  'matches your taste, no cap',
  'picked just for you',
  'your feed said yes to this one',
  'quietly your vibe',
  'main character energy, honestly',
  'zero scroll, straight to yes',
  "this one's kind of a callback",
  'basically tailor-made',
  'your taste, no notes',
  'low-key perfect for you',
]

function pickReason<T>(pool: T[], seed: string): T {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return pool[Math.abs(hash) % pool.length]
}

// A dislike shouldn't erase the event everywhere — it should just stop
// being *recommended*. This is subtracted on top of normal scoring so a
// disliked event reliably drops out of "picked for you" filters (score > 0)
// and sorts to the bottom wherever results are ranked by score, while still
// appearing in a plain browse/search — just quietly, with no "for you" tag.
const DISLIKED_EVENT_PENALTY = 100

// A save/enjoyed-attend is a direct signal about *this* event, not just a
// vote for its categories/tags. Sparsely-tagged events (no categories, no
// people, no tags — common for the generic "Other" bucket) would otherwise
// score exactly 0 when liked and never get a reason or clear a `score > 0`
// recommendation filter, despite the user explicitly saying yes.
const EXPLICIT_LIKE_BONUS = 5

export function scoreEvent(event: Event, profile: PreferenceProfile): { score: number; reason: string | null } {
  const disliked = profile.dislikedEventIds.has(event.id)
  const explicitlyLiked = !disliked && profile.likedEventIds.has(event.id)

  let score = explicitlyLiked ? EXPLICIT_LIKE_BONUS : 0
  let bestTerm: { term: string; weight: number } | null = null

  for (const c of event.categories ?? []) {
    score += profile.categoryScore[c] ?? 0
  }

  const candidateTerms = [...(event.people ?? []), ...(event.tags ?? [])]
  for (const term of candidateTerms) {
    const behaviorWeight = profile.termScore.get(term.toLowerCase()) ?? 0
    const interestHit = matchesInterest(term, profile.interestTerms)
    const weight = behaviorWeight + (interestHit ? WEIGHTS.interest : 0)
    if (weight > 0 && (!bestTerm || weight > bestTerm.weight)) {
      bestTerm = { term, weight }
    }
    score += weight
  }

  let reason: string | null = null
  if (disliked) {
    // Never claim "you like this" about something they explicitly swiped no on.
    score -= DISLIKED_EVENT_PENALTY
  } else {
    const topCategory = (event.categories ?? []).find(c => (profile.categoryScore[c] ?? 0) > 0)
    if (topCategory && topCategory !== 'other') {
      reason = pickReason(CATEGORY_VIBE_REASONS, event.id)(topCategory)
    } else if (score > 0) {
      reason = pickReason(GENERIC_VIBE_REASONS, event.id)
    }
  }

  return { score, reason }
}

export function rankEventsByPreference(events: Event[], profile: PreferenceProfile): Event[] {
  return events
    .map(ev => {
      const { score, reason } = scoreEvent(ev, profile)
      return { ...ev, match_score: score, match_reason: reason ?? ev.match_reason }
    })
    .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
}
