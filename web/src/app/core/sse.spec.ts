import { SseParser } from './sse';

describe('SseParser', () => {
  it('estrae id, evento e dati da un messaggio completo', () => {
    const parser = new SseParser();
    const messages = parser.feed('id:7\nevent:OrderCreated\ndata:{"a":1}\n\n');
    expect(messages).toEqual([{ id: '7', event: 'OrderCreated', data: '{"a":1}' }]);
  });

  it('ricompone un messaggio spezzato in più pezzi, anche a metà riga', () => {
    const parser = new SseParser();
    expect(parser.feed('id:1\nev')).toEqual([]);
    expect(parser.feed('ent:StockLow\ndata:{"x"')).toEqual([]);
    expect(parser.feed(':2}\n\n')).toEqual([{ id: '1', event: 'StockLow', data: '{"x":2}' }]);
  });

  it('ignora i commenti di keep-alive', () => {
    const parser = new SseParser();
    expect(parser.feed(': ping\n\n')).toEqual([]);
    expect(parser.feed(':ping\n\nid:2\ndata:x\n\n')).toEqual([{ id: '2', event: undefined, data: 'x' }]);
  });

  it('gestisce più messaggi nello stesso pezzo e le righe con CRLF', () => {
    const parser = new SseParser();
    const messages = parser.feed('id:1\r\ndata:a\r\n\r\nid:2\r\ndata:b\r\n\r\n');
    expect(messages.map((m) => m.data)).toEqual(['a', 'b']);
    expect(messages.map((m) => m.id)).toEqual(['1', '2']);
  });

  it('unisce più righe data con un a capo e toglie solo il primo spazio', () => {
    const parser = new SseParser();
    expect(parser.feed('data: riga uno\ndata:  due\n\n')[0].data).toBe('riga uno\n due');
  });

  it("non emette nulla se il messaggio non ha dati", () => {
    const parser = new SseParser();
    expect(parser.feed('id:5\n\n')).toEqual([]);
  });

  it("l'evento non si trascina nel messaggio successivo", () => {
    const parser = new SseParser();
    const [first, second] = parser.feed('event:A\ndata:1\n\ndata:2\n\n');
    expect(first.event).toBe('A');
    expect(second.event).toBeUndefined();
  });
});
