import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h2>Card Update</h2>
    <p class="intro">Modify card attributes and save updates.</p>
    <form [formGroup]="form" (ngSubmit)="save()">
      <label>Card Number <input formControlName="cardNum" readonly /></label>
      <label>Embossed Name <input formControlName="embossedName" /></label>
      <label>Status <input formControlName="activeStatus" /></label>
      <label>Expiry Date <input type="date" formControlName="expirationDate" /></label>
      <label>Confirm <select formControlName="confirm"><option>Y</option><option>N</option></select></label>
      <button type="submit" [disabled]="form.invalid">Save</button>
      <p class="success" *ngIf="message === 'Card updated'">{{ message }}</p>
      <p class="error" *ngIf="message && message !== 'Card updated'">{{ message }}</p>
    </form>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `form{display:grid;max-width:560px;gap:.7rem}`,
    `.error{margin:0;color:#b91c1c}`,
    `.success{margin:0;color:#166534}`
  ]
})
export class CardEditPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  message = '';
  readonly form = this.fb.group({
    cardNum: ['4444333322221111', Validators.required],
    embossedName: ['JOHN SMITH', Validators.required],
    activeStatus: ['Y', Validators.required],
    expirationDate: ['2029-01-31', Validators.required],
    confirm: ['Y', Validators.required]
  });

  constructor(private readonly route: ActivatedRoute, private readonly api: ApiService) {}

  ngOnInit(): void {
    const cardNum = this.route.snapshot.queryParamMap.get('cardNum');
    if (cardNum) this.form.patchValue({ cardNum });
  }

  save(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.api.updateCard(value.cardNum!, { confirm: value.confirm, embossedName: value.embossedName, activeStatus: value.activeStatus, expirationDate: value.expirationDate })
      .subscribe({ next: () => this.message = 'Card updated', error: (e) => this.message = e?.error?.message || 'Failed' });
  }
}
