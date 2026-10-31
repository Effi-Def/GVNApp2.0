import { describe, expect, it } from 'vitest'
import { Event } from '../types'
import {
  filterSelectableEvents,
  getSelectableEvents,
  getUserEventParticipation,
  getUserKeys,
  isEventExpiredForSelection,
  userCanChat,
  userCanViewEvent,
} from './events'

const now = new Date('2026-03-22T12:00:00.000Z')

function makeEvent(partial: Partial<Event> = {}): Event {
  return {
    id: partial.id ?? 'event-1',
    title: partial.title ?? 'Cena',
    description: partial.description ?? 'Descrizione',
    category: partial.category ?? 'cena',
    date: partial.date ?? new Date('2026-03-20T18:00:00.000Z'),
    time: partial.time ?? '20:00',
    location: partial.location ?? 'Roma',
    createdBy: partial.createdBy ?? 'owner-1',
    participants: partial.participants ?? [],
    visibility: partial.visibility,
    participation: partial.participation,
    endDate: partial.endDate,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  }
}

describe('events utils', () => {
  it('getUserKeys returns id/email and removes empty values', () => {
    expect(getUserKeys({ id: 'u1', email: 'u1@mail.com' })).toEqual(['u1', 'u1@mail.com'])
    expect(getUserKeys({ id: '', email: 'u1@mail.com' })).toEqual(['u1@mail.com'])
    expect(getUserKeys(null)).toEqual([])
  })

  it('getUserEventParticipation returns none for unknown user', () => {
    const event = makeEvent()
    expect(getUserEventParticipation(event, ['u-x'])).toEqual({ status: 'none', accessLevel: 'none' })
  })

  it('getUserEventParticipation grants creator full access', () => {
    const event = makeEvent({ createdBy: 'creator-1' })
    expect(getUserEventParticipation(event, ['creator-1'])).toEqual({ status: 'yes', accessLevel: 'full' })
  })

  it('getUserEventParticipation reads explicit participation map first', () => {
    const event = makeEvent({
      participation: {
        'u-1': { status: 'maybe', accessLevel: 'readonly' },
      },
    })

    const result = getUserEventParticipation(event, ['u-1'])
    expect(result.status).toBe('maybe')
    expect(result.accessLevel).toBe('readonly')
  })

  it('getUserEventParticipation falls back to legacy participants', () => {
    const event = makeEvent({
      participants: [{
        userId: 'u-2',
        name: 'User 2',
        status: 'no',
        respondedAt: now,
      }],
    })

    expect(getUserEventParticipation(event, ['u-2'])).toEqual({
      status: 'no',
      accessLevel: 'readonly',
    })
  })

  it('userCanViewEvent allows global public events for everyone', () => {
    const event = makeEvent({ visibility: { type: 'public' } })
    expect(userCanViewEvent(event, { userKeys: [], farmIds: [] })).toBe(true)
    expect(userCanViewEvent(event, { userKeys: ['u-1'], farmIds: ['farm-x'] })).toBe(true)
  })

  it('userCanViewEvent applies farm gate for farm-scoped events', () => {
    const event = makeEvent({ visibility: { type: 'restricted', farms: ['farm-a'] } })
    expect(userCanViewEvent(event, { userKeys: ['u-1'], farmIds: ['farm-b'] })).toBe(false)
    expect(userCanViewEvent(event, { userKeys: ['u-1'], farmIds: ['farm-a'] })).toBe(true)
  })

  it('userCanViewEvent for unscoped events in farm context skips creator bypass', () => {
    const event = makeEvent({ createdBy: 'creator-1', visibility: { type: 'restricted' } })
    expect(userCanViewEvent(event, { userKeys: ['creator-1'], farmIds: ['farm-a'] })).toBe(false)
  })

  it('userCanViewEvent allows unscoped event when user is in participants in farm context', () => {
    const event = makeEvent({
      visibility: { type: 'restricted' },
      participants: [{ userId: 'u-1', name: 'U1', status: 'yes', respondedAt: now }],
    })

    expect(userCanViewEvent(event, { userKeys: ['u-1'], farmIds: ['farm-a'] })).toBe(true)
  })

  it('userCanViewEvent allows restricted user by explicit visibility users', () => {
    const event = makeEvent({ visibility: { type: 'restricted', users: ['u-7'] } })
    expect(userCanViewEvent(event, { userKeys: ['u-7'], farmIds: [] })).toBe(true)
  })

  it('userCanViewEvent falls back to participation visibility including status no', () => {
    const event = makeEvent({
      participation: {
        'u-3': { status: 'no', accessLevel: 'readonly' },
      },
    })

    expect(userCanViewEvent(event, { userKeys: ['u-3'], farmIds: [] })).toBe(true)
  })

  it('userCanChat requires status yes and access full', () => {
    const event = makeEvent({
      participation: {
        'u-1': { status: 'yes', accessLevel: 'full' },
        'u-2': { status: 'maybe', accessLevel: 'full' },
        'u-3': { status: 'yes', accessLevel: 'readonly' },
      },
    })

    expect(userCanChat(event, ['u-1'])).toBe(true)
    expect(userCanChat(event, ['u-2'])).toBe(false)
    expect(userCanChat(event, ['u-3'])).toBe(false)
  })

  it('isEventExpiredForSelection respects grace window on endDate', () => {
    const event = makeEvent({
      date: new Date('2026-03-10T09:00:00.000Z'),
      endDate: new Date('2026-03-11T09:00:00.000Z'),
    })

    const insideGrace = new Date('2026-03-14T12:00:00.000Z')
    const outsideGrace = new Date('2026-03-16T12:00:00.000Z')

    expect(isEventExpiredForSelection(event, insideGrace, 3)).toBe(false)
    expect(isEventExpiredForSelection(event, outsideGrace, 3)).toBe(true)
  })

  it('filterSelectableEvents excludes hidden and expired events', () => {
    const visibleActive = makeEvent({
      id: 'v1',
      date: new Date('2026-03-21T09:00:00.000Z'),
      participants: [{ userId: 'u-1', name: 'U1', status: 'yes', respondedAt: now }],
      visibility: { type: 'restricted' },
    })

    const hidden = makeEvent({
      id: 'h1',
      visibility: { type: 'restricted', users: ['u-2'] },
    })

    const expired = makeEvent({
      id: 'e1',
      date: new Date('2026-03-10T09:00:00.000Z'),
      visibility: { type: 'public' },
    })

    const output = filterSelectableEvents(
      [visibleActive, hidden, expired],
      { userKeys: ['u-1'], farmIds: [] },
      new Date('2026-03-20T12:00:00.000Z'),
      2,
    )

    expect(output.map(e => e.id)).toEqual(['v1'])
  })

  it('getSelectableEvents is alias of filterSelectableEvents', () => {
    const event = makeEvent({
      id: 'alias-1',
      visibility: { type: 'public' },
    })

    const output = getSelectableEvents([event], { userKeys: [], farmIds: [] }, now, 999)
    expect(output.map(e => e.id)).toEqual(['alias-1'])
  })
})
