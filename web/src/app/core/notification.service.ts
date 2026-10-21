import { Injectable, inject, signal } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { NotificationsApi } from './api';
import { AuthService } from './auth.service';
import { AppNotification } from './models';
import { SseParser } from './sse';

const STREAM_URL = '/api/v1/notifications/stream';
const MAX_ITEMS = 100;

/**
 * Notifiche in tempo reale. Tiene aperto lo stream SSE di notification-service e, se la connessione cade, si
 * ricollega da solo con backoff crescente indicando l'ultimo id ricevuto (Last-Event-ID): il server rimanda quanto
 * è stato perso, senza buchi né doppioni.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(NotificationsApi);
  private readonly auth = inject(AuthService);

  readonly items = signal<AppNotification[]>([]);
  readonly unread = signal(0);
  readonly connected = signal(false);
  /** Emette ogni notifica nuova arrivata in diretta (non quelle della cronologia). */
  readonly incoming = new Subject<AppNotification>();

  private running = false;
  private abort?: AbortController;
  private lastEventId?: string;

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loadHistory().then(() => this.connectLoop());
  }

  stop(): void {
    this.running = false;
    this.abort?.abort();
    this.connected.set(false);
    this.items.set([]);
    this.unread.set(0);
    this.lastEventId = undefined;
  }

  markAllRead(): void {
    this.unread.set(0);
  }

  /** Carica altre notifiche della cronologia, più vecchie di quelle già mostrate. */
  async loadMore(pageSize = 30): Promise<boolean> {
    const oldest = this.items().at(-1);
    if (!oldest) return false;
    const older = await firstValueFrom(this.api.recent(pageSize, oldest.id));
    this.items.update((current) => [...current, ...older]);
    return older.length === pageSize;
  }

  private async loadHistory(): Promise<void> {
    try {
      const recent = await firstValueFrom(this.api.recent(30));
      this.items.set(recent);
      this.lastEventId = recent[0] ? String(recent[0].id) : undefined;
    } catch {
      // la cronologia non è essenziale: lo stream riprova da solo
    }
  }

  /** Lee lo stream; al terminar (o fallire) pianifica il tentativo successivo con attesa crescente. */
  private async connectLoop(attempt = 0): Promise<void> {
    if (!this.running) return;
    let next = 0;
    try {
      await this.readStream();
    } catch {
      next = attempt + 1;
    }
    this.connected.set(false);
    if (!this.running) return;
    const delay = Math.min(1000 * 2 ** next, 15000);
    setTimeout(() => void this.connectLoop(next), delay);
  }

  private async readStream(): Promise<void> {
    this.abort = new AbortController();
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    const token = this.auth.accessToken();
    if (!token) throw new Error('Non autenticato');
    headers['Authorization'] = `Bearer ${token}`;
    if (this.lastEventId) headers['Last-Event-ID'] = this.lastEventId;

    const response = await fetch(STREAM_URL, { headers, signal: this.abort.signal });
    if (response.status === 401) {
      await firstValueFrom(this.auth.refresh()); // il prossimo tentativo userà il token nuovo
      throw new Error('Token scaduto');
    }
    if (!response.ok || !response.body) throw new Error(`Stream non disponibile (${response.status})`);

    this.connected.set(true);
    const parser = new SseParser();
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      for (const message of parser.feed(decoder.decode(value, { stream: true }))) this.receive(message.id, message.data);
    }
  }

  private receive(id: string | undefined, data: string): void {
    let notification: AppNotification;
    try {
      notification = JSON.parse(data) as AppNotification;
    } catch {
      return;
    }
    if (id) this.lastEventId = id;
    if (this.items().some((item) => item.id === notification.id)) return;
    this.items.update((current) => [notification, ...current].slice(0, MAX_ITEMS));
    this.unread.update((count) => count + 1);
    this.incoming.next(notification);
  }
}
