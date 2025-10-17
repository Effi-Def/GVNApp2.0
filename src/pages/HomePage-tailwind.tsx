import { useState } from 'react'

const HomePage = () => {
  const [user] = useState<{ displayName: string; email: string } | null>({
    displayName: "Mario Rossi",
    email: "mario.rossi@example.com"
  })

  return (
    <div className="p-8 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4 text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Benvenuto in GVNApp! 🎉
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            La tua piattaforma per organizzare eventi indimenticabili e gestire le spese di gruppo
          </p>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center border border-gray-100 hover:shadow-xl transition-shadow duration-200">
            <div className="text-4xl mb-3">🎊</div>
            <h3 className="font-semibold text-lg mb-2 text-gray-700">Eventi Attivi</h3>
            <p className="text-3xl font-bold text-blue-600">3</p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center border border-gray-100 hover:shadow-xl transition-shadow duration-200">
            <div className="text-4xl mb-3">💰</div>
            <h3 className="font-semibold text-lg mb-2 text-gray-700">Spesa Totale</h3>
            <p className="text-3xl font-bold text-blue-600">€287,50</p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center border border-gray-100 hover:shadow-xl transition-shadow duration-200">
            <div className="text-4xl mb-3">🗳️</div>
            <h3 className="font-semibold text-lg mb-2 text-gray-700">Sondaggi Aperti</h3>
            <p className="text-3xl font-bold text-blue-600">2</p>
          </div>
        </div>

        {/* Prossimi Eventi */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 hover:shadow-xl transition-shadow duration-200">
          <div className="flex items-center mb-6">
            <div className="text-3xl mr-3">📅</div>
            <h2 className="text-2xl font-bold text-gray-900">Prossimi Eventi</h2>
          </div>
          
          <div className="space-y-4">
            {/* Evento 1 */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                  🎉
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">Cena di Gruppo</h3>
                  <p className="text-gray-600">Venerdì 18 Ottobre • 20:00</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600">8/10 partecipanti</p>
                <p className="text-sm text-gray-500">€35 a persona</p>
              </div>
            </div>

            {/* Evento 2 */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-100">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                  🎬
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">Cinema & Aperitivo</h3>
                  <p className="text-gray-600">Sabato 26 Ottobre • 18:30</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-orange-600">5/12 partecipanti</p>
                <p className="text-sm text-gray-500">€22 a persona</p>
              </div>
            </div>

            {/* Evento 3 */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                  🎵
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">Concerto Live</h3>
                  <p className="text-gray-600">Domenica 3 Novembre • 21:00</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-blue-600">12/15 partecipanti</p>
                <p className="text-sm text-gray-500">€45 a persona</p>
              </div>
            </div>
          </div>
        </div>

        {/* Spese Recenti */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center mb-4">
              <div className="text-2xl mr-3">💳</div>
              <h2 className="text-xl font-bold text-gray-900">Spese Recenti</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Ristorante "Da Mario"</p>
                  <p className="text-sm text-gray-600">15 Ottobre</p>
                </div>
                <p className="font-semibold text-red-600">-€158,00</p>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Biglietti Cinema</p>
                  <p className="text-sm text-gray-600">12 Ottobre</p>
                </div>
                <p className="font-semibold text-red-600">-€84,50</p>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Aperitivo Bar Central</p>
                  <p className="text-sm text-gray-600">8 Ottobre</p>
                </div>
                <p className="font-semibold text-red-600">-€45,00</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center mb-4">
              <div className="text-2xl mr-3">📊</div>
              <h2 className="text-xl font-bold text-gray-900">Sondaggi Attivi</h2>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                <p className="font-medium mb-2 text-gray-900">Dove andiamo a cena venerdì?</p>
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">8 voti</span> • scade in 2 giorni
                </div>
                <div className="bg-white rounded-full h-2">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full" style={{width: '75%'}}></div>
                </div>
              </div>
              
              <div className="p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-100">
                <p className="font-medium mb-2 text-gray-900">Film da vedere al cinema?</p>
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">5 voti</span> • scade in 5 giorni
                </div>
                <div className="bg-white rounded-full h-2">
                  <div className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full" style={{width: '45%'}}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center border border-gray-100 hover:shadow-xl transition-shadow duration-200">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Azioni Rapide</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold p-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200">
              <div className="text-2xl mb-2">➕</div>
              <span className="text-sm font-medium">Nuovo Evento</span>
            </button>
            
            <button className="bg-gray-50 text-gray-700 font-medium p-4 rounded-xl border border-gray-200 hover:bg-white hover:shadow-md transition-all duration-200">
              <div className="text-2xl mb-2">💰</div>
              <span className="text-sm font-medium">Aggiungi Spesa</span>
            </button>
            
            <button className="bg-gray-50 text-gray-700 font-medium p-4 rounded-xl border border-gray-200 hover:bg-white hover:shadow-md transition-all duration-200">
              <div className="text-2xl mb-2">🗳️</div>
              <span className="text-sm font-medium">Crea Sondaggio</span>
            </button>
            
            <button className="bg-gray-50 text-gray-700 font-medium p-4 rounded-xl border border-gray-200 hover:bg-white hover:shadow-md transition-all duration-200">
              <div className="text-2xl mb-2">📝</div>
              <span className="text-sm font-medium">Nuova Lista</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
