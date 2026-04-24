export type UomType = 'weight' | 'volume' | 'count' | 'length' | 'area' | 'temperature';

export interface ICategory {
  _id: string;
  name: string;
  description?: string;
  level: number;
  parent?: string;
  isActive: boolean;
  allowedUomTypes?: UomType[];
  defaultUom?: string;
  defaultCanSellLoose?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
