import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Address,
  AddressInput,
  AppNotification,
  Category,
  Customer,
  CustomerInput,
  CustomerStatus,
  CustomerSummary,
  Movement,
  Order,
  OrderStatus,
  OrderSummary,
  Page,
  PlaceOrderInput,
  Product,
  ProductInput,
  Stock,
} from './models';

type Query = Record<string, string | number | boolean | null | undefined>;

/** Costruisce i parametri della query ignorando i valori vuoti. */
export function toParams(query: Query): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
  }
  return params;
}

export interface PageQuery {
  page: number;
  size: number;
  sort?: string;
}

const BASE = '/api/v1';

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly http = inject(HttpClient);

  search(q: string, status: CustomerStatus | '', paging: PageQuery): Observable<Page<CustomerSummary>> {
    return this.http.get<Page<CustomerSummary>>(`${BASE}/customers`, { params: toParams({ q, status, ...paging }) });
  }

  get(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${BASE}/customers/${id}`);
  }

  create(input: CustomerInput): Observable<Customer> {
    return this.http.post<Customer>(`${BASE}/customers`, input);
  }

  update(id: string, input: CustomerInput): Observable<Customer> {
    return this.http.put<Customer>(`${BASE}/customers/${id}`, input);
  }

  /** Il "cancellare" un cliente lo blocca: resta nello storico degli ordini. */
  block(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/customers/${id}`);
  }

  addAddress(id: string, input: AddressInput): Observable<Address> {
    return this.http.post<Address>(`${BASE}/customers/${id}/addresses`, input);
  }

  updateAddress(id: string, addressId: string, input: AddressInput): Observable<Address> {
    return this.http.put<Address>(`${BASE}/customers/${id}/addresses/${addressId}`, input);
  }

  deleteAddress(id: string, addressId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/customers/${id}/addresses/${addressId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);

  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${BASE}/categories`);
  }

  createCategory(name: string, parentId: string | null): Observable<Category> {
    return this.http.post<Category>(`${BASE}/categories`, { name, parentId });
  }

  products(q: string, categoryId: string, active: boolean | '', paging: PageQuery): Observable<Page<Product>> {
    return this.http.get<Page<Product>>(`${BASE}/products`, {
      params: toParams({ q, categoryId, active, ...paging }),
    });
  }

  createProduct(input: ProductInput): Observable<Product> {
    return this.http.post<Product>(`${BASE}/products`, input);
  }

  updateProduct(id: string, input: ProductInput): Observable<Product> {
    return this.http.put<Product>(`${BASE}/products/${id}`, input);
  }

  setProductActive(id: string, active: boolean): Observable<Product> {
    return this.http.patch<Product>(`${BASE}/products/${id}/active`, { active });
  }
}

@Injectable({ providedIn: 'root' })
export class InventoryApi {
  private readonly http = inject(HttpClient);

  list(q: string, lowStock: boolean, paging: PageQuery): Observable<Page<Stock>> {
    return this.http.get<Page<Stock>>(`${BASE}/inventory`, { params: toParams({ q, lowStock, ...paging }) });
  }

  receive(productId: string, quantity: number, note: string | null): Observable<Stock> {
    return this.http.post<Stock>(`${BASE}/inventory/${productId}/receipts`, { quantity, note });
  }

  adjust(productId: string, delta: number, note: string): Observable<Stock> {
    return this.http.post<Stock>(`${BASE}/inventory/${productId}/adjustments`, { delta, note });
  }

  setReorderLevel(productId: string, reorderLevel: number): Observable<Stock> {
    return this.http.patch<Stock>(`${BASE}/inventory/${productId}/reorder-level`, { reorderLevel });
  }

  movements(productId: string, page: number, size: number): Observable<Page<Movement>> {
    return this.http.get<Page<Movement>>(`${BASE}/inventory/${productId}/movements`, {
      params: toParams({ page, size }),
    });
  }
}

export interface OrderFilter {
  status: OrderStatus | '';
  q: string;
  customerId?: string;
}

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);

  search(filter: OrderFilter, paging: PageQuery): Observable<Page<OrderSummary>> {
    return this.http.get<Page<OrderSummary>>(`${BASE}/orders`, { params: toParams({ ...filter, ...paging }) });
  }

  get(id: string): Observable<Order> {
    return this.http.get<Order>(`${BASE}/orders/${id}`);
  }

  place(input: PlaceOrderInput): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders`, input);
  }

  confirm(id: string): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/${id}/confirm`, null);
  }

  ship(id: string): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/${id}/ship`, null);
  }

  deliver(id: string): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/${id}/deliver`, null);
  }

  cancel(id: string, reason: string): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/${id}/cancel`, { reason });
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);

  recent(limit: number, beforeId?: number): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(`${BASE}/notifications`, { params: toParams({ limit, beforeId }) });
  }
}
