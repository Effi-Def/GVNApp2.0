import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import HomePage from './pages/HomePage-clean'
import EventsPage from './pages/EventsPage-complete'
import ExpensesPage from './pages/ExpensesPage-hybrid'
import PollsPage from './pages/PollsPage-firebase'
import ListsPage from './pages/ListsPage-firebase'
import FirebaseDebugPage from './pages/FirebaseDebugPage'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/polls" element={<PollsPage />} />
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/debug" element={<FirebaseDebugPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
