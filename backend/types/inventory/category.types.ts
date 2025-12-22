export interface ICategory {
  _id: string;
  name: string;
  description?: string;
  level: number;
  parent?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}