import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AdvancedSection from '../components/AdvancedSection'
import { useFarmContext } from '../contexts/FarmContext'
import { useFarmIdeas } from '../hooks/useFarmIdeas'
import { farmService, ideaService } from '../services/firestore'
import { useAppStore } from '../stores/AppStore'
import { useAuthStore } from '../stores/useAuthStore'
import type { FarmMembership, Idea, IdeaCategory, IdeaDraft } from '../types'
import {
  getIdeaCategory,
  getIdeaEventCategory,
  getIdeaLinkLabel,
  IDEA_CATEGORIES,
  normalizeIdeaLink,
  rankOpenIdeas,
} from '../utils/ideas'

const EMPTY_FORM = { title: '', category: 'posto' as IdeaCategory, note: '', link: '', location: '' }

const IdeasPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { activeFarmId, activeFarm } = useFarmContext()
  const { ideas, loading, error } = useFarmIdeas(activeFarmId)
  const events = useAppStore(s => s.events)

  const [members, setMembers] = useState<FarmMembership[]>([])
  const [filter, setFilter] = useState<'all' | IdeaCategory>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [organizingId, setOrganizingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const currentUserId = user?.id || ''

  useEffect(() => {
    if (!activeFarmId) {
      setMembers([])
      return
    }
    let alive = true
    farmService.listMembers(activeFarmId)
      .then(next => { if (alive) setMembers(next) })
      .catch(() => { if (alive) setMembers([]) })
    return () => { alive = false }
  }, [activeFarmId])

  // Auto-open create form when ?create=1
  useEffect(() => {
    if (new URLSearchParams(location.search).get('create') !== '1') return
    setEditingIdea(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowForm(true)
  }, [location.search])

  // Prevent background scroll on mobile when the form is open
  useEffect(() => {
    if (!showForm) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original || '' }
  }, [showForm])

  const memberNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const m of members) names.set(m.userId, m.displayName || 'Maiale')
    return names
  }, [members])

  const isFarmOwner = activeFarm?.ownerId === currentUserId
    || members.some(m => m.userId === currentUserId && m.role === 'owner')

  const matchesFilter = (idea: Idea) => filter === 'all' || idea.category === filter
  const openIdeas = rankOpenIdeas(ideas).filter(matchesFilter)
  const organizedIdeas = ideas.filter(idea => idea.status === 'organized').filter(matchesFilter)

  const personName = (userId: string) =>
    userId === currentUserId ? 'Tu' : memberNames.get(userId) || 'Un Maiale'

  const closeForm = () => {
    setShowForm(false)
    setEditingIdea(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    // Otherwise the + menu could not reopen the form from the same URL
    if (location.search) navigate('/ideas', { replace: true })
  }

  const openCreateForm = () => {
    setEditingIdea(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowForm(true)
  }

  const openEditForm = (idea: Idea) => {
    setEditingIdea(idea)
    setForm({
      title: idea.title,
      category: idea.category,
      note: idea.note || '',
      link: idea.link || '',
      location: idea.location || '',
    })
    setFormError(null)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeFarmId || !currentUserId || submitting) return

    const title = form.title.trim()
    if (!title) return

    const link = form.link.trim() ? normalizeIdeaLink(form.link) : undefined
    if (link === null) {
      setFormError('Il link non è valido. Prova con un indirizzo come www.esempio.it')
      return
    }

    const draft: IdeaDraft = {
      title,
      category: form.category,
      note: form.note.trim() || undefined,
      link,
      location: form.location.trim() || undefined,
    }

    setSubmitting(true)
    setFormError(null)
    try {
      if (editingIdea) await ideaService.update(activeFarmId, editingIdea.id, draft)
      else await ideaService.create(activeFarmId, draft, currentUserId)
      closeForm()
    } catch (err) {
      console.error('❌ Error saving idea:', err)
      setFormError('Non sono riuscito a salvare l’idea. Riprova.')
    } finally {
      setSubmitting(false)
    }
  }

  const runAction = async (action: () => Promise<void>, message: string) => {
    setActionError(null)
    try {
      await action()
    } catch (err) {
      console.error('❌ Idea action failed:', err)
      setActionError(message)
    }
  }

  const toggleInterest = (idea: Idea) => {
    if (!activeFarmId) return
    const interested = !idea.interestedIds.includes(currentUserId)
    void runAction(
      () => ideaService.setInterest(activeFarmId, idea.id, currentUserId, interested),
      'Non sono riuscito a salvare il tuo “Ci sto”. Riprova.',
    )
  }

  const handleDelete = (idea: Idea) => {
    if (!activeFarmId || !confirm('Eliminare questa idea?')) return
    void runAction(() => ideaService.delete(activeFarmId, idea.id), 'Non sono riuscito a eliminare l’idea. Riprova.')
  }

  const handleReopen = (idea: Idea) => {
    if (!activeFarmId) return
    void runAction(() => ideaService.reopen(activeFarmId, idea.id), 'Non sono riuscito a riaprire l’idea. Riprova.')
  }

  const organizeWithDate = (idea: Idea) => {
    navigate('/events?create=1', {
      state: {
        idea: {
          id: idea.id,
          farmId: idea.farmId,
          title: idea.title,
          note: idea.note,
          location: idea.location,
          category: getIdeaEventCategory(idea.category),
        },
      },
    })
  }

  const organizeWithPoll = (idea: Idea) => {
    navigate('/polls?create=1&type=date', { state: { idea: { title: idea.title, note: idea.note } } })
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-[--border-base] bg-[--bg-card] text-[--text-base] focus:outline-none focus:border-primary-500'

  return (
    <div className="pt-16 space-y-3 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[--text-base]">Cose da fare</h1>
          <p className="text-xs text-[--text-muted] mt-0.5">
            Posti, ristoranti ed eventi{activeFarm?.name ? ` di ${activeFarm.name}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          disabled={!activeFarmId}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <span className="text-base leading-none font-bold">+</span>
          <span>Nuova idea</span>
        </button>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtra per categoria">
        {[{ value: 'all' as const, label: 'Tutte', emoji: '' }, ...IDEA_CATEGORIES].map(c => (
          <button
            key={c.value}
            type="button"
            aria-pressed={filter === c.value}
            onClick={() => setFilter(c.value)}
            className={
              'px-3 py-1.5 rounded-full border text-xs font-medium transition ' +
              (filter === c.value
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'bg-[--bg-card] border-[--border-base] text-[--text-muted] hover:bg-[--bg-subtle]')
            }
          >
            {c.emoji ? `${c.emoji} ` : ''}{c.label}
          </button>
        ))}
      </div>

      {actionError && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-[--text-muted]">
          <div className="text-4xl mb-3">💡</div>
          <div className="text-sm">Caricamento idee…</div>
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-[--border-base] bg-[--bg-card] p-8 text-center">
          <div className="text-3xl mb-3">🐷</div>
          <div className="text-base font-semibold text-[--text-base] mb-1">Non riesco a caricare le idee</div>
          <div className="text-sm text-[--text-muted]">Controlla la connessione e riapri la pagina.</div>
        </div>
      ) : openIdeas.length === 0 && organizedIdeas.length === 0 ? (
        <div className="rounded-2xl border border-[--border-base] bg-[--bg-card] p-8 text-center">
          <div className="text-3xl mb-3">💡</div>
          {ideas.length === 0 ? (
            <>
              <div className="text-base font-semibold text-[--text-base] mb-1">Ancora nessuna idea</div>
              <div className="text-sm text-[--text-muted]">
                La prossima volta che qualcuno dice “dovremmo andarci”, segnalo qui.
              </div>
            </>
          ) : (
            <div className="text-sm text-[--text-muted]">Nessuna idea in questa categoria.</div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {openIdeas.map(idea => {
            const category = getIdeaCategory(idea.category)
            const interested = idea.interestedIds.includes(currentUserId)
            const canManage = idea.createdBy === currentUserId || isFarmOwner
            const names = idea.interestedIds.map(personName).join(', ')

            return (
              <article key={idea.id} className="rounded-2xl border border-[--border-base] bg-[--bg-card] p-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 text-xl" aria-hidden>{category.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-[--text-base] break-words">{idea.title}</h2>
                    <div className="mt-0.5 text-xs text-[--text-muted] break-words">
                      {category.label}
                      {idea.location ? ` · ${idea.location}` : ''}
                      {` · proposta da ${idea.createdBy === currentUserId ? 'te' : personName(idea.createdBy)}`}
                    </div>
                    {idea.note && (
                      <p className="mt-2 text-sm text-[--text-muted] whitespace-pre-wrap break-words">{idea.note}</p>
                    )}
                    {idea.link && (
                      <a
                        href={idea.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-primary-600 underline break-all"
                      >
                        🔗 {getIdeaLinkLabel(idea.link)}
                      </a>
                    )}
                  </div>
                  {canManage && (
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(idea)}
                        className="p-1.5 rounded-lg text-[--text-muted] hover:bg-[--bg-raised] transition"
                        aria-label={`Modifica ${idea.title}`}
                        title="Modifica"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(idea)}
                        className="p-1.5 rounded-lg text-[--text-muted] hover:text-red-600 hover:bg-red-500/10 transition"
                        aria-label={`Elimina ${idea.title}`}
                        title="Elimina"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={interested}
                    onClick={() => toggleInterest(idea)}
                    className={
                      'px-3 py-1.5 rounded-xl border text-sm font-semibold transition ' +
                      (interested
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-[--bg-card] border-[--border-base] text-[--text-base] hover:bg-[--bg-subtle]')
                    }
                  >
                    🐷 Ci sto · {idea.interestedIds.length}
                  </button>
                  <button
                    type="button"
                    aria-expanded={organizingId === idea.id}
                    onClick={() => setOrganizingId(prev => prev === idea.id ? null : idea.id)}
                    className="px-3 py-1.5 rounded-xl border border-[--border-base] bg-[--bg-card] text-sm font-semibold text-[--text-base] hover:bg-[--bg-subtle] transition"
                  >
                    Organizza
                  </button>
                </div>

                {names && (
                  <div className="mt-2 text-xs text-[--text-muted] break-words">{names}</div>
                )}

                {organizingId === idea.id && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      className="flex-1 px-3 py-2.5 rounded-xl bg-[--text-base] text-[--bg-card] text-sm font-semibold"
                      onClick={() => organizeWithPoll(idea)}
                    >
                      🗳️ Quando siete liberi?
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-3 py-2.5 rounded-xl border border-[--border-base] text-[--text-base] text-sm font-semibold"
                      onClick={() => organizeWithDate(idea)}
                    >
                      📅 Ho una data
                    </button>
                  </div>
                )}
              </article>
            )
          })}

          {organizedIdeas.length > 0 && (
            <details className="rounded-2xl border border-[--border-base] bg-[--bg-card] overflow-hidden group">
              <summary className="px-4 py-3 text-sm font-medium text-[--text-muted] cursor-pointer select-none list-none flex items-center justify-between hover:bg-[--bg-subtle] transition">
                <span>Già organizzate ({organizedIdeas.length})</span>
                <span className="text-xs group-open:rotate-180 transition-transform inline-block" aria-hidden>▾</span>
              </summary>
              <div className="divide-y divide-[--border-base] border-t border-[--border-base]">
                {organizedIdeas.map(idea => {
                  const hasEvent = !!idea.eventId && events.some(e => e.id === idea.eventId)
                  return (
                    <div key={idea.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="shrink-0 text-base" aria-hidden>{getIdeaCategory(idea.category).emoji}</div>
                      <div className="flex-1 min-w-0 text-sm font-medium text-[--text-base] break-words">{idea.title}</div>
                      {hasEvent && (
                        <button
                          type="button"
                          className="shrink-0 text-xs font-medium text-primary-600 underline"
                          onClick={() => navigate(`/events/${idea.eventId}/summary`)}
                        >
                          Apri evento
                        </button>
                      )}
                      <button
                        type="button"
                        className="shrink-0 text-xs text-[--text-muted] underline"
                        onClick={() => handleReopen(idea)}
                      >
                        Riapri
                      </button>
                    </div>
                  )
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 !mt-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-[70]">
          <div className="bg-[--bg-card] rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] relative">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[--text-base]">{editingIdea ? 'Modifica idea' : 'Nuova idea'}</h2>
                <button
                  type="button"
                  onClick={closeForm}
                  className="text-[--text-muted] hover:text-[--text-base]"
                  disabled={submitting}
                  aria-label="Chiudi"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="idea-title" className="block text-sm font-medium text-[--text-muted] mb-1">Cosa vi piacerebbe fare?</label>
                  <input
                    id="idea-title"
                    type="text"
                    value={form.title}
                    maxLength={120}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className={inputClass}
                    placeholder="Es. Il ristorante di pesce a Sori"
                    required
                    autoFocus
                  />
                </div>

                <fieldset>
                  <legend className="block text-sm font-medium text-[--text-muted] mb-2">Categoria</legend>
                  <div className="flex flex-wrap gap-2">
                    {IDEA_CATEGORIES.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        aria-pressed={form.category === c.value}
                        onClick={() => setForm({ ...form, category: c.value })}
                        className={
                          'px-3 py-1.5 rounded-full border text-sm font-medium transition ' +
                          (form.category === c.value
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : 'bg-[--bg-card] border-[--border-base] text-[--text-muted] hover:bg-[--bg-subtle]')
                        }
                      >
                        {c.emoji} {c.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <AdvancedSection storageKey="gvn.advanced.ideaCreate" title="Luogo, link e note">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="idea-location" className="block text-sm font-medium text-[--text-muted] mb-1">Luogo</label>
                      <input
                        id="idea-location"
                        type="text"
                        value={form.location}
                        maxLength={200}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        className={inputClass}
                        placeholder="Es. Sori"
                      />
                    </div>
                    <div>
                      <label htmlFor="idea-link" className="block text-sm font-medium text-[--text-muted] mb-1">Link</label>
                      <input
                        id="idea-link"
                        type="text"
                        inputMode="url"
                        value={form.link}
                        maxLength={500}
                        onChange={(e) => setForm({ ...form, link: e.target.value })}
                        className={inputClass}
                        placeholder="Es. www.esempio.it"
                      />
                    </div>
                    <div>
                      <label htmlFor="idea-note" className="block text-sm font-medium text-[--text-muted] mb-1">Note</label>
                      <textarea
                        id="idea-note"
                        value={form.note}
                        maxLength={1000}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                        className={inputClass}
                        rows={3}
                        placeholder="Perché vale la pena andarci?"
                      />
                    </div>
                  </div>
                </AdvancedSection>

                {formError && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">{formError}</p>
                )}

                <div className="sticky bottom-0 z-10 pt-3 pb-[env(safe-area-inset-bottom)]">
                  <div className="bg-[--bg-card] border border-[--border-base] rounded-xl shadow-md px-4 py-3 flex space-x-3">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="flex-1 px-4 py-2 border border-[--border-base] text-[--text-muted] rounded-lg hover:bg-[--bg-subtle] transition-colors"
                      disabled={submitting}
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !form.title.trim()}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Salvataggio...' : (editingIdea ? 'Salva' : 'Aggiungi')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IdeasPage
