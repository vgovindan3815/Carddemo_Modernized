import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <h2>Transaction View</h2>
    <div class="actions">
      <a class="back-link" routerLink="/transactions">Back to Transactions</a>
    </div>
    <p class="intro">Review full transaction and merchant information.</p>
    <section *ngIf="data">
      <table>
        <tbody>
          <tr><th>Transaction ID</th><td>{{ data.tranId }}</td></tr>
          <tr><th>Type Code</th><td>{{ data.tranTypeCd }}</td></tr>
          <tr><th>Category Code</th><td>{{ data.tranCatCd }}</td></tr>
          <tr><th>Source</th><td>{{ data.source }}</td></tr>
          <tr><th>Description</th><td>{{ data.description }}</td></tr>
          <tr><th>Amount</th><td>{{ data.amount | currency:'USD':'symbol':'1.2-2' }}</td></tr>
          <tr><th>Merchant ID</th><td>{{ data.merchantId }}</td></tr>
          <tr><th>Merchant Name</th><td>{{ data.merchantName }}</td></tr>
          <tr><th>Merchant City</th><td>{{ data.merchantCity }}</td></tr>
          <tr><th>Merchant ZIP</th><td>{{ data.merchantZip }}</td></tr>
          <tr><th>Card Number</th><td>{{ data.cardNum }}</td></tr>
          <tr><th>Original Timestamp</th><td>{{ data.origTs | date:'medium' }}</td></tr>
          <tr><th>Processed Timestamp</th><td>{{ data.procTs | date:'medium' }}</td></tr>
        </tbody>
      </table>
    </section>
    <p class="muted" *ngIf="!data">Loading transaction...</p>
  `,
  styles: [
    `.actions{margin:0 0 .65rem}`,
    `.back-link{display:inline-block;text-decoration:none}`,
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `.muted{color:#64748b}`,
    `table{width:100%;border-collapse:collapse;background:#fff}`,
    `th,td{border:1px solid #e2e8f0;padding:.5rem;text-align:left;vertical-align:top}`,
    `tbody th{width:220px;background:#f8fafc}`
  ]
})
export class TransactionViewPageComponent implements OnInit {
  data: any;

  constructor(private readonly route: ActivatedRoute, private readonly api: ApiService) {}

  ngOnInit(): void {
    const tranId = this.route.snapshot.queryParamMap.get('tranId') || 'TXN202602240001';
    this.api.getTransaction(tranId).subscribe((res) => this.data = res);
  }
}
