'use client'

import { Cloud, CloudOff, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface DraftStatusIndicatorProps {
  currentDraftId: string | null
  isAutoSaving: boolean
  lastSaved: Date | null
  onManualSave: () => void
}

export function DraftStatusIndicator({
  currentDraftId,
  isAutoSaving,
  lastSaved,
  onManualSave
}: DraftStatusIndicatorProps) {
  const formatLastSaved = (date: Date | null) => {
    if (!date) return 'Never'
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    return date.toLocaleDateString('en-GB')
  }

  const getStatusIcon = () => {
    if (isAutoSaving) {
      return <Cloud className="h-3 w-3 animate-pulse" />
    }
    if (currentDraftId && lastSaved) {
      return <Cloud className="h-3 w-3 text-green-600" />
    }
    return <CloudOff className="h-3 w-3 text-muted-foreground" />
  }

  const getStatusText = () => {
    if (isAutoSaving) return 'Saving...'
    if (currentDraftId && lastSaved) return `Saved ${formatLastSaved(lastSaved)}`
    return 'Not saved'
  }

  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    if (isAutoSaving) return 'secondary'
    if (currentDraftId && lastSaved) return 'default'
    return 'outline'
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={getStatusVariant()} className="flex items-center gap-1">
              {getStatusIcon()}
              <span className="text-xs">{getStatusText()}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              {currentDraftId ? (
                <div>
                  <div>Draft ID: {currentDraftId.slice(0, 8)}...</div>
                  <div>Last saved: {formatLastSaved(lastSaved)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Auto-saves every 3 seconds
                  </div>
                </div>
              ) : (
                <div>
                  <div>No draft saved</div>
                  <div className="text-xs text-muted-foreground">
                    Changes are stored locally
                  </div>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onManualSave}
              disabled={isAutoSaving}
              className="h-8 px-2"
            >
              <Save className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span className="text-sm">Save draft manually</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}