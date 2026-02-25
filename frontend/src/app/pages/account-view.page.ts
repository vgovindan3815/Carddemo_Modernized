import { AfterViewChecked, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <h2>Account View</h2>
    <p class="intro">Search accounts, inspect details, and proceed to payment workflows.</p>

    <section class="card-section">
      <h3>All Accounts</h3>
      <div class="toolbar">
        <input [(ngModel)]="search" placeholder="Search by account or customer" />
        <button (click)="searchAccounts()">Search</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Account ID</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Balance</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let account of accounts">
            <td>{{ account.acctId }}</td>
            <td>{{ account.firstName || '-' }} {{ account.lastName || '' }}</td>
            <td>{{ account.activeStatus }}</td>
            <td>{{ account.currBal | currency:'USD':'symbol':'1.2-2' }}</td>
            <td>
              <button type="button" (click)="selectAccount(account.acctId)">View</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="pager">
        <button type="button" (click)="prevPage()" [disabled]="page <= 1">Previous</button>
        <span>Page {{ page }} of {{ totalPages }}</span>
        <button type="button" (click)="nextPage()" [disabled]="page >= totalPages">Next</button>
        <span>Total: {{ total }}</span>
      </div>
    </section>

    <p class="error" *ngIf="error">{{ error }}</p>

    <section #detailsAnchor class="card-section" *ngIf="showDetails && data?.account">
      <h3>Account</h3>
      <div class="toolbar">
        <a *ngIf="(data?.cards?.length || 0) > 0" [routerLink]="['/billing/payment']" [queryParams]="{ acctId: acctId }">Pay Selected Account</a>
        <a *ngIf="(data?.cards?.length || 0) === 0" [routerLink]="['/billing/payment']" [queryParams]="{ acctId: acctId }">Add Card & Pay</a>
      </div>
      <table>
        <tbody>
          <tr><th>Account ID</th><td>{{ data.account.acctId }}</td></tr>
          <tr><th>Inserted At</th><td>{{ data.account.insertedAt ? (data.account.insertedAt | date:'medium') : '-' }}</td></tr>
          <tr><th>Status</th><td>{{ data.account.activeStatus }}</td></tr>
          <tr><th>Current Balance</th><td>{{ data.account.currBal | currency:'USD':'symbol':'1.2-2' }}</td></tr>
          <tr><th>Credit Limit</th><td>{{ data.account.creditLimit | currency:'USD':'symbol':'1.2-2' }}</td></tr>
          <tr><th>Cash Credit Limit</th><td>{{ data.account.cashCreditLimit | currency:'USD':'symbol':'1.2-2' }}</td></tr>
          <tr><th>Open Date</th><td>{{ data.account.openDate }}</td></tr>
          <tr><th>Expiration Date</th><td>{{ data.account.expirationDate }}</td></tr>
          <tr><th>Reissue Date</th><td>{{ data.account.reissueDate }}</td></tr>
        </tbody>
      </table>
    </section>

    <section class="card-section" *ngIf="showDetails && data?.customer">
      <h3>Customer</h3>
      <div class="toolbar">
        <a [routerLink]="['/accounts/edit']" [queryParams]="{ acctId: acctId, section: 'customer' }">Edit Customer</a>
      </div>
      <table>
        <tbody>
          <tr><th>Customer ID</th><td>{{ data.customer.custId }}</td></tr>
          <tr><th>First Name</th><td>{{ data.customer.firstName }}</td></tr>
          <tr><th>Middle Name</th><td>{{ data.customer.middleName }}</td></tr>
          <tr><th>Last Name</th><td>{{ data.customer.lastName }}</td></tr>
          <tr><th>SSN</th><td>{{ data.customer.ssn }}</td></tr>
          <tr><th>Date of Birth</th><td>{{ data.customer.dob }}</td></tr>
          <tr><th>FICO Score</th><td>{{ data.customer.ficoScore }}</td></tr>
          <tr><th>Address Line 1</th><td>{{ data.customer.address?.line1 }}</td></tr>
          <tr><th>Address Line 2</th><td>{{ data.customer.address?.line2 }}</td></tr>
          <tr><th>Address Line 3</th><td>{{ data.customer.address?.line3 }}</td></tr>
          <tr><th>State</th><td>{{ data.customer.address?.state }}</td></tr>
          <tr><th>Country</th><td>{{ data.customer.address?.country }}</td></tr>
          <tr><th>ZIP</th><td>{{ data.customer.address?.zip }}</td></tr>
          <tr><th>Phone 1</th><td>{{ data.customer.phone1 }}</td></tr>
          <tr><th>Phone 2</th><td>{{ data.customer.phone2 }}</td></tr>
          <tr><th>Govt ID</th><td>{{ data.customer.govtId }}</td></tr>
          <tr><th>EFT Account ID</th><td>{{ data.customer.eftAccountId }}</td></tr>
          <tr><th>Primary Holder</th><td>{{ data.customer.primaryHolderInd }}</td></tr>
        </tbody>
      </table>
    </section>

    <section class="card-section" *ngIf="showDetails">
      <h3>Cards on File</h3>

      <div *ngIf="data?.cards?.length > 1" class="toolbar">
        <label>
          Select Card
          <select [(ngModel)]="selectedCardNum" (ngModelChange)="loadSelectedCard()">
            <option *ngFor="let card of data.cards" [value]="card.cardNum">{{ card.cardNum }}</option>
          </select>
        </label>
      </div>

      <table *ngIf="selectedCardDetail">
        <tbody>
          <tr><th>Card Number</th><td>{{ selectedCardDetail.cardNum }}</td></tr>
          <tr><th>Status</th><td>{{ selectedCardDetail.activeStatus }}</td></tr>
          <tr><th>Embossed Name</th><td>{{ selectedCardDetail.embossedName }}</td></tr>
          <tr><th>Expiration Date</th><td>{{ selectedCardDetail.expirationDate }}</td></tr>
        </tbody>
      </table>

      <div *ngIf="data?.cards?.length === 0" class="no-card">
        <p>No credit card is available for this account.</p>
        <a [routerLink]="['/billing/payment']" [queryParams]="{ acctId: acctId }">Add Card & Pay</a>
      </div>
    </section>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `.card-section{margin-top:1rem}`,
    `.toolbar{display:flex;gap:.5rem;margin-bottom:.75rem}`,
    `table{width:100%;border-collapse:collapse;background:var(--surface-strong)}`,
    `th,td{border:1px solid var(--line);padding:.5rem;text-align:left;vertical-align:top}`,
    `tbody th{width:220px;background:rgba(226,232,240,.52);color:var(--text)}`,
    `.pager{display:flex;gap:.75rem;align-items:center;margin-top:.5rem}`,
    `.no-card{padding:.95rem;background:var(--surface);border:1px solid var(--line);border-radius:12px}`,
    `a{align-self:center}`,
    `.error{color:#b91c1c}`
  ]
})
export class AccountViewPageComponent implements AfterViewChecked {
  @ViewChild('detailsAnchor') detailsAnchor?: ElementRef<HTMLElement>;
  private pendingScroll = false;
  acctId = '';
  search = '';
  accounts: any[] = [];
  data: any = null;
  error = '';
  page = 1;
  pageSize = 10;
  total = 0;
  showDetails = false;
  selectedCardNum = '';
  selectedCardDetail: any = null;

