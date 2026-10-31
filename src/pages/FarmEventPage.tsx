import { Navigate, useParams } from 'react-router-dom'

// FarmEventPage is unified into EventSummary.
// All event detail traffic is redirected to the single summary page.
export default function FarmEventPage() {
  const { id } = useParams()
  return <Navigate to={id ? `/events/${id}/summary` : '/'} replace />
}
