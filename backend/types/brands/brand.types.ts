export interface BrandCategory {
  id: string;
  name: string;
  description?: string;
}

export interface QualityStandard {
  id: string;
  name: string;
  description?: string;
  compliance: boolean;
}

export type BrandStatus = "active" | "inactive" | "discontinued" | "pending_approval";

export interface BrandDTO {
  id: string;
  name: string;
  code: string;
  description?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  categories: BrandCategory[];
  qualityStandards: QualityStandard[];
  status: BrandStatus;
  isActive: boolean;
  isExclusive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface CreateBrandDTO {
  name: string;
  description?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  categories?: BrandCategory[];
  qualityStandards?: QualityStandard[];
  status?: BrandStatus;
  isActive?: boolean;
  isExclusive?: boolean;
  createdBy?: string;
}

export interface UpdateBrandDTO extends Partial<CreateBrandDTO> {
  lastModifiedBy?: string;
}

export interface BrandFilters {
  status?: BrandStatus;
  isActive?: boolean;
  isExclusive?: boolean;
  search?: string;
}