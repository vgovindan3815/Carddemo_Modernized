import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h2>{{ title }}</h2>
    <p class="intro" *ngIf="mode !== 'delete'">Provide user details and submit the request.</p>
    <form [formGroup]="form" (ngSubmit)="submit()" *ngIf="mode !== 'delete'">
      <label>User ID <input formControlName="userId" [readonly]="mode==='edit'" /></label>
      <label>First Name <input formControlName="firstName" /></label>
      <label>Last Name <input formControlName="lastName" /></label>
      <label>Password <input type="password" formControlName="password" /></label>
      <label>User Type
        <select formControlName="userType"><option>A</option><option>U</option></select>
      </label>
      <button type="submit" [disabled]="form.invalid">{{ mode === 'new' ? 'Create' : 'Update' }}</button>
      <p class="error" *ngIf="error">{{ error }}</p>
    </form>

    <div *ngIf="mode === 'delete'" class="delete-block">
      <p>Delete user: <strong>{{ userId }}</strong>?</p>
      <button (click)="deleteUser()">Delete</button>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `.error{margin:0;color:#b91c1c}`,
    `form{display:grid;max-width:560px;gap:.7rem}`,
    `.delete-block{max-width:560px}`
  ]
})
export class UserFormPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  mode: 'new' | 'edit' | 'delete' = 'new';
  title = 'User';
  userId = '';
  error = '';

  readonly form = this.fb.group({
    userId: ['', Validators.required],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    password: ['', Validators.required],
    userType: ['U', Validators.required]
  });

  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly api: ApiService) {}

  ngOnInit(): void {
    this.mode = (this.route.snapshot.data['mode'] as any) || 'new';
    this.userId = this.route.snapshot.paramMap.get('userId') || '';
    this.title = this.mode === 'new' ? 'Add User' : this.mode === 'edit' ? 'Edit User' : 'Delete User';
    if (this.mode === 'edit') {
      this.api.getUser(this.userId).subscribe((u) => this.form.patchValue({ ...u, password: 'Passw0rd' }));
    }
    if (this.mode !== 'new') {
      this.form.patchValue({ userId: this.userId });
    }
  }

  submit(): void {
    this.error = '';
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    if (this.mode === 'new') {
      this.api.createUser(value).subscribe({ next: () => this.router.navigate(['/users']), error: (e) => this.error = e?.error?.message || 'Failed' });
    } else {
      this.api.updateUser(this.userId, value).subscribe({ next: () => this.router.navigate(['/users']), error: (e) => this.error = e?.error?.message || 'Failed' });
    }
  }

  deleteUser(): void {
    this.api.deleteUser(this.userId).subscribe({ next: () => this.router.navigate(['/users']), error: (e) => this.error = e?.error?.message || 'Failed' });
  }
}
