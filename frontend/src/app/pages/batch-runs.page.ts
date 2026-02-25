import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <h2>Job Runs</h2>
    <p class="intro">Track submitted batch runs and drill into details, logs, and artifacts.</p>

    <div class="toolbar">
      <input [(ngModel)]="filters.jobName" placeholder="Job Name" />
      <select [(ngModel)]="filters.status">
        <option value="">All statuses</option>
        <option value="queued">queued</option>
        <option value="running">running</option>
        <option value="succeeded">succeeded</option>
        <option value="failed">failed</option>
        <option value="cancelled">cancelled</option>
      </select>
      <select [(ngModel)]="filters.hasRetryPolicy">
        <option value="">All retry policies</option>
        <option value="true">With retry policy</option>
        <option value="false">Without retry policy</option>
      </select>
      <input type="number" min="1" [(ngModel)]="filters.minMaxAttempts" placeholder="Min max attempts" />
      <label>From <input type="date" [(ngModel)]="filters.from" /></label>
      <label>To <input type="date" [(ngModel)]="filters.to" /></label>
      <button type="button" (click)="search()">Search</button>
      <button type="button" (click)="clear()">Clear</button>
      <a routerLink="/batch/submit">Submit Batch Job</a>
    </div>

    <table *ngIf="items.length > 0">
      <thead>
        <tr>
          <th>Job</th>
          <th>Job Run ID</th>
          <th>Retry Policy</th>
          <th>Start</th>
          <th>End</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let item of items">
          <td>{{ item.jobName }}</td>
          <td>{{ item.jobRunId }}</td>
          <td><span class="policy" [title]="item.retryPolicyDetail || item.retryPolicySummary">{{ item.retryPolicySummary || 'n/a' }}</span></td>
          <td>{{ item.startedAt || '-' }}</td>
          <td>{{ item.endedAt || '-' }}</td>
          <td><span class="status" [class]="'status status-' + item.status">{{ item.status }}</span></td>
          <td class="actions">
            <a [routerLink]="['/batch/runs', item.jobRunId]">View Detail</a>
            <a [routerLink]="['/batch/runs', item.jobRunId]" [queryParams]="{ view: 'logs' }">View Logs</a>
            <a [routerLink]="['/batch/runs', item.jobRunId]" [queryParams]="{ view: 'artifacts' }">View Artifacts</a>
            <button type="button" *ngIf="canCancel(item)" (click)="cancelRun(item)">Cancel</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="pager" *ngIf="items.length > 0 || total > 0">
      <button type="button" (click)="prevPage()" [disabled]="page <= 1">Previous</button>
      <span>Page {{ page }} of {{ totalPages }}</span>
      <button type="button" (click)="nextPage()" [disabled]="page >= totalPages">Next</button>
      <span>Total: {{ total }}</span>
    </div>

    <p class="muted" *ngIf="items.length === 0">No batch runs found.</p>

    <h3>Capability Matrix</h3>
    <div class="toolbar">
      <select [(ngModel)]="matrixClassificationFilter">
        <option value="">All classifications</option>
        <option value="real-worker">real-worker</option>
        <option value="mixed">mixed</option>
        <option value="simulated/log-only">simulated/log-only</option>
        <option value="needs-attention">needs-attention</option>
        <option value="unknown">unknown</option>
      </select>
      <button type="button" (click)="loadMatrix()">Refresh Matrix</button>
      <span class="muted">Generated: {{ matrixGeneratedAt || '-' }}</span>
    </div>

    <table *ngIf="filteredMatrixItems.length > 0">
      <thead>
        <tr>
          <th>Job</th>
          <th>Classification</th>
          <th>Latest Run</th>
          <th>Artifact Types</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let item of filteredMatrixItems">
          <td><button type="button" class="link-btn" (click)="applyJobFilter(item.jobName)">{{ item.jobName }}</button></td>
          <td>{{ item.classification }}</td>
          <td>
            <ng-container *ngIf="item.latestRun?.jobRunId; else noRun">
              <a [routerLink]="['/batch/runs', item.latestRun.jobRunId]">{{ item.latestRun.jobRunId }}</a>
              ({{ item.latestRun?.status || 'n/a' }})
            </ng-container>
            <ng-template #noRun>-</ng-template>
          </td>
          <td>{{ item.artifactTypes?.join(', ') || '-' }}</td>
          <td>{{ item.reason || '-' }}</td>
        </tr>
      </tbody>
    </table>

    <p class="muted" *ngIf="filteredMatrixItems.length === 0">No capability matrix rows for selected filter.</p>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `.policy{display:inline-block;max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
    `.actions{display:flex;gap:.45rem;flex-wrap:wrap}`,
    `.pager{display:flex;gap:.75rem;align-items:center;margin-top:.5rem}`,
    `.muted{color:#64748b;margin:.75rem 0 0}`,
    `.link-btn{background:none;border:0;padding:0;color:#2563eb;cursor:pointer;text-decoration:underline}`,
    `.status{display:inline-flex;padding:.18rem .5rem;border-radius:999px;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em}`,
    `.status-queued{background:#e0f2fe;color:#0c4a6e}`,
    `.status-running{background:#fef3c7;color:#92400e}`,
    `.status-succeeded{background:#dcfce7;color:#166534}`,
    `.status-failed{background:#fee2e2;color:#991b1b}`,
    `.status-cancelled{background:#e2e8f0;color:#334155}`
  ]
})
export class BatchRunsPageComponent implements OnInit {
  items: any[] = [];
  matrixItems: any[] = [];
  matrixGeneratedAt = '';
  matrixClassificationFilter = '';
  filters = {
    jobName: '',
    status: '',
    hasRetryPolicy: '',
    minMaxAttempts: '' as string | number,
    from: '',
    to: ''
  };
  page = 1;
  pageSize = 20;
  total = 0;

