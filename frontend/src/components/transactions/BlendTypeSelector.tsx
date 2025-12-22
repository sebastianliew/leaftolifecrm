"use client"

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FaFlask, FaWrench, FaBook, FaArrowRight, FaTimes } from 'react-icons/fa';

interface BlendTypeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectFixedBlend: () => void;
  onSelectCustomBlend: () => void;
}

export function BlendTypeSelector({
  open,
  onClose,
  onSelectFixedBlend,
  onSelectCustomBlend
}: BlendTypeSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FaFlask className="h-5 w-5" />
            Choose Blend Type
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <p className="text-gray-600">
            Select how you want to create your blend for this transaction:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fixed Blend Template Option */}
            <Card className="cursor-pointer hover:border-blue-500 transition-colors group">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FaBook className="h-5 w-5 text-blue-500" />
                  Fixed Blend Template
                </CardTitle>
                <CardDescription>
                  Use a pre-defined blend recipe
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Perfect for:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Standardized formulations</li>
                    <li>• Consistent dosing</li>
                    <li>• Frequently used blends</li>
                    <li>• Pre-calculated pricing</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Features:</h4>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-xs">Pre-validated</Badge>
                    <Badge variant="secondary" className="text-xs">Standard pricing</Badge>
                    <Badge variant="secondary" className="text-xs">Quick selection</Badge>
                    <Badge variant="secondary" className="text-xs">Usage tracking</Badge>
                  </div>
                </div>

                <Button 
                  onClick={onSelectFixedBlend}
                  className="w-full group-hover:bg-blue-600"
                >
                  <FaBook className="mr-2 h-4 w-4" />
                  Browse Templates
                  <FaArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Custom Blend Option */}
            <Card className="cursor-pointer hover:border-green-500 transition-colors group">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FaWrench className="h-5 w-5 text-green-500" />
                  Custom Blend
                </CardTitle>
                <CardDescription>
                  Create a blend on-the-fly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Perfect for:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Patient-specific formulations</li>
                    <li>• One-time mixes</li>
                    <li>• Experimental blends</li>
                    <li>• Flexible dosing</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Features:</h4>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-xs">Real-time validation</Badge>
                    <Badge variant="secondary" className="text-xs">Custom pricing</Badge>
                    <Badge variant="secondary" className="text-xs">Flexible ingredients</Badge>
                    <Badge variant="secondary" className="text-xs">Mix notes</Badge>
                  </div>
                </div>

                <Button 
                  onClick={onSelectCustomBlend}
                  className="w-full bg-green-600 hover:bg-green-700 group-hover:bg-green-700"
                >
                  <FaWrench className="mr-2 h-4 w-4" />
                  Create Custom Blend
                  <FaArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">💡 Tip</h4>
            <p className="text-sm text-blue-800">
              Fixed blend templates are recommended for consistent, repeatable formulations. 
              Custom blends are perfect for unique patient needs or experimental mixing.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              <FaTimes className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 