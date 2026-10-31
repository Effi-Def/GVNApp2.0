import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'

// Fix Leaflet marker icons broken by Vite's asset pipeline
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

interface EventMapProps {
  lat: number
  lon: number
  label?: string
  zoom?: number
  className?: string
}

export default function EventMap({ lat, lon, label, zoom = 15, className = 'h-48 w-full rounded-xl z-0' }: EventMapProps) {
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={zoom}
      className={className}
      scrollWheelZoom={false}
      // Prevent tap-drag conflicts on mobile inside a scroll container
      dragging={!L.Browser.mobile}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lon]}>
        {label && <Popup>{label}</Popup>}
      </Marker>
    </MapContainer>
  )
}
