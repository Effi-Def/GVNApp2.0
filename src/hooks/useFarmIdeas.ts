import { useEffect, useState } from 'react'
import { ideaService } from '../services/firestore'
import type { Idea } from '../types'

/** Live ideas of a farm. Pass null to stay idle. */
export function useFarmIdeas(farmId: string | null | undefined) {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(!!farmId)
  const [error, setError] = useState(false)

  useEffect(() => {
    setIdeas([])
    setError(false)
    if (!farmId) {
      setLoading(false)
      return
    }
    setLoading(true)
    return ideaService.listen(
      farmId,
      next => {
        setIdeas(next)
        setLoading(false)
      },
      () => {
        setError(true)
        setLoading(false)
      },
    )
  }, [farmId])

  return { ideas, loading, error }
}
