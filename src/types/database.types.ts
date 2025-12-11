export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
	public: {
		Tables: {
			users: {
				Row: {
					id: string
					email: string | null
					role: 'user' | 'admin' | 'moderator' | null
					subscription_id?: string | null
					sp_wallet_id?: string | null
					created_at?: string | null
					updated_at?: string | null
				}
				Insert: {
					id?: string
					email?: string | null
					role?: 'user' | 'admin' | 'moderator' | null
					subscription_id?: string | null
					sp_wallet_id?: string | null
					created_at?: string | null
				}
				Update: {
					email?: string | null
					role?: 'user' | 'admin' | 'moderator' | null
					subscription_id?: string | null
					sp_wallet_id?: string | null
					created_at?: string | null
					updated_at?: string | null
				}
			}
			subscriptions: {
				Row: {
					id: string
					user_id: string
					status: string
					created_at?: string | null
				}
				Insert: {
					id?: string
					user_id: string
					status?: string
				}
				Update: {
					status?: string
				}
			}
			sp_wallets: {
				Row: {
					id: string
					user_id: string
					status: string
					balance?: number | null
					created_at?: string | null
				}
				Insert: {
					id?: string
					user_id: string
					status?: string
					balance?: number | null
				}
				Update: {
					status?: string
					balance?: number | null
				}
			}
			user_profiles: {
				Row: {
					user_id: string
					age?: number | null
					bio?: string | null
					interests?: string[] | null
				}
				Insert: {
					user_id: string
					age?: number | null
					bio?: string | null
					interests?: string[] | null
				}
				Update: {
					age?: number | null
					bio?: string | null
					interests?: string[] | null
				}
			}
		}
		Views: { [key: string]: never }
		Functions: {
			is_admin: {
				Args: { p_uid?: string | null }
				Returns: boolean
			}
			get_subscription_summary: {
				Args: { p_user_id?: string | null }
				Returns: { status: string; can_spend_sp: boolean; availablePoints: number } | null
			}
			get_user_sp_wallet_summary: {
				Args: { p_user_id?: string | null }
				Returns: { availablePoints: number } | null
			}
		}
		Enums: { [key: string]: never }
	}
}

export type JsonValue = Json

