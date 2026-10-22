import { Severity } from './models';

/** «adesso», «5 min fa», «2 h fa», «ieri» o la data: come si legge un evento recente in un elenco. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return 'adesso';
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ieri';
  if (days < 7) return `${days} giorni fa`;
  return new Date(then).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

export interface EventLook {
  icon: string;
  tone: 'ok' | 'warn' | 'bad' | 'info';
}

/** Icona e colore di una notifica secondo il tipo di evento e la gravità. */
export function eventLook(eventType: string, severity: Severity): EventLook {
  if (severity === 'WARNING') return { icon: 'warning', tone: 'warn' };
  switch (eventType) {
    case 'OrderCreated':
      return { icon: 'add_shopping_cart', tone: 'info' };
    case 'OrderStatusChanged':
      return { icon: 'sync_alt', tone: 'ok' };
    default:
      return { icon: 'info', tone: 'info' };
  }
}