  constructor(private readonly api: ApiService) {}

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  ngOnInit(): void {
    this.load();
    this.loadMatrix();
  }

  get filteredMatrixItems(): any[] {
    if (!this.matrixClassificationFilter) return this.matrixItems;
    return this.matrixItems.filter((item) => item.classification === this.matrixClassificationFilter);
  }

  search(): void {
    this.page = 1;
    this.load();
  }

  clear(): void {
    this.filters = { jobName: '', status: '', hasRetryPolicy: '', minMaxAttempts: '', from: '', to: '' };
    this.page = 1;
    this.load();
  }

  load(): void {
    const hasRetryPolicy = this.filters.hasRetryPolicy === 'true' ? true : this.filters.hasRetryPolicy === 'false' ? false : undefined;
    const minMaxAttemptsRaw = Number(this.filters.minMaxAttempts);
    const minMaxAttempts = Number.isFinite(minMaxAttemptsRaw) && minMaxAttemptsRaw > 0 ? Math.floor(minMaxAttemptsRaw) : undefined;

    this.api.getBatchRuns({
      page: this.page,
      pageSize: this.pageSize,
      jobName: this.filters.jobName || undefined,
      status: this.filters.status || undefined,
      hasRetryPolicy,
      minMaxAttempts,
      from: this.filters.from || undefined,
      to: this.filters.to || undefined
    }).subscribe((res) => {
      this.items = res.items || [];
      this.total = Number(res.total || 0);
      this.page = Number(res.page || this.page);
    });
  }

  loadMatrix(): void {
    this.api.getBatchCapabilityMatrix({ previewChars: 120 }).subscribe((res) => {
      this.matrixItems = res.items || [];
      this.matrixGeneratedAt = res.generatedAt || '';
    });
  }

  applyJobFilter(jobName: string): void {
    this.filters.jobName = jobName || '';
    this.page = 1;
    this.load();
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

  canCancel(item: any): boolean {
    return item?.status === 'queued' || item?.status === 'running';
  }

  cancelRun(item: any): void {
    if (!item?.jobRunId) return;
    this.api.cancelBatchRun(item.jobRunId, 'Cancelled from Job Runs page').subscribe({
      next: () => this.load(),
      error: () => this.load()
    });
  }
}
