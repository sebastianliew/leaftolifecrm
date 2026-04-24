export type UomType = 'weight' | 'volume' | 'count' | 'length' | 'area' | 'temperature';

export interface ContainerType {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  allowedUomTypes: UomType[];
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CreateContainerTypeRequest {
  name: string;
  description?: string;
  isActive?: boolean;
  allowedUomTypes: UomType[];
}

export interface UpdateContainerTypeRequest {
  id: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  allowedUomTypes?: UomType[];
}

export interface ContainerTypesResponse {
  containerTypes: ContainerType[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface ContainerTypeFilters {
  search?: string;
  isActive?: boolean;
}
