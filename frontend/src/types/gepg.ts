// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GePG types
// └──────────────────────────────────────────────────────────────────────────┘

// Auth
export type GepgRole = 'ADMIN' | 'USER' | 'VIEWER';

export interface GepgUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: GepgRole;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  last_login?: string | null;
  created_at?: string;
}

export interface GepgLoginResponse {
  token: string;
  user: GepgUser;
}

// OTP login flow (validate-credentials -> send-otp -> verify-otp)
export type OtpChannelType = 'email' | 'sms';

export interface OtpChannel {
  type: OtpChannelType;
  display: string; // masked contact, e.g. "ad***@middleware.local"
  label: string;
}

export interface ValidateCredentialsData {
  channels: OtpChannel[];
}

export interface SendOtpData {
  channel: OtpChannelType;
  maskedContact: string;
}

// Pagination — matches backend's { data, pagination } shape exactly
export interface GepgPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface GepgPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: GepgPagination;
}

export interface GepgApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Bills
export type BillStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED' | 'EXPIRED';

export interface BillItem {
  id?: number;
  bill_id?: string;
  billItemRef?: string;
  bill_item_ref?: string;
  useItemRefOnPay?: string;
  use_item_ref_on_pay?: string;
  billItemAmount?: number;
  bill_item_amount?: number;
  billItemEquivAmount?: number;
  bill_item_equiv_amount?: number;
  billItemMiscAmount?: number;
  bill_item_misc_amount?: number;
  gfsCode?: string;
  gfs_code?: string;
}

