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
		Functions: { [key: string]: never }
		Enums: { [key: string]: never }
	}
}

export type JsonValue = Json

