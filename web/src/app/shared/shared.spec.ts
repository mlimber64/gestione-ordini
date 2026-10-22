import { TestBed } from '@angular/core/testing';
import { EmptyState } from './empty-state';
import { TableSkeleton } from './table-skeleton';

describe('EmptyState', () => {
  it('mostra titolo e messaggio, e il messaggio è facoltativo', () => {
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'Nessun ordine trovato');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('strong')?.textContent).toBe('Nessun ordine trovato');
    expect(element.querySelector('p')).toBeNull();

    fixture.componentRef.setInput('message', 'Prova a togliere i filtri.');
    fixture.detectChanges();
    expect(element.querySelector('p')?.textContent).toBe('Prova a togliere i filtri.');
  });
});

describe('TableSkeleton', () => {
  it('disegna righe e colonne richieste e si annuncia come caricamento', () => {
    const fixture = TestBed.createComponent(TableSkeleton);
    fixture.componentRef.setInput('rows', 3);
    fixture.componentRef.setInput('cols', 4);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.row').length).toBe(3);
    expect(element.querySelectorAll('.skeleton').length).toBe(12);
    expect(element.querySelector('[role=status]')?.getAttribute('aria-label')).toBe('Caricamento in corso');
  });
});
