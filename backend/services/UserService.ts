import { 
  User, 
  CreateUserData, 
  UpdateUserData, 
  UserFilters,
  UserStats 
} from '@/types/user';

interface ApiResponse<T> {
  data?: T;
  success?: boolean;
  message?: string;
}

export class UserApiService {
  private static baseUrl = '/api/users';

  static async getUsers(filters?: UserFilters): Promise<User[]> {
    const params = new URLSearchParams();
    
    if (filters?.role && filters.role !== 'all') {
      params.append('role', filters.role);
    }
    
    if (filters?.status && filters.status !== 'all') {
      params.append('status', filters.status);
    }
    
    if (filters?.searchTerm) {
      params.append('search', filters.searchTerm);
    }

    const url = params.toString() ? `${this.baseUrl}?${params}` : this.baseUrl;
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include', // Important for NextAuth cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    
    const result = await response.json() as ApiResponse<User[]> | User[];
    return (result as ApiResponse<User[]>)?.data || result as User[] || [];
  }

  static async getUserById(id: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }
    
    const result = await response.json() as ApiResponse<User> | User;
    return (result as ApiResponse<User>)?.data || result as User;
  }

  static async createUser(userData: CreateUserData): Promise<User> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create user');
    }
    
    const result = await response.json() as ApiResponse<User> | User;
    return (result as ApiResponse<User>)?.data || result as User;
  }

  static async updateUser(id: string, userData: UpdateUserData): Promise<User> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update user');
    }
    
    const result = await response.json() as ApiResponse<User> | User;
    return (result as ApiResponse<User>)?.data || result as User;
  }

  static async deleteUser(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete user');
    }
  }

  static async updateUserPassword(id: string, password: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}/password`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update password');
    }
  }

  static async toggleUserStatus(id: string, isActive: boolean): Promise<User> {
    return this.updateUser(id, { isActive });
  }
}

export class UserUtilsService {
  static calculateUserStats(users: User[]): UserStats {
    if (!users || !Array.isArray(users)) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        adminUsers: 0,
        staffUsers: 0,
      };
    }
    
    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.isActive).length,
      adminUsers: users.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
      staffUsers: users.filter(u => u.role === 'staff' || u.role === 'manager').length,
    };
  }

  static formatUserDisplayName(user: User): string {
    if (!user) return 'Unknown User';
    
    return user.displayName || 
           `${user.firstName || ''} ${user.lastName || ''}`.trim() || 
           user.username || 
           user.email || 
           'Unknown User';
  }

  static hasDiscountPermissions(user: User): boolean {
    return user.featurePermissions?.discounts?.canApplyProductDiscounts || 
           user.featurePermissions?.discounts?.canApplyBillDiscounts ||
           user.discountPermissions?.canApplyDiscounts || false;
  }

  static getMaxDiscountInfo(user: User): { unlimited: boolean; maxPercent: number; maxAmount: number } {
    const unlimited = user.featurePermissions?.discounts?.unlimitedDiscounts || 
                     user.discountPermissions?.unlimitedDiscounts || false;
    const maxPercent = user.featurePermissions?.discounts?.maxDiscountPercent || 
                      user.discountPermissions?.maxDiscountPercent || 0;
    const maxAmount = user.featurePermissions?.discounts?.maxDiscountAmount || 
                     user.discountPermissions?.maxDiscountAmount || 0;

    return {
      unlimited,
      maxPercent,
      maxAmount,
    };
  }

  static getRoleColor(role: string): string {
    switch (role) {
      case "super_admin":
        return "bg-purple-100 text-purple-800";
      case "admin":
        return "bg-blue-100 text-blue-800";
      case "manager":
        return "bg-green-100 text-green-800";
      case "staff":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  static getStatusColor(isActive: boolean): string {
    return isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  }

  static sortUsers(users: User[], sortBy: string, sortOrder: 'asc' | 'desc'): User[] {
    if (!users || !Array.isArray(users)) {
      return [];
    }
    return [...users].sort((a, b) => {
      let aValue: unknown;
      let bValue: unknown;
      
      switch (sortBy) {
        case "username":
          aValue = (this.formatUserDisplayName(a) || '').toLowerCase();
          bValue = (this.formatUserDisplayName(b) || '').toLowerCase();
          break;
        case "email":
          aValue = (a.email || '').toLowerCase();
          bValue = (b.email || '').toLowerCase();
          break;
        case "role":
          aValue = a.role;
          bValue = b.role;
          break;
        case "status":
          aValue = a.isActive;
          bValue = b.isActive;
          break;
        case "lastLogin":
          aValue = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
          bValue = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
          break;
        default:
          return 0;
      }
      
      if ((aValue as string) < (bValue as string)) return sortOrder === "asc" ? -1 : 1;
      if ((aValue as string) > (bValue as string)) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }

  static filterUsers(users: User[], filters: UserFilters): User[] {
    if (!users || !Array.isArray(users)) {
      return [];
    }
    return users.filter((user) => {
      const matchesSearch = !filters.searchTerm || 
        (user.username && user.username.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        (user.email && user.email.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        (user.firstName && user.firstName.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        (user.lastName && user.lastName.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        (user.displayName && user.displayName.toLowerCase().includes(filters.searchTerm.toLowerCase()));
      
      const matchesRole = !filters.role || filters.role === "all" || user.role === filters.role;
      const matchesStatus = !filters.status || filters.status === "all" || 
        (filters.status === "active" && user.isActive) ||
        (filters.status === "inactive" && !user.isActive);
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }
}