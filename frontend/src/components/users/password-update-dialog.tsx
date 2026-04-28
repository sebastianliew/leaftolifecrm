"use client"

import { useState } from "react"
import { useToast } from "@/components/ui/toast"
import { UserApiService } from "@/services/UserApiService"
import { User } from "@/types/user"
import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
  EditorialField,
  EditorialInput,
  EditorialMeta,
} from "@/components/ui/editorial"

interface PasswordUpdateDialogProps {
  isOpen: boolean
  onClose: () => void
  user: Pick<User, '_id' | 'username' | 'email' | 'displayName'> | null
}

export function PasswordUpdateDialog({ isOpen, onClose, user }: PasswordUpdateDialogProps) {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!newPassword.trim()) newErrors.newPassword = 'Password is required'
    else if (newPassword.length < 8) newErrors.newPassword = 'Password must be at least 8 characters'
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(newPassword)) {
      newErrors.newPassword = 'Must include upper, lower, number, and special character'
    }
    if (!confirmPassword.trim()) newErrors.confirmPassword = 'Confirmation is required'
    else if (newPassword !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm() || !user) return

    setLoading(true)
    try {
      await UserApiService.updateUserPassword(user._id, newPassword)
      toast({ title: "Success", description: `Password updated for ${user.username}`, variant: "success" })
      handleClose()
    } catch (error) {
      console.error('Error updating password:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update password',
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setNewPassword("")
    setConfirmPassword("")
    setErrors({})
    onClose()
  }

  if (!user) return null

  return (
    <EditorialModal
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      kicker="Security"
      title="Update password"
      description="Set a new password for this user. They'll need to use it on their next login."
    >
      <div className="border-b border-[#E5E7EB] pb-5 mb-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">For</p>
        <p className="text-[14px] text-[#0A0A0A] mt-1">{user.displayName || user.username}</p>
        <EditorialMeta className="font-mono tracking-wide">{user.email}</EditorialMeta>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <EditorialField label="New password">
          <EditorialInput
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            disabled={loading}
          />
          {errors.newPassword && <p className="text-[11px] text-[#DC2626] mt-1">{errors.newPassword}</p>}
        </EditorialField>

        <EditorialField label="Confirm password">
          <EditorialInput
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            disabled={loading}
          />
          {errors.confirmPassword && <p className="text-[11px] text-[#DC2626] mt-1">{errors.confirmPassword}</p>}
        </EditorialField>

        <div className="border-l-2 border-[#0A0A0A] bg-[#FAFAFA] px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">Requirements</p>
          <ul className="mt-2 space-y-1 text-[12px] text-[#0A0A0A]">
            <li>At least 8 characters</li>
            <li>Upper- and lower-case letters</li>
            <li>At least one number</li>
            <li>One special character (@$!%*?&)</li>
          </ul>
        </div>
      </form>

      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={handleSubmit} disabled={loading || !newPassword || !confirmPassword}>
          {loading ? 'Updating…' : 'Update password'}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
