import { useState } from 'react'
import { ExpenseAttachment } from '../types'

interface ExpenseAttachmentsProps {
  attachments: ExpenseAttachment[]
  onAddAttachment: (file: File) => void
  onDeleteAttachment?: (attachmentId: string) => void
  maxFileSize?: number // MB
}

const ExpenseAttachments = ({ 
  attachments, 
  onAddAttachment, 
  onDeleteAttachment,
  maxFileSize = 5 
}: ExpenseAttachmentsProps) => {
  const [dragOver, setDragOver] = useState(false)

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    
    // Validazione dimensione
    if (file.size > maxFileSize * 1024 * 1024) {
      alert(`File troppo grande. Massimo ${maxFileSize}MB`)
      return
    }

    // Validazione tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      alert('Tipo file non supportato. Usa JPG, PNG, WEBP o PDF')
      return
    }

    onAddAttachment(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️'
    if (type === 'application/pdf') return '📄'
    return '📎'
  }

  // Helper non utilizzato al momento
  // const formatFileSize = (bytes: number) => {
  //   if (bytes === 0) return '0 B'
  //   const k = 1024
  //   const sizes = ['B', 'KB', 'MB']
  //   const i = Math.floor(Math.log(bytes) / Math.log(k))
  //   return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  // }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">📎 Allegati ({attachments.length})</span>
      </div>

      {/* Area drop per nuovi allegati */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          dragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          id="file-upload"
        />
        <label 
          htmlFor="file-upload" 
          className="cursor-pointer text-sm text-gray-600 hover:text-gray-800"
        >
          <div className="space-y-1">
            <div className="text-2xl">📁</div>
            <div>Clicca o trascina per aggiungere allegati</div>
            <div className="text-xs text-gray-500">JPG, PNG, WEBP, PDF (max {maxFileSize}MB)</div>
          </div>
        </label>
      </div>

      {/* Lista allegati esistenti */}
      {attachments.length > 0 && (
        <div className="mt-3 space-y-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-lg">{getFileIcon(attachment.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {attachment.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {attachment.uploadedBy} • {attachment.uploadedAt.toLocaleDateString('it-IT')}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.open(attachment.url, '_blank')}
                  className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                >
                  Visualizza
                </button>
                {onDeleteAttachment && (
                  <button
                    onClick={() => onDeleteAttachment(attachment.id)}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                  >
                    Elimina
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ExpenseAttachments