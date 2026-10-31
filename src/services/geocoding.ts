const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

export interface GeocodingResult {
  lat: number
  lon: number
  displayName: string
}

// Max 1 req/sec per Nominatim ToS – callers should debounce/throttle themselves.
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const trimmed = address.trim()
  if (!trimmed) return null

  const params = new URLSearchParams({ q: trimmed, format: 'json', limit: '1', addressdetails: '0' })

  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { 'Accept-Language': 'it' },
  })

  if (!res.ok) return null

  const data: unknown = await res.json()
  if (!Array.isArray(data) || data.length === 0) return null

  const first = data[0]
  if (
    typeof first !== 'object' ||
    first === null ||
    !('lat' in first) ||
    !('lon' in first) ||
    !('display_name' in first)
  ) {
    return null
  }

  const lat = parseFloat(String((first as Record<string, unknown>).lat))
  const lon = parseFloat(String((first as Record<string, unknown>).lon))
  if (isNaN(lat) || isNaN(lon)) return null

  return { lat, lon, displayName: String((first as Record<string, unknown>).display_name) }
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const res = await fetch(
    `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: { 'Accept-Language': 'it' } },
  ).catch(() => null)
  if (!res?.ok) return null
  const d: unknown = await res.json().catch(() => null)
  if (d && typeof d === 'object' && 'display_name' in d) {
    return String((d as Record<string, unknown>).display_name)
  }
  return null
}
