import React, { useEffect, useState } from 'react'
import { useChannelStore } from '../stores/useChannelStore'
import { useAuthStore } from '../stores/useAuthStore'
import { channelService } from '../services/firestore'
import { Channel } from '../types'

const MAX_CHANNELS = 10

interface Props {
  farmId: string
  ownerId: string
  activeChannelId?: string
  onSelectChannel: (channelId: string) => void
}

const ChannelList: React.FC<Props> = ({ farmId, ownerId, activeChannelId, onSelectChannel }) => {
  const { user } = useAuthStore()
  const { channelsByFarm, listenChannels, getUnread } = useChannelStore()
  const channels = (channelsByFarm[farmId] ?? []).filter(c => !c.isArchived)
  const archivedChannels = (channelsByFarm[farmId] ?? []).filter(c => c.isArchived)
  const isOwner = user?.id === ownerId

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    const unsub = listenChannels(farmId)
    return unsub
  }, [farmId, listenChannels])

  // Subscribe to channelReads for unread state
  useEffect(() => {
    if (!user?.id) return
    return useChannelStore.getState().loadReads(user.id)
  }, [user?.id])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || !newName.trim()) return
    setCreateError(null)
    try {
      const channel = await channelService.create(farmId, {
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        createdBy: user.id,
      })
      setNewName('')
      setNewDesc('')
      setCreating(false)
      onSelectChannel(channel.id)
    } catch (err: any) {
      setCreateError(err?.message ?? 'Errore nella creazione del canale')
    }
  }

  const handleArchive = async (ch: Channel) => {
    if (!confirm(`Archiviare #${ch.name}? I messaggi non verranno eliminati.`)) return
    try { await channelService.archive(farmId, ch.id) } catch {}
  }

  const handleUnarchive = async (ch: Channel) => {
    try { await channelService.unarchive(farmId, ch.id) } catch {}
  }

  const activeCount = channels.length
  const atLimit = activeCount >= MAX_CHANNELS

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[--border-base]">
        <span className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider">Canali</span>
        {isOwner && !creating && (
          <button
            onClick={() => setCreating(true)}
            disabled={atLimit}
            title={atLimit ? `Limite di ${MAX_CHANNELS} canali raggiunto` : 'Nuovo canale'}
            className="text-[--text-muted] hover:text-[--text-base] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate} className="px-3 py-2 space-y-2 border-b border-[--border-base] bg-[--bg-subtle]">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="nome-canale"
            maxLength={32}
            className="w-full text-sm px-2 py-1.5 rounded-lg border border-[--border-base] bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Descrizione (opzionale)"
            maxLength={80}
            className="w-full text-sm px-2 py-1.5 rounded-lg border border-[--border-base] bg-[--bg-card] text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {createError && <p className="text-xs text-red-500">{createError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={!newName.trim()} className="flex-1 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg disabled:opacity-50 hover:bg-primary-700">
              Crea
            </button>
            <button type="button" onClick={() => { setCreating(false); setCreateError(null) }} className="flex-1 py-1.5 text-sm text-[--text-muted] rounded-lg hover:bg-[--bg-raised]">
              Annulla
            </button>
          </div>
        </form>
      )}

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-1">
        {channels.map(ch => {
          const unread = getUnread(ch.id, ch)
          const active = ch.id === activeChannelId
          return (
            <div
              key={ch.id}
              className={`group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer rounded-lg mx-1 transition-colors ${
                active
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'hover:bg-[--bg-subtle] text-[--text-muted] hover:text-[--text-base]'
              }`}
              onClick={() => onSelectChannel(ch.id)}
            >
              <span className="text-sm font-medium select-none">#</span>
              <span className={`flex-1 text-sm truncate ${unread ? 'font-semibold text-[--text-base]' : ''}`}>
                {ch.name}
              </span>
              {unread && (
                <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
              )}
              {isOwner && !ch.isDefault && (
                <button
                  onClick={e => { e.stopPropagation(); handleArchive(ch) }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-[--text-muted] hover:text-red-500 transition-all"
                  title="Archivia canale"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12h12L19 8" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}

        {/* Archived section */}
        {isOwner && archivedChannels.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowArchived(v => !v)}
              className="w-full px-3 py-1 text-xs text-[--text-muted] hover:text-[--text-base] text-left"
            >
              {showArchived ? '▾' : '▸'} Archiviati ({archivedChannels.length})
            </button>
            {showArchived && archivedChannels.map(ch => (
              <div key={ch.id} className="group flex items-center gap-1.5 px-3 py-1 mx-1 rounded-lg">
                <span className="text-xs text-[--text-muted]">#</span>
                <span className="flex-1 text-xs text-[--text-muted] line-through truncate">{ch.name}</span>
                <button
                  onClick={() => handleUnarchive(ch)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-primary-600 hover:underline"
                >
                  Ripristina
                </button>
              </div>
            ))}
          </div>
        )}

        {channels.length === 0 && !creating && (
          <p className="px-3 py-3 text-xs text-[--text-muted] italic">
            Nessun canale. {isOwner ? 'Creane uno!' : ''}
          </p>
        )}
      </div>

      {atLimit && (
        <p className="px-3 py-2 text-xs text-[--text-muted] border-t border-[--border-base]">
          Limite di {MAX_CHANNELS} canali raggiunto.
        </p>
      )}
    </div>
  )
}

export default ChannelList
