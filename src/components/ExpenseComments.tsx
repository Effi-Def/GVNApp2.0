import { useState } from 'react'
import { ExpenseComment } from '../types'
import { useAuthStore } from '../stores/useAuthStore'

interface ExpenseCommentsProps {
  comments: ExpenseComment[]
  onAddComment: (text: string) => void
  onDeleteComment?: (commentId: string) => void
}

const ExpenseComments = ({ comments, onAddComment, onDeleteComment }: ExpenseCommentsProps) => {
  const { user } = useAuthStore()
  const [newComment, setNewComment] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newComment.trim()) {
      onAddComment(newComment.trim())
      setNewComment('')
    }
  }

  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'ora'
    if (diffMins < 60) return `${diffMins}m fa`
    if (diffHours < 24) return `${diffHours}h fa`
    if (diffDays < 7) return `${diffDays}g fa`
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="mt-3 border-t pt-3">
      {/* Intestazione commenti */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-sm text-gray-600 hover:text-gray-800"
      >
        <div className="flex items-center space-x-2">
          <span>💬</span>
          <span>Commenti ({comments.length})</span>
        </div>
        <svg 
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Lista commenti */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {comments.length === 0 && (
            <p className="text-sm text-gray-500 italic">Nessun commento ancora</p>
          )}
          
          {comments.map((comment) => (
            <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-700">{comment.authorName}</span>
                    <span className="text-xs text-gray-500">{formatRelativeTime(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-800">{comment.text}</p>
                </div>
                {onDeleteComment && user?.id === comment.authorId && (
                  <button
                    onClick={() => onDeleteComment(comment.id)}
                    className="ml-2 text-gray-400 hover:text-red-500 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Form nuovo commento */}
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Aggiungi un commento..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Invia
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default ExpenseComments