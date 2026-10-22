import { TestBed } from '@angular/core/testing';
import { DialogHeader } from './dialog-header';

describe('DialogHeader', () => {
  function render(inputs: Record<string, string>) {
    const fixture = TestBed.createComponent(DialogHeader);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra titolo e icona, e il sottotitolo solo se c\'è', () => {
    const element = render({ title: 'Nuovo cliente', icon: 'person_add' });

    expect(element.querySelector('.title')?.textContent).toBe('Nuovo cliente');
    expect(element.querySelector('.icon mat-icon')?.textContent).toBe('person_add');
    expect(element.querySelector('.sub')).toBeNull();

    const withSub = render({ title: 'Movimenti', subtitle: 'Penna' });
    expect(withSub.querySelector('.sub')?.textContent).toBe('Penna');
  });

  it('il tono cambia il colore dell\'icona e il pulsante per chiudere ha un nome accessibile', () => {
    const element = render({ title: 'Annulla ordine', tone: 'danger' });

    expect(element.querySelector('.icon.danger')).not.toBeNull();
    expect(element.querySelector('button')?.getAttribute('aria-label')).toBe('Chiudi');
  });
});
