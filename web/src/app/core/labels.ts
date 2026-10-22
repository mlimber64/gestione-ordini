import { MovementType, OrderStatus, PaymentMethod, PaymentStatus, Role, Settlement } from './models';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'In attesa',
  CONFIRMED: 'Confermato',
  SHIPPED: 'Spedito',
  DELIVERED: 'Consegnato',
  CANCELLED: 'Annullato',
};

/** Classe del chip colorato per ogni stato. */
export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: 'warn',
  CONFIRMED: 'info',
  SHIPPED: 'info',
  DELIVERED: 'ok',
  CANCELLED: 'bad',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bonifico',
  CARD: 'Carta',
  CASH_ON_DELIVERY: 'Contrassegno',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'In attesa',
  PAID: 'Incassato',
  FAILED: 'Non riuscito',
  REFUNDED: 'Rimborsato',
};

export const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  PENDING: 'warn',
  PAID: 'ok',
  FAILED: 'bad',
  REFUNDED: 'info',
};

export const SETTLEMENT_LABEL: Record<Settlement, string> = {
  UNPAID: 'Da pagare',
  PARTIAL: 'Pagato in parte',
  PAID: 'Pagato',
};

export const SETTLEMENT_CLASS: Record<Settlement, string> = {
  UNPAID: 'warn',
  PARTIAL: 'info',
  PAID: 'ok',
};

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  RECEIPT: 'Carico',
  ADJUSTMENT: 'Rettifica',
  RESERVATION: 'Riserva',
  RELEASE: 'Rilascio',
  SHIPMENT: 'Spedizione',
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Amministratore',
  OPERATOR: 'Operatore',
  VIEWER: 'Sola lettura',
};

/** Passi successivi consentiti per uno stato, specchio della macchina a stati del server. */
export const NEXT_STEPS: Record<OrderStatus, ('confirm' | 'ship' | 'deliver' | 'cancel')[]> = {
  PENDING: ['confirm', 'cancel'],
  CONFIRMED: ['ship', 'cancel'],
  SHIPPED: ['deliver'],
  DELIVERED: [],
  CANCELLED: [],
};
