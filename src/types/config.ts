// filepath: p2p-kids-admin/src/types/config.ts

export interface AdminConfigItem {
  key: string;
  value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SMSRateLimitStats {
  totalSentToday: number;
  totalSentThisHour: number;
  uniquePhonesThisHour: number;
  rateLimitedAttempts: number;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
