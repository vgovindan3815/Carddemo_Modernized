import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="back-nav">
      <button type="button" class="back-button" [routerLink]="['/authorizations']">
        ← Back to Pending Authorizations
      </button>
    </div>

    <h2>Authorization Details</h2>
    <p class="intro">View detailed information about a pending authorization.</p>

    <div *ngIf="authorization" class="details-container">
      <section class="card-section">
        <h3>Authorization Information</h3>
        <div class="detail-grid">
          <div class="detail-row">
            <span class="label">Authorization ID:</span>
            <span class="value">{{ authorization.authId }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Account ID:</span>
            <span class="value">{{ authorization.acctId }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Card Number:</span>
            <span class="value">{{ maskCardNumber(authorization.cardNum) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Authorization Date:</span>
            <span class="value">{{ authorization.authOrigDate }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Authorization Time:</span>
            <span class="value">{{ authorization.authOrigTime }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Auth Type:</span>
            <span class="value">{{ authorization.authType }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Card Expiry:</span>
            <span class="value">{{ authorization.cardExpiryDate || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Response Code:</span>
            <span class="value" [class.approved]="authorization.authRespCode === '00'" [class.declined]="authorization.authRespCode !== '00'">
              {{ authorization.authRespCode }} {{ authorization.authRespCode === '00' ? '(Approved)' : '(Declined)' }}
            </span>
          </div>
          <div class="detail-row">
            <span class="label">Response Reason:</span>
            <span class="value">{{ authorization.authRespReason || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Match Status:</span>
            <span class="value">{{ getStatusLabel(authorization.matchStatus) }}</span>
          </div>
          <div class="detail-row" *ngIf="authorization.authFraud === 'F'">
            <span class="label">Fraud Status:</span>
            <span class="value fraud-alert">FRAUD CONFIRMED ({{ authorization.fraudRptDate }})</span>
          </div>
        </div>
      </section>

      <section class="card-section">
        <h3>Transaction Details</h3>
        <div class="detail-grid">
          <div class="detail-row">
            <span class="label">Transaction ID:</span>
            <span class="value">{{ authorization.transactionId || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Processing Code:</span>
            <span class="value">{{ authorization.processingCode || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Transaction Amount:</span>
            <span class="value">{{ authorization.transactionAmt | currency:'USD':'symbol':'1.2-2' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Approved Amount:</span>
            <span class="value">{{ authorization.approvedAmt | currency:'USD':'symbol':'1.2-2' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Message Type:</span>
            <span class="value">{{ authorization.messageType || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Message Source:</span>
            <span class="value">{{ authorization.messageSource || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Auth ID Code:</span>
            <span class="value">{{ authorization.authIdCode || 'N/A' }}</span>
          </div>
        </div>
      </section>

      <section class="card-section">
        <h3>Merchant Information</h3>
        <div class="detail-grid">
          <div class="detail-row">
            <span class="label">Merchant ID:</span>
            <span class="value">{{ authorization.merchantId }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Merchant Name:</span>
            <span class="value">{{ authorization.merchantName }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Merchant City:</span>
            <span class="value">{{ authorization.merchantCity || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Merchant State:</span>
            <span class="value">{{ authorization.merchantState || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Merchant ZIP:</span>
            <span class="value">{{ authorization.merchantZip || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Merchant Category:</span>
            <span class="value">{{ authorization.merchantCategoryCode || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Acquirer Country:</span>
            <span class="value">{{ authorization.acqrCountryCode || 'N/A' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">POS Entry Mode:</span>
            <span class="value">{{ authorization.posEntryMode || 'N/A' }}</span>
          </div>
        </div>
      </section>

      <div class="actions">
        <button type="button" *ngIf="authorization.authFraud !== 'F'" (click)="markAsFraud()" class="fraud-button">
          Mark as Fraud
        </button>
        <button type="button" [routerLink]="['/authorizations']">Back to List</button>
      </div>
    </div>

    <p class="error" *ngIf="error">{{ error }}</p>
  `,
  styles: [
    `.back-nav{margin-bottom:1rem}`,
    `.back-button{padding:.5rem 1rem;background:transparent;color:#3b82f6;border:1px solid #3b82f6;border-radius:6px;font-size:.9rem;cursor:pointer;transition:all .15s ease;display:inline-flex;align-items:center;gap:.5rem}`,
    `.back-button:hover{background:#3b82f6;color:#fff;border-color:#3b82f6}`,
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `.details-container{display:flex;flex-direction:column;gap:1.25rem}`,
    `.card-section{background:rgba(255,255,255,.75);border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:1.25rem;box-shadow:0 6px 16px rgba(15,23,42,.07)}`,
    `.card-section h3{margin:0 0 1rem;font-size:1.05rem;font-weight:700;color:#0f172a}`,
    `.detail-grid{display:grid;grid-template-columns:1fr;gap:.85rem}`,
    `.detail-row{display:grid;grid-template-columns:200px 1fr;gap:1rem;padding:.5rem 0;border-bottom:1px solid rgba(226,232,240,.4)}`,
    `.detail-row:last-child{border-bottom:none}`,
    `.label{font-weight:600;color:#475569;font-size:.9rem}`,
    `.value{color:#0f172a;font-size:.9rem}`,
    `.approved{color:#16a34a;font-weight:700}`,
    `.declined{color:#dc2626;font-weight:700}`,
    `.fraud-alert{color:#dc2626;font-weight:700;text-transform:uppercase}`,
    `.actions{display:flex;gap:.75rem;margin-top:1rem}`,
    `button{padding:.55rem 1.25rem;background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;border:none;border-radius:8px;font-size:.95rem;cursor:pointer;transition:box-shadow .15s ease}`,
    `button:hover{box-shadow:0 4px 12px rgba(59,130,246,.35)}`,
    `.fraud-button{background:linear-gradient(135deg,#b91c1c,#dc2626)}`,
    `.fraud-button:hover{box-shadow:0 4px 12px rgba(220,38,38,.35)}`,
    `.error{color:#dc2626;padding:.75rem;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.2);border-radius:8px;margin-top:1rem}`
  ]
})
export class AuthorizationViewPageComponent implements OnInit {
  authorization: any = null;
  error = '';
  authId = '';

  constructor(
    private readonly api: ApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.authId = this.route.snapshot.paramMap.get('authId') || '';
    if (this.authId) {
      this.loadAuthorization();
    } else {
      this.error = 'No authorization ID provided';
    }
  }

  loadAuthorization(): void {
    this.api.getAuthorization(this.authId).subscribe({
      next: (auth) => {
        this.authorization = auth;
        this.error = '';
      },
      error: () => {
        this.error = 'Failed to load authorization details';
      }
    });
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

  markAsFraud(): void {
    if (!confirm('Are you sure you want to mark this authorization as fraudulent?')) {
      return;
    }

    this.api.markAuthorizationFraud(this.authId, { fraudStatus: 'F' }).subscribe({
      next: () => {
        alert('Authorization marked as fraud');
        this.loadAuthorization();
      },
      error: () => {
        this.error = 'Failed to mark authorization as fraud';
      }
    });
  }
}
