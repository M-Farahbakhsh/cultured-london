'use client'
import { useEffect, useRef } from 'react'
import type { Event, Category } from '@/lib/types'
import { formatDate, formatTime, formatPrice } from '@/lib/utils'

const CATEGORY_COLORS: Record<string, string> = {
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

interface Props {
  events: Event[]
  totalCount: number
}

export default function MapView({ events, totalCount }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  const mappable = events.filter(e => e.lat != null && e.lng != null)
  const unmappable = totalCount - mappable.length

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then(L => {
      import('leaflet/dist/leaflet.css' as any)

      const map = L.map(containerRef.current!, {
        center: [51.505, -0.09],
        zoom: 12,
        scrollWheelZoom: true,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map)

      const bounds: [number, number][] = []

      mappable.forEach(event => {
        const lat = event.lat!
        const lng = event.lng!
        const cat = event.categories?.[0] ?? 'other'
        const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:14px;height:14px;
            background:${color};
            border-radius:50%;
            border:2.5px solid white;
            box-shadow:0 1px 4px rgba(0,0,0,0.35);
            cursor:pointer;
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          popupAnchor: [0, -10],
        })

        const popup = L.popup({ maxWidth: 280 }).setContent(`
          <div style="font-family:system-ui,sans-serif;padding:2px 0">
            <p style="font-size:13px;font-weight:600;line-height:1.3;margin:0 0 6px">${event.title}</p>
            <p style="font-size:11px;color:#666;margin:0 0 2px">${formatDate(event.start_datetime)} · ${formatTime(event.start_datetime)}</p>
            ${event.venue_name ? `<p style="font-size:11px;color:#666;margin:0 0 6px">${event.venue_name}</p>` : ''}
            <p style="font-size:11px;font-weight:600;color:#111;margin:0 0 8px">${formatPrice(event.price_min, event.price_max ?? null, event.is_free)}</p>
            <a href="/events/${event.id}" style="font-size:11px;color:#2563eb;text-decoration:none;font-weight:500">View event →</a>
          </div>
        `)

        L.marker([lat, lng], { icon }).addTo(map).bindPopup(popup)
        bounds.push([lat, lng])
      })

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
      }

      mapRef.current = map
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // only run once on mount

  return (
    <div>
      {unmappable > 0 && (
        <p className="text-xs text-muted mb-3">
          Showing {mappable.length} of {totalCount} events on map — {unmappable} events have no location data and are hidden.
        </p>
      )}
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-border"
        style={{ height: '600px' }}
      />
    </div>
  )
}
