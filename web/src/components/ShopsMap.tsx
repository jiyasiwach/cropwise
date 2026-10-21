import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Store } from '../lib/api'

/** OpenStreetMap tiles with the farm and nearby agri-input shops. Loaded only on the Shops tab. */
export default function ShopsMap({ lat, lon, stores }: { lat: number; lon: number; stores: Store[] }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!el.current) return
    const map = L.map(el.current, { scrollWheelZoom: false }).setView([lat, lon], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    L.circleMarker([lat, lon], { radius: 9, color: '#0f3b2a', fillColor: '#e9a520', fillOpacity: 1, weight: 3 })
      .addTo(map)
      .bindPopup('Your farm (approximate)')
    const points: [number, number][] = [[lat, lon]]
    for (const s of stores) {
      L.circleMarker([s.latitude, s.longitude], { radius: 7, color: '#1f7a4d', fillColor: '#4cc38a', fillOpacity: 0.9, weight: 2 })
        .addTo(map)
        .bindPopup(`<strong>${s.name.replace(/</g, '&lt;')}</strong><br>${s.distance_km.toFixed(1)} km`)
      points.push([s.latitude, s.longitude])
    }
    if (points.length > 1) map.fitBounds(points, { padding: [24, 24] })
    return () => {
      map.remove()
    }
  }, [lat, lon, stores])
  return <div ref={el} className="h-72 w-full overflow-hidden rounded-2xl border border-line" role="img" aria-label="Map of nearby agri-input shops" />
}
