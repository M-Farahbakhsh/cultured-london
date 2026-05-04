'use client'
import { useState, useRef, useEffect } from 'react'
import { X, Search, Plus } from 'lucide-react'
import type { InterestType, Interest } from '@/lib/types'

interface Suggestion {
  id: string
  name: string
  description?: string
}

interface Props {
  type: InterestType
  label: string
  placeholder: string
  interests: Interest[]
  onAdd: (name: string, metadata?: Record<string, unknown>) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export default function InterestPicker({ type, label, placeholder, interests, onAdd, onRemove }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/interests/search?type=${type}&q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSuggestions(data.results ?? [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const pick = async (s: Suggestion) => {
    await onAdd(s.name, { external_id: s.id, description: s.description })
    setQuery('')
    setSuggestions([])
    setOpen(false)
  }

  const addManual = async () => {
    if (!query.trim()) return
    await onAdd(query.trim())
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-ink">{label}</label>

      {/* Selected interests */}
      {interests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {interests.map(i => (
            <span key={i.id}
              className="flex items-center gap-1.5 bg-bg border border-border rounded-full px-3 py-1 text-sm">
              {i.name}
              <button onClick={() => onRemove(i.id)} className="text-muted hover:text-ink">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div ref={wrapperRef} className="relative">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={query}
            onChange={handleInput}
            onFocus={() => { setOpen(true); if (query.length >= 2) search(query) }}
            placeholder={placeholder}
            className="input pl-9 pr-10"
          />
          {query && (
            <button
              onClick={addManual}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-accent hover:text-accent-dark"
              title="Add as-is"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && (suggestions.length > 0 || (loading && query.length >= 2)) && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-card-hover z-20 overflow-hidden">
            {loading && suggestions.length === 0 && (
              <p className="text-sm text-muted px-4 py-3">Searching...</p>
            )}
            {suggestions.map(s => (
              <button
                key={s.id}
                onClick={() => pick(s)}
                className="w-full text-left px-4 py-3 hover:bg-bg transition-colors border-b border-border last:border-0"
              >
                <p className="text-sm font-medium text-ink">{s.name}</p>
                {s.description && (
                  <p className="text-xs text-muted mt-0.5 line-clamp-1">{s.description}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
