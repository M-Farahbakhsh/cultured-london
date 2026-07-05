'use client'
import { useEffect, useRef } from 'react'
import type { Event, Category } from '@/lib/types'
import { formatDate, formatTime, formatPrice, CATEGORY_META, decodeHtmlEntities } from '@/lib/utils'

// Same hues as CATEGORY_META, as flat hex for Leaflet's inline-styled markers.
const CATEGORY_COLORS: Record<Category, string> = {
  music:      '#9333ea',
  art:        '#e11d48',
  talk:       '#2563eb',
  film:       '#0d9488',
  tech:       '#ea580c',
  literature: '#16a34a',
  theatre:    '#db2777',
  comedy:     '#ca8a04',
  exhibition: '#4f46e5',
  other:      '#78716c',
}

// One glance tells you what's on the pin — colour is just a backup cue, not the whole story.
const CATEGORY_EMOJI: Record<Category, string> = {
  music:      '🎸',
  art:        '🎨',
  talk:       '🎤',
  film:       '🎬',
  tech:       '🤖',
  literature: '📚',
  theatre:    '🎭',
  comedy:     '😂',
  exhibition: '🖼️',
  other:      '✨',
}

// Trafalgar Square — dead center of town, so the map reads as "central London"
// the instant it paints, with no fitBounds jump-cut once markers arrive.
const CENTRAL_LONDON: [number, number] = [51.5074, -0.1278]
const INITIAL_ZOOM = 13

interface Props {
  events: Event[]
  totalCount: number
}

export default function MapView({ events, totalCount }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)

  const mappable = events.filter(e => e.lat != null && e.lng != null)
  const unmappable = totalCount - mappable.length

  // Only show a legend entry for categories actually on screen — no point
  // explaining eight icons when three are plotted.
  const presentCategories = (Object.keys(CATEGORY_META) as Category[]).filter(cat =>
    mappable.some(e => (e.categories?.[0] ?? 'other') === cat)
  )

  // Map + tiles + controls are created once. Markers are redrawn on every
  // run of this effect — which fires whenever `events` changes, i.e. every
  // filter change — instead of only ever reflecting whatever was on screen
  // at first mount (the old bug: switching filters while already on the
  // map view silently did nothing).
  useEffect(() => {
    let cancelled = false

    import('leaflet').then(L => {
      if (cancelled || !containerRef.current) return
      import('leaflet/dist/leaflet.css' as any)

      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          center: CENTRAL_LONDON,
          zoom: INITIAL_ZOOM,
          scrollWheelZoom: true,
          zoomControl: false,
        })

        L.control.zoom({ position: 'bottomright' }).addTo(map)

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20,
        }).addTo(map)

        markersLayerRef.current = L.layerGroup().addTo(map)
        mapRef.current = map
      }

      markersLayerRef.current.clearLayers()

      mappable.forEach(event => {
        const lat = event.lat!
        const lng = event.lng!
        const cat = (event.categories?.[0] ?? 'other') as Category
        const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other
        const emoji = CATEGORY_EMOJI[cat] ?? CATEGORY_EMOJI.other

        const icon = L.divIcon({
          className: '',
          html: `<div class="map-pin" style="border-color:${color}"><span>${emoji}</span></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -18],
        })

        const popup = L.popup({ maxWidth: 260, className: 'map-popup' }).setContent(`
          <div style="font-family:Inter,system-ui,sans-serif;padding:2px 2px 4px">
            <span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${color};margin-bottom:6px">${emoji} ${CATEGORY_META[cat]?.label ?? cat}</span>
            <p style="font-family:'Instrument Serif',Georgia,serif;font-size:17px;line-height:1.25;margin:0 0 6px;color:#1A1817">${decodeHtmlEntities(event.title)}</p>
            <p style="font-size:12px;color:#6F6A63;margin:0 0 2px">${formatDate(event.start_datetime)} · ${formatTime(event.start_datetime)}</p>
            ${event.venue_name ? `<p style="font-size:12px;color:#6F6A63;margin:0 0 8px">${event.venue_name}</p>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:12px;font-weight:600;color:#1A1817">${formatPrice(event.price_min, event.price_max ?? null, event.is_free)}</span>
              <a href="/events/${event.id}" style="font-size:12px;color:#E32017;text-decoration:none;font-weight:600">View →</a>
            </div>
          </div>
        `)

        L.marker([lat, lng], { icon }).addTo(markersLayerRef.current).bindPopup(popup)
      })
    })

    return () => { cancelled = true }
  }, [events])

  // Map instance itself only ever gets torn down on actual unmount.
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        {presentCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {presentCategories.map(cat => {
              const meta = CATEGORY_META[cat]
              return (
                <span
                  key={cat}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full ${meta.bg} ${meta.color}`}
                >
                  <span>{CATEGORY_EMOJI[cat]}</span>{meta.label}
                </span>
              )
            })}
          </div>
        )}
        {unmappable > 0 && (
          <p className="text-xs text-muted">
            {mappable.length} of {totalCount} shown — {unmappable} have no location data
          </p>
        )}
      </div>
      <div
        ref={containerRef}
        className="map-shell w-full rounded-2xl overflow-hidden border border-border shadow-card"
        style={{ height: '600px' }}
      />
    </div>
  )
}
