"use client"

import { useState } from "react"
import type { Product } from "@/types/inventory/product.types"
import { getUomBehavior, validateLooseQuantity } from "@/lib/uom"
import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
  EditorialField,
  EditorialInput,
} from "@/components/ui/editorial"

interface PoolTransferDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
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
    <EditorialModal
      open={open}
      onOpenChange={handleClose}
      kicker="Loose pool"
      title={`Manage ${product.name}`}
      description="Move sealed containers into the loose pool to allow partial sales, or seal it back."
    >
      <div className="space-y-7">
        <div className="grid grid-cols-2 gap-10 border-b border-[#E5E7EB] pb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Sealed</p>
            <p className="font-light text-[36px] leading-none tabular-nums mt-2 text-[#0A0A0A]">
              {sealedStock}
              <span className="text-[12px] text-[#9CA3AF] ml-1.5">{unit}</span>
            </p>
            {cap > 1 && (
              <p className="text-[11px] italic font-light text-[#9CA3AF] mt-2 tabular-nums">
                {Math.floor(sealedStock / cap)} containers
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Loose pool</p>
            <p className="font-light text-[36px] leading-none tabular-nums mt-2 text-[#16A34A]">
              {looseStock}
              <span className="text-[12px] text-[#9CA3AF] ml-1.5">{unit}</span>
            </p>
            {cap > 1 && (
              <p className="text-[11px] italic font-light text-[#9CA3AF] mt-2 tabular-nums">
                {(looseStock / cap).toFixed(1)} containers worth
              </p>
            )}
          </div>
        </div>

        <div className="flex border-b border-[#E5E7EB]">
          <button
            className={`flex-1 py-3 text-[11px] uppercase tracking-[0.28em] transition-colors ${
              action === "open" ? "text-[#0A0A0A] border-b-2 border-[#0A0A0A] -mb-[1px]" : "text-[#6B7280] hover:text-[#0A0A0A]"
            }`}
            onClick={() => { setAction("open"); setAmount("") }}
          >
            Move to loose
          </button>
          <button
            className={`flex-1 py-3 text-[11px] uppercase tracking-[0.28em] transition-colors ${
              action === "close" ? "text-[#0A0A0A] border-b-2 border-[#0A0A0A] -mb-[1px]" : "text-[#6B7280] hover:text-[#0A0A0A]"
            }`}
            onClick={() => { setAction("close"); setAmount("") }}
          >
            Seal back
          </button>
        </div>

        <EditorialField label={action === "open" ? `Move to loose pool (${unit})` : `Seal back (${unit})`}>
          <div className="flex items-end gap-3">
            <EditorialInput
              type="number"
              min={uomCfg.allowsDecimal ? uomCfg.step : 1}
              max={maxAmount}
              step={uomCfg.step}
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder={`max ${maxAmount} ${unit}`}
            />
            <span className="text-[10px] uppercase tracking-[0.22em] text-[#6B7280] pb-2">{unit}</span>
          </div>
          {parsedAmount > 0 && cap > 1 && (
            <p className="text-[11px] italic font-light text-[#9CA3AF] mt-2 tabular-nums">
              ≈ {(parsedAmount / cap).toFixed(2)} containers worth
            </p>
          )}
        </EditorialField>
      </div>

      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </EditorialButton>
        <EditorialButton
          variant="primary"
          arrow
          onClick={handleConfirm}
          disabled={loading || !parsedAmount || parsedAmount <= 0 || parsedAmount > maxAmount}
        >
          {loading ? "Saving…" : action === "open" ? "Move to loose pool" : "Seal back"}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
