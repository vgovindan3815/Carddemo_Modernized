import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <h2>Submit Batch Job</h2>
    <p class="intro">Choose a job, provide parameters, and submit a new batch run.</p>

    <div class="card">
      <div class="form-grid">
        <label>
          Job
          <select [(ngModel)]="selectedJobName" (ngModelChange)="onJobChanged()">
            <option value="">Select job</option>
            <option *ngFor="let job of jobs" [value]="job.jobName">{{ job.jobName }} - {{ job.displayName || job.jobName }}</option>
          </select>
        </label>

        <label>
          Run Mode
          <select [(ngModel)]="runMode">
            <option value="manual">manual</option>
            <option value="scheduled">scheduled</option>
            <option value="replay">replay</option>
          </select>
        </label>

        <label>
          Processing Date
          <input type="date" [(ngModel)]="processingDate" />
        </label>

        <label>
          Start Date
          <input type="date" [(ngModel)]="startDate" />
        </label>

        <label>
          End Date
          <input type="date" [(ngModel)]="endDate" />
        </label>

        <label *ngIf="selectedJobName === 'ACCTFILE'">
          Input File Path
          <input type="text" [(ngModel)]="inputFilePath" placeholder="e.g. C:\\data\\ACCTFILE_20260224.txt" />
          <small class="field-help">Relative paths are resolved from the backend workspace root (for example, <code>data/input/acctdata.txt</code>).</small>
        </label>

        <label *ngIf="selectedJobName === 'CUSTFILE'">
          Input File Path
          <input type="text" [(ngModel)]="inputFilePath" placeholder="e.g. C:\\data\\CUSTFILE_20260224.txt" />
          <small class="field-help">Relative paths are resolved from the backend workspace root (for example, <code>data/input/custdata.txt</code>).</small>
        </label>

        <label *ngIf="selectedJobName === 'CARDFILE'">
          Card Input File Path
          <input type="text" [(ngModel)]="cardInputFilePath" placeholder="e.g. C:\\data\\CARDFILE_20260224.txt" />
          <small class="field-help">Relative paths are resolved from the backend workspace root (for example, <code>data/input/carddata.txt</code>).</small>
        </label>

        <label *ngIf="selectedJobName === 'CARDFILE'">
          Card Xref File Path
          <input type="text" [(ngModel)]="xrefInputFilePath" placeholder="e.g. C:\\data\\CARDXREF_20260224.txt" />
          <small class="field-help">Relative paths are resolved from the backend workspace root (for example, <code>data/input/cardxref.txt</code>).</small>
        </label>

        <label *ngIf="selectedJobName === 'TRANBKP'">
          Output Directory Path
          <input type="text" [(ngModel)]="outputDirPath" placeholder="e.g. C:\\data\\backup" />
          <small class="field-help">Relative paths are resolved from the backend workspace root (for example, <code>data/backup</code>).</small>
        </label>
      </div>

      <div class="actions-row">
        <button type="button" (click)="submit()" [disabled]="!selectedJobName || submitting">{{ submitting ? 'Submitting...' : 'Submit' }}</button>
        <a routerLink="/batch/runs">View Job Runs</a>
      </div>

      <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>
      <div class="confirmation" *ngIf="result">
        <strong>Submission queued.</strong>
        <div>Job Run ID: {{ result.jobRunId }}</div>
        <div>Job Name: {{ result.jobName }}</div>
        <div>Status: {{ result.status }}</div>
        <a [routerLink]="['/batch/runs', result.jobRunId]">Open Run Detail</a>
      </div>
    </div>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `.card{display:grid;gap:1rem}`,
    `.form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.85rem}`,
    `.actions-row{display:flex;gap:.6rem;align-items:center}`,
    `.field-help{display:block;margin-top:.3rem;color:#64748b;font-size:.8rem}`,
    `.confirmation{border:1px solid #86efac;background:#f0fdf4;color:#166534;border-radius:10px;padding:.75rem}`,
    `.error{color:#b91c1c;margin:0}`
  ]
})
export class BatchSubmitPageComponent implements OnInit {
  jobs: any[] = [];
  selectedJobName = '';
  runMode = 'manual';
  processingDate = '';
  startDate = '';
  endDate = '';
  inputFilePath = '';
  cardInputFilePath = '';
  xrefInputFilePath = '';
  outputDirPath = '';
  submitting = false;
  errorMessage = '';
  result: any = null;

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.api.getBatchJobs().subscribe((res) => {
      this.jobs = res.items || [];
    });
  }

  onJobChanged(): void {
    this.errorMessage = '';
    this.result = null;
    const selected = this.jobs.find((job) => job.jobName === this.selectedJobName);
    if (!selected) return;
    const defaults = selected.defaultParameters || {};
    this.processingDate = defaults.processingDate || this.processingDate;
    this.startDate = defaults.startDate || this.startDate;
    this.endDate = defaults.endDate || this.endDate;
    this.inputFilePath = defaults.inputFilePath || '';
    this.cardInputFilePath = defaults.cardInputFilePath || '';
    this.xrefInputFilePath = defaults.xrefInputFilePath || '';
    this.outputDirPath = defaults.outputDirPath || '';
    this.runMode = defaults.runMode || this.runMode;
  }

  submit(): void {
    if (!this.selectedJobName) return;

    this.submitting = true;
    this.errorMessage = '';
    this.result = null;

    const parameters: any = {};
    if (this.processingDate) parameters.processingDate = this.processingDate;
    if (this.startDate) parameters.startDate = this.startDate;
    if (this.endDate) parameters.endDate = this.endDate;
    if ((this.selectedJobName === 'ACCTFILE' || this.selectedJobName === 'CUSTFILE') && this.inputFilePath.trim()) {
      parameters.inputFilePath = this.inputFilePath.trim();
    }
    if (this.selectedJobName === 'CARDFILE' && this.cardInputFilePath.trim()) {
      parameters.cardInputFilePath = this.cardInputFilePath.trim();
    }
    if (this.selectedJobName === 'CARDFILE' && this.xrefInputFilePath.trim()) {
      parameters.xrefInputFilePath = this.xrefInputFilePath.trim();
    }
    if (this.selectedJobName === 'TRANBKP' && this.outputDirPath.trim()) {
      parameters.outputDirPath = this.outputDirPath.trim();
    }

    this.api.submitBatchJob(this.selectedJobName, { runMode: this.runMode, parameters }).subscribe({
      next: (res) => {
        this.result = res;
        this.submitting = false;
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err?.error?.message || 'Failed to submit batch job.';
      }
    });
  }
}
