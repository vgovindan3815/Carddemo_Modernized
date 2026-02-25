import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <h2>Run Detail</h2>

    <div class="toolbar">
      <a routerLink="/batch/runs">Back to Job Runs</a>
      <button type="button" (click)="showLogs()">View Logs</button>
      <button type="button" (click)="showArtifacts()">View Artifacts</button>
      <button type="button" (click)="refresh()">Refresh</button>
      <button type="button" (click)="restart('resume-from-failed-step')" [disabled]="!canRestart || restarting">Resume From Failed</button>
      <button type="button" (click)="restart('rerun-all')" [disabled]="!canRestart || restarting">Rerun All</button>
      <button type="button" (click)="cancel()" [disabled]="!canCancel || restarting">Cancel Run</button>
    </div>

    <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>

    <div *ngIf="run" class="summary-grid">
      <div><strong>Job:</strong> {{ run.jobName }}</div>
      <div><strong>Run ID:</strong> {{ run.jobRunId }}</div>
      <div><strong>Status:</strong> {{ run.status }}</div>
      <div><strong>Run Mode:</strong> {{ run.runMode || '-' }}</div>
      <div><strong>Submitted:</strong> {{ run.submittedAt || '-' }}</div>
      <div><strong>Started:</strong> {{ run.startedAt || '-' }}</div>
      <div><strong>Ended:</strong> {{ run.endedAt || '-' }}</div>
      <div><strong>Exit Code:</strong> {{ run.exitCode ?? '-' }}</div>
      <div><strong>Restart Of:</strong> {{ run.restartOfJobRunId || '-' }}</div>
      <div><strong>Cancel Requested At:</strong> {{ run.cancelRequestedAt || '-' }}</div>
      <div><strong>Cancel Requested By:</strong> {{ run.cancelRequestedBy || '-' }}</div>
      <div><strong>Cancel Reason:</strong> {{ run.cancelReason || '-' }}</div>
    </div>

    <table *ngIf="steps.length > 0">
      <thead>
        <tr>
          <th>Seq</th>
          <th>Step</th>
          <th>Legacy Target</th>
          <th>Attempts</th>
          <th>Backoff (ms)</th>
          <th>Status</th>
          <th>RC</th>
          <th>Start</th>
          <th>End</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let step of steps">
          <td>{{ step.stepSeq }}</td>
          <td>{{ step.stepName }}</td>
          <td>{{ step.target }}</td>
          <td>{{ step.retryMaxAttempts ?? 1 }}</td>
          <td>{{ step.retryBackoffMs ?? 0 }}</td>
          <td>{{ step.status }}</td>
          <td>{{ step.returnCode ?? '-' }}</td>
          <td>{{ step.startedAt || '-' }}</td>
          <td>{{ step.endedAt || '-' }}</td>
        </tr>
      </tbody>
    </table>

    <p class="muted" *ngIf="steps.length === 0">No step records available yet.</p>

    <section class="panel" *ngIf="view === 'logs'">
      <h3>Logs</h3>
      <pre>{{ combinedLog || 'No logs available.' }}</pre>
    </section>

    <section class="panel" *ngIf="view === 'artifacts'">
      <h3>Artifacts</h3>
      <table *ngIf="artifacts.length > 0">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let artifact of artifacts">
            <td>{{ artifact.name }}</td>
            <td>{{ artifact.type }}</td>
            <td>{{ artifact.sizeBytes || '-' }}</td>
            <td>{{ artifact.createdAt || '-' }}</td>
            <td><button type="button" (click)="downloadArtifact(artifact)">Download</button></td>
          </tr>
        </tbody>
      </table>
      <p class="muted" *ngIf="artifacts.length === 0">No artifacts available.</p>
    </section>
  `,
  styles: [
    `.toolbar{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin-bottom:.75rem}`,
    `.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.45rem 1rem;margin:.25rem 0 .9rem}`,
    `.panel{margin-top:.9rem}`,
    `pre{max-height:320px;overflow:auto;background:#0f172a;color:#e2e8f0;border-radius:10px;padding:.8rem}`,
    `.error{color:#b91c1c;margin:0 0 .5rem}`,
    `.muted{color:#64748b}`
  ]
})
export class BatchRunDetailPageComponent implements OnInit {
  runId = '';
  run: any = null;
  steps: any[] = [];
  view: 'none' | 'logs' | 'artifacts' = 'none';
  combinedLog = '';
  artifacts: any[] = [];
  errorMessage = '';
  restarting = false;

  constructor(private readonly api: ApiService, private readonly route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.runId = params['jobRunId'];
      this.refresh();
    });

    this.route.queryParams.subscribe((params) => {
      const desired = params['view'];
      if (desired === 'logs') {
        this.showLogs();
      } else if (desired === 'artifacts') {
        this.showArtifacts();
      }
    });
  }

  refresh(): void {
    if (!this.runId) return;
    this.errorMessage = '';
    this.api.getBatchRunDetail(this.runId).subscribe({
      next: (res) => {
        this.run = res;
        this.steps = res.steps || [];
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to load run details.';
      }
    });
  }

  get canRestart(): boolean {
    const status = this.run?.status;
    return status === 'failed' || status === 'succeeded' || status === 'cancelled';
  }

  get canCancel(): boolean {
    const status = this.run?.status;
    return status === 'queued' || status === 'running';
  }

  restart(mode: 'resume-from-failed-step' | 'rerun-all'): void {
    if (!this.runId || !this.canRestart || this.restarting) return;
    this.restarting = true;
    this.errorMessage = '';
    this.api.restartBatchRun(this.runId, mode).subscribe({
      next: (res) => {
        this.restarting = false;
        this.errorMessage = `Restart queued as ${res.jobRunId}`;
      },
      error: (err) => {
        this.restarting = false;
        this.errorMessage = err?.error?.message || 'Failed to restart run.';
      }
    });
  }

  cancel(): void {
    if (!this.runId || !this.canCancel) return;
    this.restarting = true;
    this.errorMessage = '';
    this.api.cancelBatchRun(this.runId, 'Cancelled from Run Detail page').subscribe({
      next: () => {
        this.restarting = false;
        this.refresh();
      },
      error: (err) => {
        this.restarting = false;
        this.errorMessage = err?.error?.message || 'Failed to cancel run.';
      }
    });
  }

  showLogs(): void {
    if (!this.runId) return;
    this.view = 'logs';
    this.api.getBatchRunLogs(this.runId).subscribe({
      next: (res) => {
        this.combinedLog = res.combinedLog || '';
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to load logs.';
      }
    });
  }

  showArtifacts(): void {
    if (!this.runId) return;
    this.view = 'artifacts';
    this.api.getBatchArtifacts(this.runId).subscribe({
      next: (res) => {
        this.artifacts = res.items || [];
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to load artifacts.';
      }
    });
  }

  downloadArtifact(artifact: any): void {
    this.api.downloadBatchArtifact(this.runId, artifact.artifactId).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = artifact.name || artifact.artifactId;
      link.click();
      URL.revokeObjectURL(url);
    });
  }
}
