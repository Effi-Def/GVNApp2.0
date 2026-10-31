import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useActiveFarmStore } from '../stores/useActiveFarmStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useChannelStore } from '../stores/useChannelStore'
import { useAppStore } from '../stores/AppStore'
import { farmService } from '../services/firestore'
import { channelDescriptor } from '../types/chat'
import { FarmMembership } from '../types'
import EventChat from '../components/Chat/EventChat'
import ChannelList from '../components/ChannelList'
import FarmSearch from '../components/FarmSearch'

const FarmChannelPage: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { activeFarmId, farms } = useActiveFarmStore()
  const { channelsByFarm, listenChannels, markRead, loadReads } = useChannelStore()

  const farmId = activeFarmId ?? ''
  const activeFarm = farms.find(f => f.id === farmId) ?? null
  const allEvents = useAppStore(s => s.events)

  const [members, setMembers] = useState<FarmMembership[]>([])

  // Start listening to channels for this farm
  useEffect(() => {
    if (!farmId) return
    return listenChannels(farmId)
  }, [farmId, listenChannels])

  // Subscribe to per-channel read timestamps
  useEffect(() => {
    if (!user?.id) return
    return loadReads(user.id)
  }, [user?.id, loadReads])

  // Load farm members for @mention list
  useEffect(() => {
    if (!farmId) return
    farmService.listMembers(farmId).then(setMembers).catch(() => {})
  }, [farmId])

  const channels = useMemo(
    () => (channelsByFarm[farmId] ?? []).filter(c => !c.isArchived),
    [channelsByFarm, farmId]
  )

  const activeChannel = channels.find(c => c.id === channelId)

  // Auto-select first channel if none specified or channelId is invalid
  useEffect(() => {
    if (!channelId && channels.length > 0) {
      navigate(`/farm/channels/${channels[0].id}`, { replace: true })
    } else if (channelId && channels.length > 0 && !activeChannel) {
      navigate(`/farm/channels/${channels[0].id}`, { replace: true })
    }
  }, [channelId, channels, activeChannel, navigate])

  const chatPeople = useMemo(
    () => members.map(m => ({ uid: m.userId, name: m.displayName ?? m.userId })),
    [members]
  )

  const descriptor = useMemo(
    () => channelId ? channelDescriptor(farmId, channelId) : null,
    [farmId, channelId]
  )

  const handleMarkRead = React.useCallback(async () => {
    if (!user?.id || !channelId) return
    await markRead(user.id, farmId, channelId)
  }, [user?.id, farmId, channelId, markRead])

  if (!activeFarm) {
    return (
      <div className="flex items-center justify-center h-screen text-[--text-muted] text-sm">
        Nessun gruppo attivo.
      </div>
    )
  }

  return (
    <div className="flex h-screen pt-14">
      {/* Sidebar — visible on md+ */}
      <aside className="hidden md:flex flex-col w-56 border-r border-[--border-base] bg-[--bg-subtle] flex-shrink-0">
        <div className="px-3 py-2.5 border-b border-[--border-base] flex items-center gap-2">
          <span className="font-semibold text-sm text-[--text-base] truncate min-w-0 flex-1">
            {activeFarm.iconEmoji ?? '🐷'} {activeFarm.name}
          </span>
          <FarmSearch farmId={farmId} channels={channels} farmEvents={allEvents} />
        </div>
        <ChannelList
          farmId={farmId}
          ownerId={activeFarm.ownerId}
          activeChannelId={channelId}
          onSelectChannel={id => navigate(`/farm/channels/${id}`)}
        />
      </aside>

      {/* Mobile channel picker — shown when no channel is selected */}
      {!channelId && (
        <div className="flex-1 flex flex-col md:hidden">
          <div className="px-4 py-3 border-b border-[--border-base] flex items-center gap-2">
            <button onClick={() => navigate('/farm')} className="text-[--text-muted] hover:text-[--text-base]">
              ←
            </button>
            <span className="font-semibold text-[--text-base]">Canali</span>
          </div>
          <ChannelList
            farmId={farmId}
            ownerId={activeFarm.ownerId}
            activeChannelId={channelId}
            onSelectChannel={id => navigate(`/farm/channels/${id}`)}
          />
        </div>
      )}

      {/* Chat area */}
      {descriptor && activeChannel ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[--border-base] bg-[--bg-card] flex-shrink-0">
            {/* Mobile: back to channel list */}
            <button
              className="md:hidden text-[--text-muted] hover:text-[--text-base] mr-1"
              onClick={() => navigate('/farm/channels')}
            >
              ←
            </button>
            <span className="font-semibold text-[--text-base]"># {activeChannel.name}</span>
            {activeChannel.description && (
              <span className="text-xs text-[--text-muted] hidden sm:inline truncate">— {activeChannel.description}</span>
            )}
          </div>

          <div className="flex-1 min-h-0">
            <EventChat
              chatDescriptor={descriptor}
              chatPeople={chatPeople}
              onMarkRead={handleMarkRead}
              eventName={`#${activeChannel.name}`}
              canWrite={true}
              className="h-full"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center text-[--text-muted] text-sm">
          Seleziona un canale dalla lista.
        </div>
      )}
    </div>
  )
}

export default FarmChannelPage
