import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'gestione-ordini.tema';
const MODES: ThemeMode[] = ['system', 'light', 'dark'];

/**
 * Tema dell'interfaccia: segue il sistema oppure è forzato a chiaro o scuro. La scelta resta nel browser
 * (localStorage, se disponibile) e si applica con l'attributo data-theme sull'elemento radice: senza attributo
 * vale la preferenza del sistema (color-scheme: light dark).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;

  readonly mode = signal<ThemeMode>(this.read());
  readonly label = computed(() => ({ system: 'Tema del sistema', light: 'Tema chiaro', dark: 'Tema scuro' })[this.mode()]);
  readonly icon = computed(() => ({ system: 'contrast', light: 'light_mode', dark: 'dark_mode' })[this.mode()]);

  constructor() {
    this.apply(this.mode());
  }

  /** Passa al tema successivo: sistema, chiaro, scuro. */
  cycle(): void {
    this.set(MODES[(MODES.indexOf(this.mode()) + 1) % MODES.length]);
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    this.apply(mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // Archiviazione non disponibile (finestra privata, dati bloccati): la scelta vale solo per questa visita
    }
  }

  private apply(mode: ThemeMode): void {
    if (mode === 'system') this.root.removeAttribute('data-theme');
    else this.root.setAttribute('data-theme', mode);
  }

  private read(): ThemeMode {
    try {
      const saved = localStorage.getItem(KEY);
      return MODES.includes(saved as ThemeMode) ? (saved as ThemeMode) : 'system';
    } catch {
      return 'system';
    }
  }
}
