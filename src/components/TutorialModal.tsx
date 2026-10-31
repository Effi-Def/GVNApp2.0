import { useState } from 'react'
import { isThemeSetupDone, isTutorialPending, markTutorialDone } from '../utils/firstRun'

export function shouldShowTutorial(): boolean {
  return isThemeSetupDone() && isTutorialPending()
}

const STEPS = [
  {
    emoji: '👋',
    title: 'Benvenuto in GVN!',
    body: 'La tua fattoria. Qui organizzi tutto: eventi, sondaggi, chat e spese condivise.',
  },
  {
    emoji: '📅',
    title: 'Organizza eventi',
    body: 'Proponi date, vedi chi partecipa, raccoglie le risposte. Tutto in un posto solo, senza perdersi nelle chat.',
  },
  {
    emoji: '🗳️',
    title: 'Sondaggi e date',
    body: 'Non sai quando siete tutti liberi? Crea un sondaggio con più date e lascia che la fattoria decida.',
  },
  {
    emoji: '💬',
    title: 'Chat della fattoria',
    body: 'Ogni evento ha la sua chat. Manda messaggi, foto e video. Tutto nel contesto giusto.',
  },
  {
    emoji: '🔗',
    title: 'Invita gli amici',
    body: 'Vai in Fattoria → tocca il tua fattoria → Invita per copiare il link e condividerlo.',
  },
]

interface Props {
  onClose: () => void
}

export default function TutorialModal({ onClose }: Props) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const handleClose = () => {
    markTutorialDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* panel */}
      <div className="relative w-full sm:max-w-sm bg-[--bg-card] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* progress bar */}
        <div className="h-1 bg-[--bg-raised]">
          <div
            className="h-full bg-neutral-900 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* step dots */}
        <div className="flex justify-center gap-1.5 pt-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === step ? 'w-5 bg-neutral-900' : 'w-1.5 bg-neutral-300'
              }`}
              aria-label={`Passo ${i + 1}`}
            />
          ))}
        </div>

        {/* content */}
        <div className="px-8 pt-8 pb-4 text-center min-h-[220px] flex flex-col items-center justify-center">
          <div className="text-6xl mb-4" role="img" aria-label={current.title}>
            {current.emoji}
          </div>
          <h2 className="text-xl font-bold text-[--text-base] mb-2">{current.title}</h2>
          <p className="text-sm text-[--text-muted] leading-relaxed">{current.body}</p>
        </div>

        {/* actions */}
        <div className="px-6 pb-8 flex flex-col gap-2">
          <button
            type="button"
            className="w-full py-3 rounded-2xl bg-neutral-900 text-white text-sm font-semibold"
            onClick={() => {
              if (isLast) {
                handleClose()
              } else {
                setStep((s) => s + 1)
              }
            }}
          >
            {isLast ? 'Inizia 🚀' : 'Avanti →'}
          </button>
          {!isLast && (
            <button
              type="button"
              className="w-full py-2 text-sm text-[--text-muted]"
              onClick={handleClose}
            >
              Salta
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

