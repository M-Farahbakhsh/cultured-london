'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import type { Category, DateFilter } from '@/lib/types'
import { CATEGORY_META } from '@/lib/utils'

const CATEGORIES: Array<{ value: Category | 'all'; label: string }> = [
  { value: 'all', label: 'Everything' },
  { value: 'music', label: 'Music' },
  { value: 'art', label: 'Art' },
  { value: 'talk', label: 'Talks' },
  { value: 'film', label: 'Film' },
  { value: 'tech', label: 'Tech' },
  { value: 'literature', label: 'Literature' },
  { value: 'theatre', label: 'Theatre' },
  { value: 'exhibition', label: 'Exhibitions' },
  { value: 'comedy', label: 'Comedy' },
]

const DATES: Array<{ value: DateFilter; label: string }> = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_weekend', label: 'Weekend' },
  { value: 'this_month', label: 'This month' },
]

export default function FilterBar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const category = (searchParams.get('category') ?? 'all') as Category | 'all'
  const date = (searchParams.get('date') ?? 'all') as DateFilter
  const free = searchParams.get('free') === 'true'
  const search = searchParams.get('search') ?? ''

  const update = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === 'all' || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`/explore?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search events, venues, people..."
          defaultValue={search}
          onChange={e => update('search', e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {CATEGORIES.map(({ value, label }) => {
          const active = category === value
          const meta = value !== 'all' ? CATEGORY_META[value as Category] : null
          return (
            <button
              key={value}
              onClick={() => update('category', value)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors
                ${active
                  ? (meta ? `${meta.bg} ${meta.color}` : 'bg-ink text-white')
                  : 'bg-white border border-border text-muted hover:text-ink hover:border-ink/30'
                }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Date + Free filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <SlidersHorizontal size={14} className="text-muted" />
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {DATES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => update('date', value)}
              className={`shrink-0 px-3 py-1 rounded-md text-xs font-medium transition-colors
                ${date === value ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={free}
              onChange={e => update('free', e.target.checked ? 'true' : null)}
              className="rounded border-border text-accent focus:ring-accent/30"
            />
            Free only
          </label>
        </div>
      </div>
    </div>
  )
}
