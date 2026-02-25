import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStoreService } from './session.store';

export const authGuard: CanActivateFn = () => {
  const session = inject(SessionStoreService);
  const router = inject(Router);

  if (session.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/signon']);
};