  constructor(private readonly api: ApiService) {
    this.loadAccounts();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  loadAccounts(): void {
    this.api.getAccounts({ search: this.search || undefined, page: this.page, pageSize: this.pageSize, sort: 'acctId:asc' }).subscribe({
      next: (res) => {
        this.accounts = res.items || [];
        this.total = Number(res.total || 0);
        this.page = Number(res.page || this.page);
      },
      error: () => {
        this.accounts = [];
        this.total = 0;
      }
    });
  }

  searchAccounts(): void {
    this.page = 1;
    this.loadAccounts();
  }

  prevPage(): void {
    if (this.page <= 1) return;
    this.page -= 1;
    this.loadAccounts();
  }

  nextPage(): void {
    if (this.page >= this.totalPages) return;
    this.page += 1;
    this.loadAccounts();
  }

  selectAccount(acctId: number): void {
    this.acctId = String(acctId);
    this.load();
  }

  load(): void {
    this.error = '';
    this.showDetails = true;
    this.selectedCardNum = '';
    this.selectedCardDetail = null;
    this.api.getAccount(this.acctId).subscribe({
      next: (res) => {
        this.data = res;
        this.pendingScroll = true;
        const cards = this.data?.cards || [];
        if (cards.length > 0) {
          this.selectedCardNum = cards[0].cardNum;
          this.loadSelectedCard();
        }
      },
      error: (err) => {
        this.data = null;
        this.pendingScroll = false;
        this.error = err?.error?.message || 'Unable to load account details';
      }
    });
  }

  ngAfterViewChecked(): void {
    if (!this.pendingScroll || !this.detailsAnchor) return;
    this.pendingScroll = false;
    this.detailsAnchor.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  loadSelectedCard(): void {
    if (!this.selectedCardNum) {
      this.selectedCardDetail = null;
      return;
    }
    this.api.getCard(this.selectedCardNum).subscribe({
      next: (res) => this.selectedCardDetail = res?.card || null,
      error: () => this.selectedCardDetail = null
    });
  }
}
