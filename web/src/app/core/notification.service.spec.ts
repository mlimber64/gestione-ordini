import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { fakeJwt } from './testing';
import { AppNotification } from './models';
import { NotificationService } from './notification.service';

const notification = (id: number, title: string): AppNotification => ({
  id,
  eventId: `e-${id}`,
  eventType: 'OrderCreated',
  aggregateId: 'o-1',
  severity: 'INFO',
  title,
  message: 'messaggio',
  occurredAt: '2026-10-21T10:00:00Z',
  receivedAt: '2026-10-21T10:00:01Z',
});

/** Risposta SSE simulata: i pezzi di testo arrivano uno alla volta, come da una connessione vera. */
function sseResponse(...chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('NotificationService', () => {
  let service: NotificationService;
  let http: HttpTestingController;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    TestBed.inject(AuthService).accessToken.set(fakeJwt({ sub: 'anna', roles: ['VIEWER'] }));
    service = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    service.stop();
    vi.unstubAllGlobals();
  });

  it('carica la cronologia, apre lo stream con il token e aggiunge le notifiche in arrivo', async () => {
    fetchMock.mockResolvedValue(sseResponse(': ping\n\n', `id:2\nevent:OrderCreated\ndata:${JSON.stringify(notification(2, 'Nuovo ordine B'))}\n\n`));
    const arrived: string[] = [];
    service.incoming.subscribe((n) => arrived.push(n.title));

    service.start();
    http.expectOne('/api/v1/notifications?limit=30').flush([notification(1, 'Nuovo ordine A')]);

    await vi.waitFor(() => expect(service.items().map((n) => n.title)).toEqual(['Nuovo ordine B', 'Nuovo ordine A']));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/notifications/stream');
    expect(options.headers['Authorization']).toMatch(/^Bearer /);
    // La cronologia non conta come "da leggere" né come avviso a comparsa: solo la notifica in diretta
    expect(service.unread()).toBe(1);
    expect(arrived).toEqual(['Nuovo ordine B']);
    // Lo stream parte dall'ultima notifica già vista
    expect(options.headers['Last-Event-ID']).toBe('1');
  });

  it('segnare come lette azzera il contatore e una notifica ripetuta non si duplica', async () => {
    const repeated = `id:2\ndata:${JSON.stringify(notification(2, 'Uguale'))}\n\n`;
    fetchMock.mockResolvedValue(sseResponse(repeated, repeated));

    service.start();
    http.expectOne('/api/v1/notifications?limit=30').flush([]);

    await vi.waitFor(() => expect(service.items()).toHaveLength(1));
    expect(service.unread()).toBe(1);
    service.markAllRead();
    expect(service.unread()).toBe(0);
  });

  it('se la connessione cade si ricollega indicando l\'ultimo id ricevuto', async () => {
    fetchMock
      .mockResolvedValueOnce(sseResponse(`id:7\ndata:${JSON.stringify(notification(7, 'Prima della caduta'))}\n\n`))
      .mockResolvedValue(sseResponse(': ping\n\n'));

    service.start();
    http.expectOne('/api/v1/notifications?limit=30').flush([]);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 4000 });
    expect(fetchMock.mock.calls[1][1].headers['Last-Event-ID']).toBe('7');
  });

  it('stop() svuota lo stato', async () => {
    fetchMock.mockResolvedValue(sseResponse(`id:3\ndata:${JSON.stringify(notification(3, 'x'))}\n\n`));
    service.start();
    http.expectOne('/api/v1/notifications?limit=30').flush([]);
    await vi.waitFor(() => expect(service.items()).toHaveLength(1));

    service.stop();

    expect(service.items()).toEqual([]);
    expect(service.unread()).toBe(0);
    expect(service.connected()).toBe(false);
  });
});