export interface Bill {
  id?: number;
  bill_id: string;
  sub_sp_code?: string;
  sp_sys_id?: string;
  bill_amount: number;
  misc_amount?: number;
  bill_expiry_date: string;
  payer_id: string;
  payer_name: string;
  payer_cell_num?: string;
  payer_email?: string;
  bill_description?: string;
  currency: string;
  bill_equiv_amount: number;
  reminder_flag?: boolean;
  bill_pay_option: number;
  payment_control_number?: string | null;
  status: BillStatus;
  transaction_status?: string | null;
  transaction_status_code?: string | null;
  item_count?: number;
  items?: BillItem[];
  totalPaid?: number;
  remainingAmount?: number;
  billing_system_code?: string | null;
  external_ref?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateBillPayload {
  billId: string;
  billAmount: number;
  miscAmount?: number;
  billExpiryDate: string;
  payerId: string;
  payerName: string;
  payerCellNumber?: string;
  payerEmail?: string;
  billDescription?: string;
  currency?: string;
  billEquivAmount: number;
  reminderFlag?: boolean;
  billPayOption?: number;
  items: Array<{
    billItemRef: string;
    useItemRefOnPay?: string;
    billItemAmount: number;
    billItemEquivAmount: number;
    billItemMiscAmount?: number;
    gfsCode: string;
  }>;
}

// Payments
export type PaymentType = 'OFFLINE' | 'ONLINE';
export type PaymentStatus = 'PENDING' | 'ACKNOWLEDGED' | 'PROCESSED';

export interface Payment {
  id: number;
  transaction_id: string;
  sp_code?: string;
  pay_ref_id?: string;
  bill_id: string;
  payment_control_number?: string;
  bill_amount?: number;
  paid_amount: number;
  bill_pay_option?: string;
  currency: string;
  transaction_datetime: string;
  used_payment_channel?: string;
  payer_cell_num?: string;
  payer_name?: string;
  payer_email?: string;
  psp_receipt_number?: string;
  psp_name?: string;
  credited_account_number?: string;
  payment_type: PaymentType;
  authorization_code?: string;
  status: PaymentStatus;
  bill_payer_name?: string;
  bill_description?: string;
}

export interface PaymentStatistics {
  total_payments: number;
  total_amount: number;
  online_payments: number;
  offline_payments: number;
  acknowledged_payments: number;
}

// Reconciliation
export type ReconciliationStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ReconciliationRequest {
  id: number;
  reconciliation_request_id: string;
  sp_code?: string;
  sp_sys_id?: string;
  transaction_date: string;
  reconciliation_option: number;
  status: ReconciliationStatus;
  status_code?: string | null;
  created_at?: string;
}

export interface ReconciliationTransaction {
  id: number;
  reconciliation_request_id: string;
  sp_bill_id?: string;
  bill_control_number?: string;
  psp_transaction_id?: string;
  paid_amount?: number;
  currency?: string;
  pay_ref_id?: string;
  transaction_datetime?: string;
  credited_account_number?: string;
  used_payment_channel?: string;
  psp_name?: string;
  psp_code?: string;
  depositor_cell_num?: string;
  depositor_name?: string;
  depositor_email?: string;
  remarks?: string;
}

export interface ReconciliationRequestDetail extends ReconciliationRequest {
  transactions: ReconciliationTransaction[];
}

// API Keys
export type ApiKeyStatus = 'ACTIVE' | 'DISABLED';

export interface ApiKeyRecord {
  id: number;
  name: string;
  key_prefix: string;
  status: ApiKeyStatus;
  last_used_at?: string | null;
  created_at: string;
  created_by_username?: string | null;
  billing_system_id?: number | null;
  billing_system_code?: string | null;
}

export interface CreatedApiKey {
  id: number;
  name: string;
  key: string; // plaintext - only ever present in the create response
  keyPrefix: string;
  status: ApiKeyStatus;
}

// GFS Codes
export type GfsCodeStatus = 'ACTIVE' | 'INACTIVE';

export interface GfsCodeRecord {
  id: number;
  code: string;
  description?: string | null;
  status: GfsCodeStatus;
  created_at?: string;
  updated_at?: string;
  created_by_username?: string | null;
}

// Dashboard
export interface DashboardBillStats {
  total_bills: number;
  pending_bills: number;
  approved_bills: number;
  paid_bills: number;
  cancelled_bills: number;
  total_billed_amount: number;
  total_paid_amount: number;
}

export interface DashboardPaymentStats {
  total_payments: number;
  online_payments: number;
  offline_payments: number;
  total_collected: number;
  today_payments: number;
  today_amount: number;
}

export interface DashboardData {
  bills: DashboardBillStats;
  payments: DashboardPaymentStats;
  recentPayments: Payment[];
  monthlyTrend: Array<{ month: string; payment_count: number; total_amount: number }>;
}

// Printable documents (GET /bills/:id/print, GET /payments/:id/receipt)

export interface PrintInstitution {
  name: string;
  subtitle: string;
}

export interface PrintBillDocument {
  type: 'bill' | 'transfer';
  title: string;
  institution: PrintInstitution;
  logos: { coatOfArms: string; gepg: string };
  bill: {
    controlNumber: string;
    paymentReference: string;
    billReference: string;
    serviceProviderCode: string;
    payerName: string;
    payerPhone: string;
    description: string;
    items: Array<{ no: number; description: string; amount: string }>;
    total: string;
    currency: string;
    amountInWords: string;
    expiresOn: string;
    preparedBy: string;
    collectionCentre: string;
    printedBy: string;
    printedOn: string;
  };
  qr: { image: string | null; payload: Record<string, string>; caption: string } | null;
  payment: { controlNumber: string; mobileMoney: boolean };
  transfer?: {
    beneficiaryName: string;
    bankName: string;
    accountNumber: string;
    swiftCode: string;
    field59: string;
    field70: string;
    beingPaymentFor: string;
  };
  warnings: string[];
}

export interface PrintReceiptDocument {
  type: 'receipt';
  title: string;
  titleSw: string;
  institution: PrintInstitution;
  logos: { coatOfArms: string; gepg: string };
  receipt: {
    receiptNumber: string;
    receivedFrom: string;
    amount: string;
    currency: string;
    amountInWords: string;
    outstandingBalance: string;
    items: Array<{ description: string; amount: string }>;
    totalBilled: string;
    billReference: string;
    controlNumber: string;
    paymentDate: string;
    paymentChannel: string;
    pspName: string;
    issuedBy: string;
    dateIssued: string;
  };
  warnings: string[];
}

// Settings page (GET /settings)
export type SettingSource = 'database' | 'env' | 'default' | 'unset';

export interface SettingField {
  key: string;
  label: string;
  abbr: string;
  meaning: string;
  example: string;
  providedBy: string;
  input: 'text' | 'select';
  options?: Array<{ value: string; label: string }>;
  max?: number;
  hint?: string;
  critical: boolean;
  affects?: string;
  value: string;
  source: SettingSource;
  savedValue: string;
  envValue: string;
}

export interface SettingGroup {
  id: string;
  title: string;
  description: string;
  critical: boolean;
  fields: SettingField[];
}

export interface SettingsData {
  groups: SettingGroup[];
  envOnly: Array<{ name: string; meaning: string }>;
}

export interface SettingChange {
  key: string;
  label: string;
  from: string;
  to: string;
}

export interface CertificateStatus {
  label: string;
  file: string;
  status: 'ok' | 'expiring' | 'expired' | 'missing' | 'unreadable';
  message: string;
  subject?: string;
}

// Billing systems and the outbox
export interface BillingSystem {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  contact?: string | null;
  status: 'ACTIVE' | 'DISABLED';
  callback_url?: string | null;
  retry_window_hours: number;
  created_at: string;
  active_keys: number;
  bill_count: number;
  pending_events: number;
  dead_events: number;
  last_delivered_at?: string | null;
}

export interface BillingSystemList {
  systems: BillingSystem[];
  retryWindows: number[];
  defaultRetryWindow: number;
}

export interface BillingSystemInput {
  code?: string;
  name: string;
  description?: string;
  contact?: string;
  callbackUrl?: string;
  retryWindowHours: number;
  status?: 'ACTIVE' | 'DISABLED';
}

export interface SystemTestResult {
  eventId: number;
  ok: boolean;
  httpStatus: number | null;
  error: string | null;
  response: string;
  durationMs: number;
}

export type EventStatus = 'PENDING' | 'DELIVERED' | 'DEAD' | 'PULL_ONLY';

export interface OutboxEvent {
  id: number;
  type: string;
  bill_id?: string | null;
  delivery_status: EventStatus;
  attempts: number;
  next_attempt_at?: string | null;
  deadline_at?: string | null;
  last_attempt_at?: string | null;
  last_http_status?: number | null;
  last_error?: string | null;
  delivered_at?: string | null;
  created_at: string;
  system_code: string;
  system_name: string;
}

export interface OutboxDelivery {
  id: number;
  attempt: number;
  url?: string | null;
  http_status?: number | null;
  ok: number;
  error?: string | null;
  response_snippet?: string | null;
  duration_ms?: number | null;
  created_at: string;
}

export interface OutboxEventDetail extends OutboxEvent {
  callback_url?: string | null;
  envelope: unknown;
  deliveries: OutboxDelivery[];
}

export type OutboxStats = Record<EventStatus, number>;

// Developer page (GET /developer/docs)
export interface DocParam {
  name: string;
  in: 'path' | 'query';
  required: boolean;
  description: string;
  example: string;
}

export interface DocField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example: unknown;
}

