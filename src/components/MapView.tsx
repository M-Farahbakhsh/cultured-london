'use client'
import { useEffect, useRef } from 'react'
import type { Event, Category } from '@/lib/types'
import { formatDate, formatTime, formatPrice } from '@/lib/utils'

// Same hues as CATEGORY_META, as flat hex for Leaflet's inline-styled markers.
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

  const mappable = events.filter(e => e.lat != null && e.lng != null)
  const unmappable = totalCount - mappable.length

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then(L => {
      import('leaflet/dist/leaflet.css' as any)

      const map = L.map(containerRef.current!, {
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

      mappable.forEach(event => {
        const lat = event.lat!
        const lng = event.lng!
        const cat = event.categories?.[0] ?? 'other'
        const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other

        const icon = L.divIcon({
          className: '',
          html: `<div class="map-pin" style="background:${color}"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          popupAnchor: [0, -12],
        })

        const popup = L.popup({ maxWidth: 260, className: 'map-popup' }).setContent(`
          <div style="font-family:Inter,system-ui,sans-serif;padding:2px 2px 4px">
            <span style="display:inline-block;font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${color};margin-bottom:6px">${cat}</span>
            <p style="font-family:'Instrument Serif',Georgia,serif;font-size:17px;line-height:1.25;margin:0 0 6px;color:#1A1817">${event.title}</p>
            <p style="font-size:12px;color:#6F6A63;margin:0 0 2px">${formatDate(event.start_datetime)} · ${formatTime(event.start_datetime)}</p>
            ${event.venue_name ? `<p style="font-size:12px;color:#6F6A63;margin:0 0 8px">${event.venue_name}</p>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:12px;font-weight:600;color:#1A1817">${formatPrice(event.price_min, event.price_max ?? null, event.is_free)}</span>
              <a href="/events/${event.id}" style="font-size:12px;color:#E32017;text-decoration:none;font-weight:600">View →</a>
            </div>
          </div>
        `)

        L.marker([lat, lng], { icon }).addTo(map).bindPopup(popup)
      })

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
        className="map-shell w-full rounded-2xl overflow-hidden border border-border shadow-card"
        style={{ height: '600px' }}
      />
    </div>
  )
}
