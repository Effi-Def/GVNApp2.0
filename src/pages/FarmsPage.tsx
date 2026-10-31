import React from 'react'
import { useNavigate } from 'react-router-dom'
import { farmService, userPrivateService } from '../services/firestore'
import { useAuthStore } from '../stores/useAuthStore'
import { useAppStore } from '../stores/AppStore'
import { Farm, FarmJoinRequest, FarmMembership } from '../types'

const FarmsPage: React.FC = () => {
  const { user } = useAuthStore()
  const { setFarmIds } = useAppStore() as any
  const navigate = useNavigate()

  const [loading, setLoading] = React.useState(true)
  const [farms, setFarms] = React.useState<Farm[]>([])
  const [creating, setCreating] = React.useState(false)
  const [newFarmName, setNewFarmName] = React.useState('')

  const [joinValue, setJoinValue] = React.useState('')
  const [joinLoading, setJoinLoading] = React.useState(false)

  const [openRequestsFor, setOpenRequestsFor] = React.useState<string | null>(null)
  const [requestsLoading, setRequestsLoading] = React.useState(false)
  const [requests, setRequests] = React.useState<Record<string, FarmJoinRequest[]>>({})

  const [openMembersFor, setOpenMembersFor] = React.useState<string | null>(null)
  const [membersLoading, setMembersLoading] = React.useState(false)
  const [members, setMembers] = React.useState<Record<string, FarmMembership[]>>({})
  const [kickingId, setKickingId] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      await userPrivateService.ensure(user.id)
      const [myFarms, myFarmIds] = await Promise.all([
        farmService.getMyFarms(user.id),
        userPrivateService.getFarmIds(user.id),
      ])
      setFarms(myFarms)
      try { setFarmIds(myFarmIds) } catch {}
    } finally {
      setLoading(false)
    }
  }, [user?.id, setFarmIds])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const inviteLinkFor = (token: string) => `${window.location.origin}/farms/join/${token}`

  const copyInvite = async (token?: string) => {
    if (!token) return
    const link = inviteLinkFor(token)
    try {
      await navigator.clipboard.writeText(link)
      alert('Link copiato')
    } catch {
      prompt('Copia il link:', link)
    }
  }

  const loadRequests = async (farmId: string) => {
    setRequestsLoading(true)
    try {
      const list = await farmService.listPendingJoinRequests(farmId)
      setRequests(prev => ({ ...prev, [farmId]: list }))
    } catch (e) {
      console.error(e)
      setRequests(prev => ({ ...prev, [farmId]: [] }))
      const anyErr: any = e
      const code = typeof anyErr?.code === 'string' ? anyErr.code : ''
      const msg = typeof anyErr?.message === 'string' ? anyErr.message : ''
      alert(`Errore durante il caricamento delle richieste pendenti.${code ? `\n\nCodice: ${code}` : ''}${msg ? `\n${msg}` : ''}`)
    } finally {
      setRequestsLoading(false)
    }
  }

  const loadMembers = async (farmId: string) => {
    setMembersLoading(true)
    try {
      const list = await farmService.listMembers(farmId)
      setMembers(prev => ({ ...prev, [farmId]: list }))
    } catch (e) {
      console.error(e)
      setMembers(prev => ({ ...prev, [farmId]: [] }))
      const anyErr: any = e
      const code = typeof anyErr?.code === 'string' ? anyErr.code : ''
      const msg = typeof anyErr?.message === 'string' ? anyErr.message : ''
      alert(`Errore durante il caricamento dei maiali.${code ? `\n\nCodice: ${code}` : ''}${msg ? `\n${msg}` : ''}`)
    } finally {
      setMembersLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="pt-16 px-6 pb-6 max-w-3xl mx-auto">
        <div className="bg-[--bg-card] border border-[--border-base] rounded-2xl p-4">
          <p className="text-sm text-[--text-muted]">Accesso richiesto.</p>
        </div>
      </div>
    )
  }

  const normalizeInviteToken = (raw: string): string => {
    const v = (raw || '').trim()
    if (!v) return ''
    // Accept full URL like https://.../farms/join/<token>
    const idx = v.indexOf('/farms/join/')
    if (idx >= 0) {
      const after = v.slice(idx + '/farms/join/'.length)
      return after.split(/[?#/]/)[0] || ''
    }
    return v.split(/[?#/]/)[0] || ''
  }

  const cardCls = 'bg-[--bg-card] border border-[--border-base] rounded-2xl p-4'
  const inputCls = 'flex-1 rounded-xl border border-[--border-base] bg-[--bg-card] text-[--text-base] placeholder:text-[--text-muted] px-3 py-2.5 text-sm focus:outline-none focus:border-primary-500 transition-all'
  const btnSec = 'px-3 py-2 rounded-xl text-sm border border-[--border-base] bg-[--bg-subtle] hover:bg-[--bg-raised] text-[--text-base] transition-colors disabled:opacity-50'

  return (
    <div className="pt-16 px-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[--text-base]">Fattorie</h1>
        <button type="button" className={btnSec} onClick={() => refresh()} disabled={loading}>
          Aggiorna
        </button>
      </div>

      <div className={cardCls}>
        <h2 className="font-semibold text-[--text-base] mb-3">Crea una fattoria</h2>
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="Es. Fattoria degli amici"
            value={newFarmName}
            onChange={(e) => setNewFarmName(e.target.value)}
          />
          <button
            type="button"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-60"
            disabled={creating || !newFarmName.trim()}
            onClick={async () => {
              if (!newFarmName.trim()) return
              setCreating(true)
              try {
                await farmService.createFarm({ name: newFarmName, ownerId: user.id })
                setNewFarmName('')
                await refresh()
              } catch (e) {
                console.error(e)
                alert('Errore durante la creazione')
              } finally {
                setCreating(false)
              }
            }}
          >
            {creating ? 'Creazione...' : 'Crea'}
          </button>
        </div>
      </div>

      <div className="bg-[--bg-card] border border-[--border-base] rounded-2xl p-4">
        <h2 className="font-semibold text-[--text-base] mb-1">Entra con invito</h2>
        <p className="text-xs text-[--text-muted] mb-3">Incolla il codice o il link d'invito.</p>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-lg px-3 py-2"
            placeholder="Codice invito oppure link"
            value={joinValue}
            onChange={(e) => setJoinValue(e.target.value)}
          />
          <button
            type="button"
            className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 hover:brightness-110 transition-all"
            disabled={joinLoading || !normalizeInviteToken(joinValue)}
            onClick={async () => {
              const token = normalizeInviteToken(joinValue)
              if (!token) return
              setJoinLoading(true)
              try { navigate(`/farms/join/${token}`) } finally { setJoinLoading(false) }
            }}
          >
            Apri
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-[--text-muted] px-1">Caricamento...</p>}

      {!loading && farms.length === 0 && (
        <div className={cardCls}>
          <p className="text-sm text-[--text-muted]">Non sei ancora in nessuna fattoria.</p>
        </div>
      )}

      <div className="space-y-4">
        {farms.map((farm) => {
          const isOwner = farm.ownerId === user.id
          const pending = requests[farm.id] || []
          const isOpen = openRequestsFor === farm.id

          const farmMembers = members[farm.id] || []
          const isMembersOpen = openMembersFor === farm.id

          return (
            <div key={farm.id} className={cardCls}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[--text-base]">{farm.name}</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-[--bg-subtle] text-[--text-muted]">
                      {isOwner ? '👑 Re Maiale' : 'Maiale'}
                    </span>
                  </div>
                  {typeof farm.memberCount === 'number' && (
                    <p className="text-xs text-[--text-muted] mt-1">{farm.memberCount} {farm.memberCount === 1 ? 'maiale' : 'maiali'}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isOwner && (
                    <>
                      <button
                        type="button"
                        className={btnSec}
                        onClick={() => copyInvite(farm.inviteTokenId)}
                        disabled={!farm.inviteTokenId}
                      >
                        🔗 Invita
                      </button>
                      <button
                        type="button"
                        className={btnSec}
                        onClick={async () => {
                          if (!confirm('Rigenerare il link? Il precedente smetterà di funzionare.')) return
                          try {
                            const newToken = await farmService.regenerateInviteToken({
                              farmId: farm.id,
                              ownerId: user.id,
                              currentToken: farm.inviteTokenId,
                            })
                            await copyInvite(newToken)
                            await refresh()
                          } catch (e) {
                            console.error(e)
                            alert('Errore durante la rigenerazione')
                          }
                        }}
                      >
                        Rigenera link
                      </button>
                    </>
                  )}
                  {!isOwner && (
                    <button
                      type="button"
                      className="px-3 py-2 rounded-xl text-sm border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      onClick={async () => {
                        if (!confirm('Uscire dalla fattoria?')) return
                        try {
                          await farmService.leaveFarm({ farmId: farm.id, userId: user.id })
                          await refresh()
                        } catch (e) {
                          console.error(e)
                          alert('Errore durante l\'uscita')
                        }
                      }}
                    >
                      Esci
                    </button>
                  )}
                </div>
              </div>

              {isOwner && (
                <div className="mt-4">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline"
                      onClick={async () => {
                        const next = isMembersOpen ? null : farm.id
                        setOpenMembersFor(next)
                        if (next) await loadMembers(farm.id)
                      }}
                    >
                      Maiali{farmMembers.length ? ` (${farmMembers.length})` : ''}
                    </button>

                    <button
                      type="button"
                      className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline"
                      onClick={async () => {
                        const next = isOpen ? null : farm.id
                        setOpenRequestsFor(next)
                        if (next) await loadRequests(farm.id)
                      }}
                    >
                      Richieste{pending.length ? ` (${pending.length})` : ''}
                    </button>
                  </div>

                  {isMembersOpen && (
                    <div className="mt-3 border border-[--border-base] rounded-xl p-3 bg-[--bg-subtle] space-y-2">
                      {membersLoading && <p className="text-xs text-[--text-muted]">Caricamento...</p>}
                      {!membersLoading && farmMembers.length === 0 && (
                        <p className="text-xs text-[--text-muted]">Nessun maiale trovato.</p>
                      )}
                      {!membersLoading && farmMembers.length > 0 && (
                        <div className="space-y-2">
                          {farmMembers.map((m) => (
                            <div key={m.userId} className="flex items-center gap-3 bg-[--bg-card] border border-[--border-base] rounded-xl p-2">
                              {m.photoURL ? (
                                <img src={m.photoURL} alt="" className="w-8 h-8 rounded-full" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-[--bg-raised]" />
                              )}
                              <div className="text-sm text-[--text-base] flex-1">
                                <div className="font-medium">{m.displayName || m.userId}</div>
                                <div className="text-xs text-[--text-muted]">{m.role === 'owner' ? '👑 Re Maiale' : 'Maiale'}</div>
                              </div>
                              {isOwner && m.role !== 'owner' && (
                                <button
                                  type="button"
                                  disabled={kickingId === m.userId}
                                  className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                                  onClick={async () => {
                                    const name = m.displayName || m.userId
                                    if (!confirm(`Rimuovere ${name} dalla fattoria?`)) return
                                    setKickingId(m.userId)
                                    try {
                                      await farmService.removeMember({ farmId: farm.id, ownerId: user.id, memberId: m.userId })
                                      await loadMembers(farm.id)
                                      await refresh()
                                    } catch (e) {
                                      console.error(e)
                                      alert('Errore durante la rimozione')
                                    } finally {
                                      setKickingId(null)
                                    }
                                  }}
                                >
                                  {kickingId === m.userId ? '…' : '🚫 Rimuovi'}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {isOpen && (
                    <div className="mt-3 border border-[--border-base] rounded-xl p-3 bg-[--bg-subtle] space-y-2">
                      {requestsLoading && <p className="text-xs text-[--text-muted]">Caricamento richieste...</p>}
                      {!requestsLoading && pending.length === 0 && (
                        <p className="text-xs text-[--text-muted]">Nessuna richiesta pendente.</p>
                      )}
                      {!requestsLoading && pending.length > 0 && (
                        <div className="space-y-2">
                          {pending.map((r) => (
                            <div key={r.id} className="flex items-center justify-between gap-3 bg-[--bg-card] border border-[--border-base] rounded-xl p-2">
                              <div className="text-sm text-[--text-base]">
                                {r.displayName || r.userId}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium"
                                  onClick={async () => {
                                    try {
                                      await farmService.approveJoinRequest({ farmId: farm.id, ownerId: user.id, userId: r.userId })
                                      await loadRequests(farm.id)
                                    } catch (e) {
                                      console.error(e)
                                      alert('Errore durante approvazione')
                                    }
                                  }}
                                >
                                  Approva
                                </button>
                                <button
                                  type="button"
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[--border-base] bg-[--bg-subtle] text-[--text-base] hover:bg-[--bg-raised]"
                                  onClick={async () => {
                                    try {
                                      await farmService.denyJoinRequest({ farmId: farm.id, ownerId: user.id, userId: r.userId })
                                      await loadRequests(farm.id)
                                    } catch (e) {
                                      console.error(e)
                                      alert('Errore durante rifiuto')
                                    }
                                  }}
                                >
                                  Nega
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FarmsPage
