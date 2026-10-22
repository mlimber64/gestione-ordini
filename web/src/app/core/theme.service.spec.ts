import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  function create(): ThemeService {
    TestBed.resetTestingModule();
    return TestBed.inject(ThemeService);
  }

  it('di base segue il sistema: nessun attributo sulla radice', () => {
    const theme = create();

    expect(theme.mode()).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('cycle passa da sistema a chiaro, scuro e di nuovo a sistema', () => {
    const theme = create();

    theme.cycle();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    theme.cycle();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    theme.cycle();
    expect(theme.mode()).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('ricorda la scelta al ritorno', () => {
    create().set('dark');

    const again = create();

    expect(again.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ignora un valore salvato che non conosce', () => {
    localStorage.setItem('gestione-ordini.tema', 'viola');

    expect(create().mode()).toBe('system');
  });

  it('funziona anche se l\'archiviazione del browser non è disponibile', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloccato');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloccato');
    });
    const theme = create();

    expect(() => theme.set('dark')).not.toThrow();
    expect(theme.mode()).toBe('dark');
    vi.restoreAllMocks();
  });
});
