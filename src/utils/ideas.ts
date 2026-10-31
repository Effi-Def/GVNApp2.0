import type { EventCategory, Idea, IdeaCategory } from '../types'

export const IDEA_CATEGORIES: { value: IdeaCategory; label: string; emoji: string }[] = [
  { value: 'posto', label: 'Posto', emoji: '📍' },
  { value: 'ristorante', label: 'Ristorante', emoji: '🍽️' },
  { value: 'evento', label: 'Evento', emoji: '🎉' },
  { value: 'viaggio', label: 'Viaggio', emoji: '✈️' },
  { value: 'altro', label: 'Altro', emoji: '💡' },
]

const EVENT_CATEGORY_BY_IDEA: Record<IdeaCategory, EventCategory> = {
  posto: 'altro',
  ristorante: 'cena',
  evento: 'festa',
  viaggio: 'viaggio',
  altro: 'altro',
}

export const getIdeaCategory = (category: IdeaCategory) =>
  IDEA_CATEGORIES.find(c => c.value === category) ?? IDEA_CATEGORIES[IDEA_CATEGORIES.length - 1]

export const getIdeaEventCategory = (category: IdeaCategory): EventCategory =>
  EVENT_CATEGORY_BY_IDEA[category] ?? 'altro'

/**
 * Returns a safe http(s) URL, null when the text cannot be used as a link.
 * Links are rendered as href, so any other scheme (javascript:, data:) is refused.
 */
export const normalizeIdeaLink = (raw: string): string | null => {
  const text = raw.trim()
  if (!text || /\s/.test(text)) return null
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[^/:]+:\d+(\/|$)/.test(text)
  try {
    const url = new URL(hasScheme ? text : `https://${text}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

export const getIdeaLinkLabel = (link: string): string => {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return link
  }
}

/** Open ideas, the ones with more "Ci sto" first and then the newest. */
export const rankOpenIdeas = (ideas: Idea[]): Idea[] =>
  ideas
    .filter(idea => idea.status === 'open')
    .sort((a, b) =>
      b.interestedIds.length - a.interestedIds.length ||
      b.createdAt.getTime() - a.createdAt.getTime()
    )
