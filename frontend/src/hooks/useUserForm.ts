import { useState, useCallback } from 'react';
import { UserFormData, DiscountPermissions, FeaturePermissions } from '@/types/user';

export interface ValidationErrors {
  [key: string]: string;
}

export interface UseUserFormState {
  formData: UserFormData;
  errors: ValidationErrors;
  isValid: boolean;
  isDirty: boolean;
}

export interface UseUserFormActions {
  updateField: <K extends keyof UserFormData>(field: K, value: UserFormData[K]) => void;
  updateDiscountPermissions: (permissions: Partial<DiscountPermissions>) => void;
  updateFeaturePermissions: (permissions: Partial<FeaturePermissions>) => void;
  validateForm: () => boolean;
  resetForm: (initialData?: Partial<UserFormData>) => void;
  setFormData: (data: Partial<UserFormData>) => void;
}

const getDefaultDiscountPermissions = (): DiscountPermissions => ({
  canApplyDiscounts: false,
  maxDiscountPercent: 0,
  maxDiscountAmount: 0,
  unlimitedDiscounts: false,
  canApplyProductDiscounts: false,
  canApplyBillDiscounts: false,
});

const getDefaultFormData = (): UserFormData => ({
  username: '',
  email: '',
  role: 'staff',
  firstName: '',
  lastName: '',
  displayName: '',
  discountPermissions: getDefaultDiscountPermissions(),
  featurePermissions: {},
  isActive: true,
  password: '',
});

export function useUserForm(initialData?: Partial<UserFormData>): UseUserFormState & UseUserFormActions {
  const [formData, setFormDataState] = useState<UserFormData>(() => ({
    ...getDefaultFormData(),
    ...initialData,
  }));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isDirty, setIsDirty] = useState(false);

  const updateField = useCallback(<K extends keyof UserFormData>(field: K, value: UserFormData[K]) => {
    setFormDataState(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const updateDiscountPermissions = useCallback((permissions: Partial<DiscountPermissions>) => {
    setFormDataState(prev => ({
      ...prev,
      discountPermissions: { ...prev.discountPermissions, ...permissions }
    }));
    setIsDirty(true);
  }, []);

  const updateFeaturePermissions = useCallback((permissions: Partial<FeaturePermissions>) => {
    setFormDataState(prev => ({
      ...prev,
      featurePermissions: { ...prev.featurePermissions, ...permissions }
    }));
    setIsDirty(true);
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    // Required fields
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    // Password validation (for new users)
    if (formData.password && !initialData) {
      if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }
    }

    // Discount permissions validation
    if (formData.discountPermissions.canApplyDiscounts && 
        !formData.discountPermissions.unlimitedDiscounts) {
      if (formData.discountPermissions.maxDiscountPercent <= 0) {
        newErrors.maxDiscountPercent = 'Max discount percentage must be greater than 0';
      }
      if (formData.discountPermissions.maxDiscountAmount <= 0) {
        newErrors.maxDiscountAmount = 'Max discount amount must be greater than 0';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, initialData]);

  const resetForm = useCallback((newInitialData?: Partial<UserFormData>) => {
    setFormDataState({
      ...getDefaultFormData(),
      ...newInitialData,
    });
    setErrors({});
    setIsDirty(false);
  }, []);

  const setFormData = useCallback((data: Partial<UserFormData>) => {
    setFormDataState(prev => ({ ...prev, ...data }));
    setIsDirty(true);
  }, []);

  const isValid = Object.keys(errors).length === 0;

  return {
    formData,
    errors,
    isValid,
    isDirty,
    updateField,
    updateDiscountPermissions,
    updateFeaturePermissions,
    validateForm,
    resetForm,
    setFormData,
  };
}