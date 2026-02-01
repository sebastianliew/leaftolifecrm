"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HiUsers, HiChartBar, HiMagnifyingGlass, HiCube, HiBuildingOffice, HiTag, HiReceiptRefund, HiCurrencyDollar } from "react-icons/hi2"
import { Shield } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"

// Define DashboardStats interface
interface DashboardStats {
  totalProducts?: number;
  productGrowth?: number;
  activePatients?: number;
  patientGrowth?: number;
  lowStockAlerts?: number;
  expiredProducts?: number;
  expiringSoonProducts?: number;
  totalValue?: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRootSession, setIsRootSession] = useState(false);
  const [rootUserInfo, setRootUserInfo] = useState<{username: string, role: string} | null>(null);
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    // Check for root session
    const rootInfo = sessionStorage.getItem('rootUserInfo');
    const rootSessionCookie = document.cookie.includes('rootSession=true');
    
    if (rootInfo || rootSessionCookie) {
      setIsRootSession(true);
      if (rootInfo) {
        try {
          setRootUserInfo(JSON.parse(rootInfo));
        } catch {
          // console.error('Failed to parse root user info');
        }
      }
    }
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use Next.js API route instead of external backend
        const response = await fetch('/api/dashboard/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch {
        // console.error('Failed to fetch dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);
  
  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  
  // If not authenticated, show message
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Authentication Required</h2>
            <p className="mb-4">Please log in to access the dashboard.</p>
            <Button asChild>
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inventory Management System</h1>
              <div className="flex items-center gap-4">
                <p className="text-gray-600">Comprehensive inventory and patient management</p>
                {isRootSession && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    <span>Root Session</span>
                    {rootUserInfo && (
                      <span className="ml-1">({rootUserInfo.username})</span>
                    )}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" asChild>
                <Link href="/patients">
                  <HiUsers className="w-4 h-4 mr-2" />
                  New Patient
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-8">
        {/* Quick Stats */}
        {user?.role !== 'staff' && (
          <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="cursor-pointer transition-all hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="text-24px font-bold mb-2">
                  {loading ? "..." : stats?.totalProducts?.toLocaleString('en-GB') || "0"}
                </div>
                <div className="flex flex-col">
                  <h3 className="text-sm font-medium">Total Products</h3>
                  <p className="text-xs text-muted-foreground">
                    {loading ? "Loading..." : 
                      stats?.productGrowth !== undefined ? 
                        `${stats.productGrowth >= 0 ? '+' : ''}${stats.productGrowth}% from last month` : 
                        "No growth data"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-all hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="text-24px font-bold mb-2">
                  {loading ? "..." : stats?.activePatients?.toLocaleString('en-GB') || "0"}
                </div>
                <div className="flex flex-col">
                  <h3 className="text-sm font-medium">Active Patients</h3>
                  <p className="text-xs text-muted-foreground">
                    {loading ? "Loading..." : 
                      stats?.patientGrowth !== undefined ? 
                        `${stats.patientGrowth >= 0 ? '+' : ''}${stats.patientGrowth}% from last month` : 
                        "No growth data"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer transition-all hover:shadow-md ${
            (stats?.lowStockAlerts && stats.lowStockAlerts > 0) || 
            (stats?.expiredProducts && stats.expiredProducts > 0) || 
            (stats?.expiringSoonProducts && stats.expiringSoonProducts > 0) 
              ? "bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 border-red-200" 
              : ""
          }`}>
            <CardContent className="p-6">
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Stock Alerts</h3>
                  <div className="text-xs text-muted-foreground">
                    {loading ? "Loading..." : 
                      ((stats?.lowStockAlerts || 0) + (stats?.expiredProducts || 0) + (stats?.expiringSoonProducts || 0)) > 0 
                        ? "Requires attention" 
                        : "All good"}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Expired</span>
                    <span className={`text-sm font-bold ${stats?.expiredProducts && stats.expiredProducts > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {loading ? "..." : stats?.expiredProducts || "0"}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Expiring Soon</span>
                    <span className={`text-sm font-bold ${stats?.expiringSoonProducts && stats.expiringSoonProducts > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                      {loading ? "..." : stats?.expiringSoonProducts || "0"}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Low Stock</span>
                    <span className={`text-sm font-bold ${stats?.lowStockAlerts && stats.lowStockAlerts > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>
                      {loading ? "..." : stats?.lowStockAlerts || "0"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {user?.role !== 'staff' && (
            <Card className="cursor-pointer transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="text-24px font-bold text-medsy-green break-words leading-tight mb-2">
                    {loading ? "..." : `$${stats?.totalValue?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || "0.00"}`}
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-sm font-medium">Total Value</h3>
                    <p className="text-xs text-muted-foreground">Current inventory value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {/* Inventory Management Cards */}
          <Link href="/inventory" className="flex flex-col items-center text-center space-y-3 p-4 rounded-lg cursor-pointer transition-all hover:scale-105">
            <div className="p-4 bg-blue-100 rounded-full">
              <HiCube className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-xs">View Products</h3>
              <p className="text-xs text-muted-foreground">Browse inventory</p>
            </div>
          </Link>

          <Link href="/inventory" className="flex flex-col items-center text-center space-y-3 p-4 rounded-lg cursor-pointer transition-all hover:scale-105">
            <div className="p-4 bg-green-100 rounded-full">
              <HiCube className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-xs">Add Product</h3>
              <p className="text-xs text-muted-foreground">New inventory item</p>
            </div>
          </Link>

          <Link href="/inventory" className="flex flex-col items-center text-center space-y-3 p-4 rounded-lg cursor-pointer transition-all hover:scale-105">
            <div className="p-4 bg-purple-100 rounded-full">
              <HiMagnifyingGlass className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-xs">Search Inventory</h3>
              <p className="text-xs text-muted-foreground">Find products</p>
            </div>
          </Link>

          {user?.role === 'super_admin' && (
            <Link href="/reports" className="flex flex-col items-center text-center space-y-3 p-4 rounded-lg cursor-pointer transition-all hover:scale-105">
              <div className="p-4 bg-orange-100 rounded-full">
                <HiChartBar className="w-8 h-8 text-orange-600" />
              </div>
              <div>
                <h3 className="font-medium text-xs">Inventory Reports</h3>
                <p className="text-xs text-muted-foreground">Analytics & insights</p>
              </div>
            </Link>
          )}

          {/* Suppliers & Brands Cards */}
          <Link href="/suppliers" className="flex flex-col items-center text-center space-y-3 p-4 rounded-lg cursor-pointer transition-all hover:scale-105">
            <div className="p-4 bg-indigo-100 rounded-full">
              <HiBuildingOffice className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-medium text-xs">View Suppliers</h3>
              <p className="text-xs text-muted-foreground">Manage suppliers</p>
            </div>
          </Link>

          <Link href="/brands" className="flex flex-col items-center text-center space-y-3 p-4 rounded-lg cursor-pointer transition-all hover:scale-105">
            <div className="p-4 bg-pink-100 rounded-full">
              <HiTag className="w-8 h-8 text-pink-600" />
            </div>
            <div>
              <h3 className="font-medium text-xs">View Brands</h3>
              <p className="text-xs text-muted-foreground">Product brands</p>
            </div>
          </Link>

          {/* Transaction Cards */}
          <Link href="/transactions" className="flex flex-col items-center text-center space-y-3 p-4 rounded-lg cursor-pointer transition-all hover:scale-105">
            <div className="p-4 bg-teal-100 rounded-full">
              <HiReceiptRefund className="w-8 h-8 text-teal-600" />
            </div>
            <div>
              <h3 className="font-medium text-xs">View Transactions</h3>
              <p className="text-xs text-muted-foreground">Transaction history</p>
            </div>
          </Link>

          <Link href="/transactions" className="flex flex-col items-center text-center space-y-3 p-4 rounded-lg cursor-pointer transition-all hover:scale-105">
            <div className="p-4 bg-cyan-100 rounded-full">
              <HiReceiptRefund className="w-8 h-8 text-cyan-600" />
            </div>
            <div>
              <h3 className="font-medium text-xs">New Transaction</h3>
              <p className="text-xs text-muted-foreground">Create transaction</p>
            </div>
          </Link>

          {/* Consultation Cards */}
          <Link href="/patients" className="flex flex-col items-center text-center space-y-3 p-4 rounded-lg cursor-pointer transition-all hover:scale-105">
            <div className="p-4 bg-green-100 rounded-full">
              <HiCurrencyDollar className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-xs">New Consultation</h3>
              <p className="text-xs text-muted-foreground">Start consultation</p>
            </div>
          </Link>

          <Link href="/settings/consultation" className="flex flex-col items-center text-center space-y-3 p-4 rounded-lg cursor-pointer transition-all hover:scale-105">
            <div className="p-4 bg-gray-100 rounded-full">
              <HiCurrencyDollar className="w-8 h-8 text-gray-600" />
            </div>
            <div>
              <h3 className="font-medium text-xs">Manage Settings</h3>
              <p className="text-xs text-muted-foreground">Consultation config</p>
            </div>
          </Link>

          {/* Appointment Cards */}
          <Link href="/dashboard/appointments" className="flex flex-col items-center text-center space-y-3 p-4 rounded-lg cursor-pointer transition-all hover:scale-105">
            <div className="p-4 bg-blue-100 rounded-full">
              <HiUsers className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-xs">View Appointments</h3>
              <p className="text-xs text-muted-foreground">Appointment list</p>
            </div>
          </Link>

          <Link href="/appointments" className="flex flex-col items-center text-center space-y-3 p-4 rounded-lg cursor-pointer transition-all hover:scale-105">
            <div className="p-4 bg-emerald-100 rounded-full">
              <HiUsers className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-medium text-xs">Schedule New</h3>
              <p className="text-xs text-muted-foreground">Book appointment</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}