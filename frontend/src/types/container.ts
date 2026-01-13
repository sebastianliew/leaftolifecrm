export interface ContainerType {
  id: string
  name: string
  description: string
  allowedUoms: string[] // Array of allowed UOMs for this container type
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Bottle/Container tracking types for partial unit sales
export interface SaleHistoryEntry {
  transactionRef: string
  quantitySold: number
  soldAt: string
  soldBy?: string
}

export interface Bottle {
  id: string
  remaining: number
  capacity: number
  status: 'full' | 'partial' | 'empty' | 'oversold'
  openedAt?: string
  batchNumber?: string
  expiryDate?: string
  notes?: string
  salesCount?: number
  lastSale?: string
  saleHistory?: SaleHistoryEntry[]
}

export interface ProductContainersResponse {
  success: boolean
  data: {
    productId: string
    productName: string
    productSku: string
    containerCapacity: number
    unitOfMeasurement: {
      _id: string
      name: string
      abbreviation: string
    }
    fullContainers: number
    containers: Bottle[]
    summary: {
      totalFull: number
      totalPartial: number
      totalEmpty: number
      totalRemaining: number
    }
  }
}

export interface ContainerDetailsResponse {
  success: boolean
  data: {
    productId: string
    productName: string
    productSku: string
    unitOfMeasurement: {
      _id: string
      name: string
      abbreviation: string
    }
    container: Bottle
  }
}

export interface ContainerSaleHistoryResponse {
  success: boolean
  data: {
    containerId: string
    productName: string
    productSku: string
    openedAt?: string
    capacity: number
    currentRemaining: number
    totalSold: number
    salesCount: number
    saleHistory: SaleHistoryEntry[]
  }
}

export interface CreateContainerRequest {
  quantity?: number
  batchNumber?: string
  expiryDate?: string
  notes?: string
  capacity?: number
}

export interface UpdateContainerRequest {
  batchNumber?: string
  expiryDate?: string
  notes?: string
  status?: 'full' | 'partial' | 'empty'
  remaining?: number
} 