// ============================================================
// API Service Layer — Connects to the FastAPI backend
// Backend base URL is controlled by VITE_API_URL env var.
// Falls back to http://localhost:8000 in development.
// ============================================================

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

// ── Shared fetch wrapper ──────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${text}`);
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Types (mirrors Pydantic schemas) ─────────────────────────────────────────

export type AICategory = "high_malicious" | "low_malicious" | "safe";
export type ReviewStatus = "pending" | "reviewed" | "overridden";
export type JobStatus = "running" | "idle" | "paused" | "error";

export interface ThreatIndicator {
  id: number;
  indicator_type: "url" | "domain" | "ip";
  value: string;
  is_malicious: boolean;
}

export interface AuditTrailEntry {
  id: number;
  timestamp: string;
  action: string;
  actor: string;
  detail?: string;
}

/** Compact email used in lists */
export interface Email {
  id: string;
  sender: string;
  sender_domain: string;
  recipient: string;
  subject: string;
  received_at: string;
  ai_category: AICategory;
  confidence_score: number | null;
  review_status: ReviewStatus;
  mailbox_address: string;
}

/** Full email detail */
export interface EmailDetail extends Email {
  graph_message_id?: string;
  body_html?: string;
  body_text?: string;
  ai_reasoning?: string[];
  analyst_category?: string;
  analyst_override_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  similar_email_ids?: string[];
  threat_indicators: ThreatIndicator[];
  audit_trail: AuditTrailEntry[];
  created_at: string;
  updated_at: string;
}

