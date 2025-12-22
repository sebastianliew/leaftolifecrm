import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { HiEye, HiEyeSlash } from "react-icons/hi2"

interface LoginFormProps {
  onSubmit: (e: React.FormEvent) => Promise<void>
  onForgotPassword: () => void
  email: string
  setEmail: (email: string) => void
  password: string
  setPassword: (password: string) => void
  error: string
  loading: boolean
}

export function LoginForm({
  onSubmit,
  onForgotPassword,
  email,
  setEmail,
  password,
  setPassword,
  error,
  loading
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
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

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="pr-12"
            disabled={loading}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-4 flex items-center"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <HiEyeSlash className="h-5 w-5 text-gray-500" />
            ) : (
              <HiEye className="h-5 w-5 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={loading}
      >
        {loading ? "Signing in..." : "Sign in"}
      </Button>

      <div className="text-center mt-4">
        <button
          type="button"
          className="text-sm text-blue-600 hover:text-blue-500"
          onClick={onForgotPassword}
        >
          Forgot your password?
        </button>
      </div>
    </form>
  )
}