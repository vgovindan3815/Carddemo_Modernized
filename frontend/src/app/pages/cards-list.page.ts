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
    <h2>Cards</h2>
    <p class="intro">{{ isAdmin ? 'Use Search or All Cards to navigate records.' : 'Search cards by account and open card details or update flow.' }}</p>
    <div class="toolbar">
      <input [(ngModel)]="acctId" [placeholder]="isAdmin ? 'Account ID (optional)' : 'Account ID'" />
      <button (click)="search()">Search</button>
      <button type="button" *ngIf="isAdmin" (click)="loadAll()">All Cards</button>
      <label class="page-size" *ngIf="isAdmin">
        Rows
        <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()">
          <option *ngFor="let size of pageSizeOptions" [ngValue]="size">{{ size }}</option>
        </select>
      </label>
    </div>
    <table *ngIf="items.length > 0">
      <thead><tr><th>Card</th><th>Account</th><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        <tr *ngFor="let c of items"><td>{{ c.cardNum }}</td><td>{{ c.acctId }}</td><td>{{ c.embossedName }}</td><td>{{ c.activeStatus }}</td><td><a [routerLink]="['/cards/view']" [queryParams]="{cardNum:c.cardNum}">View</a> | <a [routerLink]="['/cards/edit']" [queryParams]="{cardNum:c.cardNum}">Edit</a></td></tr>
      </tbody>
    </table>
    <div class="pager" *ngIf="items.length > 0 || total > 0">
      <button type="button" (click)="prevPage()" [disabled]="page <= 1">Previous</button>
      <span>Page {{ page }} of {{ totalPages }}</span>
      <button type="button" (click)="nextPage()" [disabled]="page >= totalPages">Next</button>
      <span>Total: {{ total }}</span>
    </div>
    <p class="muted" *ngIf="items.length === 0">{{ isAdmin ? 'No cards found.' : 'No cards found for the selected account.' }}</p>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `.page-size{display:flex;align-items:center;gap:.35rem}`,
    `.page-size select{width:auto;min-width:88px}`,
    `.pager{display:flex;gap:.75rem;align-items:center;margin-top:.5rem}`,
    `.muted{color:#64748b;margin:.75rem 0 0}`
  ]
})
export class CardsListPageComponent implements OnInit {
  acctId = '';
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
      this.acctId = '10000000001';
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
    this.acctId = '';
    this.page = 1;
    this.load();
  }

  load(): void {
    const acctId = this.isAdmin ? (this.acctId?.trim() || undefined) : this.acctId;
    this.api.getCards({ acctId, page: this.page, pageSize: this.pageSize, sort: 'cardNum:asc' }).subscribe((res) => {
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
