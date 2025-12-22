import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'

interface ExportData {
  title: string
  data: unknown
  format: 'pdf' | 'excel' | 'csv'
  metrics?: {
    label: string
    value: string | number
  }[]
}

export class ReportExporter {
  static async exportReport(options: ExportData) {
    switch (options.format) {
      case 'pdf':
        return this.exportToPDF(options)
      case 'excel':
        return this.exportToExcel(options)
      case 'csv':
        return this.exportToCSV(options)
      default:
        throw new Error(`Unsupported format: ${options.format}`)
    }
  }

  private static exportToPDF(options: ExportData) {
    const doc = new jsPDF()
    
    // Add title
    doc.setFontSize(20)
    doc.text(options.title, 20, 20)
    
    // Add date
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 20, 30)
    
    // Add metrics if provided
    if (options.metrics) {
      let yPosition = 50
      doc.setFontSize(12)
      options.metrics.forEach((metric) => {
        doc.text(`${metric.label}: ${metric.value}`, 20, yPosition)
        yPosition += 10
      })
    }
    
    // Save the PDF
    doc.save(`${options.title.toLowerCase().replace(/\s+/g, '-')}-report.pdf`)
  }

  private static exportToExcel(options: ExportData) {
    const wb = XLSX.utils.book_new()
    
    // Create summary sheet if metrics provided
    if (options.metrics) {
      const summaryData = options.metrics.map(m => ({
        Metric: m.label,
        Value: m.value
      }))
      const summaryWs = XLSX.utils.json_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')
    }
    
    // Create data sheet
    if (Array.isArray(options.data)) {
      const dataWs = XLSX.utils.json_to_sheet(options.data)
      XLSX.utils.book_append_sheet(wb, dataWs, 'Data')
    }
    
    // Save the file
    XLSX.writeFile(wb, `${options.title.toLowerCase().replace(/\s+/g, '-')}-report.xlsx`)
  }

  private static exportToCSV(options: ExportData) {
    if (!Array.isArray(options.data)) {
      throw new Error('CSV export requires array data')
    }
    
    // Convert to CSV
    const ws = XLSX.utils.json_to_sheet(options.data)
    const csv = XLSX.utils.sheet_to_csv(ws)
    
    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${options.title.toLowerCase().replace(/\s+/g, '-')}-report.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }
}