import type { ListItem, ListItemAssignee, ShoppingList } from '../../types'
import {
  assigneeKey,
  getDefaultCapacity,
  getTakenElsewhere,
  isSlotList,
  namesToAssignees,
  type ListPerson,
} from '../../utils/lists'

type Props = {
  list: ShoppingList
  item: ListItem
  people: ListPerson[]
  onChange: (patch: Partial<ListItem>) => void
  onClose: () => void
}

export default function ListAssigneesPopover({ list, item, people, onChange, onClose }: Props) {
  const assignees = item.assignees || []
  const slot = isSlotList(list.type)
  const capacity = slot ? (item.capacity ?? getDefaultCapacity(list.type)) : undefined
  const takenElsewhere = slot ? getTakenElsewhere(list, item.id) : new Set<string>()

  const isDriver = (key: string) => !!item.driver && assigneeKey(item.driver) === key

  const toggle = (person: ListPerson, checked: boolean) => {
    const key = person.userId || person.name
    if (checked && capacity !== undefined && assignees.length >= capacity) {
      alert('Capacità raggiunta')
      return
    }
    const next: ListItemAssignee[] = checked
      ? [...assignees.filter(a => assigneeKey(a) !== key), { userId: person.userId, userName: person.name }]
      : assignees.filter(a => assigneeKey(a) !== key)
    onChange({ assignees: next, driver: !checked && isDriver(key) ? undefined : item.driver })
  }

  const addManually = () => {
    const current = assignees.map(a => a.userName).join(', ')
    const answer = prompt('Aggiungi nominativi (separati da virgola):', current)
    if (answer === null) return
    const names = Array.from(new Set(answer.split(',').map(s => s.trim()).filter(Boolean)))
    const next = namesToAssignees(names, people, assignees)
      .filter(a => !takenElsewhere.has(assigneeKey(a)))
      .slice(0, capacity)
    const keptDriver = item.driver && next.some(a => assigneeKey(a) === assigneeKey(item.driver!))
    onChange({ assignees: next, driver: keptDriver ? item.driver : undefined })
  }

  return (
    <div className="absolute right-0 top-8 z-20 w-64 max-h-64 overflow-auto bg-[--bg-card] border border-[--border-base] rounded-lg shadow-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-[--text-muted]">Assegna Maiali</div>
        <button type="button" onClick={onClose} className="text-[--text-muted] hover:text-[--text-base]" aria-label="Chiudi">✖</button>
      </div>

      {people.length > 0 ? (
        <div className="space-y-2">
          {people.map(person => {
            const key = person.userId || person.name
            const checked = assignees.some(a => assigneeKey(a) === key)
            const disabled = !checked && takenElsewhere.has(key)
            return (
              <label
                key={key}
                className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={disabled ? 'Già assegnato altrove' : ''}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => toggle(person, e.target.checked)}
                />
                <span>{person.name}</span>
              </label>
            )
          })}
        </div>
      ) : (
        <div className="text-xs text-[--text-muted]">Nessun Maiale da mostrare. Aggiungi i nomi a mano.</div>
      )}

      {list.type === 'transport' && (
        <div className="mt-3 border-t border-[--border-base] pt-2">
          <label className="block text-xs text-[--text-muted] mb-1">Guidatore:</label>
          <select
            value={item.driver ? assigneeKey(item.driver) : ''}
            onChange={(e) => {
              const found = assignees.find(a => assigneeKey(a) === e.target.value)
              onChange({ driver: found ? { userId: found.userId, userName: found.userName } : undefined })
            }}
            className="w-full px-2 py-1 border border-[--border-base] rounded-lg text-sm bg-[--bg-card] text-[--text-base]"
          >
            <option value="">Nessuno</option>
            {assignees.map(a => (
              <option key={assigneeKey(a)} value={assigneeKey(a)}>{a.userName}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 border-t border-[--border-base] pt-2">
        <button type="button" onClick={addManually} className="text-xs text-blue-600 hover:underline">
          Aggiungi manualmente…
        </button>
      </div>
    </div>
  )
}
