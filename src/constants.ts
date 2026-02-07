import { EventCategory } from './types'

export const EVENT_CATEGORIES: Record<EventCategory, { label: string; emoji: string }> = {
  cena: { label: 'Cena', emoji: '🍽️' },
  aperitivo: { label: 'Aperitivo', emoji: '🍻' },
  viaggio: { label: 'Viaggio', emoji: '✈️' },
  sport: { label: 'Sport', emoji: '⚽' },
  festa: { label: 'Festa', emoji: '🎉' },
  cinema: { label: 'Cinema', emoji: '🎬' },
  shopping: { label: 'Shopping', emoji: '🛍️' },
  altro: { label: 'Altro', emoji: '📌' },
}

export const DEFAULT_EVENT_CATEGORY: EventCategory = 'cena'

export const APP_CONFIG = {
  PAGINATION_LIMIT: 20,
  MAX_ATTACHMENT_SIZE_MB: 5,
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  // Nasconde gli eventi finiti dalle select dopo N giorni
  EVENT_ENDED_GRACE_DAYS: 30,
}
