import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppNotification } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { NotificationList } from './notification-list';

const note = (over: Partial<AppNotification>): AppNotification => ({
  id: 1,
  eventId: 'e-1',
  eventType: 'OrderCreated',
  aggregateId: 'o-1',
  severity: 'INFO',
  title: 'Nuovo ordine ORD-1',
  message: 'Rossi Srl ha effettuato un ordine',
  occurredAt: new Date().toISOString(),
  receivedAt: new Date().toISOString(),
  ...over,
});

describe('NotificationList', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [NotificationList], providers: [provideRouter([])] }));

  function open(items: AppNotification[]) {
    TestBed.inject(NotificationService).items.set(items);
    const fixture = TestBed.createComponent(NotificationList);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('senza notifiche mostra lo stato vuoto e nasconde «Mostra le precedenti»', () => {
    const element = open([]);

    expect(element.querySelector('app-empty-state')?.textContent).toContain('Nessuna notifica ancora');
    expect(element.textContent).not.toContain('Mostra le precedenti');
  });

  it('ogni tipo di evento ha la sua icona e il suo colore, e l\'ora è relativa', () => {
    const element = open([
      note({ id: 1 }),
      note({ id: 2, eventType: 'OrderStatusChanged', title: 'Ordine ORD-1: confermato' }),
      note({ id: 3, eventType: 'StockLow', severity: 'WARNING', title: 'Scorta bassa ARR-001' }),
    ]);

    const icons = Array.from(element.querySelectorAll('.icon')).map((e) => ({
      tone: e.className.replace('icon', '').trim(),
      glyph: e.textContent?.trim(),
    }));
    expect(icons).toEqual([
      { tone: 'info', glyph: 'add_shopping_cart' },
      { tone: 'ok', glyph: 'sync_alt' },
      { tone: 'warn', glyph: 'warning' },
    ]);
    expect(element.querySelector('time')?.textContent?.trim()).toBe('adesso');
  });

  it('gli avvisi di scorta portano al magazzino e gli ordini al loro dettaglio', () => {
    const element = open([note({ id: 1 }), note({ id: 2, eventType: 'StockLow', severity: 'WARNING' })]);

    const links = Array.from(element.querySelectorAll('a[aria-label="Apri"]')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/ordini/o-1', '/magazzino']);
  });
});
