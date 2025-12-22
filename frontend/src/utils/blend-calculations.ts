import type { BlendIngredient } from '@/types/blend';

export const calculateIngredientCost = (quantity: number, costPerUnit: number): number => {
  return quantity * costPerUnit;
};

export const calculateTotalCost = (ingredients: BlendIngredient[]): number => {
  return ingredients.reduce((total, ing) => {
    return total + calculateIngredientCost(ing.quantity, ing.costPerUnit || 0);
  }, 0);
};

export const calculateProfit = (sellingPrice: number, totalCost: number): number => {
  return sellingPrice - totalCost;
};

export const calculateProfitMargin = (profit: number, sellingPrice: number): number => {
  return sellingPrice > 0 ? (profit / sellingPrice * 100) : 0;
};

export const formatCurrency = (amount: number): string => {
  return `S$${amount.toFixed(2)}`;
};

export const formatPercentage = (percentage: number): string => {
  return `${percentage.toFixed(1)}%`;
};