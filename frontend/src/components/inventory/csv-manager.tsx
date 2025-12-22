"use client"

import { useState, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/toast"
import { HiArrowUpTray, HiArrowDownTray, HiDocument } from "react-icons/hi2"

interface ImportResult {
  success: boolean
  imported: number
  failed: number
  errors: string[]
  duplicates: number
}

interface CSVManagerProps {
  onImportComplete: () => void
}

export function CSVManager({ onImportComplete }: CSVManagerProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file",
        variant: "destructive",
      })
      return
    }

    setImporting(true)
    setImportProgress(0)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Simulate progress during upload
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/products/bulk-import', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setImportProgress(100)

      const result: ImportResult = await response.json()

      if (response.ok) {
        setImportResult(result)
        
        if (result.imported > 0) {
          toast({
            title: "Import Successful",
            description: `Successfully imported ${result.imported} products${result.duplicates > 0 ? `. ${result.duplicates} duplicates skipped` : ''}`,
            variant: "success",
          })
          onImportComplete()
        } else if (result.failed > 0) {
          toast({
            title: "Import Failed",
            description: `No products imported. ${result.failed} rows failed`,
            variant: "destructive",
          })
        }
      } else {
        throw new Error(result.errors?.[0] || 'Import failed')
      }
    } catch (error) {
      console.error('Import error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast({
        title: "Import Error",
        description: errorMessage,
        variant: "destructive",
      })
      setImportResult({
        success: false,
        imported: 0,
        failed: 1,
        errors: [errorMessage],
        duplicates: 0
      })
    } finally {
      setImporting(false)
      setImportProgress(0)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleExport = async (simple: boolean = false) => {
    setExporting(true)
    try {
      const params = new URLSearchParams({
        format: 'csv',
        simple: simple.toString()
      })
      
      const response = await fetch(`/api/products/export?${params}`)
      
      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = simple ? 'inventory_simple.csv' : 'inventory_enhanced.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export Successful",
        description: `Inventory data exported to ${simple ? 'simple' : 'enhanced'} CSV`,
        variant: "success",
      })
    } catch (error) {
      console.error('Export error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast({
        title: "Export Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const downloadTemplate = () => {
    const headers = [
      'Product Name',
      'Category / Container type / Unit of Measurement', 
      'Usually sold as',
      'Per Container Capacity',
      'Brand/Supplier',
      'Cost',
      'Selling price',
      'Reorder point',
      'Current Stock',
      'key-in stock by',
      'Bundle?',
      'Bundle price'
    ]
    
    const sampleRow = [
      'Sample Product',
      'ml',
      'ml',
      '100',
      'Sample Brand',
      '10.50',
      '25.00',
      '5',
      '20',
      'ml',
      '-',
      '-'
    ]

    const csvContent = [
      headers.join(','),
      sampleRow.join(',')
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'inventory_template.csv'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    toast({
      title: "Template Downloaded",
      description: "CSV template downloaded successfully",
      variant: "success",
    })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HiDocument className="w-5 h-5" />
          CSV Import/Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Import Section */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Import Products</h4>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex-1"
            >
              <HiArrowUpTray className="w-4 h-4 mr-2" />
              {importing ? 'Importing...' : 'Import CSV'}
            </Button>
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex-1"
            >
              <HiDocument className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>

          {importing && (
            <div className="space-y-2">
              <Progress value={importProgress} className="w-full" />
              <p className="text-sm text-gray-600">Processing import...</p>
            </div>
          )}

          {importResult && (
            <div className="bg-gray-50 p-3 rounded-md text-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Import Results:</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Imported:</span>
                  <span className="text-green-600 font-medium">{importResult.imported}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed:</span>
                  <span className="text-red-600 font-medium">{importResult.failed}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duplicates skipped:</span>
                  <span className="text-yellow-600 font-medium">{importResult.duplicates}</span>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-3">
                  <span className="font-medium text-red-600">Errors:</span>
                  <ul className="mt-1 text-red-600 text-xs max-h-20 overflow-y-auto">
                    {importResult.errors.slice(0, 5).map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>• ... and {importResult.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export Section */}
        <div className="space-y-3 pt-3 border-t">
          <h4 className="font-medium text-sm">Export Products</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport(true)}
              disabled={exporting}
              className="flex-1"
            >
              <HiArrowDownTray className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export Simple CSV'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport(false)}
              disabled={exporting}
              className="flex-1"
            >
              <HiArrowDownTray className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export Enhanced CSV'}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Simple CSV contains original 12 columns. Enhanced CSV includes all database fields.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}