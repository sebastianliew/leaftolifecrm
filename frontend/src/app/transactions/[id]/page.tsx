"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, FileText, Printer, Download, Mail, CheckCircle2 } from 'lucide-react'

import { useTransactions as useTransactionsHook } from '@/hooks/useTransactions'
import { formatCurrency } from '@/utils/currency'
import type { Transaction } from '@/types/transaction'
import {
  EditorialPage,
  EditorialPageSkeleton,
  EditorialErrorScreen,
  EditorialBreadcrumb,
  EditorialMasthead,
  EditorialButton,
  EditorialSection,
  EditorialDefList,
  EditorialPill,
  EditorialNote,
  EditorialModal,
  EditorialMeta,
} from '@/components/ui/editorial'

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

const paymentToneMap: Record<string, "muted" | "ink" | "danger" | "warning" | "ok"> = {
  paid: 'ok',
  pending: 'warning',
  partial: 'warning',
  overdue: 'danger',
  failed: 'danger',
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
    if (id) loadTransaction()
  }, [id, loadTransaction])

  const previewInvoicePDF = async (downloadUrl: string) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token')
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'
      const fullUrl = `${apiBase.replace(/\/api$/, '')}${downloadUrl}`

      const response = await fetch(fullUrl, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` },
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

  const handleGenerateInvoice = async () => {
    if (!transaction) return
    try {
      const result = await generateInvoice(transaction._id) as GenerateInvoiceResponse
      await loadTransaction()
      await previewInvoicePDF(result.downloadUrl)
    } catch (err) {
      console.error('Failed to generate invoice:', err)
    }
  }

  const handleViewInvoice = async () => {
    if (!transaction) return
    try {
      const result = await generateInvoice(transaction._id) as GenerateInvoiceResponse
      await loadTransaction()
      await previewInvoicePDF(result.downloadUrl)
    } catch (err) {
      console.error('[Invoice] Generation failed:', err)
      setError('Failed to generate invoice. Please try again.')
    }
  }

  const downloadInvoicePDF = async () => {
    if (!pdfUrl || !transaction?.invoiceNumber) return
    const filename = transaction.invoiceFilename || `${transaction.invoiceNumber}.pdf`
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
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
      await loadTransaction()
      if (result.emailSent) {
        setEmailSuccess(`Invoice email sent successfully to ${result.recipient}`)
        setTimeout(() => setEmailSuccess(null), 5000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invoice email')
      console.error('Failed to send invoice email:', err)
    } finally {
      setEmailLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (pdfUrl) window.URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  const renderInvoiceStatus = (txn: Transaction): React.ReactNode => {
    if (txn.invoiceStatus === 'completed' && txn.invoiceEmailSent && txn.invoiceEmailSentAt) {
      return (
        <div>
          <span className="text-[#16A34A]">Email sent</span>
          <EditorialMeta className="tabular-nums">
            {new Date(txn.invoiceEmailSentAt).toLocaleString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
            {txn.invoiceEmailRecipient && ` · to ${txn.invoiceEmailRecipient}`}
          </EditorialMeta>
        </div>
      )
    }
    if (txn.invoiceStatus === 'completed') {
      return <span className="text-[#6B7280]">Generated · not sent</span>
    }
    if (txn.invoiceStatus === 'failed') {
      return (
        <div>
          <span className="text-[#DC2626]">Generation failed</span>
          {txn.invoiceError && <EditorialMeta>{txn.invoiceError}</EditorialMeta>}
        </div>
      )
    }
    if (txn.invoiceStatus === 'generating') return <span className="text-[#6B7280]">Generating…</span>
    return <span className="text-[#9CA3AF]">Pending</span>
  }

  if (loading && !transaction) return <EditorialPageSkeleton />

  if (error || !transaction) {
    return (
      <EditorialErrorScreen
        title="Could not load transaction."
        description={error || 'Transaction not found'}
        onRetry={() => router.push('/transactions')}
      />
    )
  }

  const totalItems = (transaction.items || []).reduce((sum, item) => sum + (item.quantity ?? 0), 0)
  const totalDiscounts = (transaction.items || []).reduce((sum, item) => sum + (item.discountAmount || 0), 0)
  const subtotal = (transaction.items || []).reduce((sum, item) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0)
  const calculatedTotal = subtotal - totalDiscounts - (transaction.discountAmount || 0)
  const outstanding = calculatedTotal - (transaction.paidAmount || 0)
  const paymentTone = paymentToneMap[transaction.paymentStatus || 'pending'] || 'muted'

  return (
    <EditorialPage>
      <EditorialBreadcrumb
        segments={[
          { label: 'Transactions', href: '/transactions' },
          { label: transaction.transactionNumber },
        ]}
      />

      <EditorialMasthead
        kicker="Transaction"
        title={transaction.transactionNumber}
        subtitle={
          <>
            {new Date(transaction.transactionDate).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
            {transaction.status === 'draft' && <span className="ml-3 text-[#EA580C]">· Draft</span>}
          </>
        }
      >
        <EditorialButton
          variant="ghost"
          icon={<ArrowLeft className="h-3 w-3" />}
          onClick={() => router.push('/transactions')}
        >
          Back
        </EditorialButton>
        {transaction.invoiceStatus === 'completed' && transaction.invoicePath ? (
          <EditorialButton
            variant="primary"
            arrow
            icon={<FileText className="h-3 w-3" />}
            onClick={handleViewInvoice}
          >
            View invoice
          </EditorialButton>
        ) : (
          <EditorialButton
            variant="primary"
            arrow
            icon={<Printer className="h-3 w-3" />}
            onClick={handleGenerateInvoice}
            disabled={loading}
          >
            {transaction.invoiceStatus === 'failed' ? 'Retry invoice' : 'Generate invoice'}
          </EditorialButton>
        )}
        {transaction.customerEmail && (
          <EditorialButton
            variant="ghost"
            icon={<Mail className="h-3 w-3" />}
            onClick={handleSendInvoiceEmail}
            disabled={emailLoading}
          >
            {emailLoading ? 'Sending…' : transaction.invoiceEmailSent ? 'Resend email' : 'Send email'}
          </EditorialButton>
        )}
      </EditorialMasthead>

      {emailSuccess && (
        <div className="mt-6">
          <EditorialNote tone="ok" kicker="Email sent">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
              {emailSuccess}
            </div>
          </EditorialNote>
        </div>
      )}

      <EditorialSection index="i." title="Customer">
        <EditorialDefList
          cols={3}
          items={[
            { label: 'Name', value: transaction.customerName },
            { label: 'Email', value: transaction.customerEmail || '—', tone: transaction.customerEmail ? 'ink' : 'muted' },
            { label: 'Phone', value: transaction.customerPhone || '—', tone: transaction.customerPhone ? 'ink' : 'muted' },
          ]}
        />
      </EditorialSection>

      <EditorialSection index="ii." title="Transaction details">
        <EditorialDefList
          cols={3}
          items={[
            {
              label: 'Date',
              value: new Date(transaction.transactionDate).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              }),
            },
            { label: 'Type', value: <span className="capitalize">{transaction.type || 'sale'}</span> },
            {
              label: 'Payment method',
              value: <span className="capitalize">{(transaction.paymentMethod || 'Paynow').replace('_', ' ')}</span>,
            },
            {
              label: 'Payment status',
              value: <EditorialPill tone={paymentTone}>{(transaction.paymentStatus || 'pending').toUpperCase()}</EditorialPill>,
            },
            ...(transaction.invoiceStatus && transaction.invoiceStatus !== 'none'
              ? [{ label: 'Invoice', value: renderInvoiceStatus(transaction) }]
              : []),
          ]}
        />
      </EditorialSection>

      <EditorialSection
        index="iii."
        title={`Items · ${totalItems} total`}
        actions={
          (transaction.items || []).some(i => i.itemType === 'custom_blend' || i.itemType === 'fixed_blend') && (
            <EditorialButton
              variant="ghost"
              onClick={() => router.push(`/transactions?edit=${transaction._id}`)}
            >
              Edit transaction
            </EditorialButton>
          )
        }
      >
        <div className="space-y-6">
          {(transaction.items || []).map((item, index) => {
            const isCustomBlend = item.itemType === 'custom_blend'
            const isFixedBlend = item.itemType === 'fixed_blend'
            const isBundle = item.itemType === 'bundle'
            const blendIngredients = isCustomBlend ? item.customBlendData?.ingredients : null
            const bundleProducts = isBundle ? item.bundleData?.bundleProducts : null
            return (
              <div key={index} className="flex justify-between items-start pb-6 border-b border-[#E5E7EB] last:border-0 last:pb-0">
                <div className="flex-1 pr-6">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-[14px] text-[#0A0A0A] font-medium">{item.name}</p>
                    {isCustomBlend && <EditorialPill>Custom blend</EditorialPill>}
                    {isFixedBlend && <EditorialPill>Fixed blend</EditorialPill>}
                    {isBundle && <EditorialPill tone="ink">Bundle</EditorialPill>}
                  </div>
                  {item.sku && <EditorialMeta className="font-mono tracking-wide">SKU · {item.sku}</EditorialMeta>}
                  <p className="text-[12px] text-[#6B7280] mt-2 tabular-nums">
                    {item.quantity ?? 0} × {formatCurrency(item.unitPrice ?? 0)}
                  </p>
                  {blendIngredients && blendIngredients.length > 0 && (
                    <div className="mt-3 border-l-2 border-[#16A34A] pl-4 py-2">
                      <p className="text-[10px] uppercase tracking-[0.4em] text-[#16A34A] mb-2">Ingredients</p>
                      <ul className="space-y-1">
                        {blendIngredients.map((ing, i) => (
                          <li key={i} className="text-[12px] text-[#0A0A0A] tabular-nums">
                            {ing.name} · <span className="text-[#6B7280]">{ing.quantity} {ing.unitName}</span>
                          </li>
                        ))}
                      </ul>
                      {item.customBlendData?.preparationNotes && (
                        <p className="text-[12px] text-[#6B7280] italic font-light mt-2">
                          {item.customBlendData.preparationNotes}
                        </p>
                      )}
                    </div>
                  )}
                  {bundleProducts && bundleProducts.length > 0 && (
                    <div className="mt-3 border-l-2 border-[#0A0A0A] pl-4 py-2">
                      <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280] mb-2">Bundle contents</p>
                      <ul className="space-y-1">
                        {bundleProducts.map((bp, i) => (
                          <li key={i} className="text-[12px] text-[#0A0A0A] tabular-nums">
                            {bp.name} · <span className="text-[#6B7280]">×{bp.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.discountAmount && item.discountAmount > 0 && (
                    <p className="text-[11px] uppercase tracking-[0.28em] text-[#16A34A] mt-3 tabular-nums">
                      Member discount · −{formatCurrency(item.discountAmount)}
                    </p>
                  )}
                </div>
                <p className="text-[14px] text-[#0A0A0A] tabular-nums shrink-0">{formatCurrency(item.totalPrice)}</p>
              </div>
            )
          })}
        </div>
      </EditorialSection>

      <EditorialSection index="iv." title="Payment summary">
        <dl className="space-y-3 max-w-md ml-auto">
          <div className="flex justify-between items-baseline">
            <dt className="text-[12px] text-[#6B7280]">Subtotal</dt>
            <dd className="text-[14px] text-[#0A0A0A] tabular-nums">{formatCurrency(subtotal)}</dd>
          </div>
          {totalDiscounts > 0 && (
            <div className="flex justify-between items-baseline">
              <dt className="text-[12px] text-[#16A34A]">Member discounts</dt>
              <dd className="text-[14px] text-[#16A34A] tabular-nums">−{formatCurrency(totalDiscounts)}</dd>
            </div>
          )}
          {transaction.discountAmount && transaction.discountAmount > 0 ? (
            <div className="flex justify-between items-baseline">
              <dt className="text-[12px] text-[#16A34A]">Additional discount</dt>
              <dd className="text-[14px] text-[#16A34A] tabular-nums">−{formatCurrency(transaction.discountAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between items-baseline pt-3 border-t border-[#0A0A0A]">
            <dt className="text-[10px] uppercase tracking-[0.32em] text-[#0A0A0A]">Total</dt>
            <dd className="font-light text-[28px] leading-none tabular-nums text-[#0A0A0A]">{formatCurrency(calculatedTotal)}</dd>
          </div>
          <div className="flex justify-between items-baseline pt-2">
            <dt className="text-[12px] text-[#6B7280]">Paid</dt>
            <dd className="text-[14px] text-[#0A0A0A] tabular-nums">{formatCurrency(transaction.paidAmount || 0)}</dd>
          </div>
          {outstanding > 0 && (
            <div className="flex justify-between items-baseline pt-2 border-t border-[#E5E7EB]">
              <dt className="text-[10px] uppercase tracking-[0.28em] text-[#EA580C]">Outstanding</dt>
              <dd className="text-[16px] tabular-nums text-[#EA580C]">{formatCurrency(outstanding)}</dd>
            </div>
          )}
        </dl>
      </EditorialSection>

      {transaction.paymentStatus && transaction.paymentStatus !== 'paid' && (
        <EditorialSection
          index="v."
          title="Payment required"
          description="Kindly check the invoice and proceed with transfer once confirmed."
        >
          <EditorialNote tone="warning" kicker="Outstanding amount" className="mb-8">
            <span className="font-light text-[28px] leading-none tabular-nums text-[#EA580C]">
              {formatCurrency(outstanding)}
            </span>
          </EditorialNote>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280] mb-4">Option 1 · PayNow</p>
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="bg-white p-3 border border-[#E5E7EB] flex-shrink-0">
                  <Image
                    src="/paynow-qr-uen202527780c.jpeg"
                    alt="PayNow QR Code – UEN 202527780C"
                    width={150}
                    height={150}
                  />
                  <p className="text-[10px] text-center text-[#6B7280] mt-2 tracking-wide">
                    UEN 202527780C
                  </p>
                </div>
                <div className="space-y-3 text-[13px]">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">UEN</p>
                    <p className="font-mono mt-1">202527780C</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Company</p>
                    <p className="mt-1">Leaf to Life Pte Ltd</p>
                  </div>
                  <p className="text-[11px] italic font-light text-[#9CA3AF]">
                    Scan with your banking app to pay via PayNow.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280] mb-4">Option 2 · Bank transfer</p>
              <EditorialDefList
                cols={2}
                items={[
                  { label: 'Account number', value: <span className="font-mono">0721361590</span> },
                  { label: 'Account name', value: 'Leaf to Life Pte Ltd' },
                  { label: 'Bank', value: 'DBS Bank (Singapore)' },
                  { label: 'Swift code', value: <span className="font-mono">DBSSSGSG</span> },
                  { label: 'Bank code', value: <span className="font-mono">7171</span> },
                ]}
              />
              <div className="mt-6">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Bank address</p>
                <p className="text-[13px] mt-1 text-[#0A0A0A]">
                  12 Marina Boulevard, DBS Asia Central, Marina Bay Financial Centre Tower 3, Singapore 018982
                </p>
              </div>
            </div>
          </div>

          <EditorialNote tone="danger" kicker="No refund policy" className="mt-10">
            All sales are final. No refunds will be provided once payment is processed.
          </EditorialNote>

          <p className="text-[12px] text-[#6B7280] mt-6 italic font-light">
            Please share the transaction details once payment is made. We&apos;ll proceed to blend and arrange
            delivery after payment is received.
          </p>

          <p className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280] mt-4 text-center">
            Questions? Contact{' '}
            <a href="mailto:customerservice@leaftolife.com.sg" className="text-[#0A0A0A] hover:underline normal-case tracking-normal">
              customerservice@leaftolife.com.sg
            </a>{' '}
            or{' '}
            <a href="tel:+6565389978" className="text-[#0A0A0A] hover:underline normal-case tracking-normal">
              +65 6538 9978
            </a>
          </p>
        </EditorialSection>
      )}

      {transaction.notes && (
        <EditorialSection title="Notes">
          <p className="text-[14px] text-[#0A0A0A] italic font-light leading-relaxed">{transaction.notes}</p>
        </EditorialSection>
      )}

      <EditorialModal
        open={showPreview}
        onOpenChange={(open) => !open && handleClosePreview()}
        kicker="Invoice"
        title={`Preview · ${transaction?.invoiceNumber || ''}`}
        size="2xl"
      >
        <div className="flex items-center justify-end gap-2 mb-4 -mt-2">
          <EditorialButton variant="ghost" icon={<Download className="h-3 w-3" />} onClick={downloadInvoicePDF}>
            Download
          </EditorialButton>
        </div>
        <div className="h-[70vh] overflow-hidden border border-[#E5E7EB]">
          {pdfUrl && (
            <iframe src={pdfUrl} className="w-full h-full border-0" title="Invoice Preview" />
          )}
        </div>
      </EditorialModal>
    </EditorialPage>
  )
}
