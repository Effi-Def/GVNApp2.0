import type { ListItem, ShoppingList } from '../../types'
import { getListStats, getListTypeLabel, isListShared, type ListPerson } from '../../utils/lists'
import ListItemRow from './ListItemRow'

type Props = {
  list: ShoppingList
  eventTitle?: string
  people: ListPerson[]
  currentUserId: string
  onEdit: () => void
  onDelete: () => void
  onToggleItem: (item: ListItem) => void
  onPatchItem: (itemId: string, patch: Partial<ListItem>) => void
  onRemoveItem: (itemId: string) => void
  onAddItem: (text: string) => void
}

export default function ListCard({
  list,
  eventTitle,
  people,
  currentUserId,
  onEdit,
  onDelete,
  onToggleItem,
  onPatchItem,
  onRemoveItem,
  onAddItem,
}: Props) {
  const stats = getListStats(list)
  const shared = isListShared(list)

  return (
    <div className="bg-[--bg-card] rounded-xl shadow-sm border border-[--border-base] p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold text-[--text-base] mb-2 break-words">{list.title}</h3>
          {list.description && (
            <p className="text-[--text-muted] mb-3 break-words">{list.description}</p>
          )}
          <div className="flex items-center flex-wrap gap-2 text-xs text-[--text-muted] mb-4">
            <span>📅 {list.createdAt.toLocaleDateString('it-IT')}</span>
            <span>📊 {stats.completed}/{stats.total} ({stats.percentage}%)</span>
            <span className="px-1.5 py-0.5 bg-[--bg-raised] text-[--text-muted] text-[10px] rounded-full">🏷️ {getListTypeLabel(list.type)}</span>
            {list.eventId && (
              <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 text-[10px] rounded-full">
                📅 {eventTitle || 'Evento'}
              </span>
            )}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
              shared ? 'bg-blue-500/10 text-blue-600' : 'bg-[--bg-raised] text-[--text-muted]'
            }`}>
              {shared ? 'Condivisa' : 'Solo tu'}
            </span>
          </div>
          <div className="w-full bg-[--bg-raised] rounded-full h-2 mb-4">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
        </div>
        {list.createdBy === currentUserId && (
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onEdit}
              className="p-2 text-blue-600 hover:bg-blue-500/10 rounded-lg transition-colors"
              title="Modifica lista"
              aria-label={`Modifica ${list.title}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-2 text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Elimina lista"
              aria-label={`Elimina ${list.title}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {list.items.map(item => (
          <ListItemRow
            key={item.id}
            list={list}
            item={item}
            people={people}
            currentUserId={currentUserId}
            onToggle={() => onToggleItem(item)}
            onPatch={(patch) => onPatchItem(item.id, patch)}
            onRemove={() => onRemoveItem(item.id)}
          />
        ))}

        <div className="pt-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = e.currentTarget
              const text = String(new FormData(form).get('newItem') || '').trim()
              if (!text) return
              onAddItem(text)
              form.reset()
            }}
            className="flex space-x-2"
          >
            <input
              name="newItem"
              type="text"
              placeholder="Aggiungi nuovo elemento..."
              aria-label={`Aggiungi elemento a ${list.title}`}
              className="flex-1 min-w-0 px-3 py-2 border border-[--border-base] rounded-lg bg-[--bg-card] text-[--text-base] focus:outline-none focus:border-green-500 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
            >
              Aggiungi
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
