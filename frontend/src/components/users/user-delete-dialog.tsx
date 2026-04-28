"use client"

import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
} from "@/components/ui/editorial"

interface User {
  _id: string
  username: string
  email: string
  role: 'admin' | 'manager' | 'staff' | 'super_admin'
  firstName?: string
  lastName?: string
  displayName?: string
  isActive: boolean
}

interface UserDeleteDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
}

export function UserDeleteDialog({
  user,
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: UserDeleteDialogProps) {
  if (!user) return null

  const displayName = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username
  const isElevated = user.role === 'admin' || user.role === 'super_admin'

  return (
    <EditorialModal
      open={open}
      onOpenChange={onOpenChange}
      kicker="Delete user"
      kickerTone="danger"
      title={`Remove ${displayName}?`}
      description="This action cannot be undone. All user data, permissions, and associated records will be permanently removed."
    >
      <p className="text-[11px] text-[#9CA3AF] font-mono tracking-wide">@{user.username}</p>
      {isElevated && (
        <div className="mt-6 border-l-2 border-[#EA580C] bg-[#FFF7ED] px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#EA580C]">Warning</p>
          <p className="text-[13px] text-[#0A0A0A] mt-2">
            This is an {user.role.replace('_', ' ')} user with elevated permissions.
          </p>
        </div>
      )}
      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting…' : 'Delete user'}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
