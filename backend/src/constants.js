const mainMenuOptions = [
  { option: 1, label: 'Account View', route: '/accounts/view', program: 'COACTVWC' },
  { option: 2, label: 'Account Update', route: '/accounts/edit', program: 'COACTUPC' },
  { option: 3, label: 'Credit Card List', route: '/cards', program: 'COCRDLIC' },
  { option: 4, label: 'Credit Card View', route: '/cards/view', program: 'COCRDSLC' },
  { option: 5, label: 'Credit Card Update', route: '/cards/edit', program: 'COCRDUPC' },
  { option: 6, label: 'Transaction List', route: '/transactions', program: 'COTRN00C' },
  { option: 7, label: 'Transaction View', route: '/transactions/view', program: 'COTRN01C' },
  { option: 8, label: 'Transaction Add', route: '/transactions/new', program: 'COTRN02C' },
  { option: 9, label: 'Transaction Reports', route: '/reports/transactions', program: 'CORPT00C' },
  { option: 10, label: 'Bill Payment', route: '/billing/payment', program: 'COBIL00C' },
  { option: 11, label: 'Pending Authorizations', route: '/authorizations', program: 'COPAUS0C' }
];

const adminMenuOptions = [
  { option: 1, label: 'User List (Security)', route: '/users', program: 'COUSR00C' },
  { option: 2, label: 'User Add (Security)', route: '/users/new', program: 'COUSR01C' },
  { option: 3, label: 'User Update (Security)', route: '/users/:userId/edit', program: 'COUSR02C' },
  { option: 4, label: 'User Delete (Security)', route: '/users/:userId/delete', program: 'COUSR03C' }
];

const errorCatalog = {
  requiredUserId: 'Please enter User ID ...',
  requiredPassword: 'Please enter Password ...',
  requiredFirstName: 'First Name can NOT be empty...',
  requiredLastName: 'Last Name can NOT be empty...',
  requiredUserType: 'User Type can NOT be empty...',
  requiredPasswordField: 'Password can NOT be empty...',
  requiredAcctId: 'Acct ID can NOT be empty...',
  requiredTranType: 'Type CD can NOT be empty...',
  requiredTranCategory: 'Category CD can NOT be empty...',
  requiredDescription: 'Description can NOT be empty...',
  requiredAmount: 'Amount can NOT be empty...',
  requiredCardNumber: 'Card Number can NOT be empty...',
  requiredCardExpiry: 'Expiry Date can NOT be empty...',
  requiredCardCvv: 'Secret Code can NOT be empty...',
  wrongPassword: 'Wrong Password. Try again ...',
  duplicateUserId: 'User ID already exist...',
  userNotFound: 'User ID NOT found...',
  invalidConfirm: 'Invalid value. Valid values are (Y/N)...',
  confirmPayment: 'Confirm to make a bill payment...',
  tdqFailure: 'Unable to Write TDQ (JOBS)...'
};

module.exports = {
  mainMenuOptions,
  adminMenuOptions,
  errorCatalog
};
