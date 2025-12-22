// Backend exports for Brands
export { Brand, type IBrand } from './models/Brand.js';
export { BrandService } from './services/brands/BrandService.js';
export type {
  BrandDTO,
  CreateBrandDTO,
  UpdateBrandDTO,
  BrandFilters,
  BrandCategory,
  QualityStandard,
  BrandStatus
} from './types/brands/brand.types.js';

// Backend exports for Patients
export { Patient } from './models/Patient.js';
export { PatientsController } from './controllers/patients.controller.js';
export type {
  Patient as IPatient,
  PatientFormData,
  PatientAllergy,
  PatientPreference,
  PatientNotification
} from './types/patient.js';

// Controllers exports  
export { 
  getBrands, 
  getBrandById, 
  createBrand, 
  updateBrand, 
  deleteBrand 
} from './controllers/brands.controller.js';