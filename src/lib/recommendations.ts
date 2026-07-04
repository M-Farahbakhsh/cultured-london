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
  if (bestTerm) {
    reason = `Because you like ${bestTerm.term}`
  } else {
    const topCategory = (event.categories ?? []).find(c => (profile.categoryScore[c] ?? 0) > 0)
    if (topCategory) reason = `Because you've enjoyed ${topCategory} events`
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
