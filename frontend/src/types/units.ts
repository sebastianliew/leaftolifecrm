export interface UnitOfMeasurement {
  id: string;
  _id?: string;
  name: string;
  abbreviation: string;
  type: 'weight' | 'volume' | 'count' | 'length' | 'area' | 'temperature';
  description?: string;
  isActive: boolean;
  baseUnit?: string;
  conversionRate?: number;
}

export interface Unit {
  _id: string;
  name: string;
  abbreviation: string;
  type: 'weight' | 'volume' | 'count' | 'length' | 'area' | 'temperature';
  description?: string;
  isActive: boolean;
  baseUnit?: string;
  conversionRate?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}