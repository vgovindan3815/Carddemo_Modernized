import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h2>Add Transaction</h2>
    <p class="intro">Capture a new transaction for an account card.</p>
    <form [formGroup]="form" (ngSubmit)="save()">
      <label>Account ID <input formControlName="acctId" /></label>
      <label>Card Number <input formControlName="cardNum" /></label>
      <label>Type CD <input formControlName="tranTypeCd" /></label>
      <label>Category CD <input formControlName="tranCatCd" /></label>
      <label>Source <input formControlName="source" /></label>
      <label>Description <input formControlName="description" /></label>
      <label>Amount <input type="number" formControlName="amount" /></label>
      <p class="amount-preview">Formatted Amount: {{ (form.getRawValue().amount || 0) | currency:'USD':'symbol':'1.2-2' }}</p>
      <label>Orig Date <input type="date" formControlName="origDate" /></label>
      <label>Proc Date <input type="date" formControlName="procDate" /></label>
      <label>Merchant ID <input formControlName="merchantId" /></label>
      <label>Merchant Name <input formControlName="merchantName" /></label>
      <label>Merchant City <input formControlName="merchantCity" /></label>
      <label>Merchant Zip <input formControlName="merchantZip" /></label>
      <label>Confirm <select formControlName="confirm"><option>Y</option><option>N</option></select></label>
      <button type="submit" [disabled]="form.invalid">Create</button>
      <p class="success" *ngIf="message && message.startsWith('Created')">{{ message }}</p>
      <p class="error" *ngIf="message && !message.startsWith('Created')">{{ message }}</p>
    </form>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `form{display:grid;max-width:560px;gap:.65rem}`,
    `.amount-preview{margin:.1rem 0 .4rem;color:#334155;font-size:.9rem}`,
    `.error{margin:0;color:#b91c1c}`,
    `.success{margin:0;color:#166534}`
  ]
})
export class TransactionNewPageComponent {
  private readonly fb = inject(FormBuilder);
  message = '';
  readonly form = this.fb.group({
    acctId: [10000000001, Validators.required],
    cardNum: ['4444333322221111', Validators.required],
    tranTypeCd: ['PU', Validators.required],
    tranCatCd: [3001, Validators.required],
    source: ['POS', Validators.required],
    description: ['GROCERY', Validators.required],
    amount: [120.35, Validators.required],
    origDate: ['2026-02-24', Validators.required],
    procDate: ['2026-02-24', Validators.required],
    merchantId: [101001001, Validators.required],
    merchantName: ['FRESH MART', Validators.required],
    merchantCity: ['AUSTIN', Validators.required],
    merchantZip: ['73301', Validators.required],
    confirm: ['Y', Validators.required]
  });

  constructor(private readonly api: ApiService) {}

  save(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.api.createTransaction({ ...value, acctId: Number(value.acctId), tranCatCd: Number(value.tranCatCd), amount: Number(value.amount), merchantId: Number(value.merchantId) })
      .subscribe({ next: (res) => this.message = `Created ${res.tranId}`, error: (e) => this.message = e?.error?.message || 'Failed' });
  }
}
