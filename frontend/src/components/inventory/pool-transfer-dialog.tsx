"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Product } from "@/types/inventory/product.types"
import { getUomBehavior, validateLooseQuantity } from "@/lib/uom"

interface PoolTransferDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** amount is in base units (ml, g, pieces) — NOT containers */
  onConfirm: (action: "open" | "close", amount: number) => Promise<void>
  loading?: boolean
}

export function PoolTransferDialog({
  product,
  open,
  onOpenChange,
  onConfirm,
  loading,
}: PoolTransferDialogProps) {
  const [amount, setAmount] = useState<number | "">("")
  const [action, setAction] = useState<"open" | "close">("open")

  if (!product) return null

  const cap = product.containerCapacity ?? 1
  const looseStock = product.looseStock ?? 0
  const currentStock = product.currentStock ?? 0
  const sealedStock = Math.max(0, currentStock - looseStock)
  const unit = (product as unknown as { unitName?: string }).unitName || "units"

  const uomType = typeof product.unitOfMeasurement === 'object' && product.unitOfMeasurement !== null
    ? (product.unitOfMeasurement as { type?: string }).type
    : undefined
  const uomCfg = getUomBehavior(uomType)

  const parsedAmount = typeof amount === "number" ? amount : 0
  const maxAmount = action === "open" ? sealedStock : looseStock

  const handleConfirm = async () => {
    if (!parsedAmount || parsedAmount <= 0) return
    const validation = validateLooseQuantity(parsedAmount, uomType)
    if (!validation.valid) {
      alert(validation.error)
      return
    }
    await onConfirm(action, parsedAmount)
    setAmount("")
  }

  const handleClose = () => {
    setAmount("")
    setAction("open")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Loose Stock — {product.name}</DialogTitle>
          <DialogDescription>
            Move content into the loose pool to allow partial sales, or seal it back.
          </DialogDescription>
        </DialogHeader>

        {/* Current pool state */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-muted/40 rounded-lg text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Sealed</p>
            <p className="font-semibold text-lg">{sealedStock} {unit}</p>
            {cap > 1 && <p className="text-muted-foreground text-xs">{Math.floor(sealedStock / cap)} containers</p>}
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Loose Pool</p>
            <p className="font-semibold text-lg">{looseStock} {unit}</p>
            {cap > 1 && <p className="text-muted-foreground text-xs">{(looseStock / cap).toFixed(1)} containers worth</p>}
          </div>
        </div>

        {/* Action toggle */}
        <div className="flex rounded-md border overflow-hidden">
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              action === "open"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => { setAction("open"); setAmount("") }}
          >
            Move to loose
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              action === "close"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => { setAction("close"); setAmount("") }}
          >
            Seal back
          </button>
        </div>

        {/* Amount input */}
        <div className="space-y-2">
          <Label>
            {action === "open"
              ? `How much to move to loose pool (${unit})`
              : `How much to seal back (${unit})`}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={uomCfg.allowsDecimal ? uomCfg.step : 1}
              max={maxAmount}
              step={uomCfg.step}
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder={`max ${maxAmount} ${unit}`}
              className="flex-1"
            />
            <span className="text-sm font-medium text-muted-foreground w-12">{unit}</span>
          </div>
          {parsedAmount > 0 && cap > 1 && (
            <p className="text-xs text-muted-foreground">
              ≈ {(parsedAmount / cap).toFixed(2)} containers worth
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !parsedAmount || parsedAmount <= 0 || parsedAmount > maxAmount}
          >
            {loading ? "Saving..." : action === "open" ? "Move to Loose Pool" : "Seal Back"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
