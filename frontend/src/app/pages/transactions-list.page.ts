import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { SessionStoreService } from '../core/session.store';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <h2>Transactions</h2>
    <p class="intro">{{ isAdmin ? 'Use Search or All Transactions to navigate records.' : 'Search card transactions and open individual transaction details.' }}</p>
    <div class="toolbar">
      <input [(ngModel)]="cardNum" [placeholder]="isAdmin ? 'Card Number (optional)' : 'Card Number'" />
      <button (click)="search()">Search</button>
      <button type="button" *ngIf="isAdmin" (click)="loadAll()">All Transactions</button>
      <label class="page-size" *ngIf="isAdmin">
        Rows
        <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()">
          <option *ngFor="let size of pageSizeOptions" [ngValue]="size">{{ size }}</option>
        </select>
      </label>
      <a routerLink="/transactions/new">Add Transaction</a>
    </div>
    <table *ngIf="items.length > 0">
      <thead><tr><th>Tran ID</th><th>Type</th><th>Amount</th><th>Merchant</th><th>Action</th></tr></thead>
      <tbody><tr *ngFor="let t of items"><td>{{ t.tranId }}</td><td>{{ t.tranTypeCd }}</td><td>{{ t.amount | currency:'USD':'symbol':'1.2-2' }}</td><td>{{ t.merchantName }}</td><td><a [routerLink]="['/transactions/view']" [queryParams]="{tranId:t.tranId}">View</a></td></tr></tbody>
    </table>
    <div class="pager" *ngIf="items.length > 0 || total > 0">
      <button type="button" (click)="prevPage()" [disabled]="page <= 1">Previous</button>
      <span>Page {{ page }} of {{ totalPages }}</span>
      <button type="button" (click)="nextPage()" [disabled]="page >= totalPages">Next</button>
      <span>Total: {{ total }}</span>
    </div>
    <p class="muted" *ngIf="items.length === 0">{{ isAdmin ? 'No transactions found.' : 'No transactions found for the selected card.' }}</p>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `.page-size{display:flex;align-items:center;gap:.35rem}`,
    `.page-size select{width:auto;min-width:88px}`,
    `.pager{display:flex;gap:.75rem;align-items:center;margin-top:.5rem}`,
    `.muted{color:#64748b;margin:.75rem 0 0}`
  ]
})
export class TransactionsListPageComponent implements OnInit {
  cardNum = '';
  items: any[] = [];
  page = 1;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50];
  total = 0;

  constructor(private readonly api: ApiService, private readonly session: SessionStoreService) {}

  get isAdmin(): boolean {
    return this.session.isAdmin();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  ngOnInit(): void {
    if (!this.isAdmin) {
      this.cardNum = '4444333322221111';
    }
    this.load();
  }

  search(): void {
    this.page = 1;
    this.load();
  }

  onPageSizeChange(): void {
    this.page = 1;
    this.load();
  }

  loadAll(): void {
    this.cardNum = '';
    this.page = 1;
    this.load();
  }

  load(): void {
    const cardNum = this.isAdmin ? (this.cardNum?.trim() || undefined) : this.cardNum;
    this.api.getTransactions({ cardNum, page: this.page, pageSize: this.pageSize, sort: 'procTs:desc' }).subscribe((res) => {
      this.items = res.items || [];
      this.total = Number(res.total || 0);
      this.page = Number(res.page || this.page);
    });
  }

  prevPage(): void {
    if (this.page <= 1) return;
    this.page -= 1;
    this.load();
  }

  nextPage(): void {
    if (this.page >= this.totalPages) return;
    this.page += 1;
    this.load();
  }
}
