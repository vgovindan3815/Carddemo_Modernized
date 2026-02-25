import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h2>Bill Payment</h2>
    <p class="intro">Post payment against an account and optionally persist card details.</p>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label>Account ID <input formControlName="acctId" (blur)="loadAccountContext()" /></label>
      <label>Amount <input type="number" step="0.01" formControlName="amount" /></label>
      <p class="amount-preview">Formatted Amount: {{ (form.getRawValue().amount || 0) | currency:'USD':'symbol':'1.2-2' }}</p>
      <label>Card Number <input formControlName="cardNum" /></label>
      <label>Expiry Date <input type="date" formControlName="expirationDate" /></label>
      <label>
        Secret Code
        <div class="secret-row">
          <input [type]="showSecretCode ? 'text' : 'password'" formControlName="secretCode" autocomplete="off" />
          <button type="button" (click)="toggleSecretCode()">{{ showSecretCode ? 'Hide' : 'Show' }}</button>
        </div>
      </label>
      <label>Confirm <select formControlName="confirm"><option>Y</option><option>N</option></select></label>
      <button type="submit" [disabled]="form.invalid">Post Payment</button>
      <p class="hint">{{ cardHint }}</p>
      <p class="success" *ngIf="message && message.startsWith('Payment posted')">{{ message }}</p>
      <p class="error" *ngIf="message && !message.startsWith('Payment posted')">{{ message }}</p>
    </form>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `form{display:grid;max-width:500px;gap:.65rem}`,
    `.hint{color:#1e40af;font-size:.9rem;margin:.2rem 0}`,
    `.secret-row{display:flex;gap:.5rem;align-items:center}`,
    `.amount-preview{margin:.1rem 0 .4rem;color:#334155;font-size:.9rem}`,
    `.error{margin:0;color:#b91c1c}`,
    `.success{margin:0;color:#166534}`
  ]
})
export class BillPaymentPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  message = '';
  cardHint = '';
  showSecretCode = false;
  readonly form = this.fb.group({
    acctId: [10000000001, Validators.required],
    amount: [0, Validators.required],
    cardNum: [''],
    expirationDate: [''],
    secretCode: [''],
    confirm: ['Y', Validators.required]
  });

  constructor(private readonly api: ApiService) {}

  toggleSecretCode(): void {
    this.showSecretCode = !this.showSecretCode;
  }

  ngOnInit(): void {
    const acctIdFromRoute = this.route.snapshot.queryParamMap.get('acctId');
    if (acctIdFromRoute) {
      this.form.patchValue({ acctId: Number(acctIdFromRoute) });
    }
    this.loadAccountContext();
  }

  loadAccountContext(): void {
    this.loadBalanceForAccount();
    this.loadCardForAccount();
  }

  loadBalanceForAccount(): void {
    const acctId = this.form.getRawValue().acctId;
    if (!acctId) return;
    this.api.getAccount(String(acctId)).subscribe({
      next: (res) => {
        const currBal = Number(res?.account?.currBal ?? 0);
        this.form.patchValue({ amount: Number(currBal.toFixed(2)) });
      }
    });
  }

  loadCardForAccount(): void {
    const acctId = this.form.getRawValue().acctId;
    if (!acctId) return;
    this.api.getCards({ acctId: String(acctId), page: 1, pageSize: 1, sort: 'cardNum:asc' }).subscribe({
      next: (res) => {
        const card = res?.items?.[0];
        if (!card) {
          this.cardHint = 'No saved card found for this account. Enter card details and submit once to save card and post payment.';
          return;
        }
        this.form.patchValue({
          cardNum: card.cardNum || '',
          expirationDate: card.expirationDate || '',
          secretCode: card.secretCode || ''
        });
        this.cardHint = 'Saved card details loaded for this account. Submit to post payment.';
      },
      error: () => {
        this.cardHint = '';
      }
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload: any = {
      acctId: Number(value.acctId),
      amount: Number(Number(value.amount).toFixed(2)),
      confirm: value.confirm
    };
    if (value.cardNum || value.expirationDate || value.secretCode) {
      payload.card = {
        cardNum: value.cardNum,
        expirationDate: value.expirationDate,
        secretCode: value.secretCode
      };
    }
    this.api.postBillPayment(payload).subscribe({
      next: (res) => this.message = `Payment posted. New balance: ${res.newBalance}`,
      error: (e) => this.message = e?.error?.message || 'Failed'
    });
  }
}
