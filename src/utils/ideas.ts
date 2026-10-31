import type { EventCategory, Idea, IdeaCategory, IdeaEventPrefill, Poll } from '../types'

export const IDEA_CATEGORIES: { value: IdeaCategory; label: string; emoji: string }[] = [
  { value: 'posto', label: 'Posto', emoji: '📍' },
  { value: 'ristorante', label: 'Ristorante', emoji: '🍽️' },
  { value: 'evento', label: 'Evento', emoji: '🎉' },
  { value: 'viaggio', label: 'Viaggio', emoji: '✈️' },
  { value: 'altro', label: 'Altro', emoji: '💡' },
]

const IDEA_TITLE_MAX = 120

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

export const buildIdeaEventPrefill = (idea: Idea): IdeaEventPrefill => ({
  id: idea.id,
  farmId: idea.farmId,
  title: idea.title,
  note: idea.note,
  location: idea.location,
  category: getIdeaEventCategory(idea.category),
})

/** A chat message as the starting point of an idea: a long text moves entirely to the note. */
export const messageToIdeaDraft = (text: string): { title: string; note?: string } => {
  const clean = text.trim()
  if (clean.length <= IDEA_TITLE_MAX) return { title: clean }
  return { title: `${clean.slice(0, IDEA_TITLE_MAX - 1).trimEnd()}…`, note: clean.slice(0, 1000) }
}

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

/** The most voted date of a date poll; on a tie the earliest one. Null without votes or dates. */
export const getWinningDateOption = (poll: Pick<Poll, 'options' | 'votes'>): string | null => {
  const isDate = (text: string) => /^\d{4}-\d{2}-\d{2}$/.test(text)
  if (poll.options.length === 0 || !poll.options.every(o => isDate(o.text))) return null
  let winner: { date: string; votes: number } | null = null
  for (const option of poll.options) {
    const votes = poll.votes.filter(v => v.optionId === option.id).length
    if (votes === 0) continue
    if (!winner || votes > winner.votes || (votes === winner.votes && option.text < winner.date)) {
      winner = { date: option.text, votes }
    }
  }
  return winner?.date ?? null
}
