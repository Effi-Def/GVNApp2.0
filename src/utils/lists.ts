import type { ListItem, ListItemAssignee, ListType, ShoppingList } from '../types'

export type ListPerson = { userId: string; name: string }

export const LIST_TYPES: { value: ListType; label: string }[] = [
  { value: 'shopping', label: 'Spesa' },
  { value: 'todo', label: 'Da fare' },
  { value: 'transport', label: 'Macchine' },
  { value: 'lodging', label: 'Stanze' },
]

export const ITEM_STATUS_LABELS: Record<NonNullable<ListItem['status']>, string> = {
  todo: 'Da fare',
  'in-progress': 'In corso',
  done: 'Fatto',
}

export const getListTypeLabel = (type?: ListType) =>
  LIST_TYPES.find(t => t.value === (type || 'shopping'))?.label ?? 'Spesa'

export const isSlotList = (type?: ListType) => type === 'transport' || type === 'lodging'

export const getDefaultCapacity = (type?: ListType) =>
  type === 'transport' ? 5 : type === 'lodging' ? 2 : undefined

export const getListStats = (list: ShoppingList) => {
  const total = list.items.length
  const completed = list.items.filter(i => i.completed).length
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { total, completed, percentage }
}

/** A list without event or farm stays with its creator, whatever `shared` says. */
export const isListShared = (list: ShoppingList) =>
  !!list.eventId || !!list.farmId || (list.sharedWith?.length ?? 0) > 1

// toISOString would move a local midnight to the previous day east of Greenwich
export const toLocalISODate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export const formatShortDate = (date?: Date): string => {
  if (!date) return ''
  const d = new Date(date)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const isPastDate = (date?: Date): boolean => {
  if (!date) return false
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return end.getTime() < Date.now()
}

export const isPastISODate = (iso?: string): boolean => {
  if (!iso) return false
  return new Date(`${iso}T23:59:59`).getTime() < Date.now()
}

const completionPatch = (completed: boolean, userId: string): Partial<ListItem> => ({
  completed,
  completedBy: completed ? userId : undefined,
  completedAt: completed ? new Date() : undefined,
})

export const getTogglePatch = (item: ListItem, type: ListType | undefined, userId: string): Partial<ListItem> => {
  const completed = !item.completed
  return {
    ...completionPatch(completed, userId),
    ...(type === 'todo' ? { status: completed ? 'done' as const : 'todo' as const } : {}),
  }
}

/** Next status of a to-do item, keeping the checkbox and the progress bar in sync. */
export const getNextStatusPatch = (item: ListItem, userId: string): Partial<ListItem> => {
  const status: ListItem['status'] =
    item.status === 'done' ? 'todo' : item.status === 'in-progress' ? 'done' : 'in-progress'
  return { status, ...completionPatch(status === 'done', userId) }
}

export const createListItem = (text: string, type: ListType | undefined, userId: string): ListItem => ({
  id: Math.random().toString(36).slice(2),
  text,
  completed: false,
  addedBy: userId,
  addedAt: new Date(),
  status: type === 'todo' ? 'todo' : undefined,
  capacity: getDefaultCapacity(type),
})

/** New items from the edit form, keeping progress and assignees of the ones that did not change. */
export const mergeEditedItems = (
  existing: ListItem[],
  texts: string[],
  type: ListType | undefined,
  userId: string,
): ListItem[] => {
  const available = [...existing]
  return texts.map(text => {
    const index = available.findIndex(item => item.text === text)
    if (index >= 0) return available.splice(index, 1)[0]
    return createListItem(text, type, userId)
  })
}

/** Turns typed names into assignees, linking the ones that match a known person. */
export const namesToAssignees = (
  names: string[],
  people: ListPerson[],
  current: ListItemAssignee[] = [],
): ListItemAssignee[] =>
  names.map(name => {
    const known = current.find(a => a.userName === name)
    if (known) return known
    const person = people.find(p => p.name === name)
    return person ? { userId: person.userId, userName: person.name } : { userName: name }
  })

export const assigneeKey = (assignee: ListItemAssignee) => assignee.userId || assignee.userName

/** People already placed in another car or room of the same list. */
export const getTakenElsewhere = (list: ShoppingList, itemId: string): Set<string> => {
  const taken = new Set<string>()
  for (const item of list.items) {
    if (item.id !== itemId) (item.assignees || []).forEach(a => taken.add(assigneeKey(a)))
  }
  return taken
}
