"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface User {
  _id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'staff' | 'super_admin';
  firstName?: string;
  lastName?: string;
  displayName?: string;
  isActive: boolean;
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
  loading = false 
}: UserDeleteDialogProps) {
  if (!user) return null

  const displayName = user.displayName || 
    `${user.firstName || ''} ${user.lastName || ''}`.trim() || 
    user.username

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the user &quot;{displayName}&quot; (@{user.username})?
            <br />
            <br />
            <strong>This action cannot be undone.</strong> All user data, permissions, and associated records will be permanently removed from the system.
          </AlertDialogDescription>
          {user.role === 'admin' || user.role === 'super_admin' ? (
            <div className="text-amber-600 font-medium mt-2">
              Warning: This is an {user.role.replace('_', ' ')} user with elevated permissions.
            </div>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {loading ? "Deleting..." : "Delete User"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}