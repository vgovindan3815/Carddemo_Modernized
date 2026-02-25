import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionStoreService } from './session.store';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const session = inject(SessionStoreService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        session.setUser(null);
        router.navigate(['/signon']);
      }
      if (error.status === 403) {
        router.navigate(['/menu']);
      }
      return throwError(() => error);
    })
  );
};
