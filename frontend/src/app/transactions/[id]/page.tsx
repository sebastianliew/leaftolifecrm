"use client"

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, FileText, Printer, AlertTriangle, Download, X, Mail, CheckCircle2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTransactions as useTransactionsHook } from '@/hooks/useTransactions'
import { formatCurrency } from '@/utils/currency'
import type { Transaction } from '@/types/transaction'

interface GenerateInvoiceResponse {
  success: boolean
  invoicePath: string
  invoiceNumber: string
  downloadUrl: string
}

interface SendEmailResponse {
  emailSent: boolean
  recipient: string
  sentAt: string
}

export default function TransactionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { getTransaction, generateInvoice, sendInvoiceEmail, loading } = useTransactionsHook()
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  const loadTransaction = useCallback(async () => {
    try {
      const data = await getTransaction(id) as Transaction
      setTransaction(data)
    } catch (err) {
      setError('Failed to load transaction')
      console.error(err)
    }
  }, [id, getTransaction])

  useEffect(() => {
    if (id) {
      loadTransaction()
    }
  }, [id, loadTransaction])

  const handleGenerateInvoice = async () => {
    if (!transaction) return

    try {
      const result = await generateInvoice(transaction._id) as GenerateInvoiceResponse
      await loadTransaction() // Refresh to show invoice status
      // After generation, show the preview
      await previewInvoicePDF(result.downloadUrl)
    } catch (err) {
      console.error('Failed to generate invoice:', err)
    }
  }

  const handleViewInvoice = async () => {
    if (!transaction) return

    try {
      // Always regenerate to ensure PDF reflects current transaction data
      const result = await generateInvoice(transaction._id) as GenerateInvoiceResponse
      await loadTransaction() // Refresh transaction data
      await previewInvoicePDF(result.downloadUrl)
    } catch (err) {
      console.error('[Invoice] Generation failed:', err)
      setError('Failed to generate invoice. Please try again.')
    }
  }

  const previewInvoicePDF = async (downloadUrl: string) => {
    try {
      // Get token from authToken (used by api-client)
      const token = localStorage.getItem('authToken') || localStorage.getItem('token')
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const fullUrl = `${apiBase.replace(/\/api$/, '')}${downloadUrl}`

      const response = await fetch(fullUrl, {
        credentials: 'include', // Include cookies
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Invoice] Error response:', errorText)
        throw new Error(`Failed to load invoice: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      setPdfUrl(url)
      setShowPreview(true)
    } catch (error) {
      console.error('[Invoice] Preview failed:', error)
      setError('Failed to preview invoice. Please try again.')
      throw error
    }
  }

  const downloadInvoicePDF = async () => {
    if (!pdfUrl || !transaction?.invoiceNumber) return

    try {
      const a = document.createElement('a')
      a.href = pdfUrl
      a.download = `${transaction.invoiceNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (error) {
      console.error('[Invoice] Download failed:', error)
    }
  }

  const handleClosePreview = () => {
    setShowPreview(false)
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl)
      setPdfUrl(null)
    }
  }

  const handleSendInvoiceEmail = async () => {
    if (!transaction) return

    setEmailLoading(true)
    setError(null)
    setEmailSuccess(null)

    try {
      const result = await sendInvoiceEmail(transaction._id) as SendEmailResponse
      await loadTransaction() // Refresh transaction to show email sent status

      if (result.emailSent) {
        setEmailSuccess(`Invoice email sent successfully to ${result.recipient}`)
        // Auto-hide success message after 5 seconds
        setTimeout(() => setEmailSuccess(null), 5000)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invoice email'
      setError(errorMessage)
      console.error('Failed to send invoice email:', err)
    } finally {
      setEmailLoading(false)
    }
  }

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        window.URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [pdfUrl])

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'partial':
        return 'bg-orange-100 text-orange-800'
      case 'overdue':
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading && !transaction) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error || !transaction) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error || 'Transaction not found'}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/transactions')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Transactions
        </Button>
      </div>
    )
  }

  const totalItems = (transaction.items || []).reduce((sum, item) => sum + (item.quantity ?? 0), 0)
  const totalDiscounts = (transaction.items || []).reduce((sum, item) => sum + (item.discountAmount || 0), 0)
  // Calculate correct total from subtotal minus discounts
  const subtotal = (transaction.items || []).reduce((sum, item) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0)
  const calculatedTotal = subtotal - totalDiscounts - (transaction.discountAmount || 0)

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/transactions')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Transaction Details</h1>
              {transaction.status === 'draft' && (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                  DRAFT
                </Badge>
              )}
            </div>
            <p className="text-gray-500">{transaction.transactionNumber}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push('/transactions')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Transactions
          </Button>
          {/* Only show View Invoice if invoice was successfully generated (status = completed) */}
          {transaction.invoiceStatus === 'completed' && transaction.invoicePath ? (
            <>
              <Button onClick={handleViewInvoice} variant="default">
                <FileText className="mr-2 h-4 w-4" />
                View Invoice
              </Button>
              {transaction.customerEmail && (
                <Button
                  onClick={handleSendInvoiceEmail}
                  disabled={emailLoading}
                  variant="secondary"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {emailLoading ? 'Sending...' : transaction.invoiceEmailSent ? 'Resend Email' : 'Send Email'}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={handleGenerateInvoice} disabled={loading} variant="default">
              <Printer className="mr-2 h-4 w-4" />
              {transaction.invoiceStatus === 'failed' ? 'Retry Invoice' : 'Download PDF'}
            </Button>
          )}
        </div>
      </div>

      {/* Success Message */}
      {emailSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {emailSuccess}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium">{transaction.customerName}</p>
            </div>
            {transaction.customerEmail && (
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{transaction.customerEmail}</p>
              </div>
            )}
            {transaction.customerPhone && (
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{transaction.customerPhone}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Information */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-medium">
                {new Date(transaction.transactionDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-medium capitalize">{transaction.type || 'sale'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Payment Method</p>
              <p className="font-medium capitalize">{(transaction.paymentMethod || 'Paynow').replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Payment Status</p>
              <Badge className={getPaymentStatusColor(transaction.paymentStatus || 'pending')}>
                {(transaction.paymentStatus || 'pending').toUpperCase()}
              </Badge>
            </div>
            {(transaction.invoiceStatus && transaction.invoiceStatus !== 'none') && (
              <div>
                <p className="text-sm text-gray-500">Invoice Status</p>
                {transaction.invoiceStatus === 'completed' ? (
                  transaction.invoiceEmailSent && transaction.invoiceEmailSentAt ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-700">Email Sent</p>
                        <p className="text-xs text-gray-600">
                          {new Date(transaction.invoiceEmailSentAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {transaction.invoiceEmailRecipient && (
                          <p className="text-xs text-gray-600">
                            to: {transaction.invoiceEmailRecipient}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="font-medium text-gray-600">Generated • Not sent via email</p>
                  )
                ) : transaction.invoiceStatus === 'failed' ? (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-600">Generation Failed</p>
                      {transaction.invoiceError && (
                        <p className="text-xs text-gray-600">{transaction.invoiceError}</p>
                      )}
                    </div>
                  </div>
                ) : transaction.invoiceStatus === 'generating' ? (
                  <p className="font-medium text-blue-600">Generating...</p>
                ) : (
                  <p className="font-medium text-gray-500">Pending</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items ({totalItems} total)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(transaction.items || []).map((item, index) => (
              <div key={index} className="flex justify-between items-start pb-4 border-b last:border-0">
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  {item.sku && <p className="text-sm text-gray-500">SKU: {item.sku}</p>}
                  <p className="text-sm text-gray-600">
                    Quantity: {item.quantity ?? 0} × {formatCurrency(item.unitPrice ?? 0)}
                  </p>
                  {item.discountAmount && item.discountAmount > 0 && (
                    <p className="text-sm text-green-600">
                      Member Discount: -{formatCurrency(item.discountAmount)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(item.totalPrice)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span>{formatCurrency((transaction.items || []).reduce((sum, item) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0))}</span>
          </div>
          {totalDiscounts > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Member Discounts</span>
              <span>-{formatCurrency(totalDiscounts)}</span>
            </div>
          )}
          {transaction.discountAmount && transaction.discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Additional Discount</span>
              <span>-{formatCurrency(transaction.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold pt-2 border-t">
            <span>Total</span>
            <span>{formatCurrency(calculatedTotal)}</span>
          </div>
          <div className="flex justify-between font-medium pt-2">
            <span>Paid Amount</span>
            <span>{formatCurrency(transaction.paidAmount || 0)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Required Section - Show when payment is not complete */}
      {transaction.paymentStatus && transaction.paymentStatus !== 'paid' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 text-lg">Payment Required</h3>
                <p className="text-yellow-800 text-sm mt-1">
                  Outstanding Amount: {formatCurrency(calculatedTotal - (transaction.paidAmount || 0))}
                </p>
              </div>
            </div>

            <p className="text-gray-700 mb-4">
              Please complete your payment using one of the following methods. EXCEPT orders completed at the CLINIC COUNTER:
            </p>

            {/* PayNow Option */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-900 mb-3">Option 1: PayNow</h4>
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                {/* QR Code */}
                <div className="bg-white p-3 rounded-lg border border-blue-300 flex-shrink-0">
                  <QRCodeSVG
                    value="202527780C"
                    size={150}
                    level="H"
                    includeMargin={false}
                  />
                  <p className="text-xs text-center text-gray-600 mt-2 font-medium">
                    UEN 202527780C, Leaf to Life Pte Ltd
                  </p>
                </div>
                {/* Instructions */}
                <div className="space-y-2 text-sm flex-1">
                  <p className="text-gray-700">
                    <span className="font-medium">PayNow to our UEN:</span> <span className="font-mono font-semibold">202527780C</span>
                  </p>
                  <p className="text-gray-700">
                    <span className="font-medium">Company Name:</span> Leaf to Life Pte Ltd
                  </p>
                  <p className="text-gray-600 text-xs mt-2">
                    Scan the QR code with your banking app to make payment via PayNow
                  </p>
                </div>
              </div>
            </div>

            {/* Bank Transfer Option */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-900 mb-2">Option 2: Bank Transfer</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-gray-600">Account Number:</p>
                  <p className="font-medium font-mono">0721361590</p>
                </div>
                <div>
                  <p className="text-gray-600">Account Name:</p>
                  <p className="font-medium">Leaf to Life Pte Ltd</p>
                </div>
                <div>
                  <p className="text-gray-600">Bank:</p>
                  <p className="font-medium">DBS Bank (Singapore)</p>
                </div>
                <div>
                  <p className="text-gray-600">Swift Code:</p>
                  <p className="font-medium font-mono">DBSSSGSG</p>
                </div>
                <div>
                  <p className="text-gray-600">Bank Code:</p>
                  <p className="font-medium font-mono">7171</p>
                </div>
                <div>
                  <p className="text-gray-600">Branch Code:</p>
                  <p className="font-medium font-mono">010</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-600">Bank Address:</p>
                  <p className="font-medium">12 Marina Boulevard, DBS Asia Central, Marina Bay Financial Centre Tower 3, Singapore 018982</p>
                </div>
              </div>
            </div>

            {/* No Refund Policy */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-red-900">NO REFUND POLICY</h4>
                  <p className="text-red-800 text-sm mt-1">
                    All sales are final. No refunds will be provided once payment is processed.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mt-4 text-center">
              For questions about this invoice, please contact us at <a href="mailto:customerservice@leaftolife.com.sg" className="text-blue-600 hover:underline">customerservice@leaftolife.com.sg</a> or <a href="tel:+6565389978" className="text-blue-600 hover:underline">+65 6538 9978</a>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {transaction.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{transaction.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* PDF Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={handleClosePreview}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle>Invoice Preview - {transaction?.invoiceNumber}</DialogTitle>
              <div className="flex gap-2">
                <Button onClick={downloadInvoicePDF} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button onClick={handleClosePreview} variant="ghost" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title="Invoice Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
