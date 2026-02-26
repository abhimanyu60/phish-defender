// ============================================================
// API Service Layer — All data flows through these functions
// Currently returns mock data; swap endpoints for production
// ============================================================

export type AICategory = "high_malicious" | "low_malicious" | "safe";
export type ReviewStatus = "pending" | "reviewed";
export type JobStatus = "running" | "idle" | "paused";

export interface Email {
  emailId: string;
  sender: string;
  senderDomain: string;
  recipient: string;
  subject: string;
  receivedAt: string;
  aiCategory: AICategory;
  confidenceScore: number;
  reviewStatus: ReviewStatus;
  body: string;
  aiReasoning: string[];
  threatIndicators: { urls: string[]; domains: string[]; ips: string[] };
  auditTrail: AuditEntry[];
  similarEmailIds: string[];
}

export interface DashboardSummary {
  totalEmails: number;
  highMalicious: number;
  lowMalicious: number;
  safe: number;
  pendingReview: number;
}

export interface TrendDay {
  date: string;
  highMalicious: number;
  lowMalicious: number;
  safe: number;
}

export interface IngestionStatus {
  lastRunTime: string;
  emailsProcessed: number;
  nextScheduledRun: string;
  status: JobStatus;
}

export interface AuditEntry {
  id: string;
  analyst: string;
  action: string;
  emailId?: string;
  timestamp: string;
  details: string;
}

export interface AnalystActivity {
  analyst: string;
  reviewedCount: number;
  avgReviewTimeMinutes: number;
}

export interface CustomRule {
  id: string;
  type: "domain" | "keyword";
  value: string;
  forceCategory: AICategory;
  createdAt: string;
}

export interface Settings {
  jobStatus: JobStatus;
  highMaliciousThreshold: number;
  lowMaliciousThreshold: number;
  customRules: CustomRule[];
  notificationPreferences: { highMaliciousSpike: boolean; jobFailure: boolean; dailyDigest: boolean };
  connectedMailboxes: { email: string; displayName: string; status: string }[];
}

// ---------- Mock Data ----------

const analysts = ["Sarah Chen", "Marcus Rivera", "Alex Kumar", "Jordan Peters", "Taylor Novak"];