export interface EmailListResponse {
  emails: Email[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TrendDay {
  date: string;
  high_malicious: number;
  low_malicious: number;
  safe: number;
}

export interface IngestionStatus {
  status: JobStatus;
  last_run?: string;
  error_message?: string;
  mailboxes_active: number;
  mailboxes_total: number;
}

export interface DashboardSummary {
  total_today: number;
  high_malicious_today: number;
  low_malicious_today: number;
  safe_today: number;
  pending_review: number;
  trend: TrendDay[];
  ingestion: IngestionStatus;
  recent_high_malicious: Email[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  analyst: string;
  action: string;
  email_id?: string;
  detail?: string;
  previous_category?: string;
  new_category?: string;
}

export interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AccuracyStats {
  ai_agreement_rate: number;
  total_reviewed: number;
  total_overrides: number;
  high_to_low: number;
  high_to_safe: number;
  low_to_high: number;
  low_to_safe: number;
  safe_to_high: number;
  safe_to_low: number;
}

export interface DomainCount {
  domain: string;
  count: number;
}

export interface KeywordCount {
  keyword: string;
  count: number;
}

export interface AnalystActivity {
  analyst: string;
  reviewed_count: number;
  override_count: number;
  avg_review_time_minutes: number;
}

export interface CustomRule {
  id: string;
  rule_type: "domain" | "keyword";
  value: string;
  force_category: AICategory;
  is_active: boolean;
  created_by?: string;
  created_at: string;
}

export interface MailboxStatus {
  id: string;
  address: string;
  display_name: string;
  is_active: boolean;
  last_polled_at?: string;
  last_error?: string;
}

export interface Settings {
  id: string;
  job_status: JobStatus;
  job_last_run?: string;
  job_error_message?: string;
  high_malicious_threshold: number;
  low_malicious_threshold: number;
  notify_high_malicious_spike: boolean;
  notify_job_failure: boolean;
  notify_daily_digest: boolean;
  updated_at: string;
  custom_rules: CustomRule[];
  mailboxes: MailboxStatus[];
}

// ── API Functions ─────────────────────────────────────────────────────────────

export const api = {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: {
    getSummary: (): Promise<DashboardSummary> =>
      request("/api/dashboard/summary"),
  },

  // ── Emails ─────────────────────────────────────────────────────────────────
  emails: {
    list: (params: {
      category?: AICategory;
      status?: ReviewStatus;
      search?: string;
      page?: number;
      pageSize?: number;
    }): Promise<EmailListResponse> => {
      const q = new URLSearchParams();
      if (params.category) q.set("category", params.category);
      if (params.status) q.set("status", params.status);
      if (params.search) q.set("search", params.search);
      if (params.page) q.set("page", String(params.page));
      if (params.pageSize) q.set("page_size", String(params.pageSize));
      return request(`/api/emails?${q.toString()}`);
    },

    getById: (emailId: string): Promise<EmailDetail> =>
      request(`/api/emails/${emailId}`),

    override: (
      emailId: string,
      data: { newCategory: AICategory; reason: string; analyst: string }
    ): Promise<EmailDetail> =>
      request(`/api/emails/${emailId}/override`, {
        method: "POST",
        body: JSON.stringify({
          analyst: data.analyst,
          new_category: data.newCategory,
          reason: data.reason,
        }),
      }),

    bulkReview: (
      emailIds: string[],
      analyst: string
    ): Promise<{ updated: number }> =>
      request("/api/emails/bulk-review", {
        method: "POST",
        body: JSON.stringify({ email_ids: emailIds, analyst }),
      }),

    exportCsv: (params?: { category?: AICategory; status?: ReviewStatus; analyst?: string }): void => {
      const q = new URLSearchParams();
      if (params?.category) q.set("category", params.category);
      if (params?.status) q.set("status", params.status);
      if (params?.analyst) q.set("analyst", params.analyst);
      window.open(`${BASE_URL}/api/emails/export/csv?${q.toString()}`, "_blank");
    },
  },

  // ── Analytics ──────────────────────────────────────────────────────────────
  analytics: {
    getAccuracy: (): Promise<AccuracyStats> =>
      request("/api/analytics/accuracy"),

    getCategoryTrend: (days = 30): Promise<TrendDay[]> =>
      request(`/api/analytics/category-trend?days=${days}`),

    getTopDomains: (limit = 10): Promise<DomainCount[]> =>
      request(`/api/analytics/top-domains?limit=${limit}`),

    getKeywords: (limit = 12): Promise<KeywordCount[]> =>
      request(`/api/analytics/keywords?limit=${limit}`),

    getAnalystActivity: (): Promise<AnalystActivity[]> =>
      request("/api/analytics/analyst-activity"),
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  settings: {
    get: (): Promise<Settings> =>
      request("/api/settings"),

    updateThresholds: (thresholds: {
      high_malicious_threshold: number;
      low_malicious_threshold: number;
    }): Promise<Settings> =>
      request("/api/settings/thresholds", {
        method: "PATCH",
        body: JSON.stringify(thresholds),
      }),

    updateNotifications: (prefs: {
      notify_high_malicious_spike?: boolean;
      notify_job_failure?: boolean;
      notify_daily_digest?: boolean;
    }): Promise<Settings> =>
      request("/api/settings/notifications", {
        method: "PATCH",
        body: JSON.stringify(prefs),
      }),

    pauseJob: (): Promise<{ success: boolean; job_status: string }> =>
      request("/api/settings/job/pause", { method: "POST" }),

    resumeJob: (): Promise<{ success: boolean; job_status: string }> =>
      request("/api/settings/job/resume", { method: "POST" }),

    triggerJob: (): Promise<{ success: boolean; message: string }> =>
      request("/api/settings/job/trigger", { method: "POST" }),

    listRules: (): Promise<CustomRule[]> =>
      request("/api/settings/rules"),

    addRule: (rule: {
      rule_type: "domain" | "keyword";
      value: string;
      force_category: AICategory;
      created_by?: string;
    }): Promise<CustomRule> =>
      request("/api/settings/rules", {
        method: "POST",
        body: JSON.stringify(rule),
      }),

    deleteRule: (ruleId: string): Promise<void> =>
      request(`/api/settings/rules/${ruleId}`, { method: "DELETE" }),
  },

  // ── Audit Log ──────────────────────────────────────────────────────────────
  auditLog: {
    list: (params: {
      analyst?: string;
      action?: string;
      page?: number;
      pageSize?: number;
    }): Promise<AuditLogResponse> => {
      const q = new URLSearchParams();
      if (params.analyst) q.set("analyst", params.analyst);
      if (params.action) q.set("action", params.action);
      if (params.page) q.set("page", String(params.page));
      if (params.pageSize) q.set("page_size", String(params.pageSize));
      return request(`/api/audit-log?${q.toString()}`);
    },

    exportCsv: (params?: { analyst?: string; action?: string }): void => {
      const q = new URLSearchParams();
      if (params?.analyst) q.set("analyst", params.analyst);
      if (params?.action) q.set("action", params.action);
      window.open(`${BASE_URL}/api/audit-log/export/csv?${q.toString()}`, "_blank");
    },
  },
};
