// filepath: p2p-kids-admin/src/types/nodes.ts

export interface GeographicNode {
  id: string;
  name: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  radius_miles: number;
  description?: string | null;
  is_active: boolean;
  member_count: number;
  created_at: string;
  updated_at?: string;
}

export interface NodeFormData {
  name: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  radius_miles: number;
  description: string;
  is_active: boolean;
}

export interface ZipCodeLookupResult {
  'place name': string;
  'state abbreviation': string;
  latitude: string;
  longitude: string;
}

export interface AdminAuditLogEntry {
  id?: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  changes: Record<string, any>;
  created_at?: string;
}