const mockEmails: Email[] = [
  {
    emailId: "em-001", sender: "security-alert@paypa1.com.ru", senderDomain: "paypa1.com.ru",
    recipient: "shared-mailbox@company.com", subject: "Urgent: Your account has been compromised",
    receivedAt: "2026-02-26T08:12:00Z", aiCategory: "high_malicious", confidenceScore: 0.96,
    reviewStatus: "pending",
    body: `<div style="font-family:Arial"><img src="https://fake-paypal-logo.com/logo.png" /><h2>Your PayPal account has been limited</h2><p>We've noticed unusual activity on your account. Please <a href="http://paypa1-secure.com.ru/verify">verify your identity</a> within 24 hours or your account will be permanently suspended.</p><p>Click here to restore access: <a href="http://paypa1-secure.com.ru/login">Secure Login</a></p></div>`,
    aiReasoning: ["Sender domain 'paypa1.com.ru' mimics legitimate PayPal domain", "Contains urgency language: 'within 24 hours', 'permanently suspended'", "Embedded URLs point to suspicious Russian TLD", "Known phishing template pattern match (94% similarity)"],
    threatIndicators: { urls: ["http://paypa1-secure.com.ru/verify", "http://paypa1-secure.com.ru/login"], domains: ["paypa1.com.ru", "paypa1-secure.com.ru"], ips: ["185.220.101.42"] },
    auditTrail: [], similarEmailIds: ["em-003", "em-012"]
  },
  {
    emailId: "em-002", sender: "ceo@company-financial.net", senderDomain: "company-financial.net",
    recipient: "shared-mailbox@company.com", subject: "Wire Transfer Needed - Confidential",
    receivedAt: "2026-02-26T07:45:00Z", aiCategory: "high_malicious", confidenceScore: 0.93,
    reviewStatus: "reviewed",
    body: `<div><p>Hi,</p><p>I need you to process an urgent wire transfer of $47,500 to the following account. This is time-sensitive and confidential - please do not discuss with anyone else on the team.</p><p>Bank: First National<br/>Account: 4829103847<br/>Routing: 021000021</p><p>Best,<br/>Michael Chen, CEO</p></div>`,
    aiReasoning: ["Business Email Compromise (BEC) pattern detected", "Sender domain does not match company domain", "Urgency + secrecy language: 'time-sensitive', 'do not discuss'", "Wire transfer request with specific banking details", "CEO impersonation attempt"],
    threatIndicators: { urls: [], domains: ["company-financial.net"], ips: ["91.234.99.12"] },
    auditTrail: [{ id: "au-001", analyst: "Sarah Chen", action: "reviewed", emailId: "em-002", timestamp: "2026-02-26T08:30:00Z", details: "Confirmed as BEC attempt. Notified finance team." }],
    similarEmailIds: ["em-008"]
  },
  {
    emailId: "em-003", sender: "noreply@amaz0n-orders.com", senderDomain: "amaz0n-orders.com",
    recipient: "shared-mailbox@company.com", subject: "Your order #938-2847561 has been placed",
    receivedAt: "2026-02-26T07:30:00Z", aiCategory: "high_malicious", confidenceScore: 0.91,
    reviewStatus: "pending",
    body: `<div style="font-family:Arial"><h2>Order Confirmation</h2><p>Thank you for your order of MacBook Pro 16" ($2,499.00).</p><p>If you did not place this order, <a href="http://amaz0n-orders.com/cancel">click here to cancel immediately</a>.</p></div>`,
    aiReasoning: ["Typosquatting domain: 'amaz0n' instead of 'amazon'", "Social engineering via fake purchase urgency", "Malicious cancellation link designed to harvest credentials", "Domain registered 3 days ago"],
    threatIndicators: { urls: ["http://amaz0n-orders.com/cancel"], domains: ["amaz0n-orders.com"], ips: ["103.45.67.89"] },
    auditTrail: [], similarEmailIds: ["em-001"]
  },
  {
    emailId: "em-004", sender: "it-helpdesk@company.com", senderDomain: "company.com",
    recipient: "shared-mailbox@company.com", subject: "Scheduled Maintenance - VPN Update Required",
    receivedAt: "2026-02-26T07:00:00Z", aiCategory: "safe", confidenceScore: 0.88,
    reviewStatus: "reviewed",
    body: `<div><p>Dear Team,</p><p>Please note that our VPN client will be updated this weekend. No action is required on your part - the update will be pushed automatically.</p><p>Regards,<br/>IT Department</p></div>`,
    aiReasoning: ["Sender domain matches company domain", "No external links or attachments", "Matches known IT communication template", "No urgency or credential request language"],
    threatIndicators: { urls: [], domains: [], ips: [] },
    auditTrail: [{ id: "au-002", analyst: "Marcus Rivera", action: "reviewed", emailId: "em-004", timestamp: "2026-02-26T07:15:00Z", details: "Confirmed legitimate IT communication." }],
    similarEmailIds: ["em-015"]
  },
  {
    emailId: "em-005", sender: "invoice@quickbooks-billing.net", senderDomain: "quickbooks-billing.net",
    recipient: "shared-mailbox@company.com", subject: "Invoice #INV-29481 Due - Payment Required",
    receivedAt: "2026-02-26T06:45:00Z", aiCategory: "high_malicious", confidenceScore: 0.89,
    reviewStatus: "pending",
    body: `<div><p>Please find attached your invoice for professional services. Payment is due within 48 hours to avoid late fees.</p><p><a href="http://quickbooks-billing.net/pay/INV-29481">Pay Now</a></p></div>`,
    aiReasoning: ["Domain impersonates QuickBooks", "Invoice pressure with short deadline", "Payment link leads to credential harvesting page", "No prior invoice history with this sender"],
    threatIndicators: { urls: ["http://quickbooks-billing.net/pay/INV-29481"], domains: ["quickbooks-billing.net"], ips: ["45.33.98.12"] },
    auditTrail: [], similarEmailIds: ["em-009"]
  },
  {
    emailId: "em-006", sender: "newsletter@techcrunch.com", senderDomain: "techcrunch.com",
    recipient: "shared-mailbox@company.com", subject: "This Week in Tech: AI Security Developments",
    receivedAt: "2026-02-26T06:30:00Z", aiCategory: "safe", confidenceScore: 0.92,
    reviewStatus: "reviewed",
    body: `<div><h2>TechCrunch Weekly</h2><p>Top stories this week: AI-powered security tools are reshaping how enterprises handle threat detection...</p></div>`,
    aiReasoning: ["Known legitimate newsletter sender", "Domain SPF/DKIM verified", "Content matches typical newsletter format", "No suspicious links or attachments"],
    threatIndicators: { urls: [], domains: [], ips: [] },
    auditTrail: [{ id: "au-003", analyst: "Alex Kumar", action: "reviewed", emailId: "em-006", timestamp: "2026-02-26T06:45:00Z", details: "Legitimate newsletter." }],
    similarEmailIds: []
  },
  {
    emailId: "em-007", sender: "admin@microsoft-365-verify.com", senderDomain: "microsoft-365-verify.com",
    recipient: "shared-mailbox@company.com", subject: "Action Required: Verify your Microsoft 365 account",
    receivedAt: "2026-02-26T06:15:00Z", aiCategory: "high_malicious", confidenceScore: 0.95,
    reviewStatus: "pending",
    body: `<div style="font-family:Segoe UI"><p>Your Microsoft 365 subscription needs verification. Your account will be deactivated in 12 hours.</p><p><a href="http://microsoft-365-verify.com/auth">Verify Now</a></p></div>`,
    aiReasoning: ["Impersonates Microsoft with fake verification domain", "Account deactivation threat with time pressure", "Credential harvesting link detected", "Domain age: 2 days"],
    threatIndicators: { urls: ["http://microsoft-365-verify.com/auth"], domains: ["microsoft-365-verify.com"], ips: ["192.99.45.67"] },
    auditTrail: [], similarEmailIds: ["em-011"]
  },
  {
    emailId: "em-008", sender: "cfo@company-accounts.org", senderDomain: "company-accounts.org",
    recipient: "shared-mailbox@company.com", subject: "Re: Q4 Budget Approval - Please Process",
    receivedAt: "2026-02-26T05:50:00Z", aiCategory: "high_malicious", confidenceScore: 0.87,
    reviewStatus: "reviewed",
    body: `<div><p>Following up on the Q4 budget discussion. Please process the attached purchase orders totaling $89,200. I've already approved these with the board.</p></div>`,
    aiReasoning: ["BEC attempt impersonating CFO", "External domain spoofing internal role", "Large financial request without proper authorization chain", "Reply-to address differs from sender"],
    threatIndicators: { urls: [], domains: ["company-accounts.org"], ips: ["78.46.89.23"] },
    auditTrail: [{ id: "au-004", analyst: "Sarah Chen", action: "override", emailId: "em-008", timestamp: "2026-02-26T06:10:00Z", details: "Escalated to fraud team. Confirmed BEC." }],
    similarEmailIds: ["em-002"]
  },
  {
    emailId: "em-009", sender: "billing@docusign-secure.net", senderDomain: "docusign-secure.net",
    recipient: "shared-mailbox@company.com", subject: "Document Ready for Signature - Contract #DC-4821",
    receivedAt: "2026-02-26T05:30:00Z", aiCategory: "low_malicious", confidenceScore: 0.72,
    reviewStatus: "pending",
    body: `<div><p>A document is waiting for your signature. Please review and sign at your earliest convenience.</p><p><a href="http://docusign-secure.net/sign/DC-4821">Review Document</a></p></div>`,
    aiReasoning: ["Domain similar to DocuSign but not official", "Link structure mimics legitimate DocuSign URLs", "No attachment — relies on link click", "Moderate confidence — could be legitimate third-party"],
    threatIndicators: { urls: ["http://docusign-secure.net/sign/DC-4821"], domains: ["docusign-secure.net"], ips: ["104.21.45.78"] },
    auditTrail: [], similarEmailIds: ["em-005"]
  },
  {
    emailId: "em-010", sender: "hr@company.com", senderDomain: "company.com",
    recipient: "shared-mailbox@company.com", subject: "Updated PTO Policy - Effective March 1",
    receivedAt: "2026-02-26T05:15:00Z", aiCategory: "safe", confidenceScore: 0.94,
    reviewStatus: "reviewed",
    body: `<div><p>Hi Team,</p><p>We're updating our PTO policy effective March 1st. Key changes include increased rollover days. Full details on the HR portal.</p><p>Thanks,<br/>HR Team</p></div>`,
    aiReasoning: ["Internal sender verified via SPF/DKIM", "Standard HR communication pattern", "Links point to internal company portal", "No urgency or credential requests"],
    threatIndicators: { urls: [], domains: [], ips: [] },
    auditTrail: [{ id: "au-005", analyst: "Jordan Peters", action: "reviewed", emailId: "em-010", timestamp: "2026-02-26T05:30:00Z", details: "Legitimate HR email." }],
    similarEmailIds: []
  },
  {
    emailId: "em-011", sender: "support@apple-id-verification.com", senderDomain: "apple-id-verification.com",
    recipient: "shared-mailbox@company.com", subject: "Your Apple ID has been locked",
    receivedAt: "2026-02-26T04:45:00Z", aiCategory: "high_malicious", confidenceScore: 0.94,
    reviewStatus: "pending",
    body: `<div><p>Your Apple ID has been locked due to suspicious activity. Unlock your account now to prevent data loss.</p><p><a href="http://apple-id-verification.com/unlock">Unlock Account</a></p></div>`,
    aiReasoning: ["Apple ID phishing — fake verification domain", "Account lockout social engineering", "Malicious unlock link", "Domain registered within last week"],
    threatIndicators: { urls: ["http://apple-id-verification.com/unlock"], domains: ["apple-id-verification.com"], ips: ["162.55.89.34"] },
    auditTrail: [], similarEmailIds: ["em-007"]
  },
  {
    emailId: "em-012", sender: "shipping@fedex-tracking-update.com", senderDomain: "fedex-tracking-update.com",
    recipient: "shared-mailbox@company.com", subject: "Package Delivery Failed - Action Required",
    receivedAt: "2026-02-26T04:30:00Z", aiCategory: "low_malicious", confidenceScore: 0.68,
    reviewStatus: "pending",
    body: `<div><p>We attempted to deliver your package but were unable to. Please update your delivery preferences.</p><p><a href="http://fedex-tracking-update.com/redeliver">Schedule Redelivery</a></p></div>`,
    aiReasoning: ["Sender mimics FedEx but uses unofficial domain", "Delivery failure is common phishing pretext", "Link leads to external site", "Lower confidence — some legitimate delivery services use similar patterns"],
    threatIndicators: { urls: ["http://fedex-tracking-update.com/redeliver"], domains: ["fedex-tracking-update.com"], ips: ["89.45.67.12"] },
    auditTrail: [], similarEmailIds: ["em-001"]
  },
  {
    emailId: "em-013", sender: "no-reply@zoom.us", senderDomain: "zoom.us",
    recipient: "shared-mailbox@company.com", subject: "You have a new Zoom meeting invitation",
    receivedAt: "2026-02-26T04:00:00Z", aiCategory: "safe", confidenceScore: 0.90,
    reviewStatus: "reviewed",
    body: `<div><p>You've been invited to a Zoom meeting.<br/>Topic: Weekly Standup<br/>Time: Feb 27, 2026 10:00 AM<br/><a href="https://zoom.us/j/123456789">Join Meeting</a></p></div>`,
    aiReasoning: ["Legitimate Zoom domain verified", "Standard meeting invitation format", "Link points to official zoom.us domain", "SPF/DKIM pass"],
    threatIndicators: { urls: [], domains: [], ips: [] },
    auditTrail: [{ id: "au-006", analyst: "Taylor Novak", action: "reviewed", emailId: "em-013", timestamp: "2026-02-26T04:15:00Z", details: "Legitimate Zoom invite." }],
    similarEmailIds: []
  },
  {
    emailId: "em-014", sender: "prize@lottery-winner-2026.com", senderDomain: "lottery-winner-2026.com",
    recipient: "shared-mailbox@company.com", subject: "Congratulations! You've Won $1,500,000",
    receivedAt: "2026-02-26T03:30:00Z", aiCategory: "high_malicious", confidenceScore: 0.98,
    reviewStatus: "reviewed",
    body: `<div><h1>🎉 CONGRATULATIONS! 🎉</h1><p>You have been selected as the winner of our international lottery. To claim your prize of $1,500,000, please provide your bank details.</p></div>`,
    aiReasoning: ["Classic lottery/advance fee fraud pattern", "Requests banking information", "Disposable domain with lottery-specific name", "Extremely high confidence — textbook spam"],
    threatIndicators: { urls: [], domains: ["lottery-winner-2026.com"], ips: ["195.22.34.56"] },
    auditTrail: [{ id: "au-007", analyst: "Marcus Rivera", action: "reviewed", emailId: "em-014", timestamp: "2026-02-26T03:45:00Z", details: "Obvious lottery scam. Blocked sender domain." }],
    similarEmailIds: []
  },
  {
    emailId: "em-015", sender: "noreply@company.com", senderDomain: "company.com",
    recipient: "shared-mailbox@company.com", subject: "System Alert: Server maintenance completed",
    receivedAt: "2026-02-26T03:00:00Z", aiCategory: "safe", confidenceScore: 0.91,
    reviewStatus: "reviewed",
    body: `<div><p>Scheduled maintenance on production servers has been completed successfully. All systems are operational.</p></div>`,
    aiReasoning: ["Internal system notification", "Verified sender domain", "No external links", "Matches known system alert template"],
    threatIndicators: { urls: [], domains: [], ips: [] },
    auditTrail: [{ id: "au-008", analyst: "Alex Kumar", action: "reviewed", emailId: "em-015", timestamp: "2026-02-26T03:10:00Z", details: "Legitimate system alert." }],
    similarEmailIds: ["em-004"]
  },
  {
    emailId: "em-016", sender: "tax-refund@irs-gov-refund.com", senderDomain: "irs-gov-refund.com",
    recipient: "shared-mailbox@company.com", subject: "IRS Tax Refund Notification - $3,247.00",
    receivedAt: "2026-02-26T02:30:00Z", aiCategory: "high_malicious", confidenceScore: 0.97,
    reviewStatus: "pending",
    body: `<div><p>The IRS has determined you are eligible for a tax refund of $3,247.00. Please verify your identity to process your refund.</p><p><a href="http://irs-gov-refund.com/claim">Claim Refund</a></p></div>`,
    aiReasoning: ["IRS impersonation — government agencies don't email refund links", "Fake .com domain mimicking .gov", "Identity verification phishing", "Tax season social engineering"],
    threatIndicators: { urls: ["http://irs-gov-refund.com/claim"], domains: ["irs-gov-refund.com"], ips: ["178.62.45.89"] },
    auditTrail: [], similarEmailIds: []
  },
  {
    emailId: "em-017", sender: "sales@vendor-partner.com", senderDomain: "vendor-partner.com",
    recipient: "shared-mailbox@company.com", subject: "Partnership Proposal - Q1 2026",
    receivedAt: "2026-02-26T02:00:00Z", aiCategory: "low_malicious", confidenceScore: 0.55,
    reviewStatus: "pending",
    body: `<div><p>Hi,</p><p>We'd love to discuss a potential partnership for Q1 2026. Please find our proposal attached. Let us know if you'd like to schedule a call.</p><p>Best regards,<br/>Sales Team</p></div>`,
    aiReasoning: ["Unknown sender domain — not in approved vendor list", "Unsolicited business proposal", "Attachment reference (though none attached)", "Low confidence — may be legitimate cold outreach"],
    threatIndicators: { urls: [], domains: ["vendor-partner.com"], ips: ["34.89.12.45"] },
    auditTrail: [], similarEmailIds: ["em-020"]
  },
  {
    emailId: "em-018", sender: "admin@company.com", senderDomain: "company.com",
    recipient: "shared-mailbox@company.com", subject: "New Employee Onboarding - Week of March 3",
    receivedAt: "2026-02-26T01:30:00Z", aiCategory: "safe", confidenceScore: 0.93,
    reviewStatus: "reviewed",
    body: `<div><p>Please prepare workstations for 3 new hires starting March 3rd. Equipment requests have been submitted to procurement.</p></div>`,
    aiReasoning: ["Internal sender verified", "Routine administrative communication", "No suspicious content or links", "Matches organizational communication patterns"],
    threatIndicators: { urls: [], domains: [], ips: [] },
    auditTrail: [{ id: "au-009", analyst: "Sarah Chen", action: "reviewed", emailId: "em-018", timestamp: "2026-02-26T01:45:00Z", details: "Legitimate internal email." }],
    similarEmailIds: []
  },
  {
    emailId: "em-019", sender: "crypto-alert@blockchain-secure.io", senderDomain: "blockchain-secure.io",
    recipient: "shared-mailbox@company.com", subject: "Urgent: Unusual login to your crypto wallet",
    receivedAt: "2026-02-26T01:00:00Z", aiCategory: "high_malicious", confidenceScore: 0.92,
    reviewStatus: "pending",
    body: `<div><p>We detected a login from an unrecognized device. If this wasn't you, secure your wallet immediately.</p><p><a href="http://blockchain-secure.io/secure">Secure Wallet</a></p></div>`,
    aiReasoning: ["Cryptocurrency phishing pattern", "Fake security alert to create panic", "Suspicious .io domain not associated with any known exchange", "Credential harvesting link"],
    threatIndicators: { urls: ["http://blockchain-secure.io/secure"], domains: ["blockchain-secure.io"], ips: ["45.77.89.23"] },
    auditTrail: [], similarEmailIds: []
  },
  {
    emailId: "em-020", sender: "contact@legitimate-saas.com", senderDomain: "legitimate-saas.com",
    recipient: "shared-mailbox@company.com", subject: "Your subscription renewal reminder",
    receivedAt: "2026-02-26T00:30:00Z", aiCategory: "low_malicious", confidenceScore: 0.61,
    reviewStatus: "pending",
    body: `<div><p>Your annual subscription is due for renewal on March 15, 2026. Log in to your dashboard to review your plan.</p><p><a href="https://legitimate-saas.com/dashboard">View Dashboard</a></p></div>`,
    aiReasoning: ["Sender not in approved vendor list", "Subscription renewal could be pretext for phishing", "Link appears to match sender domain (positive signal)", "Moderate confidence — needs manual verification"],
    threatIndicators: { urls: ["https://legitimate-saas.com/dashboard"], domains: ["legitimate-saas.com"], ips: [] },
    auditTrail: [], similarEmailIds: ["em-017"]
  },
  {
    emailId: "em-021", sender: "jira@atlassian.net", senderDomain: "atlassian.net",
    recipient: "shared-mailbox@company.com", subject: "[JIRA] SEC-1042 - Update firewall rules for new office",
    receivedAt: "2026-02-25T23:00:00Z", aiCategory: "safe", confidenceScore: 0.95,
    reviewStatus: "reviewed",
    body: `<div><p>Sarah Chen updated SEC-1042:<br/>Status: In Progress → Done<br/>Comment: Firewall rules updated for new office IP range.</p></div>`,
    aiReasoning: ["Legitimate Atlassian notification domain", "Standard JIRA ticket format", "Internal project reference", "SPF/DKIM verified"],
    threatIndicators: { urls: [], domains: [], ips: [] },
    auditTrail: [{ id: "au-010", analyst: "Jordan Peters", action: "reviewed", emailId: "em-021", timestamp: "2026-02-25T23:15:00Z", details: "Legitimate JIRA notification." }],
    similarEmailIds: []
  },
  {
    emailId: "em-022", sender: "helpdesk@microsoft-support-case.com", senderDomain: "microsoft-support-case.com",
    recipient: "shared-mailbox@company.com", subject: "Support Case #MS-78421 - Immediate response needed",
    receivedAt: "2026-02-25T22:30:00Z", aiCategory: "high_malicious", confidenceScore: 0.90,
    reviewStatus: "reviewed",
    body: `<div><p>Your Microsoft support case requires immediate attention. Please download and run the diagnostic tool to resolve the issue.</p><p><a href="http://microsoft-support-case.com/diagnostic.exe">Download Tool</a></p></div>`,
    aiReasoning: ["Fake Microsoft support domain", "Executable file download link (.exe)", "Urgency language to bypass careful review", "Tech support scam pattern"],
    threatIndicators: { urls: ["http://microsoft-support-case.com/diagnostic.exe"], domains: ["microsoft-support-case.com"], ips: ["85.90.45.12"] },
    auditTrail: [{ id: "au-011", analyst: "Taylor Novak", action: "reviewed", emailId: "em-022", timestamp: "2026-02-25T22:45:00Z", details: "Tech support scam with malware download link." }],
    similarEmailIds: ["em-007"]
  },
  {
    emailId: "em-023", sender: "updates@github.com", senderDomain: "github.com",
    recipient: "shared-mailbox@company.com", subject: "[GitHub] Security advisory for repository: infra-core",
    receivedAt: "2026-02-25T22:00:00Z", aiCategory: "safe", confidenceScore: 0.89,
    reviewStatus: "pending",
    body: `<div><p>A new security advisory has been published for a dependency in your repository <strong>infra-core</strong>. We recommend updating the affected packages.</p></div>`,
    aiReasoning: ["Legitimate GitHub domain", "Standard security advisory format", "References known internal repository", "No suspicious links"],
    threatIndicators: { urls: [], domains: [], ips: [] },
    auditTrail: [], similarEmailIds: []
  },
  {
    emailId: "em-024", sender: "urgent@bank-of-america-alert.com", senderDomain: "bank-of-america-alert.com",
    recipient: "shared-mailbox@company.com", subject: "Suspicious transaction detected on your account",
    receivedAt: "2026-02-25T21:30:00Z", aiCategory: "high_malicious", confidenceScore: 0.96,
    reviewStatus: "pending",
    body: `<div><p>We detected a suspicious transaction of $8,942.00 on your account. If you did not authorize this, please verify your identity immediately.</p><p><a href="http://bank-of-america-alert.com/verify">Verify Identity</a></p></div>`,
    aiReasoning: ["Banking phishing — fake Bank of America domain", "Fraudulent transaction alert to create urgency", "Credential harvesting via fake verification page", "Domain registered 1 day ago"],
    threatIndicators: { urls: ["http://bank-of-america-alert.com/verify"], domains: ["bank-of-america-alert.com"], ips: ["45.89.12.67"] },
    auditTrail: [], similarEmailIds: []
  },
  {
    emailId: "em-025", sender: "marketing@hubspot.com", senderDomain: "hubspot.com",
    recipient: "shared-mailbox@company.com", subject: "Your weekly marketing performance report",
    receivedAt: "2026-02-25T21:00:00Z", aiCategory: "safe", confidenceScore: 0.87,
    reviewStatus: "reviewed",
    body: `<div><p>Here's your weekly marketing performance summary. Open rate: 24.3%, Click rate: 3.1%, New contacts: 47.</p></div>`,
    aiReasoning: ["Known marketing platform domain", "Standard reporting format", "No suspicious content", "Consistent with previous communications from this sender"],
    threatIndicators: { urls: [], domains: [], ips: [] },
    auditTrail: [{ id: "au-012", analyst: "Marcus Rivera", action: "reviewed", emailId: "em-025", timestamp: "2026-02-25T21:15:00Z", details: "Legitimate HubSpot report." }],
    similarEmailIds: []
  },
];

