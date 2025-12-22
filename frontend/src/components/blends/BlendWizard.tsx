'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import QuickBlendCreator from './QuickBlendCreator';

interface BlendWizardProps {
  products: Array<{
    _id: string;
    name: string;
    unitName: string;
    currentStock: number;
    [key: string]: unknown;
  }>;
  onComplete: (blend: {
    blendName: string;
    targetSize: number;
    targetUnit: string;
    ingredients: Array<unknown>;
    [key: string]: unknown;
  }) => Promise<void>;
  onCancel: () => void;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  component?: React.ComponentType<{
    products: BlendWizardProps['products'];
    onSave: (blend: Parameters<BlendWizardProps['onComplete']>[0]) => Promise<void>;
  }>;
  tips?: string[];
}

export default function BlendWizard({ products, onComplete, onCancel }: BlendWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [blendData, setBlendData] = useState<Parameters<BlendWizardProps['onComplete']>[0]>({} as Parameters<BlendWizardProps['onComplete']>[0]);
  const [showTips, setShowTips] = useState(true);

  const steps: WizardStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Blend Creation',
      description: 'Learn how to create custom blends efficiently',
      tips: [
        'Blends allow you to combine multiple products in specific quantities',
        'You can use different units (ml, drops, g) and the system will handle conversions',
        'Each blend tracks cost and suggests pricing automatically',
        'Saved blends can be reused for future orders'
      ]
    },
    {
      id: 'planning',
      title: 'Plan Your Blend',
      description: 'Understand what makes a good blend',
      tips: [
        'Start with a target size (e.g., 100ml, 50g)',
        'Choose compatible ingredients that work well together',
        'Consider the final use - topical, oral, aromatic, etc.',
        'Check that you have sufficient stock of all ingredients'
      ]
    },
    {
      id: 'create',
      title: 'Create Your Blend',
      description: 'Add ingredients and set quantities'
    },
    {
      id: 'review',
      title: 'Review and Save',
      description: 'Final check before creating your blend'
    }
  ];

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleBlendSave = async (blend: Parameters<BlendWizardProps['onComplete']>[0]) => {
    setBlendData(blend);
    if (currentStep === 2) { // Create step
      nextStep(); // Go to review
    }
  };

  const handleComplete = async () => {
    try {
      await onComplete(blendData);
    } catch {
      // console.error('Failed to complete blend creation:', error);
    }
  };

  const WelcomeStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold">Let&apos;s Create Your First Blend!</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          This wizard will guide you through creating custom blends step by step. 
          Perfect for newcomers or anyone who wants a structured approach.
        </p>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          What you&apos;ll learn:
        </h3>
        <ul className="space-y-2 text-sm">
          {currentStepData.tips?.map((tip, index) => (
            <li key={index} className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div className="p-4 border rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{products.length}</div>
          <div className="text-sm text-gray-600">Available Products</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-2xl font-bold text-green-600">∞</div>
          <div className="text-sm text-gray-600">Possible Combinations</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-2xl font-bold text-purple-600">100%</div>
          <div className="text-sm text-gray-600">Accuracy Guaranteed</div>
        </div>
      </div>
    </div>
  );

  const PlanningStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Lightbulb className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold">Planning Your Blend</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          Good planning leads to better blends. Here are some key considerations 
          before you start adding ingredients.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Blend Size Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="font-medium">Small batch</span>
              <Badge variant="outline">10-50ml</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="font-medium">Medium batch</span>
              <Badge variant="outline">50-200ml</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="font-medium">Large batch</span>
              <Badge variant="outline">200ml+</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Common Unit Conversions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span>20 drops</span>
              <span className="text-gray-500">≈ 1ml</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span>1 tsp</span>
              <span className="text-gray-500">≈ 5ml</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span>1 tbsp</span>
              <span className="text-gray-500">≈ 15ml</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {showTips && (
        <Alert>
          <Lightbulb className="w-4 h-4" />
          <AlertDescription>
            <strong>Pro Tips:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              {currentStepData.tips?.map((tip, index) => (
                <li key={index}>• {tip}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-yellow-800">Before You Start</h4>
            <p className="text-yellow-700 text-sm mt-1">
              Make sure you have sufficient stock of all ingredients. The system will 
              warn you if stock is low, but it&apos;s good to plan ahead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const ReviewStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold">Review Your Blend</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          Take a final look at your blend before saving. You can always edit it later.
        </p>
      </div>

      {blendData && (
        <Card>
          <CardHeader>
            <CardTitle>{blendData.blendName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">Target Size</div>
                <div className="font-medium">{blendData.targetSize} {blendData.targetUnit}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Ingredients</div>
                <div className="font-medium">{blendData.ingredients?.length || 0}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Cost</div>
                <div className="font-medium">${typeof blendData.totalCost === 'number' ? blendData.totalCost.toFixed(2) : '0.00'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Suggested Price</div>
                <div className="font-medium">${typeof blendData.suggestedPrice === 'number' ? blendData.suggestedPrice.toFixed(2) : '0.00'}</div>
              </div>
            </div>

            {blendData.ingredients && (
              <div>
                <h4 className="font-semibold mb-2">Ingredients:</h4>
                <div className="space-y-2">
                  {blendData.ingredients?.map((ing: unknown, index: number) => {
                    const ingredient = ing as { name: string; quantity: number; unitName: string };
                    return (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span>{ingredient.name}</span>
                        <Badge variant="outline">{ingredient.quantity} {ingredient.unitName}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(() => {
              const notes = blendData.notes as string;
              return notes && (
                <div>
                  <h4 className="font-semibold mb-2">Notes:</h4>
                  <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded">{notes}</p>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <Alert>
        <CheckCircle className="w-4 h-4" />
        <AlertDescription>
          <strong>Ready to save!</strong> Your blend will be saved and can be reused for future orders. 
          You can always edit the formula later if needed.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStepData.id) {
      case 'welcome':
        return <WelcomeStep />;
      case 'planning':
        return <PlanningStep />;
      case 'create':
        return (
          <QuickBlendCreator
            products={products as Array<{
              _id: string;
              name: string;
              unitName: string;
              currentStock: number;
              totalQuantity: number;
              sellingPrice: number;
              costPrice: number;
              containerCapacity?: number;
              containerType?: string;
              discountFlags?: {
                discountableInBlends: boolean;
              };
            }>}
            onSave={handleBlendSave}
            onCancel={onCancel}
            initialData={blendData as {
              blendName?: string;
              targetSize?: number;
              targetUnit?: string;
              ingredients?: Array<{
                productId: string;
                product: {
                  _id: string;
                  name: string;
                  unitName: string;
                  currentStock: number;
                  totalQuantity: number;
                  sellingPrice: number;
                  costPrice: number;
                };
                quantity: number;
                unit: string;
                costPerUnit: number;
                notes?: string;
              }>;
              notes?: string;
            }}
          />
        );
      case 'review':
        return <ReviewStep />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Blend Creation Wizard</h1>
          <Button variant="outline" onClick={() => setShowTips(!showTips)}>
            <Lightbulb className="w-4 h-4 mr-2" />
            {showTips ? 'Hide Tips' : 'Show Tips'}
          </Button>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Step {currentStep + 1} of {steps.length}: {currentStepData.title}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        <p className="text-gray-600 mt-2">{currentStepData.description}</p>
      </div>

      {/* Step Content */}
      <div className="mb-8">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      {currentStepData.id !== 'create' && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            
            {currentStep === steps.length - 1 ? (
              <Button onClick={handleComplete} disabled={!blendData.blendName}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete & Save
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={currentStep === 2 && !blendData.blendName} // Can't proceed from create without blend data
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}