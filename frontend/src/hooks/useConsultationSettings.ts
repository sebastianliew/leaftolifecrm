import { useState, useCallback } from 'react';

interface ConsultationSettings {
  id: string;
  currency: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastUpdatedBy?: string;
}

interface DiscountPreset {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export const useConsultationSettings = () => {
  const [settings, setSettings] = useState<ConsultationSettings | null>(null);
  const [discountPresets, setDiscountPresets] = useState<DiscountPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch consultation settings
  const getSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/consultation/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch consultation settings');
      }
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  // Update consultation settings
  const updateSettings = useCallback(async (data: Partial<ConsultationSettings>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/consultation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update consultation settings');
      }
      
      const updatedSettings = await response.json();
      setSettings(updatedSettings);
      return updatedSettings;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch discount presets
  const getDiscountPresets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/consultation/discount-presets');
      if (!response.ok) {
        throw new Error('Failed to fetch discount presets');
      }
      const data = await response.json();
      setDiscountPresets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create discount preset
  const createDiscountPreset = useCallback(async (data: Partial<DiscountPreset>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/consultation/discount-presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create discount preset');
      }
      
      const newPreset = await response.json();
      setDiscountPresets(prev => [...prev, newPreset]);
      return newPreset;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update discount preset
  const updateDiscountPreset = useCallback(async (id: string, data: Partial<DiscountPreset>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/consultation/discount-presets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update discount preset');
      }
      
      const updatedPreset = await response.json();
      setDiscountPresets(prev => 
        prev.map(preset => preset.id === id ? updatedPreset : preset)
      );
      return updatedPreset;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete discount preset
  const deleteDiscountPreset = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/consultation/discount-presets/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete discount preset');
      }
      
      setDiscountPresets(prev => prev.filter(preset => preset.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    settings,
    discountPresets,
    loading,
    error,
    getSettings,
    updateSettings,
    getDiscountPresets,
    createDiscountPreset,
    updateDiscountPreset,
    deleteDiscountPreset,
  };
};