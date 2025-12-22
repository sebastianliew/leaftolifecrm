export interface DiscountPreset {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PresetFormData {
  name: string;
  price: number;
}

export interface ConsultationSettings {
  id: string;
  currency: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastUpdatedBy?: string;
}