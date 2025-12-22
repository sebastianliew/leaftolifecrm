'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock, FileText, Trash2 } from 'lucide-react'
import type { DraftData } from '@/lib/client/draftStorage'

interface DraftRecoveryDialogProps {
  isOpen: boolean
  onClose: () => void
  drafts: DraftData[]
  onSelectDraft: (draftId: string) => void
  onDeleteDraft: (draftId: string) => void
}

export function DraftRecoveryDialog({
  isOpen,
  onClose,
  drafts,
  onSelectDraft,
  onDeleteDraft
}: DraftRecoveryDialogProps) {
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getFormSummary = (formData: Record<string, unknown>) => {
    const items = Array.isArray(formData.items) ? formData.items : []
    const itemCount = items.length
    const customerName = typeof formData.customerName === 'string' ? formData.customerName : 'No customer'
    const totalAmount = typeof formData.totalAmount === 'number' ? formData.totalAmount : 0
    
    return {
      customerName,
      itemCount,
      totalAmount: totalAmount.toFixed(2)
    }
  }

  const handleContinue = () => {
    if (selectedDraftId) {
      onSelectDraft(selectedDraftId)
      onClose()
    }
  }

  const handleStartFresh = () => {
    onClose()
  }

  const handleDeleteDraft = (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onDeleteDraft(draftId)
    if (selectedDraftId === draftId) {
      setSelectedDraftId(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Incomplete Transactions Found
          </DialogTitle>
          <DialogDescription>
            You have unsaved transaction drafts. Would you like to continue working on one of them?
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-96">
          <div className="space-y-3">
            {drafts.map((draft) => {
              const summary = getFormSummary(draft.formData)
              const isSelected = selectedDraftId === draft.draftId
              
              return (
                <div
                  key={draft.draftId}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedDraftId(draft.draftId)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">
                          {draft.draftName || `Draft for ${summary.customerName}`}
                        </h4>
                        <Badge variant="secondary" className="text-xs">
                          {summary.itemCount} item{summary.itemCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Customer: {summary.customerName}</div>
                        <div>Total: ${summary.totalAmount}</div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Saved: {formatDate(draft.timestamp)}
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteDraft(draft.draftId, e)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleStartFresh}>
            Start Fresh
          </Button>
          <Button 
            onClick={handleContinue}
            disabled={!selectedDraftId}
          >
            Continue Selected Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}