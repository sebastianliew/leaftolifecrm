'use client';

import { History, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { RestockCart } from '../../../components/inventory/RestockCart';

export default function RestockDashboard() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Restock</h1>
          <p className="text-muted-foreground">
            Build a restock cart and process products in bulk.
          </p>
        </div>
      </div>

      <Tabs defaultValue="cart" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cart">Cart</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="cart" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Restock Cart
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RestockCart onProcessComplete={() => { /* no-op */ }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Restock History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <History className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Restock history coming soon...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  View past restock operations, batch processing results, and audit trails.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
