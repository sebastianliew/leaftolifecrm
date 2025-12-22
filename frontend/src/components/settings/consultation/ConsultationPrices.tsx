"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HiPlus } from "react-icons/hi2"
import { useConsultationSettings } from "@/hooks/useConsultationSettings"
import { useToast } from "@/components/ui/toast"
import { ConsultationPricesTable } from "./ConsultationPricesTable"
import { DiscountPreset, PresetFormData } from "./types"

export function ConsultationPrices() {
  const { 
    discountPresets, 
    loading, 
    getDiscountPresets,
    createDiscountPreset,
    updateDiscountPreset,
    deleteDiscountPreset
  } = useConsultationSettings()
  const { toast } = useToast()

  const [editingPreset, setEditingPreset] = useState<string | null>(null)
  const [presetForm, setPresetForm] = useState<PresetFormData>({ name: "", price: 0 })
  const [showNewPreset, setShowNewPreset] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    getDiscountPresets()
  }, [getDiscountPresets])

  const validateForm = () => {
    if (!presetForm.name || presetForm.price < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid preset name and price (≥0)",
        variant: "destructive",
      })
      return false
    }
    return true
  }

  const handleCreatePreset = async () => {
    if (!validateForm()) return

    setIsLoading(true)
    try {
      await createDiscountPreset(presetForm)
      setShowNewPreset(false)
      setPresetForm({ name: "", price: 0 })
      toast({
        title: "Success",
        description: "Discount preset created successfully",
        variant: "success",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to create discount preset",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdatePreset = async (id: string) => {
    if (!validateForm()) return

    setIsLoading(true)
    try {
      await updateDiscountPreset(id, presetForm)
      setEditingPreset(null)
      setPresetForm({ name: "", price: 0 })
      toast({
        title: "Success",
        description: "Discount preset updated successfully",
        variant: "success",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to update discount preset",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePreset = async (id: string) => {
    if (!confirm("Are you sure you want to delete this discount preset?")) return

    setIsLoading(true)
    try {
      await deleteDiscountPreset(id)
      toast({
        title: "Success",
        description: "Discount preset deleted successfully",
        variant: "success",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete discount preset",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const startEditPreset = (preset: DiscountPreset) => {
    setEditingPreset(preset.id)
    setPresetForm({ 
      name: preset.name, 
      price: preset.price
    })
  }

  const cancelEdit = () => {
    setEditingPreset(null)
    setShowNewPreset(false)
    setPresetForm({ name: "", price: 0 })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Consultation Prices</CardTitle>
            <CardDescription>Configure different consultation pricing options</CardDescription>
          </div>
          <Button 
            onClick={() => setShowNewPreset(true)}
            disabled={showNewPreset || loading}
          >
            <HiPlus className="w-4 h-4 mr-2" />
            Add Price
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ConsultationPricesTable
          presets={discountPresets}
          loading={loading}
          editingPreset={editingPreset}
          showNewPreset={showNewPreset}
          formData={presetForm}
          isLoading={isLoading}
          onFormChange={setPresetForm}
          onCreatePreset={handleCreatePreset}
          onUpdatePreset={handleUpdatePreset}
          onDeletePreset={handleDeletePreset}
          onStartEdit={startEditPreset}
          onCancelEdit={cancelEdit}
        />
      </CardContent>
    </Card>
  )
}