import { describe, expect, it } from 'vitest'
import type { ListItem, ShoppingList } from '../types'
import {
  createListItem,
  getListStats,
  getNextStatusPatch,
  getTakenElsewhere,
  getTogglePatch,
  isListShared,
  mergeEditedItems,
  namesToAssignees,
  toLocalISODate,
} from './lists'

const item = (overrides: Partial<ListItem>): ListItem => ({
  id: 'i',
  text: 'Pane',
  completed: false,
  addedBy: 'u1',
  addedAt: new Date('2030-01-01T10:00:00.000Z'),
  ...overrides,
})

const list = (overrides: Partial<ShoppingList>): ShoppingList => ({
  id: 'l',
  title: 'Lista',
  items: [],
  createdBy: 'u1',
  createdAt: new Date('2030-01-01T10:00:00.000Z'),
  updatedAt: new Date('2030-01-01T10:00:00.000Z'),
  ...overrides,
})

describe('toLocalISODate', () => {
  it('keeps the local day, unlike toISOString', () => {
    expect(toLocalISODate(new Date(2030, 10, 5, 0, 0, 0))).toBe('2030-11-05')
  })
})

describe('getNextStatusPatch', () => {
  it('ticks the item when it becomes done', () => {
    const patch = getNextStatusPatch(item({ status: 'in-progress' }), 'u2')
    expect(patch.status).toBe('done')
    expect(patch.completed).toBe(true)
    expect(patch.completedBy).toBe('u2')
  })

  it('unticks the item when it leaves done', () => {
    const patch = getNextStatusPatch(item({ status: 'done', completed: true, completedBy: 'u2' }), 'u3')
    expect(patch.status).toBe('todo')
    expect(patch.completed).toBe(false)
    expect(patch.completedBy).toBeUndefined()
  })

  it('moves a to-do item to in progress without ticking it', () => {
    const patch = getNextStatusPatch(item({ status: 'todo' }), 'u2')
    expect(patch.status).toBe('in-progress')
    expect(patch.completed).toBe(false)
  })
})

describe('getTogglePatch', () => {
  it('syncs the status only on to-do lists', () => {
    expect(getTogglePatch(item({}), 'todo', 'u2').status).toBe('done')
    expect(getTogglePatch(item({}), 'shopping', 'u2')).not.toHaveProperty('status')
  })
})

describe('getListStats', () => {
  it('counts completed items', () => {
    const stats = getListStats(list({ items: [item({ completed: true }), item({}), item({})] }))
    expect(stats).toEqual({ total: 3, completed: 1, percentage: 33 })
  })

  it('handles an empty list', () => {
    expect(getListStats(list({})).percentage).toBe(0)
  })
})

describe('isListShared', () => {
  it('is false for a list only its creator can see', () => {
    expect(isListShared(list({ shared: true, sharedWith: ['u1'] }))).toBe(false)
  })

  it('is true with an event, a farm or more people', () => {
    expect(isListShared(list({ eventId: 'e' }))).toBe(true)
    expect(isListShared(list({ farmId: 'f' }))).toBe(true)
    expect(isListShared(list({ sharedWith: ['u1', 'u2'] }))).toBe(true)
  })
})

describe('mergeEditedItems', () => {
  it('keeps progress of unchanged items and adds the new ones', () => {
    const done = item({ id: 'a', text: 'Pane', completed: true })
    const merged = mergeEditedItems([done, item({ id: 'b', text: 'Vino' })], ['Pane', 'Birra'], 'shopping', 'u1')
    expect(merged[0]).toBe(done)
    expect(merged[1].text).toBe('Birra')
    expect(merged[1].completed).toBe(false)
    expect(merged).toHaveLength(2)
  })

  it('handles repeated texts without reusing an item twice', () => {
    const first = item({ id: 'a', text: 'Pane' })
    const merged = mergeEditedItems([first], ['Pane', 'Pane'], 'shopping', 'u1')
    expect(merged[0]).toBe(first)
    expect(merged[1].id).not.toBe('a')
  })
})

describe('createListItem', () => {
  it('sets the fields of each type', () => {
    expect(createListItem('x', 'todo', 'u').status).toBe('todo')
    expect(createListItem('x', 'transport', 'u').capacity).toBe(5)
    expect(createListItem('x', 'lodging', 'u').capacity).toBe(2)
    expect(createListItem('x', 'shopping', 'u').capacity).toBeUndefined()
  })
})

describe('namesToAssignees', () => {
  it('links known people and keeps existing assignees', () => {
    const result = namesToAssignees(
      ['Anna', 'Marco', 'Ospite'],
      [{ userId: 'u2', name: 'Marco' }],
      [{ userId: 'u1', userName: 'Anna' }],
    )
    expect(result).toEqual([
      { userId: 'u1', userName: 'Anna' },
      { userId: 'u2', userName: 'Marco' },
      { userName: 'Ospite' },
    ])
  })
})

describe('getTakenElsewhere', () => {
  it('collects people assigned to the other slots', () => {
    const taken = getTakenElsewhere(list({
      items: [
        item({ id: 'a', assignees: [{ userId: 'u1', userName: 'Anna' }] }),
        item({ id: 'b', assignees: [{ userName: 'Ospite' }] }),
      ],
    }), 'a')
    expect([...taken]).toEqual(['Ospite'])
  })
})
