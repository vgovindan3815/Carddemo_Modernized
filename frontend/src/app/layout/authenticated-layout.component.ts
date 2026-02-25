import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header.component';

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [HeaderComponent, RouterOutlet],
  template: `
    <app-header />
    <main class="container app-shell">
      <div class="content-glass">
        <router-outlet />
      </div>
    </main>
  `,
  styles: [
    `.container{padding:1.15rem;max-width:1280px;margin:0 auto}`,
    `.app-shell{display:grid}`,
    `.content-glass{background:rgba(255,255,255,.48);border:1px solid rgba(148,163,184,.35);backdrop-filter:blur(10px);border-radius:16px;padding:1rem;box-shadow:0 14px 34px rgba(15,23,42,.12)}`
  ]
})
export class AuthenticatedLayoutComponent {}
