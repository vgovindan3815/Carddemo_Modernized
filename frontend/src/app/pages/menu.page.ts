import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <h2>Main Menu</h2>
    <p class="intro">Choose an operation area to continue.</p>
    <div class="grid">
      <a class="tile" *ngFor="let option of options" [routerLink]="option.route">{{ option.option }}. {{ option.label }}</a>
    </div>
  `,
  styles: [
    `.intro{margin:0 0 .85rem;color:#475569}`,
    `.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.9rem}`,
    `.tile{display:block;padding:1rem;border:1px solid rgba(148,163,184,.35);border-radius:12px;text-decoration:none;background:rgba(255,255,255,.7);backdrop-filter:blur(6px);color:#0f172a;font-weight:600;box-shadow:0 10px 24px rgba(15,23,42,.09);transition:transform .08s ease,box-shadow .15s ease}`,
    `.tile:hover{transform:translateY(-1px);box-shadow:0 14px 28px rgba(15,23,42,.13)}`
  ]
})
export class MenuPageComponent implements OnInit {
  options: Array<{ option: number; label: string; route: string }> = [];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.api.getMainMenu().subscribe((res) => this.options = res.options || []);
  }
}
