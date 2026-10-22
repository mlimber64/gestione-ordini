// Tipi che rispecchiano i contratti JSON di order-service e notification-service.

export type Role = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Risposta di login e refresh: solo il token di accesso. Quello di refresh viaggia nel cookie HttpOnly. */
export interface AccessToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export type CustomerStatus = 'ACTIVE' | 'BLOCKED';
export type AddressType = 'BILLING' | 'SHIPPING';

export interface CustomerSummary {
  id: string;
  code: string;
  name: string;
  email: string;
  vatNumber: string | null;
  status: CustomerStatus;
}

export interface Address {
  id: string;
  type: AddressType;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  defaultAddress: boolean;
}

export interface Customer extends CustomerSummary {
  phone: string | null;
  taxCode: string | null;
  createdAt: string;
  updatedAt: string;
  addresses: Address[];
}

export interface CustomerInput {
  name: string;
  email: string;
  phone: string | null;
  vatNumber: string | null;
  taxCode: string | null;
}

export type AddressInput = Omit<Address, 'id'>;

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  unitPrice: number;
  vatRate: number;
  active: boolean;
}

export interface ProductInput {
  sku: string;
  name: string;
  description: string | null;
  categoryId: string;
  unitPrice: number;
  vatRate: number;
}

export interface Stock {
  productId: string;
  sku: string;
  productName: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderLevel: number;
  lowStock: boolean;
}

export type MovementType = 'RECEIPT' | 'ADJUSTMENT' | 'RESERVATION' | 'RELEASE' | 'SHIPMENT';

export interface Movement {
  id: string;
  type: MovementType;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderSummary {
  id: string;
  number: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  status: OrderStatus;
  totalGross: number;
  createdAt: string;
}

export interface OrderLine {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineNet: number;
  lineVat: number;
  lineGross: number;
}

export interface StatusChange {
  from: OrderStatus | null;
  to: OrderStatus;
  reason: string | null;
  changedBy: string;
  changedAt: string;
}

export interface Order {
  id: string;
  number: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  status: OrderStatus;
  shippingAddress: { street: string; city: string; province: string; postalCode: string; country: string };
  notes: string | null;
  lines: OrderLine[];
  totalNet: number;
  totalVat: number;
  totalGross: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  history: StatusChange[];
}

export interface PlaceOrderInput {
  customerId: string;
  shippingAddressId: string | null;
  notes: string | null;
  items: { productId: string; quantity: number }[];
}

export type PaymentMethod = 'BANK_TRANSFER' | 'CARD' | 'CASH_ON_DELIVERY';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

/** Quanto dell'ordine è stato incassato. */
export type Settlement = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  reference: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  paidAt: string | null;
}

/** Pagamenti di un ordine con il riepilogo: `balance` manca da incassare, `registrable` si può ancora registrare. */
export interface OrderPayments {
  orderId: string;
  total: number;
  paid: number;
  pending: number;
  balance: number;
  registrable: number;
  settlement: Settlement;
  payments: Payment[];
}

export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  reference: string | null;
}

export type Severity = 'INFO' | 'WARNING';

export interface AppNotification {
  id: number;
  eventId: string;
  eventType: string;
  aggregateId: string;
  severity: Severity;
  title: string;
  message: string;
  occurredAt: string;
  receivedAt: string;
}

/** Come autenticare l'utente: con il modulo dell'applicazione o con Keycloak (ADR 0021). */
export interface AuthConfig {
  mode: 'local' | 'oidc';
}
