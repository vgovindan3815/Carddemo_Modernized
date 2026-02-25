import { Routes } from '@angular/router';
import { SignonPageComponent } from './pages/signon.page';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';
import { AuthenticatedLayoutComponent } from './layout/authenticated-layout.component';
import { MenuPageComponent } from './pages/menu.page';
import { AdminPageComponent } from './pages/admin.page';
import { UsersListPageComponent } from './pages/users-list.page';
import { UserFormPageComponent } from './pages/user-form.page';
import { AccountViewPageComponent } from './pages/account-view.page';
import { AccountEditPageComponent } from './pages/account-edit.page';
import { CardsListPageComponent } from './pages/cards-list.page';
import { CardViewPageComponent } from './pages/card-view.page';
import { CardEditPageComponent } from './pages/card-edit.page';
import { TransactionsListPageComponent } from './pages/transactions-list.page';
import { TransactionViewPageComponent } from './pages/transaction-view.page';
import { TransactionNewPageComponent } from './pages/transaction-new.page';
import { BillPaymentPageComponent } from './pages/bill-payment.page';
import { ReportRequestPageComponent } from './pages/report-request.page';
import { BatchSubmitPageComponent } from './pages/batch-submit.page';
import { BatchRunsPageComponent } from './pages/batch-runs.page';
import { BatchRunDetailPageComponent } from './pages/batch-run-detail.page';
import { AuthorizationsListPageComponent } from './pages/authorizations-list.page';
import { AuthorizationViewPageComponent } from './pages/authorization-view.page';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'signon' },
	{ path: 'signon', component: SignonPageComponent },
	{
		path: '',
		component: AuthenticatedLayoutComponent,
		canActivate: [authGuard],
		children: [
			{ path: 'menu', component: MenuPageComponent },
			{ path: 'admin', component: AdminPageComponent, canActivate: [adminGuard] },
			{ path: 'users', component: UsersListPageComponent, canActivate: [adminGuard] },
			{ path: 'users/new', component: UserFormPageComponent, canActivate: [adminGuard], data: { mode: 'new' } },
			{ path: 'users/:userId/edit', component: UserFormPageComponent, canActivate: [adminGuard], data: { mode: 'edit' } },
			{ path: 'users/:userId/delete', component: UserFormPageComponent, canActivate: [adminGuard], data: { mode: 'delete' } },
			{ path: 'accounts/view', component: AccountViewPageComponent },
			{ path: 'accounts/edit', component: AccountEditPageComponent },
			{ path: 'cards', component: CardsListPageComponent },
			{ path: 'cards/view', component: CardViewPageComponent },
			{ path: 'cards/edit', component: CardEditPageComponent },
			{ path: 'transactions', component: TransactionsListPageComponent },
			{ path: 'transactions/view', component: TransactionViewPageComponent },
			{ path: 'transactions/new', component: TransactionNewPageComponent },
			{ path: 'billing/payment', component: BillPaymentPageComponent },
			{ path: 'reports/transactions', component: ReportRequestPageComponent },
			{ path: 'authorizations', component: AuthorizationsListPageComponent },
			{ path: 'authorizations/view/:authId', component: AuthorizationViewPageComponent },
			{ path: 'batch/submit', component: BatchSubmitPageComponent, canActivate: [adminGuard] },
			{ path: 'batch/runs', component: BatchRunsPageComponent, canActivate: [adminGuard] },
			{ path: 'batch/runs/:jobRunId', component: BatchRunDetailPageComponent, canActivate: [adminGuard] }
		]
	},
	{ path: '**', redirectTo: 'signon' }
];
