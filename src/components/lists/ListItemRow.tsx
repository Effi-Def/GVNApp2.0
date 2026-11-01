import { useRef, useState } from 'react'
import type { ListItem, ShoppingList } from '../../types'
import {
  formatShortDate,
  getDefaultCapacity,
  getNextStatusPatch,
  ITEM_STATUS_LABELS,
  isPastDate,
  isSlotList,
  toLocalISODate,
  type ListPerson,
} from '../../utils/lists'
import ListAssigneesPopover from './ListAssigneesPopover'

type Props = {
  list: ShoppingList
  item: ListItem
  people: ListPerson[]
  currentUserId: string
  onToggle: () => void
  onPatch: (patch: Partial<ListItem>) => void
  onRemove: () => void
}

const chipClass = 'text-xs px-2 py-1 rounded border border-[--border-base] text-[--text-muted] hover:bg-[--bg-subtle]'

export default function ListItemRow({ list, item, people, currentUserId, onToggle, onPatch, onRemove }: Props) {
  const [assigneesOpen, setAssigneesOpen] = useState(false)
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const slot = isSlotList(list.type)
  const assigned = item.assignees?.length || 0
  const capacity = item.capacity ?? getDefaultCapacity(list.type)

  const openDatePicker = () => {
    const input = dateInputRef.current
    if (input && typeof input.showPicker === 'function') input.showPicker()
    else input?.click()
  }

  const assigneesChip = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAssigneesOpen(open => !open)}
        className={chipClass}
        title="Assegna Maiali"
        aria-expanded={assigneesOpen}
      >
        👤 {assigned}
      </button>
      {assigneesOpen && (
        <ListAssigneesPopover
          list={list}
          item={item}
          people={people}
          onChange={onPatch}
          onClose={() => setAssigneesOpen(false)}
        />
      )}
    </div>
  )

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 rounded-lg hover:bg-[--bg-subtle] transition-colors">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={item.completed}
        aria-label={item.completed ? `Segna da fare: ${item.text}` : `Segna fatto: ${item.text}`}
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all duration-200 ${
          item.completed ? 'bg-green-500 border-green-500' : 'border-[--border-base] hover:border-green-500'
        }`}
      >
        {item.completed && (
          <svg className="w-4 h-4 text-white mx-auto mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <span className={`flex-1 min-w-[6rem] break-words ${item.completed ? 'line-through text-[--text-muted]' : 'text-[--text-base]'}`}>
        {item.text}
        {slot && (
          <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-[--bg-raised] text-[--text-muted] align-middle">
            {assigned}/{capacity}
          </span>
        )}
        {list.type === 'transport' && item.driver && (
          <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 align-middle">🚗 {item.driver.userName}</span>
        )}
      </span>

      {list.type === 'todo' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPatch(getNextStatusPatch(item, currentUserId))}
            className={`text-xs px-2 py-1 rounded-full border ${
              item.status === 'done' ? 'bg-green-500/10 text-green-600 border-green-500/30' :
              item.status === 'in-progress' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' :
              'bg-[--bg-raised] text-[--text-muted] border-[--border-base]'
            }`}
            title="Cambia stato"
          >
            {ITEM_STATUS_LABELS[item.status || 'todo']}
          </button>
          {/* Compact date chip + hidden native picker to avoid oversized mobile date input */}
          <input
            type="date"
            ref={dateInputRef}
            value={item.dueDate ? toLocalISODate(new Date(item.dueDate)) : ''}
            onChange={(e) => {
              const value = e.target.value
              onPatch({ dueDate: value ? new Date(`${value}T00:00:00`) : undefined })
            }}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={openDatePicker}
            className={`text-[10px] px-2 py-1 rounded border hover:bg-[--bg-subtle] ${
              item.dueDate && isPastDate(item.dueDate) && !item.completed
                ? 'bg-red-500/10 border-red-500/30 text-red-600'
                : 'border-[--border-base] text-[--text-muted]'
            }`}
            title="Scadenza"
          >
            📅 {item.dueDate ? formatShortDate(item.dueDate) : 'Data'}
          </button>
          {assigneesChip}
        </div>
      )}

      {slot && (
        <div className="flex items-center gap-2">
          {list.type === 'lodging' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const name = prompt('Rinomina stanza:', item.text)
                  if (name && name.trim()) onPatch({ text: name.trim() })
                }}
                className={chipClass}
                title="Rinomina stanza"
              >✏️</button>
              <button
                type="button"
                onClick={() => onPatch({ capacity: (capacity ?? 2) + 1 })}
                className={chipClass}
                title="Aggiungi posto"
              >➕</button>
              <button
                type="button"
                onClick={() => {
                  const current = capacity ?? 2
                  if (current <= 1 || current - 1 < assigned) return
                  onPatch({ capacity: current - 1 })
                }}
                className={chipClass}
                title="Rimuovi posto"
              >➖</button>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Eliminare questa stanza?')) onRemove()
                }}
                className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-600 hover:bg-red-500/10"
                title="Elimina stanza"
              >🗑️</button>
            </div>
          )}
          {assigneesChip}
        </div>
      )}

      {item.completed && item.completedBy && (
        <span className="text-xs text-green-600">
          ✓ {item.completedBy === currentUserId ? 'Da te' : 'Completato'}
        </span>
      )}
    </div>
  )
}
