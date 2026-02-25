import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  login(payload: { userId: string; password: string }) {
    return this.http.post<any>(`${this.baseUrl}/auth/login`, payload, { withCredentials: true });
  }

  logout() {
    return this.http.post(`${this.baseUrl}/auth/logout`, {}, { withCredentials: true });
  }

  me() {
    return this.http.get<any>(`${this.baseUrl}/auth/me`, { withCredentials: true });
  }

  getMainMenu() {
    return this.http.get<any>(`${this.baseUrl}/menu/main`, { withCredentials: true });
  }

  getAdminMenu() {
    return this.http.get<any>(`${this.baseUrl}/menu/admin`, { withCredentials: true });
  }

  getUsers(params: { search?: string; page?: number; pageSize?: number; sort?: string }) {
    let httpParams = new HttpParams().set('page', String(params.page ?? 1)).set('pageSize', String(params.pageSize ?? 10));
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    return this.http.get<any>(`${this.baseUrl}/users`, { params: httpParams, withCredentials: true });
  }

  getUser(userId: string) {
    return this.http.get<any>(`${this.baseUrl}/users/${userId}`, { withCredentials: true });
  }

  createUser(payload: any) {
    return this.http.post<any>(`${this.baseUrl}/users`, payload, { withCredentials: true });
  }

  updateUser(userId: string, payload: any) {
    return this.http.put<any>(`${this.baseUrl}/users/${userId}`, payload, { withCredentials: true });
  }

  deleteUser(userId: string) {
    return this.http.delete(`${this.baseUrl}/users/${userId}`, { withCredentials: true });
  }

  getAccount(acctId: string) {
    return this.http.get<any>(`${this.baseUrl}/accounts/${acctId}`, { withCredentials: true });
  }

  getAccounts(params: { search?: string; page?: number; pageSize?: number; sort?: string }) {
    let httpParams = new HttpParams().set('page', String(params.page ?? 1)).set('pageSize', String(params.pageSize ?? 20));
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    return this.http.get<any>(`${this.baseUrl}/accounts`, { params: httpParams, withCredentials: true });
  }

  updateAccount(acctId: string, payload: any) {
    return this.http.put<any>(`${this.baseUrl}/accounts/${acctId}`, payload, { withCredentials: true });
  }

  getCards(params: { acctId?: string; cardNum?: string; page?: number; pageSize?: number; sort?: string }) {
    let httpParams = new HttpParams().set('page', String(params.page ?? 1)).set('pageSize', String(params.pageSize ?? 10));
    if (params.acctId) httpParams = httpParams.set('acctId', params.acctId);
    if (params.cardNum) httpParams = httpParams.set('cardNum', params.cardNum);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    return this.http.get<any>(`${this.baseUrl}/cards`, { params: httpParams, withCredentials: true });
  }

  getCard(cardNum: string) {
    return this.http.get<any>(`${this.baseUrl}/cards/${cardNum}`, { withCredentials: true });
  }

  updateCard(cardNum: string, payload: any) {
    return this.http.put<any>(`${this.baseUrl}/cards/${cardNum}`, payload, { withCredentials: true });
  }

  getTransactions(params: { cardNum?: string; acctId?: string; page?: number; pageSize?: number; sort?: string }) {
    let httpParams = new HttpParams().set('page', String(params.page ?? 1)).set('pageSize', String(params.pageSize ?? 10));
    if (params.cardNum) httpParams = httpParams.set('cardNum', params.cardNum);
    if (params.acctId) httpParams = httpParams.set('acctId', params.acctId);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    return this.http.get<any>(`${this.baseUrl}/transactions`, { params: httpParams, withCredentials: true });
  }

  getTransaction(tranId: string) {
    return this.http.get<any>(`${this.baseUrl}/transactions/${tranId}`, { withCredentials: true });
  }

  createTransaction(payload: any) {
    return this.http.post<any>(`${this.baseUrl}/transactions`, payload, { withCredentials: true });
  }

  postBillPayment(payload: any) {
    return this.http.post<any>(`${this.baseUrl}/billing/payments`, payload, { withCredentials: true });
  }

  submitReport(payload: any) {
    return this.http.post<any>(`${this.baseUrl}/reports/transactions`, payload, { withCredentials: true });
  }

  getReportRequests(params: { page?: number; pageSize?: number; sort?: string }) {
    let httpParams = new HttpParams().set('page', String(params.page ?? 1)).set('pageSize', String(params.pageSize ?? 20));
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    return this.http.get<any>(`${this.baseUrl}/reports/transactions/requests`, { params: httpParams, withCredentials: true });
  }

  getBatchJobs() {
    return this.http.get<any>(`${this.baseUrl}/jobs`, { withCredentials: true });
  }

  getBatchCapabilityMatrix(params?: { previewChars?: number }) {
    let httpParams = new HttpParams();
    if (params?.previewChars !== undefined) httpParams = httpParams.set('previewChars', String(params.previewChars));
    return this.http.get<any>(`${this.baseUrl}/jobs/capability-matrix`, { params: httpParams, withCredentials: true });
  }

  submitBatchJob(jobName: string, payload: { runMode?: string; parameters?: any }) {
    return this.http.post<any>(`${this.baseUrl}/jobs/${encodeURIComponent(jobName)}/submit`, payload, { withCredentials: true });
  }

  getBatchRuns(params: { jobName?: string; status?: string; from?: string; to?: string; hasRetryPolicy?: boolean; minMaxAttempts?: number; page?: number; pageSize?: number }) {
    let httpParams = new HttpParams().set('page', String(params.page ?? 1)).set('pageSize', String(params.pageSize ?? 20));
    if (params.jobName) httpParams = httpParams.set('jobName', params.jobName);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.hasRetryPolicy !== undefined) httpParams = httpParams.set('hasRetryPolicy', String(params.hasRetryPolicy));
    if (params.minMaxAttempts !== undefined) httpParams = httpParams.set('minMaxAttempts', String(params.minMaxAttempts));
    return this.http.get<any>(`${this.baseUrl}/job-runs`, { params: httpParams, withCredentials: true });
  }

  getBatchRunDetail(jobRunId: string) {
    return this.http.get<any>(`${this.baseUrl}/job-runs/${encodeURIComponent(jobRunId)}`, { withCredentials: true });
  }

  getBatchRunLogs(jobRunId: string) {
    return this.http.get<any>(`${this.baseUrl}/job-runs/${encodeURIComponent(jobRunId)}/logs`, { withCredentials: true });
  }

  getBatchArtifacts(jobRunId: string) {
    return this.http.get<any>(`${this.baseUrl}/job-runs/${encodeURIComponent(jobRunId)}/artifacts`, { withCredentials: true });
  }

  downloadBatchArtifact(jobRunId: string, artifactId: string) {
    return this.http.get(`${this.baseUrl}/job-runs/${encodeURIComponent(jobRunId)}/artifacts/${encodeURIComponent(artifactId)}`, {
      withCredentials: true,
      responseType: 'blob'
    });
  }

  restartBatchRun(jobRunId: string, mode: 'resume-from-failed-step' | 'rerun-all') {
    return this.http.post<any>(`${this.baseUrl}/job-runs/${encodeURIComponent(jobRunId)}/restart`, { mode }, { withCredentials: true });
  }

  cancelBatchRun(jobRunId: string, reason?: string) {
    return this.http.post<any>(`${this.baseUrl}/job-runs/${encodeURIComponent(jobRunId)}/cancel`, { reason }, { withCredentials: true });
  }

  getAuthorizations(params: { acctId?: string; cardNum?: string; status?: string; page?: number; pageSize?: number; sort?: string }) {
    let httpParams = new HttpParams().set('page', String(params.page ?? 1)).set('pageSize', String(params.pageSize ?? 10));
    if (params.acctId) httpParams = httpParams.set('acctId', params.acctId);
    if (params.cardNum) httpParams = httpParams.set('cardNum', params.cardNum);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    return this.http.get<any>(`${this.baseUrl}/authorizations`, { params: httpParams, withCredentials: true });
  }

  getAuthorization(authId: string) {
    return this.http.get<any>(`${this.baseUrl}/authorizations/${authId}`, { withCredentials: true });
  }

  markAuthorizationFraud(authId: string, payload: { fraudStatus?: string }) {
    return this.http.put<any>(`${this.baseUrl}/authorizations/${authId}/fraud`, payload, { withCredentials: true });
  }
}
