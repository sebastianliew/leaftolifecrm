'use client';

import { useEffect } from 'react';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle,
  History,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { QuickRestockWidget } from '../../../components/inventory/QuickRestockWidget';
import { ProductSearchRestock } from '../../../components/inventory/ProductSearchRestock';
import { RestockCart } from '../../../components/inventory/RestockCart';
import { 
  useRestockSuggestions, 
  useRestockCart,
  UseRestockCartItem 
} from '../../../hooks/useRestock';

export default function RestockDashboard() {
  const { 
    suggestions, 
    summary, 
    isLoading: suggestionsLoading, 
    error: suggestionsError,
    fetchSuggestions,
    refreshSuggestions 
  } = useRestockSuggestions();

  const { addItem: addToCart } = useRestockCart();

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleRestockComplete = () => {
    refreshSuggestions();
  };

  const handleAddToCart = (item: UseRestockCartItem) => {
    addToCart(item);
  };

  const getSummaryStats = () => {
    if (!summary) return [];
    
    return [
      {
        title: "Total Alerts",
        value: summary.total,
        icon: AlertTriangle,
        color: "text-orange-600"
      },
      {
        title: "Critical Items",
        value: summary.high,
        icon: Package,
        color: "text-red-600"
      },
      {
        title: "Medium Priority",
        value: summary.medium,
        icon: TrendingUp,
        color: "text-yellow-600"
      },
      {
        title: "Low Priority",
        value: summary.low,
        icon: BarChart3,
        color: "text-green-600"
      }
    ];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Restock</h1>
          <p className="text-muted-foreground">
            Manage product restocking with quick actions and bulk operations
          </p>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {getSummaryStats().map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="search">Search & Add</TabsTrigger>
          <TabsTrigger value="cart">Cart</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Restock Widget */}
            <QuickRestockWidget
              suggestions={suggestions}
              onRestockComplete={handleRestockComplete}
              className="h-fit"
            />

            {/* Search Component */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Quick Product Search
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProductSearchRestock
                  onAddToCart={handleAddToCart}
                  onQuickRestock={handleRestockComplete}
                  placeholder="Search products to restock..."
                />
              </CardContent>
            </Card>
          </div>

          {/* Additional Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              {suggestionsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading suggestions...</p>
                </div>
              ) : suggestionsError ? (
                <div className="text-center py-8 text-red-600">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                  <p>Failed to load suggestions: {suggestionsError}</p>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-8 h-8 mx-auto text-green-500 mb-2" />
                  <p className="text-muted-foreground">All products are well stocked!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {suggestions.slice(0, 6).map((suggestion) => (
                    <div key={suggestion.product._id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{suggestion.product.name}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          suggestion.priority === 'high' ? 'bg-red-100 text-red-800' :
                          suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {suggestion.priority}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Stock: {suggestion.currentStock} / Reorder: {suggestion.reorderPoint}
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAddToCart({
                            id: `quick-${suggestion.product._id}`,
                            productId: suggestion.product._id,
                            productName: suggestion.product.name,
                            quantity: suggestion.suggestedQuantity,
                            currentStock: suggestion.currentStock,
                            estimatedCost: 0
                          })}
                          className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Product Search & Restock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProductSearchRestock
                onAddToCart={handleAddToCart}
                onQuickRestock={handleRestockComplete}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cart" className="space-y-6">
          <RestockCart onProcessComplete={handleRestockComplete} />
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