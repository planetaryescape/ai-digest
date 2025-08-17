'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Play, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DigestTrigger() {
  const [cleanup, setCleanup] = useState(false)

  const triggerMutation = useMutation({
    mutationFn: async (options: { cleanup: boolean }) => {
      const res = await fetch('/api/digest/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      })
      
      if (!res.ok) {
        throw new Error('Failed to trigger digest')
      }
      
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(
        cleanup 
          ? 'Cleanup digest generation started! This may take several minutes.'
          : 'Weekly digest generation started!'
      )
    },
    onError: () => {
      toast.error('Failed to trigger digest generation')
    },
  })

  const handleTrigger = () => {
    triggerMutation.mutate({ cleanup })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <button
          onClick={handleTrigger}
          disabled={triggerMutation.isPending}
          className={cn(
            "flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg",
            "hover:bg-blue-700 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {triggerMutation.isPending ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Play className="h-5 w-5 mr-2" />
              Generate Digest
            </>
          )}
        </button>

        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={cleanup}
            onChange={(e) => setCleanup(e.target.checked)}
            disabled={triggerMutation.isPending}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Cleanup Mode
          </span>
          <Trash2 className="h-4 w-4 text-gray-500" />
        </label>
      </div>

      {cleanup && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Warning:</strong> Cleanup mode will process ALL unarchived emails. 
            This may take significantly longer and will send multiple digest emails.
          </p>
        </div>
      )}

      {triggerMutation.isSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            Digest generation has been triggered successfully. 
            You'll receive an email once it's complete.
          </p>
        </div>
      )}
    </div>
  )
}