export interface DocResponse {
  status: number;
  title: string;
  body: unknown;
}

export interface DocEndpoint {
  id: string;
  group: string;
  method: string;
  path: string;
  url: string;
  title: string;
  summary: string;
  notes?: string[];
  params?: DocParam[];
  body?: { description: string; fields: DocField[]; example: unknown };
  responses: DocResponse[];
  curl: string;
}

export interface DocGroup {
  id: string;
  title: string;
  description: string;
  endpoints: DocEndpoint[];
}

export interface DocEvent {
  type: string;
  when: string;
  sample: unknown;
  sampleText: string;
}

export interface DeveloperDocs {
  title: string;
  baseUrl: string;
  code: string;
  system: { code: string; name: string; callbackUrl: string } | null;
  gettingStarted: Array<{ title: string; text: string }>;
  authentication: { header: string; text: string; rules: string[] };
  groups: DocGroup[];
  events: DocEvent[];
  delivery: {
    summary: string;
    callbackUrl: string;
    headers: Array<{ name: string; description: string; example: string }>;
    verify: { steps: string[]; samples: Record<string, string>; receiverSamples: Record<string, string> };
    testVector: { description: string; secret: string; timestamp: number; body: string; signedText: string; signature: string; header: string };
    sampleRequest: { text: string; body: string; bodyPretty: string };
    sampleResponses: Array<{ status: number; title: string; text: string; result: string }>;
    failures: string[];
    retries: { schedule: Array<{ afterAttempt: number; wait: string }>; scheduleText: string; windows: Array<{ hours: number; text: string; default: boolean }>; text: string };
    rules: string[];
  };
  errors: { http: Array<{ status: number; meaning: string }>; codesNote: string; gepgCodes: Array<{ code: string; description: string }> };
}

export interface DeveloperData {
  docs: DeveloperDocs;
  systems: Array<{ id: number; code: string; name: string }>;
  files: Array<{ id: string; name: string; audience: 'billing' | 'gepg' }>;
}
