import { Injectable, signal } from '@angular/core';

const THEME_STORAGE_KEY = 'carddemo.theme';
const HIGH_CONTRAST_CLASS = 'theme-high-contrast';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isHighContrast = signal(false);

  constructor() {
    this.initialize();
  }

  toggleHighContrast(): void {
    this.applyTheme(!this.isHighContrast());
  }

  private initialize(): void {
    if (!this.isBrowser()) return;
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    this.applyTheme(savedTheme === HIGH_CONTRAST_CLASS, false);
  }

  private applyTheme(enabled: boolean, persist = true): void {
    this.isHighContrast.set(enabled);
    if (!this.isBrowser()) return;
    document.body.classList.toggle(HIGH_CONTRAST_CLASS, enabled);
    if (persist) {
      localStorage.setItem(THEME_STORAGE_KEY, enabled ? HIGH_CONTRAST_CLASS : 'default');
    }
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }
}
