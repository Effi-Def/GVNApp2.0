import { describe, expect, it } from 'vitest'
import type { Idea } from '../types'
import {
  getIdeaEventCategory,
  getIdeaLinkLabel,
  getWinningDateOption,
  messageToIdeaDraft,
  normalizeIdeaLink,
  rankOpenIdeas,
} from './ideas'

const makeIdea = (overrides: Partial<Idea>): Idea => ({
  id: 'idea',
  farmId: 'farm',
  title: 'Idea',
  category: 'altro',
  createdBy: 'u1',
  interestedIds: [],
  status: 'open',
  createdAt: new Date('2030-01-01T10:00:00.000Z'),
  updatedAt: new Date('2030-01-01T10:00:00.000Z'),
  ...overrides,
})

describe('normalizeIdeaLink', () => {
  it('adds https when the scheme is missing', () => {
    expect(normalizeIdeaLink('www.example.com/menu')).toBe('https://www.example.com/menu')
    expect(normalizeIdeaLink('  example.com  ')).toBe('https://example.com/')
    expect(normalizeIdeaLink('example.com:8080/menu')).toBe('https://example.com:8080/menu')
  })

  it('keeps http and https links', () => {
    expect(normalizeIdeaLink('http://example.com/a')).toBe('http://example.com/a')
    expect(normalizeIdeaLink('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
  })

  it('refuses schemes that would be unsafe as href', () => {
    expect(normalizeIdeaLink('javascript:alert(1)')).toBeNull()
    expect(normalizeIdeaLink('JavaScript:alert(1)')).toBeNull()
    expect(normalizeIdeaLink('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(normalizeIdeaLink('ftp://example.com')).toBeNull()
  })

  it('refuses text that is not a link', () => {
    expect(normalizeIdeaLink('')).toBeNull()
    expect(normalizeIdeaLink('da mario')).toBeNull()
    expect(normalizeIdeaLink('mario')).toBeNull()
  })
})

describe('getIdeaLinkLabel', () => {
  it('shows the host without www', () => {
    expect(getIdeaLinkLabel('https://www.example.com/menu')).toBe('example.com')
  })
})

describe('getIdeaEventCategory', () => {
  it('maps idea categories to event categories', () => {
    expect(getIdeaEventCategory('ristorante')).toBe('cena')
    expect(getIdeaEventCategory('viaggio')).toBe('viaggio')
    expect(getIdeaEventCategory('posto')).toBe('altro')
  })
})

describe('messageToIdeaDraft', () => {
  it('uses a short message as title', () => {
    expect(messageToIdeaDraft('  Dovremmo andare a Lisbona ')).toEqual({ title: 'Dovremmo andare a Lisbona' })
  })

  it('cuts a long message and keeps it in the note', () => {
    const text = 'x'.repeat(300)
    const draft = messageToIdeaDraft(text)
    expect(draft.title.length).toBeLessThanOrEqual(120)
    expect(draft.note).toBe(text)
  })

  it('keeps the note within the allowed size', () => {
    expect(messageToIdeaDraft('x'.repeat(5000)).note).toHaveLength(1000)
  })
})

describe('getWinningDateOption', () => {
  const options = [
    { id: 'a', text: '2030-05-02', votes: 0 },
    { id: 'b', text: '2030-05-01', votes: 0 },
  ]
  const vote = (optionId: string) => ({ userId: optionId, userName: 'x', optionId, votedAt: new Date() })

  it('returns the most voted date', () => {
    expect(getWinningDateOption({ options, votes: [vote('a'), vote('a'), vote('b')] })).toBe('2030-05-02')
  })

  it('prefers the earliest date on a tie', () => {
    expect(getWinningDateOption({ options, votes: [vote('a'), vote('b')] })).toBe('2030-05-01')
  })

  it('returns null without votes or with options that are not dates', () => {
    expect(getWinningDateOption({ options, votes: [] })).toBeNull()
    expect(getWinningDateOption({ options: [{ id: 'a', text: 'Pizza', votes: 0 }], votes: [vote('a')] })).toBeNull()
  })
})

describe('rankOpenIdeas', () => {
  it('sorts by interest and then by newest', () => {
    const ranked = rankOpenIdeas([
      makeIdea({ id: 'old', interestedIds: ['a'] }),
      makeIdea({ id: 'popular', interestedIds: ['a', 'b'] }),
      makeIdea({ id: 'new', interestedIds: ['b'], createdAt: new Date('2030-02-01T10:00:00.000Z') }),
    ])
    expect(ranked.map(idea => idea.id)).toEqual(['popular', 'new', 'old'])
  })

  it('leaves out organized ideas without changing the input', () => {
    const input = [
      makeIdea({ id: 'done', status: 'organized', interestedIds: ['a', 'b'] }),
      makeIdea({ id: 'open' }),
    ]
    expect(rankOpenIdeas(input).map(idea => idea.id)).toEqual(['open'])
    expect(input).toHaveLength(2)
  })
})
