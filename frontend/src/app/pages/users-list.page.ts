import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <h2>Users</h2>
    <p class="intro">Search and manage application users.</p>
    <div class="toolbar">
      <input [(ngModel)]="search" placeholder="Search user" />
      <button (click)="load()">Search</button>
      <a routerLink="/users/new">Add User</a>
    </div>
    <table *ngIf="items.length > 0">
      <thead><tr><th>User ID</th><th>Name</th><th>Type</th><th>Actions</th></tr></thead>
      <tbody>
        <tr *ngFor="let item of items">
          <td>{{ item.userId }}</td>
          <td>{{ item.firstName }} {{ item.lastName }}</td>
          <td>{{ item.userType }}</td>
          <td>
            <a [routerLink]="['/users', item.userId, 'edit']">Edit</a> |
            <a [routerLink]="['/users', item.userId, 'delete']">Delete</a>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="muted" *ngIf="items.length === 0">No users found for the current search.</p>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `.toolbar{display:flex;gap:.5rem;margin-bottom:.75rem}`,
    `.muted{color:#64748b;margin:.75rem 0 0}`,
    `table{width:100%;border-collapse:collapse}`,
    `th,td{border:1px solid #e2e8f0;padding:.5rem;text-align:left}`
  ]
})
export class UsersListPageComponent implements OnInit {
  items: any[] = [];
  search = '';

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getUsers({ search: this.search || undefined }).subscribe((res) => this.items = res.items || []);
  }
}
