'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

interface Props {
  selectedDate: string  // YYYY-MM-DD or ''
  timeFrom: string      // HH:MM or ''
  timeTo: string        // HH:MM or ''
  onApply: (date: string, timeFrom: string, timeTo: string) => void
  onClear: () => void
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
// Monday-first week (UK convention)
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m ? `${hour}:${String(m).padStart(2, '0')}${ampm}` : `${hour}${ampm}`
}

export default function DateTimePicker({ selectedDate, timeFrom, timeTo, onApply, onClear }: Props) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [localDate, setLocalDate] = useState(selectedDate)
  const [localFrom, setLocalFrom] = useState(timeFrom)
  const [localTo, setLocalTo] = useState(timeTo)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openPicker = () => {
    setLocalDate(selectedDate)
    setLocalFrom(timeFrom)
    setLocalTo(timeTo)
    if (selectedDate) {
      const d = new Date(selectedDate + 'T12:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    } else {
      setViewYear(today.getFullYear())
      setViewMonth(today.getMonth())
    }
    setOpen(true)
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  // Monday = 0, Sunday = 6 offset
  const rawFirst = new Date(viewYear, viewMonth, 1).getDay()
  const firstOffset = (rawFirst + 6) % 7

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const dayStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const isPast = (day: number) => dayStr(day) < todayStr
  const isSelected = (day: number) => localDate === dayStr(day)
  const isToday = (day: number) => dayStr(day) === todayStr

  const handleApply = () => {
    onApply(localDate, localFrom, localTo)
    setOpen(false)
  }

  const handleClear = () => {
    setLocalDate('')
    setLocalFrom('')
    setLocalTo('')
    onClear()
    setOpen(false)
  }

  const hasActive = !!(selectedDate || timeFrom || timeTo)

  const label = () => {
    const parts: string[] = []
    if (selectedDate) {
      const d = new Date(selectedDate + 'T12:00:00')
      parts.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))
    }
    if (timeFrom || timeTo) {
      if (timeFrom && timeTo) parts.push(`${fmtTime(timeFrom)}–${fmtTime(timeTo)}`)
      else if (timeFrom) parts.push(`from ${fmtTime(timeFrom)}`)
      else parts.push(`until ${fmtTime(timeTo)}`)
    }
    return parts.length ? parts.join(' · ') : 'Date & time'
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => open ? setOpen(false) : openPicker()}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors
          ${hasActive ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}
      >
        <CalendarDays size={12} />
        {label()}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl border border-border shadow-xl p-4 w-72">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-surface transition-colors"
            >
              <ChevronLeft size={15} className="text-muted" />
            </button>
            <span className="text-sm font-semibold text-ink">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-surface transition-colors"
            >
              <ChevronRight size={15} className="text-muted" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-muted py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: firstOffset }).map((_, i) => <div key={`gap-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const past = isPast(day)
              const selected = isSelected(day)
              const todayDay = isToday(day)
              return (
                <button
                  key={day}
                  onClick={() => !past && setLocalDate(dayStr(day))}
                  disabled={past}
                  className={`w-full aspect-square flex items-center justify-center text-xs rounded-full transition-colors
                    ${selected
                      ? 'bg-ink text-white font-semibold'
                      : past
                        ? 'text-border cursor-not-allowed'
                        : todayDay
                          ? 'text-accent font-semibold hover:bg-surface'
                          : 'text-ink hover:bg-surface'
                    }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Time range */}
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-[11px] font-semibold text-muted mb-2 uppercase tracking-wide">
              Time range
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted block mb-1">From</label>
                <input
                  type="time"
                  value={localFrom}
                  onChange={e => setLocalFrom(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ink/20 bg-white text-ink"
                />
              </div>
              <span className="text-muted text-sm pb-1.5">–</span>
              <div className="flex-1">
                <label className="text-[10px] text-muted block mb-1">To</label>
                <input
                  type="time"
                  value={localTo}
                  onChange={e => setLocalTo(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ink/20 bg-white text-ink"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleClear}
              className="flex-1 px-3 py-1.5 text-xs text-muted hover:text-ink border border-border rounded-lg transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-3 py-1.5 text-xs font-semibold bg-ink text-white rounded-lg hover:bg-ink/90 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
