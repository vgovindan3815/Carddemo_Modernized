import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <h2>Card View</h2>
    <div class="actions">
      <a class="back-link" routerLink="/cards">Back to Cards</a>
    </div>
    <p class="intro">Inspect card information with related account and customer details.</p>
    <section class="card-section" *ngIf="data?.card">
      <h3>Card</h3>
      <table>
        <tbody>
          <tr><th>Card Number</th><td>{{ data.card.cardNum }}</td></tr>
          <tr><th>Embossed Name</th><td>{{ data.card.embossedName }}</td></tr>
          <tr><th>Status</th><td>{{ data.card.activeStatus }}</td></tr>
          <tr><th>Expiration Date</th><td>{{ data.card.expirationDate }}</td></tr>
        </tbody>
      </table>
    </section>

    <section class="card-section" *ngIf="data?.account">
      <h3>Account</h3>
      <table>
        <tbody>
          <tr><th>Account ID</th><td>{{ data.account.acctId }}</td></tr>
          <tr><th>Current Balance</th><td>{{ data.account.currBal | currency:'USD':'symbol':'1.2-2' }}</td></tr>
        </tbody>
      </table>
    </section>

    <section class="card-section" *ngIf="data?.customer">
      <h3>Customer</h3>
      <table>
        <tbody>
          <tr><th>Customer ID</th><td>{{ data.customer.custId }}</td></tr>
          <tr><th>First Name</th><td>{{ data.customer.firstName }}</td></tr>
          <tr><th>Last Name</th><td>{{ data.customer.lastName }}</td></tr>
        </tbody>
      </table>
    </section>
    <p class="muted" *ngIf="!data">Loading card details...</p>
  `,
  styles: [
    `.actions{margin:0 0 .65rem}`,
    `.back-link{display:inline-block;text-decoration:none}`,
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `.card-section{margin-top:1rem}`,
    `.muted{color:#64748b}`,
    `table{width:100%;border-collapse:collapse;background:#fff}`,
    `th,td{border:1px solid #e2e8f0;padding:.5rem;text-align:left;vertical-align:top}`,
    `tbody th{width:220px;background:#f8fafc}`
  ]
})
export class CardViewPageComponent implements OnInit {
  data: any;

  constructor(private readonly route: ActivatedRoute, private readonly api: ApiService) {}

  ngOnInit(): void {
    const cardNum = this.route.snapshot.queryParamMap.get('cardNum') || '4444333322221111';
    this.api.getCard(cardNum).subscribe((res) => this.data = res);
  }
}
