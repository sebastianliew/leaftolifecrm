export interface Product {
  _id: string;
  name: string;
  sku: string;
  unitOfMeasurement?: {
    _id: string;
    name: string;
    abbreviation: string;
  };
} 