'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Search, SlidersHorizontal, LayoutGrid, Map, Sparkles } from 'lucide-react'
import type { Category, DateFilter } from '@/lib/types'
import { CATEGORY_META } from '@/lib/utils'
import DateTimePicker from './DateTimePicker'

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
  { value: 'sports', label: 'Sports' },
]

const DATE_PRESETS: Array<{ value: DateFilter; label: string }> = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_weekend', label: 'This Weekend' },
  { value: 'this_month', label: 'This month' },
]

export default function FilterBar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const category = (searchParams.get('category') ?? 'all') as Category | 'all'
  const date = (searchParams.get('date') ?? 'all') as DateFilter
  const from = searchParams.get('from') ?? ''
  const timeFrom = searchParams.get('time_from') ?? ''
  const timeTo = searchParams.get('time_to') ?? ''
  const free = searchParams.get('free') === 'true'
  const search = searchParams.get('search') ?? ''
  const view = searchParams.get('view') ?? 'grid'
  const picked = searchParams.get('picked') === 'true'

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') {
        params.delete(key)
      } else if (key === 'date' && value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    params.delete('page')
    router.push(`/explore?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  const handleDateTimeApply = (pickedDate: string, pickedFrom: string, pickedTo: string) => {
    const updates: Record<string, string | null> = {
      time_from: pickedFrom || null,
      time_to: pickedTo || null,
    }
    if (pickedDate) {
      updates.date = 'custom'
      updates.from = pickedDate
    }
    updateParams(updates)
  }

  const handleDateTimeClear = () => {
    updateParams({ date: null, from: null, time_from: null, time_to: null })
  }

  return (
    <div className="space-y-3">
      {/* Search + view toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search events, venues, people..."
            defaultValue={search}
            onChange={e => updateParams({ search: e.target.value || null })}
            className="input pl-10"
          />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
          <button
            onClick={() => updateParams({ view: null })}
            className={`px-3 py-2 flex items-center gap-1.5 text-sm font-medium transition-colors
              ${view !== 'map' ? 'bg-ink text-white' : 'bg-white text-muted hover:text-ink'}`}
          >
            <LayoutGrid size={15} />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button
            onClick={() => updateParams({ view: 'map' })}
            className={`px-3 py-2 flex items-center gap-1.5 text-sm font-medium transition-colors border-l border-border
              ${view === 'map' ? 'bg-ink text-white' : 'bg-white text-muted hover:text-ink'}`}
          >
            <Map size={15} />
            <span className="hidden sm:inline">Map</span>
          </button>
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {/* Picked for you — the personalization filter, always first */}
        <button
          onClick={() => updateParams({ picked: picked ? null : 'true' })}
          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors
            ${picked
              ? 'bg-accent text-white'
              : 'bg-white border border-accent/40 text-accent hover:bg-accent-soft'
            }`}
        >
          <Sparkles size={13} />
          Picked for you
        </button>
        {CATEGORIES.map(({ value, label }) => {
          const active = category === value
          const meta = value !== 'all' ? CATEGORY_META[value as Category] : null
          return (
            <button
              key={value}
              onClick={() => updateParams({ category: value })}
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

      {/* Date presets + Date & Time picker + Free filter */}
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={14} className="text-muted shrink-0" />
        {/* Preset pills — scrollable on small screens */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide shrink">
          {DATE_PRESETS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => updateParams({ date: value, from: null })}
              className={`shrink-0 px-3 py-1 rounded-md text-xs font-medium transition-colors
                ${date === value ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* DateTimePicker sits OUTSIDE overflow container so its dropdown is never clipped */}
        <DateTimePicker
          selectedDate={date === 'custom' ? from : ''}
          timeFrom={timeFrom}
          timeTo={timeTo}
          onApply={handleDateTimeApply}
          onClear={handleDateTimeClear}
        />
        <label className="ml-auto shrink-0 flex items-center gap-2 text-sm text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={free}
            onChange={e => updateParams({ free: e.target.checked ? 'true' : null })}
            className="rounded border-border text-accent focus:ring-accent/30"
          />
          Free only
        </label>
      </div>
    </div>
  )
}
