import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <h2>Transaction Reports</h2>
    <p class="intro">Submit report requests and track processing status.</p>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label>Report Type
        <select formControlName="reportType">
          <option>MONTHLY</option>
          <option>YEARLY</option>
          <option>CUSTOM</option>
        </select>
      </label>
      <label>Start Date <input type="date" formControlName="startDate" /></label>
      <label>End Date <input type="date" formControlName="endDate" /></label>
      <label>Confirm <select formControlName="confirm"><option>Y</option><option>N</option></select></label>
      <button type="submit" [disabled]="form.invalid">Queue Report</button>
      <p class="success" *ngIf="message && message.startsWith('Queued')">{{ message }}</p>
      <p class="error" *ngIf="message && !message.startsWith('Queued')">{{ message }}</p>
    </form>

    <h3>Request History</h3>
    <table class="history-table" *ngIf="history.length > 0">
      <thead>
        <tr>
          <th>Request</th>
          <th>Type</th>
          <th>Status</th>
          <th>Batch Run</th>
          <th>Submitted</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let item of history">
          <td>#{{ item.requestId }}</td>
          <td>{{ item.reportType }}</td>
          <td>{{ item.status }}</td>
          <td>
            <a *ngIf="item.jobRunId" [routerLink]="['/batch/runs', item.jobRunId]">{{ item.jobRunId }}</a>
            <span *ngIf="!item.jobRunId">-</span>
          </td>
          <td>{{ item.submittedAt | date:'medium' }}</td>
        </tr>
      </tbody>
    </table>
    <p class="muted" *ngIf="history.length === 0">No report requests yet.</p>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `form{display:grid;max-width:520px;gap:.65rem}`,
    `.history-table{width:100%;max-width:960px;border-collapse:collapse;margin-top:.5rem}`,
    `.history-table th,.history-table td{padding:.45rem .6rem;border-bottom:1px solid #e2e8f0;text-align:left}`,
    `.history-table th{font-size:.82rem;color:#475569}`,
    `.muted{color:#64748b}`,
    `.error{margin:0;color:#b91c1c}`,
    `.success{margin:0;color:#166534}`
  ]
})
export class ReportRequestPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  message = '';
  history: any[] = [];

  readonly form = this.fb.group({
    reportType: ['CUSTOM', Validators.required],
    startDate: ['2026-01-01'],
    endDate: ['2026-01-31'],
    confirm: ['Y', Validators.required]
  });

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  submit(): void {
    if (this.form.invalid) return;
    this.api.submitReport(this.form.getRawValue()).subscribe({
      next: (res) => {
        this.message = `Queued request #${res.requestId}`;
        this.loadHistory();
      },
      error: (e) => this.message = e?.error?.message || 'Failed'
    });
  }

  private loadHistory(): void {
    this.api.getReportRequests({ page: 1, pageSize: 20 }).subscribe((res) => this.history = res.items || []);
  }
}
