// Anomaly Detection System Types

export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';

export type AnomalyType =
  | 'extreme_underpricing'
  | 'below_cost'
  | 'negative_margin'
  | 'orphaned_reference'
  | 'missing_product'
  | 'missing_bundle'
  | 'missing_blend'
  | 'calculation_error'
  | 'null_price'
  | 'negative_price'
  | 'near_zero_price'
  | 'extreme_discount'
  | 'ingredient_mismatch'
  | 'container_mismatch';

export type AnomalyStatus = 'detected' | 'reviewed' | 'fixed' | 'ignored' | 'failed';

export type ScanStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'paused' | 'cancelled';

export type FixResult = 'success' | 'failed' | 'partial';

export interface ScanConfiguration {
  batchSize: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
  scanTypes: string[];
  autoFix: boolean;
  dryRun?: boolean;
  notifyOnCritical?: boolean;
}

export interface ScanProgress {
  totalTransactions: number;
  processedTransactions: number;
  lastProcessedId?: string;
  foundAnomalies: number;
  fixedAnomalies?: number;
  failedFixes?: number;
  checkpointAt?: Date;
  percentage?: number;
}

interface PriceCalculation {
  expectedPrice: number;
  actualPrice: number;
  costPrice: number;
  margin: number;
  markupPercent: number;
}

interface CalculationDetails {
  formula: string;
  variables: Record<string, number | string>;
  result: number;
  expectedResult: number;
  variance: number;
}

export interface AnomalyDetail {
  expected?: number | string | PriceCalculation;
  actual?: number | string | PriceCalculation;
  missing?: string[];
  calculation?: CalculationDetails;
  ingredientCost?: number;
  sellingPrice?: number;
  lossAmount?: number;
  lossPercentage?: string;
  message?: string;
}

export interface SuggestedFix {
  action: string;
  newValue?: number | string | Record<string, unknown>;
  reason?: string;
  estimatedImpact?: number;
}

export interface DetectedAnomaly {
  itemId: string;
  itemName: string;
  itemType: 'product' | 'custom_blend' | 'bundle' | 'fixed_blend' | 'miscellaneous' | 'consultation' | 'service';
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  details: AnomalyDetail;
  suggestedFix?: SuggestedFix;
  canAutoFix: boolean;
}

export interface AnomalyReport {
  transactionId: string;
  transactionNumber: string;
  transactionDate: Date;
  customerName: string;
  customerId?: string;
  totalAmount: number;
  paymentStatus: string;
  anomalies: DetectedAnomaly[];
  estimatedLoss: number;
  canAutoFix: boolean;
}

export interface ScanResult {
  totalScanned: number;
  anomaliesFound: number;
  anomalies: AnomalyReport[];
  summary: {
    bySeverity: Record<AnomalySeverity, number>;
    byType: Record<string, number>;
    totalEstimatedLoss: number;
    criticalCount: number;
    autoFixableCount: number;
  };
  errors?: string[];
}

interface ChangeLog {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: Date;
}

export interface FixAttempt {
  attemptedAt: Date;
  attemptedBy: string;
  action: string;
  result: FixResult;
  changes?: ChangeLog[];
  error?: string;
}

interface CriticalIssue {
  transactionId: string;
  itemName: string;
  severity: AnomalySeverity;
  type: AnomalyType;
  estimatedLoss: number;
  description: string;
}

export interface AnomalyScanJobSummary {
  jobId: string;
  status: ScanStatus;
  startedAt: Date;
  completedAt?: Date;
  progress: ScanProgress;
  configuration: ScanConfiguration;
  results?: {
    summary: Record<string, number>;
    criticalIssues: CriticalIssue[];
    estimatedLoss: number;
  };
}

export interface AnomalyFilters {
  severity?: AnomalySeverity[];
  type?: AnomalyType[];
  status?: AnomalyStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  minLoss?: number;
  maxLoss?: number;
  customerId?: string;
  transactionNumber?: string;
  itemName?: string;
}

export interface AnomalyStats {
  total: number;
  byStatus: Record<AnomalyStatus, number>;
  bySeverity: Record<AnomalySeverity, number>;
  byType: Record<AnomalyType, number>;
  totalEstimatedLoss: number;
  totalActualLoss: number;
  fixedCount: number;
  pendingCount: number;
  autoFixableCount: number;
  averageLossPerAnomaly: number;
  topAnomalyTypes: Array<{
    type: AnomalyType;
    count: number;
    totalLoss: number;
  }>;
}

export interface BatchScanRequest {
  batchSize?: number;
  startDate?: Date;
  endDate?: Date;
  scanTypes?: string[];
  autoFix?: boolean;
  dryRun?: boolean;
}

export interface BatchScanResponse {
  jobId: string;
  status: ScanStatus;
  message: string;
  estimatedTime?: number;
}

export interface FixRequest {
  anomalyIds: string[];
  fixes: Array<{
    anomalyId: string;
    action: string;
    newValue?: number | string | Record<string, unknown>;
  }>;
  userId: string;
  notes?: string;
}

export interface FixResponse {
  success: boolean;
  fixedCount: number;
  failedCount: number;
  results: Array<{
    anomalyId: string;
    success: boolean;
    error?: string;
    changes?: ChangeLog[];
  }>;
}

// Helper type guards
export function isCriticalAnomaly(anomaly: DetectedAnomaly): boolean {
  return anomaly.severity === 'critical';
}

export function isPricingAnomaly(type: AnomalyType): boolean {
  return [
    'extreme_underpricing',
    'below_cost',
    'negative_margin',
    'null_price',
    'negative_price',
    'near_zero_price',
    'extreme_discount'
  ].includes(type);
}

export function isReferenceAnomaly(type: AnomalyType): boolean {
  return [
    'orphaned_reference',
    'missing_product',
    'missing_bundle',
    'missing_blend'
  ].includes(type);
}

// Constants
export const ANOMALY_THRESHOLDS = {
  EXTREME_UNDERPRICING_RATIO: 0.1,  // Selling at less than 10% of cost
  BELOW_COST_MARGIN: -10,            // Negative margin threshold
  NEAR_ZERO_PRICE: 0.01,             // Minimum acceptable price
  EXTREME_DISCOUNT_RATIO: 0.9,       // More than 90% discount
  MIN_BATCH_SIZE: 1,
  MAX_BATCH_SIZE: 500,
  DEFAULT_BATCH_SIZE: 50
};

export const ANOMALY_MESSAGES = {
  EXTREME_UNDERPRICING: 'Item is being sold at less than 10% of its cost',
  BELOW_COST: 'Item is being sold below cost',
  ORPHANED_REFERENCE: 'Item references a deleted product/bundle/blend',
  MISSING_PRODUCT: 'Product no longer exists in the system',
  CALCULATION_ERROR: 'Price calculation does not match expected values',
  NULL_PRICE: 'Item has no price set',
  NEGATIVE_PRICE: 'Item has a negative price'
};