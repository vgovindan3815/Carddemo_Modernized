import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { SessionStoreService } from '../core/session.store';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="card signin-card">
      <h2>Sign-on</h2>
      <p class="subtitle">Secure access to CardDemo banking operations</p>
      <form [formGroup]="form" (ngSubmit)="login()">
        <label>User ID <input formControlName="userId" /></label>
        <label>Password <input type="password" formControlName="password" /></label>
        <button type="submit">Sign in</button>
        <p class="error" *ngIf="error">{{ error }}</p>
      </form>
    </div>
  `,
  styles: [
    `.signin-card{max-width:480px;margin:4.5rem auto;padding:1.25rem;background:rgba(255,255,255,.62);backdrop-filter:blur(10px);border:1px solid rgba(148,163,184,.35);border-radius:16px;box-shadow:0 18px 38px rgba(15,23,42,.14)}`,
    `.subtitle{margin:.15rem 0 .85rem;color:#475569}`,
    `form{display:grid;gap:.85rem}`,
    `.error{margin:0}`
  ]
})
export class SignonPageComponent {
  private readonly fb = inject(FormBuilder);
  error = '';
  readonly form = this.fb.group({ userId: ['', Validators.required], password: ['', Validators.required] });

  constructor(private readonly api: ApiService, private readonly session: SessionStoreService, private readonly router: Router) {}

  login(): void {
    this.error = '';
    if (this.form.invalid) {
      this.error = 'Please enter User ID and Password';
      return;
    }
    this.api.login(this.form.getRawValue() as any).subscribe({
      next: (res) => {
        this.session.setUser({ userId: res.userId, userType: res.userType });
        this.router.navigate(['/menu']);
      },
      error: (err) => {
        this.error = err?.error?.message || 'Sign-on failed';
      }
    });
  }
}