const mockAuditLog: AuditEntry[] = [
  { id: "al-001", analyst: "Sarah Chen", action: "override", emailId: "em-008", timestamp: "2026-02-26T06:10:00Z", details: "Changed category from low_malicious to high_malicious. Reason: Confirmed BEC attempt." },
  { id: "al-002", analyst: "Marcus Rivera", action: "reviewed", emailId: "em-014", timestamp: "2026-02-26T03:45:00Z", details: "Marked as reviewed. Obvious lottery scam." },
  { id: "al-003", analyst: "Alex Kumar", action: "reviewed", emailId: "em-006", timestamp: "2026-02-26T06:45:00Z", details: "Confirmed legitimate newsletter." },
  { id: "al-004", analyst: "Jordan Peters", action: "reviewed", emailId: "em-010", timestamp: "2026-02-26T05:30:00Z", details: "Confirmed legitimate HR email." },
  { id: "al-005", analyst: "Taylor Novak", action: "reviewed", emailId: "em-022", timestamp: "2026-02-25T22:45:00Z", details: "Tech support scam with malware link." },
  { id: "al-006", analyst: "Sarah Chen", action: "reviewed", emailId: "em-002", timestamp: "2026-02-26T08:30:00Z", details: "Confirmed BEC attempt." },
  { id: "al-007", analyst: "Alex Kumar", action: "reviewed", emailId: "em-015", timestamp: "2026-02-26T03:10:00Z", details: "Legitimate system alert." },
  { id: "al-008", analyst: "Jordan Peters", action: "reviewed", emailId: "em-021", timestamp: "2026-02-25T23:15:00Z", details: "Legitimate JIRA notification." },
  { id: "al-009", analyst: "Marcus Rivera", action: "export", emailId: undefined, timestamp: "2026-02-26T04:00:00Z", details: "Exported 15 high malicious emails to CSV." },
  { id: "al-010", analyst: "Taylor Novak", action: "reviewed", emailId: "em-013", timestamp: "2026-02-26T04:15:00Z", details: "Legitimate Zoom invite." },
  { id: "al-011", analyst: "Sarah Chen", action: "override", emailId: "em-017", timestamp: "2026-02-26T02:30:00Z", details: "Changed from low_malicious to safe. Verified legitimate vendor." },
  { id: "al-012", analyst: "Marcus Rivera", action: "reviewed", emailId: "em-025", timestamp: "2026-02-25T21:15:00Z", details: "Legitimate HubSpot report." },
];

