import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStoreService } from './session.store';

export const adminGuard: CanActivateFn = () => {
  const session = inject(SessionStoreService);
  const router = inject(Router);

  if (session.isAdmin()) {
    return true;
  }

  return router.createUrlTree(['/menu']);
};
