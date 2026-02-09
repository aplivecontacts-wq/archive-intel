export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      cases: {
        Row: {
          id: string
          title: string
          tags: Json
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          title: string
          tags?: Json
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          tags?: Json
          created_at?: string
          user_id?: string | null
        }
      }
      queries: {
        Row: {
          id: string
          case_id: string
          raw_input: string
          normalized_input: string
          input_type: 'url' | 'username' | 'quote'
          status: 'running' | 'complete'
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          case_id: string
          raw_input: string
          normalized_input: string
          input_type: 'url' | 'username' | 'quote'
          status?: 'running' | 'complete'
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          case_id?: string
          raw_input?: string
          normalized_input?: string
          input_type?: 'url' | 'username' | 'quote'
          status?: 'running' | 'complete'
          created_at?: string
          user_id?: string | null
        }
      }
      results: {
        Row: {
          id: string
          query_id: string
          source: 'wayback' | 'search' | 'note'
          title: string
          url: string | null
          captured_at: string | null
          snippet: string | null
          confidence: number
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          query_id: string
          source: 'wayback' | 'search' | 'note'
          title: string
          url?: string | null
          captured_at?: string | null
          snippet?: string | null
          confidence?: number
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          query_id?: string
          source?: 'wayback' | 'search' | 'note'
          title?: string
          url?: string | null
          captured_at?: string | null
          snippet?: string | null
          confidence?: number
          created_at?: string
          user_id?: string | null
        }
      }
      user_tiers: {
        Row: {
          user_id: string
          tier: 'free' | 'basic' | 'pro'
          stripe_customer_id: string | null
          expires_at: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          tier?: 'free' | 'basic' | 'pro'
          stripe_customer_id?: string | null
          expires_at?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          tier?: 'free' | 'basic' | 'pro'
          stripe_customer_id?: string | null
          expires_at?: string | null
          updated_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          query_id: string
          content: string
          created_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          query_id: string
          content?: string
          created_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          query_id?: string
          content?: string
          created_at?: string
          updated_at?: string
          user_id?: string | null
        }
      }
    }
  }
}
