"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FaPlus, FaClipboardList, FaExclamationTriangle } from 'react-icons/fa';
import { IngredientRow } from './IngredientRow';
import { useAuth } from '@/hooks/useAuth';
import type { BlendIngredient } from '@/types/blend';

interface IngredientsSectionProps {
  ingredients: BlendIngredient[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: keyof BlendIngredient, value: string | number | boolean | undefined) => void;
  errors: Record<string, string>;
}

export function IngredientsSection({ 
  ingredients, 
  onAdd, 
  onRemove, 
  onUpdate, 
  errors 
}: IngredientsSectionProps) {
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';
  
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaClipboardList className="h-4 w-4 text-green-600" />
            <CardTitle className="text-lg">Recipe Ingredients</CardTitle>
          </div>
          <Button 
            type="button" 
            size="sm" 
            className="bg-green-600 hover:bg-green-700"
            onClick={onAdd}
          >
            <FaPlus className="mr-2 h-4 w-4" />
            Add Ingredient
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {errors.ingredients && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <FaExclamationTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{errors.ingredients}</AlertDescription>
          </Alert>
        )}

        {ingredients.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Ingredient</TableHead>
                  <TableHead className="font-semibold">Volume</TableHead>
                  <TableHead className="font-semibold">Unit</TableHead>
                  {!isStaff && <TableHead className="font-semibold">Price</TableHead>}
                  <TableHead className="font-semibold">Stock</TableHead>
                  <TableHead className="font-semibold w-20">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ingredient, index) => (
                  <IngredientRow
                    key={index}
                    ingredient={ingredient}
                    onUpdate={(field, value) => onUpdate(index, field, value)}
                    onRemove={() => onRemove(index)}
                    isStaff={isStaff}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
            <FaClipboardList className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No ingredients added yet</h3>
            <p className="text-gray-500 mb-4">Start building your blend recipe by adding ingredients</p>
            <Button 
              type="button" 
              className="bg-green-600 hover:bg-green-700"
              onClick={onAdd}
            >
              <FaPlus className="mr-2 h-4 w-4" />
              Add Your First Ingredient
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}