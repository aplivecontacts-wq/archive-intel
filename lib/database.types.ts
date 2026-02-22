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
      note_attachments: {
        Row: {
          id: string
          user_id: string
          query_id: string
          file_name: string
          mime_type: string
          size_bytes: number
          storage_path: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          query_id: string
          file_name: string
          mime_type: string
          size_bytes: number
          storage_path: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          query_id?: string
          file_name?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          created_at?: string
        }
      }
      case_briefs: {
        Row: {
          id: string
          case_id: string
          clerk_user_id: string
          version_number: number
          brief_json: Json
          evidence_counts: Json | null
          user_note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          case_id: string
          clerk_user_id: string
          version_number: number
          brief_json: Json
          evidence_counts?: Json | null
          user_note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          clerk_user_id?: string
          version_number?: number
          brief_json?: Json
          evidence_counts?: Json | null
          user_note?: string | null
          created_at?: string
        }
      }
      saved_links: {
        Row: {
          id: string
          user_id: string
          source: 'archive' | 'query' | 'official'
          url: string
          title: string | null
          snippet: string | null
          captured_at: string | null
          query_id: string | null
          case_id: string | null
          link_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source: 'archive' | 'query' | 'official'
          url: string
          title?: string | null
          snippet?: string | null
          captured_at?: string | null
          query_id?: string | null
          case_id?: string | null
          link_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source?: 'archive' | 'query' | 'official'
          url?: string
          title?: string | null
          snippet?: string | null
          captured_at?: string | null
          query_id?: string | null
          case_id?: string | null
          link_notes?: string | null
          created_at?: string
        }
      }
      saved_link_notes: {
        Row: {
          id: string
          saved_link_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          saved_link_id: string
          content?: string
          created_at?: string
        }
        Update: {
          id?: string
          saved_link_id?: string
          content?: string
          created_at?: string
        }
      }
    }
  }
}
