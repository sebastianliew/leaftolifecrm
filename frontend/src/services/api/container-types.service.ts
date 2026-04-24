import { fetchAPI } from "@/lib/query-client";
import type {
  ContainerType,
  CreateContainerTypeRequest,
  UpdateContainerTypeRequest,
  ContainerTypesResponse,
  ContainerTypeFilters,
} from "@/types/inventory/container-type.types";

class ContainerTypesService {
  private readonly baseEndpoint = "/inventory/container-types";

  async getContainerTypes(filters?: ContainerTypeFilters): Promise<ContainerType[]> {
    const params = new URLSearchParams();
    params.append('limit', '5000');

    if (filters?.search) {
      params.append('search', filters.search);
    }
    if (filters?.isActive !== undefined) {
      params.append('isActive', filters.isActive.toString());
    }

    const queryString = params.toString();
    const endpoint = queryString ? `${this.baseEndpoint}?${queryString}` : this.baseEndpoint;

    try {
      const response = await fetchAPI<ContainerType[] | ContainerTypesResponse>(endpoint);

      const containerTypes = Array.isArray(response)
        ? response
        : response.containerTypes || [];

      return containerTypes.map(ct => ({
        ...ct,
        id: ct._id || ct.id
      }));
    } catch (error) {
      console.error('Failed to fetch container types:', error);
      throw new Error('Failed to fetch container types');
    }
  }

  async getContainerTypeById(id: string): Promise<ContainerType> {
    return await fetchAPI<ContainerType>(`${this.baseEndpoint}/${id}`);
  }

  async createContainerType(data: CreateContainerTypeRequest): Promise<ContainerType> {
    return await fetchAPI<ContainerType>(this.baseEndpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContainerType({ id, ...data }: UpdateContainerTypeRequest): Promise<ContainerType> {
    return await fetchAPI<ContainerType>(`${this.baseEndpoint}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteContainerType(id: string): Promise<void> {
    await fetchAPI<{ message: string }>(`${this.baseEndpoint}/${id}`, {
      method: 'DELETE',
    });
  }
}

export const containerTypesService = new ContainerTypesService();
export default containerTypesService;
