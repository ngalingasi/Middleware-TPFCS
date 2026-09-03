// ── Auth ──────────────────────────────────────────────────────────────────────
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

// ── OTP login flow (validate-credentials -> send-otp -> verify-otp) ──────────
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

// ── Pagination — matches backend's { data, pagination } shape exactly ────────
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

// ── Bills ──────────────────────────────────────────────────────────────────────
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

// ── Payments ───────────────────────────────────────────────────────────────────
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

// ── Reconciliation ─────────────────────────────────────────────────────────────
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

// ── API Keys ────────────────────────────────────────────────────────────────────
export type ApiKeyStatus = 'ACTIVE' | 'DISABLED';

export interface ApiKeyRecord {
  id: number;
  name: string;
  key_prefix: string;
  status: ApiKeyStatus;
  last_used_at?: string | null;
  created_at: string;
  created_by_username?: string | null;
}

export interface CreatedApiKey {
  id: number;
  name: string;
  key: string; // plaintext - only ever present in the create response
  keyPrefix: string;
  status: ApiKeyStatus;
}

// ── GFS Codes ───────────────────────────────────────────────────────────────────
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

// ── Dashboard ───────────────────────────────────────────────────────────────────
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
