import type { ReportCategory, ReportStatus, SupportCategory, SupportStatus } from '@prisma/client';

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  SCAM: 'Scam in a deal',
  // Kept distinct because it is the most common attack here and usually
  // involves no platform account at all.
  DM_IMPERSONATION: 'Impersonator in my DMs',
  ALT_ACCOUNT: 'Alt account or self-dealing',
  OTHER: 'Something else',
};

export const REPORT_CATEGORY_HINT: Record<ReportCategory, string> = {
  SCAM: 'Someone took funds, failed to deliver, or drained a wallet in a deal.',
  DM_IMPERSONATION: 'Someone messaged you claiming to be a middleman or staff. Middlemen never DM first.',
  ALT_ACCOUNT: 'One person operating several accounts, or bidding on their own listing.',
  OTHER: 'Anything that does not fit the categories above.',
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: 'Awaiting review',
  UPHELD: 'Upheld',
  DISMISSED: 'Dismissed',
};

export const REPORT_STATUS_TONE: Record<ReportStatus, 'warn' | 'danger' | 'neutral'> = {
  PENDING: 'warn',
  UPHELD: 'danger',
  DISMISSED: 'neutral',
};

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  GENERAL_HELP: 'General help',
  ACCOUNT_ISSUE: 'Account issue',
  ADS_PREMIUM: 'Buying ads or premium',
  REPORT_PROBLEM: 'Report a problem',
};

export const SUPPORT_CATEGORY_HINT: Record<SupportCategory, string> = {
  GENERAL_HELP: 'How something works, or what to do next.',
  ACCOUNT_ISSUE: 'Sign-in trouble, a wrong detail on your profile, anything account-shaped.',
  ADS_PREMIUM: 'Promoted listings and ad slots.',
  REPORT_PROBLEM: 'Something on the platform is broken or behaving wrongly.',
};

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const SUPPORT_STATUS_TONE: Record<
  SupportStatus,
  'warn' | 'info' | 'ok' | 'neutral'
> = {
  OPEN: 'warn',
  ASSIGNED: 'info',
  RESOLVED: 'ok',
  CLOSED: 'neutral',
};
