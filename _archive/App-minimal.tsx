function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-block animate-float mb-4">
            <span className="text-6xl">🐷</span>
          </div>
          <h1 className="gvn-title text-4xl mb-4">
            GVNApp 2.0
          </h1>
          <p className="text-lg text-neutral-600">
            Progressive Web App per organizzare eventi sociali
          </p>
        </div>
        
        <div className="gvn-card p-8 text-center">
          <h2 className="text-2xl font-semibold text-primary-700 mb-4">
            ✅ App Funzionante!
          </h2>
          <p className="text-neutral-600 mb-6">
            React, Tailwind CSS e il design system sono caricati correttamente.
          </p>
          <button className="gvn-btn-primary">
            🚀 Iniziamo!
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
