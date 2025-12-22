import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface PasswordResetFormProps {
  onSubmit: (e: React.FormEvent) => Promise<void>
  onBackToLogin: () => void
  email: string
  setEmail: (email: string) => void
  error: string
  loading: boolean
  resetSuccess: boolean
}

export function PasswordResetForm({
  onSubmit,
  onBackToLogin,
  email,
  setEmail,
  error,
  loading,
  resetSuccess
}: PasswordResetFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {resetSuccess && (
        <Alert>
          <AlertDescription>
            Password reset email sent! Please check your inbox.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          disabled={loading}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={loading || resetSuccess}
      >
        {loading ? "Sending..." : "Send reset email"}
      </Button>

      <div className="text-center mt-4">
        <button
          type="button"
          className="text-sm text-blue-600 hover:text-blue-500"
          onClick={onBackToLogin}
        >
          Back to sign in
        </button>
      </div>
    </form>
  )
}