import { useState } from 'react'

const HomePage = () => {
  const [user] = useState<{ displayName: string; email: string } | null>({
    displayName: "andrea natali",
    email: "andrea.natali@example.com"
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header personalizzato */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Ciao, {user?.displayName || 'Utente'}! 🎉
        </h1>
        <p className="text-gray-600">
          Ecco un riepilogo delle tue attività di gruppo
        </p>
      </div>

      {/* Situazione Spese */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">💰</span>
          <h2 className="text-xl font-bold text-gray-800">Situazione Spese</h2>
        </div>
        
        <div className="flex justify-between items-center">
          <div>
            <p className="text-gray-600 mb-1">Bilancio totale:</p>
            <p className="text-gray-500 text-sm">Sei in pari con tutti</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-800">0.00€</p>
          </div>
        </div>
      </div>

      {/* Prossimi Eventi */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">📅</span>
          <h2 className="text-xl font-bold text-gray-800">Prossimi Eventi</h2>
        </div>
        
        <div className="space-y-4">
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-800">Test</h3>
            <p className="text-sm text-gray-600">05/11/2025 alle 10:00</p>
            <p className="text-sm text-gray-500">Test</p>
            <p className="text-sm text-blue-600 mt-1">0 confermati</p>
          </div>
        </div>
      </div>

      {/* Attività Recenti */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">🔔</span>
          <h2 className="text-xl font-bold text-gray-800">Attività Recenti</h2>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
            <div className="flex-1">
              <p className="text-gray-800">
                Nuovo evento creato: <span className="font-medium">"Cena al ristorante"</span>
              </p>
              <p className="text-sm text-gray-500">2 ore fa</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
            <div className="flex-1">
              <p className="text-gray-800">
                Marco ha confermato la partecipazione all'evento
              </p>
              <p className="text-sm text-gray-500">5 ore fa</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
            <div className="flex-1">
              <p className="text-gray-800">
                Nuova spesa aggiunta: <span className="font-medium">"Benzina viaggio"</span>
              </p>
              <p className="text-sm text-gray-500">1 giorno fa</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
