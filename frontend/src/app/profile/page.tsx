"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/hooks/useAuth"
import { fetchAPI } from "@/lib/query-client"
import { CheckCircle2 } from "lucide-react"
import {
  EditorialPage,
  EditorialPageSkeleton,
  EditorialMasthead,
  EditorialButton,
  EditorialSection,
  EditorialField,
  EditorialInput,
  EditorialDefList,
  EditorialPill,
  EditorialNote,
} from "@/components/ui/editorial"

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
}

const ROLE_TONE: Record<string, "muted" | "ink" | "ok" | "warning" | "danger"> = {
  super_admin: "warning",
  admin: "ink",
  manager: "ink",
  staff: "muted",
}

export default function ProfilePage() {
  const { user, loading: authLoading, refreshAuth } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [displayName, setDisplayName] = useState("")
  const [saving, setSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
    if (user) setDisplayName(user.name || user.username || "")
  }, [user, authLoading, router])

  if (authLoading) return <EditorialPageSkeleton statColumns={2} />
  if (!user) return null

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return
    setSaving(true)
    try {
      await fetchAPI(`/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ displayName: displayName.trim() }),
      })
      await refreshAuth()
      toast({ title: "Profile updated", description: "Your display name has been saved." })
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "All fields required", variant: "destructive" })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" })
      return
    }
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" })
      return
    }
    setChangingPassword(true)
    try {
      await fetchAPI(`/users/${user.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 4000)
      toast({ title: "Password changed", description: "Your password has been updated." })
    } catch (err) {
      toast({
        title: "Failed to change password",
        description: err instanceof Error ? err.message : "Check your current password and try again",
        variant: "destructive",
      })
    } finally {
      setChangingPassword(false)
    }
  }

  const initial = (user.name || user.username || "?")[0].toUpperCase()

  return (
    <EditorialPage>
      <EditorialMasthead
        kicker="Profile"
        title="My account"
        subtitle="Manage your account details and password."
      />

      <EditorialSection index="i." title="Account information">
        <div className="flex items-center gap-6 mb-8 pb-8 border-b border-[#E5E7EB]">
          <div className="h-16 w-16 border border-[#0A0A0A] flex items-center justify-center font-light text-[28px] text-[#0A0A0A]">
            {initial}
          </div>
          <div>
            <p className="font-light text-[28px] leading-none text-[#0A0A0A]">{user.name || user.username}</p>
            <div className="flex items-center gap-3 mt-3">
              <EditorialPill tone={ROLE_TONE[user.role] || 'muted'}>
                {ROLE_LABELS[user.role] || user.role}
              </EditorialPill>
              {user.isActive && <EditorialPill tone="ok">Active</EditorialPill>}
            </div>
          </div>
        </div>

        <EditorialDefList
          cols={2}
          items={[
            { label: 'Email', value: user.email },
            { label: 'Username', value: <span className="font-mono tracking-wide">{user.username}</span> },
          ]}
        />

        <div className="mt-10 pt-8 border-t border-[#E5E7EB] max-w-md">
          <EditorialField label="Display name">
            <EditorialInput
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
            />
          </EditorialField>
          <div className="mt-4">
            <EditorialButton
              variant="primary"
              arrow
              onClick={handleSaveProfile}
              disabled={saving || displayName.trim() === (user.name || user.username || "")}
            >
              {saving ? "Saving…" : "Save changes"}
            </EditorialButton>
          </div>
        </div>
      </EditorialSection>

      <EditorialSection index="ii." title="Change password">
        {passwordSuccess && (
          <EditorialNote tone="ok" kicker="Updated" className="mb-6 max-w-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
              Password changed successfully.
            </div>
          </EditorialNote>
        )}
        <div className="max-w-md space-y-6">
          <EditorialField label="Current password">
            <EditorialInput
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </EditorialField>
          <EditorialField label="New password">
            <EditorialInput
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#9CA3AF] mt-1">Minimum 8 characters</p>
          </EditorialField>
          <EditorialField label="Confirm new password">
            <EditorialInput
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
            />
          </EditorialField>
          <EditorialButton
            variant="primary"
            arrow
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {changingPassword ? "Changing…" : "Change password"}
          </EditorialButton>
        </div>
      </EditorialSection>
    </EditorialPage>
  )
}
