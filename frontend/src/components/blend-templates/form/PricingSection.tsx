"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FaDollarSign } from 'react-icons/fa';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatPercentage, calculateProfit, calculateProfitMargin } from '@/utils/blend-calculations';

interface PricingSectionProps {
  sellingPrice: number;
  totalCost: number;
  onChange: (price: number) => void;
}

export function PricingSection({ sellingPrice, totalCost, onChange }: PricingSectionProps) {
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';
  const profit = calculateProfit(sellingPrice, totalCost);
  const profitMargin = calculateProfitMargin(profit, sellingPrice);
  const isProfitable = profit > 0;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <FaDollarSign className="h-4 w-4 text-green-600" />
          <CardTitle className="text-lg">Pricing & Profit</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`grid grid-cols-1 ${isStaff ? 'md:grid-cols-1' : 'md:grid-cols-4'} gap-6`}>
          <div>
            <Label htmlFor="sellingPrice" className="text-sm font-medium">Selling Price</Label>
            <Input
              id="sellingPrice"
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Price to charge customers
            </p>
          </div>
          
          {!isStaff && (
            <>
              <div>
                <Label className="text-sm font-medium">Total Cost</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded-md">
                  <span className="text-sm font-medium">
                    {formatCurrency(totalCost)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Cost of ingredients
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Profit</Label>
                <div 
                  className={`mt-1 p-2 rounded-md ${isProfitable ? 'bg-green-50' : 'bg-red-50'}`}
                  aria-label={`Profit: ${isProfitable ? 'positive' : 'negative'} ${Math.abs(profit)} dollars`}
                >
                  <span className={`text-sm font-medium ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(profit)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selling price - Cost
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Profit Margin</Label>
                <div 
                  className={`mt-1 p-2 rounded-md ${isProfitable ? 'bg-green-50' : 'bg-red-50'}`}
                  aria-label={`Profit margin: ${formatPercentage(profitMargin)}`}
                >
                  <span className={`text-sm font-medium ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(profitMargin)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Profit percentage
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}