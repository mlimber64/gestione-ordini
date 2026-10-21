export interface SseMessage {
  id?: string;
  event?: string;
  data: string;
}

/**
 * Interprete minimale del formato Server-Sent Events. Si usa `fetch` e non `EventSource` perché quest'ultimo non può
 * inviare l'intestazione Authorization: il token non deve viaggiare nell'URL.
 *
 * Riceve pezzi di testo di qualsiasi lunghezza (anche a metà riga) e restituisce i messaggi completi.
 */
export class SseParser {
  private buffer = '';
  private id?: string;
  private event?: string;
  private data: string[] = [];

  feed(chunk: string): SseMessage[] {
    this.buffer += chunk;
    const messages: SseMessage[] = [];
    let newline: number;
    while ((newline = this.buffer.search(/\r\n|\n|\r/)) >= 0) {
      const line = this.buffer.slice(0, newline);
      const separator = this.buffer.startsWith('\r\n', newline) ? 2 : 1;
      // Un "\r" finale potrebbe essere l'inizio di "\r\n": si aspetta il prossimo pezzo
      if (this.buffer[newline] === '\r' && newline + 1 === this.buffer.length) break;
      this.buffer = this.buffer.slice(newline + separator);
      const message = this.line(line);
      if (message) messages.push(message);
    }
    return messages;
  }

  private line(line: string): SseMessage | null {
    if (line === '') {
      const message = this.data.length ? { id: this.id, event: this.event, data: this.data.join('\n') } : null;
      this.event = undefined;
      this.data = [];
      return message;
    }
    if (line.startsWith(':')) return null; // commento, per esempio il ping di keep-alive
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'id') this.id = value;
    else if (field === 'event') this.event = value;
    else if (field === 'data') this.data.push(value);
    return null;
  }
}
