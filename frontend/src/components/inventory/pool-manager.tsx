"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/api-client"
import type { Product } from "@/types/inventory"

interface PoolManagerProps {
  product: Product
  onUpdate: (updatedProduct: Product) => void
}

export function PoolManager({ product, onUpdate }: PoolManagerProps) {
  const { toast } = useToast()
  const [openCount, setOpenCount] = useState<string>("")
  const [closeCount, setCloseCount] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [inputMode, setInputMode] = useState<'containers' | 'base'>('containers')

  if (!product.canSellLoose) return null

  const cap = Math.max(1, product.containerCapacity || 1)
  const hasContainers = cap > 1
  const inContainerMode = hasContainers && inputMode === 'containers'
  const looseStock = product.looseStock ?? 0
  const sealedStock = Math.max(0, (product.currentStock || 0) - looseStock)
  const sealedContainers = Math.floor(sealedStock / cap)
  const unitAbbr = typeof product.unitOfMeasurement === "object"
    ? (product.unitOfMeasurement as { abbreviation?: string } | null)?.abbreviation || product.unitName || "units"
    : product.unitName || "units"

  const handlePool = async (action: "open" | "close", rawInput: string) => {
    const inputVal = parseFloat(rawInput)
    if (!inputVal || inputVal <= 0) return

    // Convert from containers to base units if needed
    const amount = inContainerMode ? inputVal * cap : inputVal

    setLoading(true)
    try {
      const response = await api.post<{ success: boolean; message: string; product: Product }>(
        `/inventory/products/${product._id}/pool`,
        { action, amount }
      )
      if (response.ok && response.data?.product) {
        onUpdate(response.data.product as Product)
        toast({ title: response.data.message || "Pool updated" })
        setOpenCount("")
        setCloseCount("")
      } else {
        toast({ title: "Error", description: "Failed to update pool", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to update pool", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }


  const openInputLabel = inContainerMode ? 'containers' : unitAbbr
  const closeInputLabel = inContainerMode ? 'containers' : unitAbbr
  const maxOpenDisplay = inContainerMode ? sealedContainers : sealedStock
  const maxCloseDisplay = inContainerMode ? Math.floor(looseStock / cap) : looseStock

  // Conversion hints
  const openVal = parseFloat(openCount) || 0
  const openBaseUnits = inContainerMode ? openVal * cap : openVal
  const closeVal = parseFloat(closeCount) || 0
  const closeBaseUnits = inContainerMode ? closeVal * cap : closeVal

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span>⚗️</span>
            Loose Sale Pool Manager
          </CardTitle>
          {hasContainers && (
            <div className="flex items-center gap-1 text-xs">
              <button type="button"
                className={`px-2 py-1 rounded ${inputMode === 'containers' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                onClick={() => setInputMode('containers')}>
                Containers
              </button>
              <button type="button"
                className={`px-2 py-1 rounded ${inputMode === 'base' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                onClick={() => setInputMode('base')}>
                {unitAbbr}
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stock display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-white p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{sealedContainers}</div>
            <div className="text-xs text-muted-foreground">Sealed containers</div>
            <div className="text-xs text-blue-600 mt-1">{sealedStock} {unitAbbr}</div>
          </div>
          <div className={`rounded-lg border p-3 text-center ${looseStock > 0 ? "bg-green-50 border-green-200" : "bg-white"}`}>
            <div className={`text-2xl font-bold ${looseStock > 0 ? "text-green-700" : "text-gray-400"}`}>
              {looseStock}
            </div>
            <div className="text-xs text-muted-foreground">{unitAbbr} loose (open)</div>
            <Badge variant={looseStock > 0 ? "default" : "secondary"} className="mt-1 text-xs">
              {looseStock > 0 ? "Selling loose" : "None open"}
            </Badge>
          </div>
        </div>

        {/* Move to loose pool */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Move to loose pool ({openInputLabel})</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min="0"
              step={inContainerMode ? "1" : "any"}
              max={maxOpenDisplay}
              placeholder={`max ${maxOpenDisplay}`}
              value={openCount}
              onChange={(e) => setOpenCount(e.target.value)}
              className="w-28"
              disabled={loading || sealedStock === 0}
            />
            <span className="text-sm text-muted-foreground">{openInputLabel}</span>
            <Button
              size="sm"
              onClick={() => handlePool("open", openCount)}
              disabled={loading || !openCount || openVal <= 0 || sealedStock === 0}
            >
              Move
            </Button>
          </div>
          {openVal > 0 && (
            <p className="text-xs text-muted-foreground">
              = {openBaseUnits} {unitAbbr}{inContainerMode && hasContainers ? ` (${cap} ${unitAbbr} per container)` : ''}
              {!inContainerMode && hasContainers ? ` (${(openVal / cap).toFixed(1)} containers)` : ''}
            </p>
          )}
        </div>

        {/* Seal back */}
        {looseStock > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-amber-700">Seal back ({closeInputLabel})</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min="0"
                step={inContainerMode ? "1" : "any"}
                max={maxCloseDisplay}
                placeholder={`max ${maxCloseDisplay}`}
                value={closeCount}
                onChange={(e) => setCloseCount(e.target.value)}
                className="w-28"
                disabled={loading}
              />
              <span className="text-sm text-muted-foreground">{closeInputLabel}</span>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => handlePool("close", closeCount)}
                disabled={loading || !closeCount || closeVal <= 0}
              >
                Seal
              </Button>
            </div>
            {closeVal > 0 && (
              <p className="text-xs text-muted-foreground">
                = {closeBaseUnits} {unitAbbr}{inContainerMode && hasContainers ? ` (${cap} ${unitAbbr} per container)` : ''}
                {!inContainerMode && hasContainers ? ` (${(closeVal / cap).toFixed(1)} containers)` : ''}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Move stock to the loose pool to make it available for partial sales. Remaining sealed stock sells in whole containers only.
        </p>
      </CardContent>
    </Card>
  )
}
