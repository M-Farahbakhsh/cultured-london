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
} as const

export interface PreferenceProfile {
  categoryScore: Partial<Record<Category, number>>
  termScore: Map<string, number>
  interestTerms: string[]
  hasSignal: boolean
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
  }

  const [{ data: interests }, { data: saved }, { data: attended }] = await Promise.all([
    supabase.from('interests').select('name, type').eq('user_id', userId),
    supabase.from('saved_events').select('event:events(categories, tags, people)').eq('user_id', userId),
    supabase.from('attended_events').select('enjoyed, event:events(categories, tags, people)')
      .eq('user_id', userId).not('event_id', 'is', null),
  ])

  const CATEGORY_NAMES = new Set<string>([
    'music', 'art', 'talk', 'film', 'tech', 'literature', 'theatre', 'comedy', 'exhibition', 'other',
  ])
  for (const i of interests ?? []) {
    profile.hasSignal = true
    const lower = i.name.toLowerCase()
    profile.interestTerms.push(lower)
    // Genre picks from onboarding map directly onto event categories, so they
    // should boost category scoring — not just term matching against tags/people.
    if (i.type === 'genre' && CATEGORY_NAMES.has(lower)) {
      profile.categoryScore[lower as Category] =
        (profile.categoryScore[lower as Category] ?? 0) + WEIGHTS.interest
    }
  }

  for (const s of (saved ?? []) as unknown as { event: EventSignal }[]) {
    if (!s.event) continue
    profile.hasSignal = true
    addCategoryScore(profile, s.event.categories, WEIGHTS.saved)
    addTermScore(profile, [s.event.tags, s.event.people], WEIGHTS.saved)
  }

  for (const a of (attended ?? []) as unknown as { enjoyed: boolean | null; event: EventSignal }[]) {
    if (!a.event) continue
    profile.hasSignal = true
    const weight = a.enjoyed === false ? WEIGHTS.notEnjoyedAttended : WEIGHTS.enjoyedAttended
    addCategoryScore(profile, a.event.categories, weight)
    addTermScore(profile, [a.event.tags, a.event.people], weight)
  }

  return profile
}

function matchesInterest(term: string, interestTerms: string[]): string | null {
  const lower = term.toLowerCase()
  return interestTerms.find(i => lower.includes(i) || i.includes(lower)) ?? null
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

export function scoreEvent(event: Event, profile: PreferenceProfile): { score: number; reason: string | null } {
  let score = 0
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
  const topCategory = (event.categories ?? []).find(c => (profile.categoryScore[c] ?? 0) > 0)
  if (topCategory && topCategory !== 'other') {
    reason = pickReason(CATEGORY_VIBE_REASONS, event.id)(topCategory)
  } else if (score > 0) {
    reason = pickReason(GENERIC_VIBE_REASONS, event.id)
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
