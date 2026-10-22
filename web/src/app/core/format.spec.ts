import { eventLook, relativeTime } from './format';

describe('relativeTime', () => {
  const now = new Date('2026-10-22T12:00:00Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('descrive gli eventi recenti con parole', () => {
    expect(relativeTime(ago(20_000), now)).toBe('adesso');
    expect(relativeTime(ago(5 * 60_000), now)).toBe('5 min fa');
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe('3 h fa');
    expect(relativeTime(ago(26 * 3_600_000), now)).toBe('ieri');
    expect(relativeTime(ago(3 * 86_400_000), now)).toBe('3 giorni fa');
  });

  it('dopo una settimana mostra la data', () => {
    expect(relativeTime(ago(10 * 86_400_000), now)).toMatch(/^\d{2}\/\d{2}$/);
  });

  it('con una data non valida non scrive niente', () => {
    expect(relativeTime('non-una-data', now)).toBe('');
  });
});

describe('eventLook', () => {
  it('un avviso è sempre arancione, qualunque sia l\'evento', () => {
    expect(eventLook('StockLow', 'WARNING')).toEqual({ icon: 'warning', tone: 'warn' });
  });

  it('distingue la creazione dal cambio di stato di un ordine', () => {
    expect(eventLook('OrderCreated', 'INFO').icon).toBe('add_shopping_cart');
    expect(eventLook('OrderStatusChanged', 'INFO').icon).toBe('sync_alt');
    expect(eventLook('Altro', 'INFO').icon).toBe('info');
  });
});
