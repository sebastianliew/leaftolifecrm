"use client"

import { useState, useCallback } from "react"
import { api } from "@/lib/api-client"
import type {
  Transaction,
  TransactionFormData,
  Customer,
} from "@/types/transaction"

interface PaginationInfo {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<Array<{_id: string; name: string; price: number; category?: string}>>([])
  const [serviceCategories] = useState<Array<{_id: string; name: string}>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)

  const getTransactions = useCallback(async (params?: {
    page?: number
    limit?: number
    status?: string
    type?: string
    customerId?: string
    search?: string
  }) => {
    setLoading(true)
    try {
      const searchParams = new URLSearchParams()
      if (params?.page) searchParams.set('page', params.page.toString())
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      if (params?.status) searchParams.set('status', params.status)
      if (params?.type) searchParams.set('type', params.type)
      if (params?.customerId) searchParams.set('customerId', params.customerId)
      if (params?.search) searchParams.set('search', params.search)
      
      const { data, error, status, ok } = await api.get('/transactions', Object.fromEntries(searchParams))
      
      if (!ok) {
        const errorText = error || 'Request failed'
        console.error('Failed to fetch transactions:', status, errorText)
        throw new Error(`HTTP ${status}: ${errorText}`)
      }
      
      // Handle paginated response
      const typedData = data as { data?: Transaction[]; pagination?: PaginationInfo } | Transaction[];
      if (!Array.isArray(typedData) && typedData.data && typedData.pagination) {
        setTransactions(typedData.data)
        setPagination(typedData.pagination)
      } else {
        // Backward compatibility for non-paginated response
        const transactionsArray = Array.isArray(typedData) ? typedData : []
        setTransactions(transactionsArray)
        setPagination(null)
      }
      
      setError(null)
      return data
    } catch {
      console.error('getTransactions error')
      setError("Failed to fetch transactions")
      setTransactions([])
      throw new Error("Failed to fetch transactions")
    } finally {
      setLoading(false)
    }
  }, [])

  const getTransaction = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const response = await api.get(`/transactions/${id}`)
      if (!response.ok || !response.data) {
        throw new Error(response.error || "Transaction not found")
      }
      setError(null)
      return response.data as Transaction
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch transaction"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const createTransaction = useCallback(async (data: TransactionFormData) => {
    setLoading(true)
    setError(null)

    try {
      console.log('Hook: Creating transaction with data:', data);

      const response = await api.post('/transactions', data);

      if (!response.ok) {
        const errorMessage = response.error || 'Failed to create transaction'
        console.error('Hook: Transaction creation failed:', response.error)
        setError(errorMessage)
        throw new Error(errorMessage)
      }

      const result = response.data as Transaction;
      console.log('Hook: Transaction created successfully:', result);

      setTransactions((prev) => [result, ...prev])
      setError(null)
      return result
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create transaction"
      console.error('Hook: Transaction creation error:', err);
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateTransaction = useCallback(async (id: string, data: Partial<TransactionFormData>) => {
    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const response = await fetch(`${apiUrl}/transactions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      await response.json()
      
      // Fetch the updated transaction to ensure we have the latest status
      // This is important when converting drafts to completed transactions
      const refreshResponse = await fetch(`${apiUrl}/transactions/${id}`)
      const refreshedTransaction = await refreshResponse.json()
      
      setTransactions((prev) =>
        prev.map((transaction) => (transaction._id === id ? refreshedTransaction : transaction))
      )
      setError(null)
      return refreshedTransaction
    } catch {
      setError("Failed to update transaction")
      throw new Error("Failed to update transaction")
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteTransaction = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const response = await fetch(`${apiUrl}/transactions/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete transaction')
      }
      setTransactions((prev) => prev.filter((transaction) => transaction._id !== id))
      setError(null)
    } catch {
      setError("Failed to delete transaction")
      throw new Error("Failed to delete transaction")
    } finally {
      setLoading(false)
    }
  }, [])

  const generateInvoice = useCallback(async (transactionId: string) => {
    setLoading(true)
    try {
      console.log('Hook: Generating invoice for transaction:', transactionId);

      const response = await api.post(`/transactions/${transactionId}/invoice`, {});

      if (!response.ok) {
        console.error('Hook: Invoice generation API error:', response.error);
        throw new Error(response.error || 'Failed to generate invoice')
      }

      const data = response.data as { success?: boolean; invoicePath?: string; invoiceNumber?: string };
      console.log('Hook: Invoice generation response:', data);

      // Validate response data
      if (!data.success || !data.invoicePath) {
        throw new Error('Invalid response from invoice generation API')
      }

      setTransactions((prev) =>
        prev.map((transaction) =>
          transaction._id === transactionId
            ? {
                ...transaction,
                invoiceGenerated: true,
                invoicePath: data.invoicePath!,
                invoiceNumber: data.invoiceNumber,
                updatedAt: new Date().toISOString(),
              }
            : transaction
        )
      )
      setError(null)
      return data
    } catch (err) {
      console.error('Hook: Invoice generation error:', err);
      setError("Failed to generate invoice")
      throw new Error("Failed to generate invoice")
    } finally {
      setLoading(false)
    }
  }, [])

  const sendInvoiceEmail = useCallback(async (transactionId: string) => {
    setLoading(true)
    try {
      console.log('Hook: Sending invoice email for transaction:', transactionId);

      const response = await api.post(`/transactions/${transactionId}/send-invoice-email`, {});

      if (!response.ok) {
        console.error('Hook: Send invoice email API error:', response.error);
        throw new Error(response.error || 'Failed to send invoice email')
      }

      const data = response.data as { emailSent?: boolean; sentAt?: string; recipient?: string };
      console.log('Hook: Send invoice email response:', data);

      // Update transaction with email sent info
      setTransactions((prev) =>
        prev.map((transaction) =>
          transaction._id === transactionId
            ? {
                ...transaction,
                invoiceEmailSent: data.emailSent || false,
                invoiceEmailSentAt: data.sentAt ? new Date(data.sentAt).toISOString() : undefined,
                invoiceEmailRecipient: data.recipient,
                updatedAt: new Date().toISOString(),
              }
            : transaction
        )
      )
      setError(null)
      return data
    } catch (err) {
      console.error('Hook: Send invoice email error:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to send invoice email"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const getTransactionSummary = useCallback(async (startDate?: string, endDate?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const response = await fetch(`${apiUrl}/transactions/summary${params.toString() ? `?${params.toString()}` : ''}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to fetch transaction summary:', response.status, errorData)
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Transaction summary fetched:', data)
      setError(null)
      return data
    } catch (err) {
      console.error('getTransactionSummary error:', err)
      setError("Failed to fetch transaction summary")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const getCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const response = await fetch(`${apiUrl}/customers`)
      const data = await response.json()
      setCustomers(data)
      setError(null)
      return data
    } catch (err) {
      setError("Failed to fetch customers")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const createCustomer = useCallback(async (data: Omit<Customer, "id" | "createdAt" | "updatedAt" | "totalPurchases">) => {
    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const response = await fetch(`${apiUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      const newCustomer = await response.json()
      setCustomers((prev) => [...prev, newCustomer])
      setError(null)
      return newCustomer
    } catch (err) {
      setError("Failed to create customer")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const getServices = useCallback(async () => {
    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const response = await fetch(`${apiUrl}/services`)
      const data = await response.json()
      setServices(data)
      setError(null)
      return data
    } catch (err) {
      setError("Failed to fetch services")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    transactions,
    customers,
    services,
    serviceCategories,
    loading,
    error,
    pagination,
    getTransactions,
    getTransaction,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    generateInvoice,
    sendInvoiceEmail,
    getTransactionSummary,
    getCustomers,
    createCustomer,
    getServices,
  }
}
