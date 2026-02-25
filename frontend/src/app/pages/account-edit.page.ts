import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h2>{{ customerOnly ? 'Customer Update' : 'Account Update' }}</h2>
    <p class="intro">Update account and customer details.</p>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="toolbar">
        <label>Account ID <input formControlName="acctId" /></label>
        <button type="button" (click)="loadAccount()">Load</button>
      </div>
      <label>Confirm <select formControlName="confirm"><option>Y</option><option>N</option></select></label>

      <details [open]="!customerOnly" class="section-block">
        <summary class="section-title">Account</summary>
        <label>Active Status <input formControlName="activeStatus" /></label>
        <label>Credit Limit <input type="number" step="0.01" formControlName="creditLimit" /></label>
        <p class="amount-preview">Formatted Credit Limit: {{ (form.getRawValue().creditLimit || 0) | currency:'USD':'symbol':'1.2-2' }}</p>
        <label>Cash Credit Limit <input type="number" step="0.01" formControlName="cashCreditLimit" /></label>
        <p class="amount-preview">Formatted Cash Credit Limit: {{ (form.getRawValue().cashCreditLimit || 0) | currency:'USD':'symbol':'1.2-2' }}</p>
        <label>Current Balance <input type="number" step="0.01" formControlName="currBal" /></label>
        <label>Current Cycle Credit <input type="number" step="0.01" formControlName="currCycCredit" /></label>
        <label>Current Cycle Debit <input type="number" step="0.01" formControlName="currCycDebit" /></label>
        <label>Group ID <input formControlName="groupId" /></label>
        <label>Open Date <input type="date" formControlName="openDate" /></label>
        <label>Expiry Date <input type="date" formControlName="expirationDate" /></label>
        <label>Reissue Date <input type="date" formControlName="reissueDate" /></label>
      </details>

      <h3 #customerSection class="section-title">Customer</h3>
      <label>Customer ID <input formControlName="custId" /></label>
      <label>First Name <input formControlName="firstName" /></label>
      <label>Middle Name <input formControlName="middleName" /></label>
      <label>Last Name <input formControlName="lastName" /></label>
      <label>SSN <input formControlName="ssn" /></label>
      <label>Date of Birth <input type="date" formControlName="dob" /></label>
      <label>FICO Score <input type="number" formControlName="ficoScore" /></label>

      <h3 class="section-title">Address</h3>
      <label>Address Line 1 <input formControlName="addrLine1" /></label>
      <label>Address Line 2 <input formControlName="addrLine2" /></label>
      <label>Address Line 3 <input formControlName="addrLine3" /></label>
      <label>State <input formControlName="addrState" /></label>
      <label>Country <input formControlName="addrCountry" /></label>
      <label>ZIP <input formControlName="addrZip" /></label>

      <h3 class="section-title">Additional</h3>
      <label>Phone 1 <input formControlName="phone1" /></label>
      <label>Phone 2 <input formControlName="phone2" /></label>
      <label>Govt ID <input formControlName="govtId" /></label>
      <label>EFT Account ID <input formControlName="eftAccountId" /></label>
      <label>Primary Holder <input formControlName="primaryHolderInd" /></label>

      <button type="submit" [disabled]="form.invalid">Save</button>
      <p class="success" *ngIf="message === 'Account updated'">{{ message }}</p>
      <p class="error" *ngIf="message && message !== 'Account updated'">{{ message }}</p>
    </form>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `form{display:grid;max-width:720px;gap:.7rem}`,
    `.toolbar{display:flex;gap:.75rem;align-items:end}`,
    `.section-title{margin:.9rem 0 .1rem;font-size:1rem;color:#0f172a}`,
    `details.section-block{border:1px solid var(--line);border-radius:10px;padding:.6rem;margin-bottom:.6rem;background:var(--surface)}`,
    `details.section-block summary{cursor:pointer}`,
    `.amount-preview{margin:.1rem 0 .4rem;color:#334155;font-size:.9rem}`,
    `.error{margin:0;color:#b91c1c}`,
    `.success{margin:0;color:#166534}`
  ]
})
export class AccountEditPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  @ViewChild('customerSection') customerSection?: ElementRef<HTMLElement>;

  message = '';
  customerOnly = false;
  readonly form = this.fb.group({
    acctId: ['', Validators.required],
    confirm: ['Y', Validators.required],
    activeStatus: ['Y', Validators.required],
    creditLimit: [0, Validators.required],
    cashCreditLimit: [0, Validators.required],
    currBal: [0, Validators.required],
    currCycCredit: [0, Validators.required],
    currCycDebit: [0, Validators.required],
    groupId: [''],
    openDate: ['', Validators.required],
    expirationDate: ['', Validators.required],
    reissueDate: ['', Validators.required],
    custId: ['', Validators.required],
    firstName: ['', Validators.required],
    middleName: [''],
    lastName: ['', Validators.required],
    ssn: ['', Validators.required],
    dob: ['', Validators.required],
    ficoScore: [0, Validators.required],
    addrLine1: ['', Validators.required],
    addrLine2: [''],
    addrLine3: [''],
    addrState: ['', Validators.required],
    addrCountry: ['', Validators.required],
    addrZip: ['', Validators.required],
    phone1: [''],
    phone2: [''],
    govtId: [''],
    eftAccountId: [''],
    primaryHolderInd: ['']
  });

  ngOnInit(): void {
    const acctId = this.route.snapshot.queryParamMap.get('acctId');
    const section = this.route.snapshot.queryParamMap.get('section');
    this.customerOnly = section === 'customer';
    if (acctId) {
      this.form.patchValue({ acctId });
      this.loadAccount(acctId);
    }
  }

  loadAccount(acctIdOverride?: string): void {
    const acctId = acctIdOverride ?? this.form.getRawValue().acctId;
    if (!acctId) return;
    this.message = '';
    this.api.getAccount(String(acctId)).subscribe({
      next: (res) => {
        const account = res?.account ?? {};
        const customer = res?.customer ?? {};
        const address = customer?.address ?? {};
        this.form.patchValue({
          acctId: account.acctId ?? acctId,
          activeStatus: account.activeStatus ?? 'Y',
          creditLimit: account.creditLimit ?? 0,
          cashCreditLimit: account.cashCreditLimit ?? 0,
          currBal: account.currBal ?? 0,
          currCycCredit: account.currCycCredit ?? 0,
          currCycDebit: account.currCycDebit ?? 0,
          groupId: account.groupId ?? '',
          openDate: account.openDate ?? '',
          expirationDate: account.expirationDate ?? '',
          reissueDate: account.reissueDate ?? '',
          custId: customer.custId ?? '',
          firstName: customer.firstName ?? '',
          middleName: customer.middleName ?? '',
          lastName: customer.lastName ?? '',
          ssn: customer.ssn ?? '',
          dob: customer.dob ?? '',
          ficoScore: customer.ficoScore ?? 0,
          addrLine1: address.line1 ?? '',
          addrLine2: address.line2 ?? '',
          addrLine3: address.line3 ?? '',
          addrState: address.state ?? '',
          addrCountry: address.country ?? '',
          addrZip: address.zip ?? '',
          phone1: customer.phone1 ?? '',
          phone2: customer.phone2 ?? '',
          govtId: customer.govtId ?? '',
          eftAccountId: customer.eftAccountId ?? '',
          primaryHolderInd: customer.primaryHolderInd ?? ''
        });
        if (this.customerOnly && this.customerSection?.nativeElement) {
          this.customerSection.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
      error: (err) => {
        this.message = err?.error?.message || 'Unable to load account details';
      }
    });
  }

  save(): void {
    this.message = '';
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload = {
      confirm: value.confirm,
      account: {
        activeStatus: value.activeStatus,
        creditLimit: Number(value.creditLimit),
        cashCreditLimit: Number(value.cashCreditLimit),
        openDate: value.openDate,
        expirationDate: value.expirationDate,
        reissueDate: value.reissueDate,
        currBal: Number(value.currBal),
        currCycCredit: Number(value.currCycCredit),
        currCycDebit: Number(value.currCycDebit),
        groupId: value.groupId || undefined
      },
      customer: {
        custId: Number(value.custId),
        firstName: value.firstName,
        middleName: value.middleName || undefined,
        lastName: value.lastName,
        ssn: value.ssn,
        dob: value.dob,
        ficoScore: Number(value.ficoScore),
        address: {
          line1: value.addrLine1,
          line2: value.addrLine2 || undefined,
          line3: value.addrLine3 || undefined,
          state: value.addrState,
          country: value.addrCountry,
          zip: value.addrZip
        },
        phone1: value.phone1 || undefined,
        phone2: value.phone2 || undefined,
        govtId: value.govtId || undefined,
        eftAccountId: value.eftAccountId || undefined,
        primaryHolderInd: value.primaryHolderInd || undefined
      }
    };
    this.api.updateAccount(String(value.acctId), payload).subscribe({
      next: () => this.message = 'Account updated',
      error: (e) => this.message = e?.error?.message || 'Failed'
    });
  }
}
