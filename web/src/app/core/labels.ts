import { MovementType, OrderStatus, Role } from './models';

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
