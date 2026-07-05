import type { Category, DateFilter } from './types'

export const CATEGORY_META: Record<Category, { label: string; color: string; bg: string }> = {
  music:       { label: 'Music',       color: 'text-purple-700', bg: 'bg-purple-100' },
  art:         { label: 'Art',         color: 'text-rose-700',   bg: 'bg-rose-100' },
  talk:        { label: 'Talk',        color: 'text-blue-700',   bg: 'bg-blue-100' },
  film:        { label: 'Film',        color: 'text-teal-700',   bg: 'bg-teal-100' },
  tech:        { label: 'Tech',        color: 'text-orange-700', bg: 'bg-orange-100' },
  literature:  { label: 'Literature',  color: 'text-green-700',  bg: 'bg-green-100' },
  theatre:     { label: 'Theatre',     color: 'text-pink-700',   bg: 'bg-pink-100' },
  comedy:      { label: 'Comedy',      color: 'text-yellow-700', bg: 'bg-yellow-100' },
  exhibition:  { label: 'Exhibition',  color: 'text-indigo-700', bg: 'bg-indigo-100' },
  sports:      { label: 'Sports',      color: 'text-cyan-700',   bg: 'bg-cyan-100' },
  other:       { label: 'Other',       color: 'text-stone-700',  bg: 'bg-stone-100' },
}

export const CATEGORY_GRADIENTS: Record<Category, string> = {
  music:      'from-purple-400 to-purple-600',
  art:        'from-rose-400 to-rose-600',
  talk:       'from-blue-400 to-blue-600',
  film:       'from-teal-400 to-teal-600',
  tech:       'from-orange-400 to-orange-600',
  literature: 'from-green-400 to-green-600',
  theatre:    'from-pink-400 to-pink-600',
  comedy:     'from-yellow-400 to-yellow-600',
  exhibition: 'from-indigo-400 to-indigo-600',
  sports:     'from-cyan-400 to-cyan-600',
  other:      'from-stone-400 to-stone-600',
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function formatDateRange(start: string, last: string | null | undefined): string {
  const startDate = new Date(start)
  const startDay = startDate.toDateString()

  if (!last) {
    return `${formatDate(start)} · ${formatTime(start)}`
  }

  const lastDate = new Date(last)
  if (lastDate.toDateString() === startDay) {
    // Same day — single datetime
    return `${formatDate(start)} · ${formatTime(start)}`
  }

  // Multi-day run — show range
  const startStr = startDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const lastStr  = lastDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${startStr} – ${lastStr}`
}

export function formatPrice(min: number | null, max: number | null, free: boolean): string {
  if (free) return 'Free'
  if (!min && !max) return 'Check website'
  if (min === max || !max) return `£${min}`
  return `£${min}–£${max}`
}

export function getDateRange(filter: DateFilter): { from: Date; to: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (filter) {
    case 'today':
      return { from: today, to: new Date(today.getTime() + 86400000) }
    case 'this_week': {
      const end = new Date(today)
      end.setDate(today.getDate() + 7)
      return { from: today, to: end }
    }
    case 'this_weekend': {
      const day = today.getDay()
      const sat = new Date(today)
      sat.setDate(today.getDate() + ((6 - day + 7) % 7))
      const mon = new Date(sat)
      mon.setDate(sat.getDate() + 2)
      return { from: sat, to: mon }
    }
    case 'this_month': {
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      return { from: today, to: end }
    }
    default:
      return { from: today, to: new Date(today.getFullYear() + 1, 0, 1) }
  }
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
}

// Some scraped sources (unlike Luma, which already gets cleaned in the
// scraper) store titles/descriptions with raw HTML entities intact —
// "Xero APP &amp; Agent Hackathon" instead of "Xero APP & Agent Hackathon".
// Pure string replace so it works identically server- and client-side
// (no DOM/document available during SSR).
export function decodeHtmlEntities(text: string): string {
  if (!text) return text
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X'
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10)
      return Number.isNaN(code) ? match : String.fromCodePoint(code)
    }
    return HTML_ENTITIES[entity] ?? match
  })
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map(s => s.toLowerCase()))
  const setB = new Set(b.map(s => s.toLowerCase()))
  const aArr = Array.from(setA)
  const bArr = Array.from(setB)
  const intersection = aArr.filter(x => setB.has(x)).length
  const union = new Set(aArr.concat(bArr)).size
  return union === 0 ? 0 : intersection / union
}
