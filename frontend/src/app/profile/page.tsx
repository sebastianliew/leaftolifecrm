"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/hooks/useAuth"
import { fetchAPI } from "@/lib/query-client"
import { User, KeyRound, Mail, Shield, CheckCircle2, Loader2 } from "lucide-react"

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800 border-red-200",
  admin: "bg-purple-100 text-purple-800 border-purple-200",
  manager: "bg-blue-100 text-blue-800 border-blue-200",
  staff: "bg-green-100 text-green-800 border-green-200",
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
    if (!authLoading && !user) {
      router.push("/login")
    }
    if (user) {
      setDisplayName(user.name || user.username || "")
    }
  }, [user, authLoading, router])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

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

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account details and password</p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xl font-bold">
              {(user.name || user.username || "?")[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-lg">{user.name || user.username}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`text-xs border ${ROLE_COLORS[user.role] || "bg-gray-100 text-gray-700"}`}>
                  <Shield className="h-3 w-3 mr-1" />
                  {ROLE_LABELS[user.role] || user.role}
                </Badge>
                {user.isActive && (
                  <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Active</Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Email</Label>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {user.email}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Username</Label>
            <p className="text-sm font-mono text-muted-foreground">{user.username}</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <div className="flex gap-2">
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="max-w-sm"
              />
              <Button
                onClick={handleSaveProfile}
                disabled={saving || displayName.trim() === (user.name || user.username || "")}
                size="sm"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              <CheckCircle2 className="h-4 w-4" />
              Password changed successfully
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {changingPassword ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Changing…</>
            ) : (
              "Change Password"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
