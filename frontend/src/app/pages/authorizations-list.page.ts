import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <h2>Pending Authorizations</h2>
    <p class="intro">View pending credit card authorizations for your accounts.</p>

    <section class="card-section">
      <h3>Authorizations</h3>
      <div class="toolbar">
        <select [(ngModel)]="filterStatus" (change)="loadAuthorizations()">
          <option value="">All Statuses</option>
          <option value="P">Pending</option>
          <option value="M">Matched</option>
          <option value="D">Declined</option>
          <option value="E">Expired</option>
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Auth ID</th>
            <th>Date/Time</th>
            <th>Card Number</th>
            <th>Merchant</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let auth of authorizations">
            <td>{{ auth.authId }}</td>
            <td>{{ auth.authDate }} {{ auth.authTime }}</td>
            <td>{{ maskCardNumber(auth.cardNum) }}</td>
            <td>{{ auth.merchantName }}<br><small>{{ auth.merchantCity }}</small></td>
            <td>{{ auth.transactionAmt | currency:'USD':'symbol':'1.2-2' }}</td>
            <td>
              <span [class]="'status-' + auth.matchStatus">{{ getStatusLabel(auth.matchStatus) }}</span>
              <span *ngIf="auth.authFraud === 'F'" class="fraud-badge">FRAUD</span>
            </td>
            <td>
              <button type="button" [routerLink]="['/authorizations/view', auth.authId]">View</button>
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
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `.card-section{background:rgba(255,255,255,.75);border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;box-shadow:0 6px 16px rgba(15,23,42,.07)}`,
    `.card-section h3{margin:0 0 .75rem;font-size:1.05rem;font-weight:700;color:#0f172a}`,
    `.toolbar{display:flex;gap:.5rem;margin-bottom:1rem}`,
    `.toolbar select{padding:.45rem;border:1px solid rgba(148,163,184,.35);border-radius:8px}`,
    `table{width:100%;border-collapse:collapse;font-size:.9rem}`,
    `thead{background:rgba(241,245,249,.8);border-bottom:1px solid rgba(148,163,184,.2)}`,
    `th,td{padding:.65rem;text-align:left;border-bottom:1px solid rgba(226,232,240,.5)}`,
    `th{font-weight:600;color:#475569;font-size:.85rem;text-transform:uppercase;letter-spacing:.03em}`,
    `tbody tr:hover{background:rgba(248,250,252,.7)}`,
    `button{padding:.45rem 1rem;background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;border:none;border-radius:8px;font-size:.9rem;cursor:pointer;transition:box-shadow .15s ease}`,
    `button:hover:not(:disabled){box-shadow:0 4px 12px rgba(59,130,246,.35)}`,
    `button:disabled{opacity:.5;cursor:not-allowed}`,
    `.pager{display:flex;gap:.75rem;align-items:center;margin-top:1rem;justify-content:center}`,
    `.status-P{color:#ca8a04;font-weight:600}`,
    `.status-M{color:#16a34a;font-weight:600}`,
    `.status-D{color:#dc2626;font-weight:600}`,
    `.status-E{color:#9ca3af;font-weight:600}`,
    `.fraud-badge{background:#dc2626;color:#fff;padding:.15rem .4rem;border-radius:4px;font-size:.75rem;font-weight:700;margin-left:.5rem}`,
    `.error{color:#dc2626;padding:.75rem;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.2);border-radius:8px;margin-top:1rem}`
  ]
})
export class AuthorizationsListPageComponent implements OnInit {
  authorizations: any[] = [];
  page = 1;
  pageSize = 10;
  total = 0;
  filterStatus = '';
  error = '';

  constructor(private readonly api: ApiService) {}

  get totalPages(): number {
    return Math.ceil(this.total / this.pageSize);
  }

  ngOnInit(): void {
    this.loadAuthorizations();
  }

  loadAuthorizations(): void {
    const params: any = { page: this.page, pageSize: this.pageSize, sort: 'authDate:desc' };
    if (this.filterStatus) params.status = this.filterStatus;
    
    this.api.getAuthorizations(params).subscribe({
      next: (res) => {
        this.authorizations = res?.items || [];
        this.total = res?.total || 0;
        this.error = '';
      },
      error: () => {
        this.error = 'Failed to load authorizations';
        this.authorizations = [];
      }
    });
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.loadAuthorizations();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.loadAuthorizations();
    }
  }

  maskCardNumber(cardNum: string): string {
    if (!cardNum || cardNum.length < 4) return cardNum;
    return '****-****-****-' + cardNum.slice(-4);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'P': 'Pending',
      'M': 'Matched',
      'D': 'Declined',
      'E': 'Expired'
    };
    return labels[status] || status;
  }
}
