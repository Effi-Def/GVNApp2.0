import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'

type LegalDocType = 'privacy' | 'terms'

type LegalDoc = {
  title: string
  version: string
  updatedAt: string
  sections: Array<{ heading: string; body: string[] }>
}

const DOCS: Record<LegalDocType, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    version: 'v1.0',
    updatedAt: '2026-03-22',
    sections: [
      {
        heading: '1. Titolare e contatti',
        body: [
          'GVNApp e` il servizio che gestisce eventi, chat e spese condivise tra utenti invitati.',
          'Per richieste relative ai dati personali puoi usare i canali di supporto indicati nel repository e nell\'app.',
        ],
      },
      {
        heading: '2. Dati trattati',
        body: [
          'Account: identificativi di autenticazione (Google), nome visualizzato, email.',
          'Contenuti utente: eventi, partecipazioni, chat, spese, pagamenti, sondaggi, liste, idee, impostazioni.',
          'Dati tecnici: token push notifiche, log tecnici necessari a sicurezza e funzionamento.',
        ],
      },
      {
        heading: '3. Finalita` e base giuridica',
        body: [
          'Erogazione del servizio richiesto dall\'utente (organizzazione eventi e gestione attivita` di gruppo).',
          'Sicurezza, prevenzione abusi e affidabilita` operativa del servizio.',
        ],
      },
      {
        heading: '4. Conservazione',
        body: [
          'I dati restano disponibili finche\' il servizio e` attivo e l\'utente mantiene il proprio account.',
          'I log tecnici sono mantenuti per il tempo strettamente necessario a diagnosi e sicurezza.',
        ],
      },
      {
        heading: '5. Diritti dell\'utente',
        body: [
          'Puoi richiedere accesso, rettifica o cancellazione dei dati nei limiti tecnicamente applicabili.',
          'Puoi disattivare le notifiche dalle impostazioni del browser o dalla pagina notifiche dell\'app.',
        ],
      },
    ],
  },
  terms: {
    title: 'Termini di Utilizzo',
    version: 'v1.0',
    updatedAt: '2026-03-22',
    sections: [
      {
        heading: '1. Oggetto del servizio',
        body: [
          'GVNApp e` una piattaforma per coordinare eventi, chat e spese tra membri di una fattoria (gruppo).',
          'L\'uso del servizio implica accettazione dei presenti termini.',
        ],
      },
      {
        heading: '2. Account e responsabilita`',
        body: [
          'L\'utente e` responsabile delle attivita` effettuate dal proprio account.',
          'Non e` consentito usare il servizio per contenuti illeciti o in violazione di diritti altrui.',
        ],
      },
      {
        heading: '3. Regole di utilizzo',
        body: [
          'I contenuti condivisi nelle fattorie devono rispettare leggi applicabili e regole di convivenza civile.',
          'Gli amministratori delle fattorie possono gestire membri e accessi secondo le funzionalita` disponibili.',
        ],
      },
      {
        heading: '4. Disponibilita` del servizio',
        body: [
          'Il servizio puo` subire aggiornamenti, manutenzioni o interruzioni temporanee.',
          'Le funzionalita` possono evolvere nel tempo per ragioni tecniche o di sicurezza.',
        ],
      },
      {
        heading: '5. Modifiche ai termini',
        body: [
          'I termini possono essere aggiornati: la versione corrente e la data di aggiornamento sono pubblicate in questa pagina.',
        ],
      },
    ],
  },
}

export default function LegalPage() {
  const { docType } = useParams<{ docType: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const current = useMemo(() => {
    const key = (docType || '').toLowerCase()
    if (key === 'privacy' || key === 'terms') return DOCS[key as LegalDocType]
    return null
  }, [docType])

  if (!current) {
    return (
      <div className="pt-16 px-4 pb-8 max-w-3xl mx-auto">
        <div className="bg-[--bg-card] border border-[--border-base] rounded-2xl p-5">
          <h1 className="text-xl font-semibold text-[--text-base]">Documento non trovato</h1>
          <p className="mt-2 text-sm text-[--text-muted]">Il documento richiesto non esiste.</p>
          <button
            type="button"
            className="mt-4 px-4 py-2 rounded-xl bg-[--bg-raised] text-[--text-base]"
            onClick={() => navigate(user?.id ? '/settings' : '/')}
          >
            Torna indietro
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-16 px-4 pb-10 max-w-3xl mx-auto">
      <div className="bg-[--bg-card] border border-[--border-base] rounded-2xl p-5 sm:p-6">
        <h1 className="text-2xl font-bold text-[--text-base]">{current.title}</h1>
        <p className="mt-2 text-sm text-[--text-muted]">
          Versione {current.version} - Aggiornato il {current.updatedAt}
        </p>

        <div className="mt-6 space-y-5">
          {current.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold text-[--text-base]">{section.heading}</h2>
              <div className="mt-2 space-y-2">
                {section.body.map((row, index) => (
                  <p key={`${section.heading}-${index}`} className="text-sm text-[--text-muted] leading-relaxed">
                    {row}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap gap-2 text-sm">
          <Link className="px-3 py-2 rounded-xl border border-[--border-base] bg-[--bg-subtle] text-[--text-base]" to="/legal/privacy">
            Privacy Policy
          </Link>
          <Link className="px-3 py-2 rounded-xl border border-[--border-base] bg-[--bg-subtle] text-[--text-base]" to="/legal/terms">
            Termini di Utilizzo
          </Link>
          {user?.id ? (
            <Link className="px-3 py-2 rounded-xl border border-[--border-base] bg-[--bg-subtle] text-[--text-base]" to="/settings">
              Impostazioni
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
