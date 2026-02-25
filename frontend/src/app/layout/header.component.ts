import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { SessionStoreService } from '../core/session.store';
import { ApiService } from '../core/api.service';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="header">
      <div class="brand">
        <img src="assets/images/header-credit-card.svg" alt="Credit card" />
        <div>
          <h1>CardDemo Bank</h1>
          <small>Online Banking Console</small>
        </div>
      </div>
      <nav class="nav">
        <a routerLink="/menu">Menu</a>
        <a routerLink="/accounts/view">Account View</a>
        <a routerLink="/accounts/edit">Account Update</a>
        <a routerLink="/cards">Cards</a>
        <a routerLink="/transactions">Transactions</a>
        <a routerLink="/billing/payment">Bill Payment</a>
        <a routerLink="/reports/transactions">Reports</a>
        <a *ngIf="session.isAdmin()" routerLink="/admin">Admin</a>
        <a *ngIf="session.isAdmin()" routerLink="/batch/submit">Submit Batch Job</a>
        <a *ngIf="session.isAdmin()" routerLink="/batch/runs">Job Runs</a>
        <a *ngIf="currentRunDetailLink" [routerLink]="currentRunDetailLink">Run Detail</a>
      </nav>
      <div class="user-panel" *ngIf="session.user() as user">
        <button type="button" class="contrast-toggle" (click)="theme.toggleHighContrast()">
          {{ theme.isHighContrast() ? 'Standard View' : 'High Contrast' }}
        </button>
        <span>{{ user.userId }} ({{ user.userType }})</span>
        <button class="signout-btn" (click)="logout()">Sign out</button>
      </div>
    </header>
  `,
  styles: [
    `.header{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.85rem 1rem;background:rgba(15,23,42,.78);backdrop-filter:blur(12px);color:#fff;position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(148,163,184,.25)}`,
    `.brand{display:flex;align-items:center;gap:.75rem}`,
    `.brand img{width:34px;height:34px;filter:drop-shadow(0 2px 6px rgba(14,165,233,.35))}`,
    `.brand h1{margin:0;font-size:1.02rem;line-height:1.15;letter-spacing:.2px}`,
    `.brand small{color:#bae6fd;font-size:.78rem}`,
    `.nav{display:flex;flex-wrap:wrap;gap:.45rem}`,
    `.nav a{color:#e2e8f0;text-decoration:none;font-size:.85rem;padding:.36rem .54rem;border-radius:8px;border:1px solid transparent}`,
    `.nav a:hover{background:rgba(148,163,184,.22);border-color:rgba(148,163,184,.35)}`,
    `.user-panel{display:flex;gap:.5rem;align-items:center}`,
    `.contrast-toggle{background:rgba(15,23,42,.4);border:1px solid rgba(148,163,184,.35);color:#e2e8f0;padding:.36rem .62rem;border-radius:8px}`,
    `.contrast-toggle:hover{background:rgba(30,41,59,.7)}`,
    `.user-panel span{font-size:.82rem;color:#cbd5e1}`,
    `.signout-btn{background:linear-gradient(135deg,#0ea5e9,#1d4ed8);color:#fff;border:none;padding:.38rem .64rem;border-radius:8px;cursor:pointer}`
  ]
})
export class HeaderComponent {
  constructor(public session: SessionStoreService, public theme: ThemeService, private readonly api: ApiService, private readonly router: Router) {}

  get currentRunDetailLink(): string | null {
    if (!this.session.isAdmin()) return null;
    const match = this.router.url.match(/\/batch\/runs\/([^?]+)/);
    return match ? `/batch/runs/${match[1]}` : null;
  }

  logout(): void {
    this.api.logout().subscribe({
      next: () => {
        this.session.setUser(null);
        this.router.navigate(['/signon']);
      },
      error: () => {
        this.session.setUser(null);
        this.router.navigate(['/signon']);
      }
    });
  }
}
