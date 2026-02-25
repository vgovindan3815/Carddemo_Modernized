import { Injectable, signal } from '@angular/core';

export type SessionUser = {
  userId: string;
  userType: 'A' | 'U';
  permissions?: string[];
};

@Injectable({ providedIn: 'root' })
export class SessionStoreService {
  readonly user = signal<SessionUser | null>(null);

  setUser(user: SessionUser | null): void {
    this.user.set(user);
  }

  isAuthenticated(): boolean {
    return !!this.user();
  }

  isAdmin(): boolean {
    return this.user()?.userType === 'A';
  }
}
