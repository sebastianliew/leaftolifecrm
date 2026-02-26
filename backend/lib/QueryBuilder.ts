/**
 * QueryBuilder — Eliminates duplicate query building across controllers.
 *
 * Usage:
 *   const { query, sort, skip, limit, pagination } = new QueryBuilder(req.query)
 *     .search(['name', 'sku', 'description'])
 *     .filter('category')
 *     .filter('brand')
 *     .filter('status')
 *     .filterBoolean('isActive')
 *     .excludeDeleted()
 *     .rangeFilter('currentStock', 'minStock', 'maxStock', 'int')
 *     .rangeFilter('sellingPrice', 'minPrice', 'maxPrice', 'float')
 *     .build();
 */

import { FilterQuery } from 'mongoose';

interface QueryParams {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  includeInactive?: string;
  [key: string]: string | undefined;
}

interface BuildResult<T> {
  query: FilterQuery<T>;
  sort: Record<string, 1 | -1>;
  skip: number;
  limit: number;
  pagination: {
    page: number;
    limit: number;
  };
}

export class QueryBuilder<T = unknown> {
  private _query: FilterQuery<T> = {};
  private params: QueryParams;
  private _page: number;
  private _limit: number;
  private _sortBy: string;
  private _sortOrder: 'asc' | 'desc';

  constructor(params: QueryParams, defaults?: { sortBy?: string; limit?: number }) {
    this.params = params;
    this._page = Math.max(1, parseInt(params.page || '1') || 1);
    this._limit = Math.max(1, Math.min(5000, parseInt(params.limit || String(defaults?.limit ?? 20)) || 20));
    this._sortBy = params.sortBy || defaults?.sortBy || 'name';
    this._sortOrder = params.sortOrder === 'desc' ? 'desc' : 'asc';
  }

  /** Escape regex special characters for safe MongoDB $regex usage */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Full-text search across multiple fields using $regex */
  search(fields: string[]): this {
    const term = this.params.search;
    if (term && term.trim()) {
      const escaped = QueryBuilder.escapeRegex(term.trim());
      (this._query as Record<string, unknown>).$or = fields.map(f => ({
        [f]: { $regex: escaped, $options: 'i' }
      }));
    }
    return this;
  }

  /** Exact-match filter from query param (param name = field name by default) */
  filter(field: string, paramName?: string): this {
    const value = this.params[paramName || field];
    if (value !== undefined && value !== '') {
      (this._query as Record<string, unknown>)[field] = value;
    }
    return this;
  }

  /** Boolean filter */
  filterBoolean(field: string, paramName?: string): this {
    const value = this.params[paramName || field];
    if (value !== undefined) {
      (this._query as Record<string, unknown>)[field] = value === 'true';
    }
    return this;
  }

  /** Exclude soft-deleted documents (isDeleted != true) */
  excludeDeleted(): this {
    const include = this.params.includeInactive === 'true';
    if (!include) {
      (this._query as Record<string, unknown>).isDeleted = { $ne: true };
    }
    return this;
  }

  /** Range filter (min/max) for numeric fields */
  rangeFilter(field: string, minParam: string, maxParam: string, type: 'int' | 'float' = 'float'): this {
    const parse = type === 'int' ? parseInt : parseFloat;
    const minVal = this.params[minParam] !== undefined ? parse(this.params[minParam]!) : undefined;
    const maxVal = this.params[maxParam] !== undefined ? parse(this.params[maxParam]!) : undefined;

    if (minVal !== undefined && !isNaN(minVal)) {
      const existing = (this._query as Record<string, unknown>)[field];
      (this._query as Record<string, unknown>)[field] = {
        ...(typeof existing === 'object' && existing !== null ? existing : {}),
        $gte: minVal
      };
    }
    if (maxVal !== undefined && !isNaN(maxVal)) {
      const existing = (this._query as Record<string, unknown>)[field];
      (this._query as Record<string, unknown>)[field] = {
        ...(typeof existing === 'object' && existing !== null ? existing : {}),
        $lte: maxVal
      };
    }
    return this;
  }

  /** Stock status filter (in_stock / low_stock / out_of_stock) */
  stockStatusFilter(paramName: string = 'stockStatus'): this {
    const status = this.params[paramName];
    if (!status) return this;

    switch (status) {
      case 'in_stock':
        (this._query as Record<string, unknown>).currentStock = { $gt: 0 };
        break;
      case 'low_stock':
        (this._query as Record<string, unknown>).currentStock = { $gt: 0 };
        (this._query as Record<string, unknown>).$expr = { $lte: ['$currentStock', '$reorderPoint'] };
        break;
      case 'out_of_stock':
        (this._query as Record<string, unknown>).currentStock = { $lte: 0 };
        break;
    }
    return this;
  }

  /** Custom condition */
  where(condition: FilterQuery<T>): this {
    Object.assign(this._query, condition);
    return this;
  }

  /** Build final query, sort, pagination */
  build(): BuildResult<T> {
    return {
      query: this._query,
      sort: { [this._sortBy]: this._sortOrder === 'asc' ? 1 : -1 } as Record<string, 1 | -1>,
      skip: (this._page - 1) * this._limit,
      limit: this._limit,
      pagination: {
        page: this._page,
        limit: this._limit,
      }
    };
  }

  /** Helper: build pagination response object (call after getting total count) */
  static paginationResponse(total: number, page: number, limit: number) {
    return {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }
}
