'use client'

import { useState, useEffect } from 'react'
import { FileText, Trash2, Clock, User, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { DraftStorage, type DraftData } from '@/lib/client/draftStorage'

interface DraftManagerProps {
  userId: string
  onSelectDraft: (draftId: string) => void
  onDeleteDraft?: (draftId: string) => void
}

export function DraftManager({ userId, onSelectDraft, onDeleteDraft }: DraftManagerProps) {
  const [drafts, setDrafts] = useState<DraftData[]>([])

  useEffect(() => {
    const loadDrafts = () => {
      const userDrafts = DraftStorage.getUserDrafts(userId)
      setDrafts(userDrafts)
    }

    loadDrafts()
    
    // Clean up expired drafts
    DraftStorage.cleanupExpiredDrafts()
  }, [userId])

  const handleDeleteDraft = async (draftId: string) => {
    DraftStorage.deleteDraft(draftId, userId)
    setDrafts(prev => prev.filter(d => d.draftId !== draftId))
    onDeleteDraft?.(draftId)
  }

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
    const customerName = typeof formData.customerName === 'string' ? formData.customerName.trim() || 'No customer' : 'No customer'
    const totalAmount = typeof formData.totalAmount === 'number' ? formData.totalAmount : 0
    
    return {
      customerName,
      itemCount,
      totalAmount: totalAmount.toFixed(2)
    }
  }

  if (drafts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Draft Transactions
          </CardTitle>
          <CardDescription>
            Your incomplete transactions will be saved here automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No draft transactions found</p>
            <p className="text-sm">Start creating a transaction to see drafts here</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Draft Transactions
          <Badge variant="secondary">{drafts.length}</Badge>
        </CardTitle>
        <CardDescription>
          Continue working on incomplete transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-96">
          <div className="space-y-3">
            {drafts.map((draft) => {
              const summary = getFormSummary(draft.formData)
              
              return (
                <Card key={draft.draftId} className="cursor-pointer transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div 
                        className="flex-1"
                        onClick={() => onSelectDraft(draft.draftId)}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">
                            {draft.draftName || `Draft Transaction`}
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            {summary.itemCount} item{summary.itemCount !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {summary.customerName}
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${summary.totalAmount}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(draft.timestamp)}
                          </div>
                        </div>
                      </div>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Draft</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this draft? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDraft(draft.draftId)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}