// ---------- Utility ----------

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

// ---------- API Functions ----------

export const api = {
  dashboard: {
    getSummary: async (): Promise<DashboardSummary> => {
      await delay();
      const today = mockEmails;
      return {
        totalEmails: today.length,
        highMalicious: today.filter(e => e.aiCategory === "high_malicious").length,
        lowMalicious: today.filter(e => e.aiCategory === "low_malicious").length,
        safe: today.filter(e => e.aiCategory === "safe").length,
        pendingReview: today.filter(e => e.reviewStatus === "pending").length,
      };
    },

    getTrend: async (days = 7): Promise<TrendDay[]> => {
      await delay();
      const result: TrendDay[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        result.push({
          date: d.toISOString().split("T")[0],
          highMalicious: Math.floor(Math.random() * 30) + 40,
          lowMalicious: Math.floor(Math.random() * 40) + 60,
          safe: Math.floor(Math.random() * 100) + 350,
        });
      }
      return result;
    },

    getIngestionStatus: async (): Promise<IngestionStatus> => {
      await delay();
      return {
        lastRunTime: "2026-02-26T08:00:00Z",
        emailsProcessed: 487,
        nextScheduledRun: "2026-02-26T09:00:00Z",
        status: "idle",
      };
    },

    getRecentMalicious: async (): Promise<Email[]> => {
      await delay();
      return mockEmails.filter(e => e.aiCategory === "high_malicious").slice(0, 5);
    },
  },

  emails: {
    list: async (params: { category?: AICategory; status?: ReviewStatus; search?: string; page?: number; pageSize?: number }): Promise<{ emails: Email[]; total: number }> => {
      await delay();
      let filtered = [...mockEmails];
      if (params.category) filtered = filtered.filter(e => e.aiCategory === params.category);
      if (params.status) filtered = filtered.filter(e => e.reviewStatus === params.status);
      if (params.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(e => e.sender.toLowerCase().includes(s) || e.subject.toLowerCase().includes(s));
      }
      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const start = (page - 1) * pageSize;
      return { emails: filtered.slice(start, start + pageSize), total: filtered.length };
    },

    getById: async (emailId: string): Promise<Email | null> => {
      await delay();
      return mockEmails.find(e => e.emailId === emailId) || null;
    },

    override: async (emailId: string, data: { newCategory: AICategory; reason: string }): Promise<{ success: boolean }> => {
      await delay();
      const email = mockEmails.find(e => e.emailId === emailId);
      if (email) {
        email.aiCategory = data.newCategory;
        email.auditTrail.push({
          id: `au-${Date.now()}`, analyst: "Current User", action: "override",
          emailId, timestamp: new Date().toISOString(), details: `Changed to ${data.newCategory}. Reason: ${data.reason}`,
        });
      }
      return { success: true };
    },

    bulkReview: async (emailIds: string[]): Promise<{ success: boolean; count: number }> => {
      await delay();
      emailIds.forEach(id => {
        const email = mockEmails.find(e => e.emailId === id);
        if (email) email.reviewStatus = "reviewed";
      });
      return { success: true, count: emailIds.length };
    },

    export: async (): Promise<void> => {
      await delay();
      // In production, this would trigger a CSV download
      console.log("CSV export triggered");
    },
  },

  analytics: {
    getAccuracy: async (): Promise<{ agreementRate: number; totalReviewed: number; totalOverrides: number; overrideBreakdown: Record<string, number> }> => {
      await delay();
      return {
        agreementRate: 87.3,
        totalReviewed: 3421,
        totalOverrides: 434,
        overrideBreakdown: { high_to_low: 89, high_to_safe: 45, low_to_high: 156, low_to_safe: 98, safe_to_low: 31, safe_to_high: 15 },
      };
    },

    getTopDomains: async (): Promise<{ domain: string; count: number }[]> => {
      await delay();
      return [
        { domain: "paypa1.com.ru", count: 47 }, { domain: "microsoft-365-verify.com", count: 38 },
        { domain: "apple-id-verification.com", count: 31 }, { domain: "amaz0n-orders.com", count: 28 },
        { domain: "irs-gov-refund.com", count: 24 }, { domain: "bank-of-america-alert.com", count: 21 },
        { domain: "quickbooks-billing.net", count: 18 }, { domain: "blockchain-secure.io", count: 15 },
        { domain: "docusign-secure.net", count: 12 }, { domain: "company-financial.net", count: 9 },
      ];
    },

    getCategoryTrend: async (range = "30d"): Promise<TrendDay[]> => {
      await delay();
      const days = parseInt(range) || 30;
      const result: TrendDay[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        result.push({
          date: d.toISOString().split("T")[0],
          highMalicious: Math.floor(Math.random() * 20) + 35,
          lowMalicious: Math.floor(Math.random() * 30) + 55,
          safe: Math.floor(Math.random() * 80) + 380,
        });
      }
      return result;
    },

    getKeywords: async (): Promise<{ keyword: string; frequency: number }[]> => {
      await delay();
      return [
        { keyword: "verify your account", frequency: 234 }, { keyword: "urgent action required", frequency: 189 },
        { keyword: "password expired", frequency: 156 }, { keyword: "wire transfer", frequency: 142 },
        { keyword: "suspended account", frequency: 128 }, { keyword: "click here immediately", frequency: 115 },
        { keyword: "invoice attached", frequency: 98 }, { keyword: "tax refund", frequency: 87 },
        { keyword: "lottery winner", frequency: 76 }, { keyword: "crypto wallet", frequency: 64 },
        { keyword: "unusual activity", frequency: 58 }, { keyword: "confirm identity", frequency: 52 },
      ];
    },

    getAnalystActivity: async (): Promise<AnalystActivity[]> => {
      await delay();
      return [
        { analyst: "Sarah Chen", reviewedCount: 847, avgReviewTimeMinutes: 2.3 },
        { analyst: "Marcus Rivera", reviewedCount: 723, avgReviewTimeMinutes: 3.1 },
        { analyst: "Alex Kumar", reviewedCount: 691, avgReviewTimeMinutes: 2.8 },
        { analyst: "Jordan Peters", reviewedCount: 634, avgReviewTimeMinutes: 3.5 },
        { analyst: "Taylor Novak", reviewedCount: 526, avgReviewTimeMinutes: 2.9 },
      ];
    },
  },

  settings: {
    get: async (): Promise<Settings> => {
      await delay();
      return {
        jobStatus: "idle",
        highMaliciousThreshold: 0.8,
        lowMaliciousThreshold: 0.5,
        customRules: [
          { id: "r-001", type: "domain", value: "paypa1.com.ru", forceCategory: "high_malicious", createdAt: "2026-02-20T10:00:00Z" },
          { id: "r-002", type: "keyword", value: "wire transfer urgent", forceCategory: "high_malicious", createdAt: "2026-02-22T14:00:00Z" },
          { id: "r-003", type: "domain", value: "lottery-winner", forceCategory: "high_malicious", createdAt: "2026-02-23T09:00:00Z" },
        ],
        notificationPreferences: { highMaliciousSpike: true, jobFailure: true, dailyDigest: false },
        connectedMailboxes: [
          { email: "security-inbox@company.com", displayName: "Security Shared Mailbox", status: "active" },
          { email: "abuse-reports@company.com", displayName: "Abuse Reports", status: "active" },
          { email: "phishing-reports@company.com", displayName: "Phishing Reports", status: "inactive" },
        ],
      };
    },

    pauseJob: async (): Promise<{ success: boolean }> => { await delay(); return { success: true }; },
    resumeJob: async (): Promise<{ success: boolean }> => { await delay(); return { success: true }; },
    triggerJob: async (): Promise<{ success: boolean }> => { await delay(); return { success: true }; },

    updateThresholds: async (thresholds: { highMaliciousThreshold: number; lowMaliciousThreshold: number }): Promise<{ success: boolean }> => {
      await delay(); return { success: true };
    },

    addRule: async (rule: { type: "domain" | "keyword"; value: string; forceCategory: AICategory }): Promise<CustomRule> => {
      await delay();
      return { ...rule, id: `r-${Date.now()}`, createdAt: new Date().toISOString() };
    },

    deleteRule: async (ruleId: string): Promise<{ success: boolean }> => {
      await delay(); return { success: true };
    },
  },

  auditLog: {
    list: async (params: { analyst?: string; action?: string; from?: string; to?: string; page?: number; pageSize?: number }): Promise<{ entries: AuditEntry[]; total: number }> => {
      await delay();
      let filtered = [...mockAuditLog];
      if (params.analyst) filtered = filtered.filter(e => e.analyst === params.analyst);
      if (params.action) filtered = filtered.filter(e => e.action === params.action);
      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const start = (page - 1) * pageSize;
      return { entries: filtered.slice(start, start + pageSize), total: filtered.length };
    },

    export: async (): Promise<void> => {
      await delay();
      console.log("Audit log CSV export triggered");
    },
  },
};
