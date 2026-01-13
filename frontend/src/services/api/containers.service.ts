import { fetchAPI } from "@/lib/query-client";
import type {
  Bottle,
  ProductContainersResponse,
  ContainerDetailsResponse,
  ContainerSaleHistoryResponse,
  CreateContainerRequest,
  UpdateContainerRequest,
} from "@/types/container";

interface ContainerFilters {
  status?: 'full' | 'partial' | 'empty' | 'all';
  includeEmpty?: boolean;
}

class ContainersService {
  /**
   * Get all containers (bottles) for a product
   */
  async getProductContainers(
    productId: string,
    filters?: ContainerFilters
  ): Promise<ProductContainersResponse['data']> {
    const params = new URLSearchParams();

    if (filters?.status) {
      params.append('status', filters.status);
    }
    if (filters?.includeEmpty) {
      params.append('includeEmpty', 'true');
    }

    const queryString = params.toString();
    const endpoint = queryString
      ? `/inventory/products/${productId}/containers?${queryString}`
      : `/inventory/products/${productId}/containers`;

    try {
      const response = await fetchAPI<ProductContainersResponse>(endpoint);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch containers for product ${productId}:`, error);
      throw new Error(`Failed to fetch containers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get details for a specific container including sale history
   */
  async getContainerDetails(
    productId: string,
    containerId: string
  ): Promise<ContainerDetailsResponse['data']> {
    try {
      const response = await fetchAPI<ContainerDetailsResponse>(
        `/inventory/products/${productId}/containers/${containerId}`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch container ${containerId}:`, error);
      throw new Error(`Failed to fetch container details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sale history for a specific container
   */
  async getContainerSaleHistory(
    productId: string,
    containerId: string
  ): Promise<ContainerSaleHistoryResponse['data']> {
    try {
      const response = await fetchAPI<ContainerSaleHistoryResponse>(
        `/inventory/products/${productId}/containers/${containerId}/history`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch sale history for container ${containerId}:`, error);
      throw new Error(`Failed to fetch sale history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new container(s) for a product (e.g., when receiving stock)
   */
  async createContainer(
    productId: string,
    data: CreateContainerRequest
  ): Promise<{ containersAdded: number; newTotalFull: number; newCurrentStock: number }> {
    try {
      const response = await fetchAPI<{
        success: boolean;
        message: string;
        data: {
          productId: string;
          containersAdded: number;
          newTotalFull: number;
          trackedContainers: Array<{ id: string; batchNumber?: string; expiryDate?: Date }>;
          newCurrentStock: number;
        };
      }>(`/inventory/products/${productId}/containers`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return {
        containersAdded: response.data.containersAdded,
        newTotalFull: response.data.newTotalFull,
        newCurrentStock: response.data.newCurrentStock,
      };
    } catch (error) {
      console.error('Failed to create container:', error);
      throw new Error(`Failed to create container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update container information
   */
  async updateContainer(
    productId: string,
    containerId: string,
    data: UpdateContainerRequest
  ): Promise<Bottle> {
    try {
      const response = await fetchAPI<{
        success: boolean;
        message: string;
        data: Bottle;
      }>(`/inventory/products/${productId}/containers/${containerId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to update container ${containerId}:`, error);
      throw new Error(`Failed to update container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete/archive a container
   */
  async deleteContainer(
    productId: string,
    containerId: string
  ): Promise<void> {
    try {
      await fetchAPI<{ success: boolean; message: string }>(
        `/inventory/products/${productId}/containers/${containerId}`,
        {
          method: 'DELETE',
        }
      );
    } catch (error) {
      console.error(`Failed to delete container ${containerId}:`, error);
      throw new Error(`Failed to delete container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get only active (partial) bottles for transaction bottle selection
   */
  async getActiveBottles(productId: string): Promise<Bottle[]> {
    const data = await this.getProductContainers(productId, { status: 'partial' });
    return data.containers;
  }

  /**
   * Get bottles that are expiring soon (for FEFO - First Expiry First Out)
   */
  async getExpiringBottles(productId: string, daysThreshold: number = 30): Promise<Bottle[]> {
    const data = await this.getProductContainers(productId, { status: 'partial' });
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    return data.containers.filter(bottle => {
      if (!bottle.expiryDate) return false;
      return new Date(bottle.expiryDate) <= thresholdDate;
    }).sort((a, b) => {
      const aDate = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
      const bDate = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
      return aDate - bDate;
    });
  }
}

// Export singleton instance
export const containersService = new ContainersService();
export default containersService;
