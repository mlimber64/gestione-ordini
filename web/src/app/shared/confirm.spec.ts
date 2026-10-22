import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ConfirmDialog, ConfirmService } from './confirm';

describe('ConfirmService', () => {
  function service(answer: unknown) {
    const open = vi.fn().mockReturnValue({ afterClosed: () => of(answer) });
    TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: { open } }] });
    return { service: TestBed.inject(ConfirmService), open };
  }

  const options = { title: 'Bloccare il cliente?', message: 'Non potrà più fare ordini.', confirmLabel: 'Blocca cliente' };

  it('risponde sì solo se la finestra si chiude con una conferma esplicita', () => {
    const { service: s, open } = service(true);
    let answer: boolean | undefined;
    s.ask(options).subscribe((value) => (answer = value));

    expect(answer).toBe(true);
    expect(open).toHaveBeenCalledWith(ConfirmDialog, expect.objectContaining({ data: options }));
  });

  it('chiudere la finestra, premere Esc o scegliere Indietro è un no', () => {
    for (const closed of [false, undefined, 'altro']) {
      TestBed.resetTestingModule();
      const { service: s } = service(closed);
      let answer: boolean | undefined;
      s.ask(options).subscribe((value) => (answer = value));
      expect(answer).toBe(false);
    }
  });
});

describe('ConfirmDialog', () => {
  it("mostra titolo, effetto e il verbo dell'azione sul pulsante di conferma", () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: { title: "Spedire l'ordine?", message: 'Passerà a Spedito.', confirmLabel: 'Spedisci', tone: 'warn' },
        },
      ],
    });
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.title')?.textContent).toContain("Spedire l'ordine?");
    expect(element.querySelector('.message')?.textContent).toContain('Passerà a Spedito.');
    expect(element.querySelector('.icon.warn')).not.toBeNull();
    const buttons = Array.from(element.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Indietro', 'Spedisci']);
  });
});
