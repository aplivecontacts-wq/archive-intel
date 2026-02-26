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
          objective: string | null
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          title: string
          tags?: Json
          objective?: string | null
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          tags?: Json
          objective?: string | null
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
      user_token_usage: {
        Row: {
          user_id: string
          prompt_tokens: number
          completion_tokens: number
          total_tokens: number
          updated_at: string
        }
        Insert: {
          user_id: string
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          updated_at?: string
        }
        Update: {
          user_id?: string
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
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
          source_tier: 'primary' | 'secondary' | null
          extracted_text: string | null
          extracted_at: string | null
          extraction_error: string | null
          extracted_facts: { key_claims: string[]; key_entities: string[]; key_dates: string[]; summary: string } | null
          ai_summary: string | null
          ai_key_facts: string[] | null
          ai_entities: { name: string; type: string; context: string }[] | null
          ai_analyzed_at: string | null
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
          source_tier?: 'primary' | 'secondary' | null
          extracted_text?: string | null
          extracted_at?: string | null
          extraction_error?: string | null
          extracted_facts?: { key_claims: string[]; key_entities: string[]; key_dates: string[]; summary: string } | null
          ai_summary?: string | null
          ai_key_facts?: string[] | null
          ai_entities?: { name: string; type: string; context: string }[] | null
          ai_analyzed_at?: string | null
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
          source_tier?: 'primary' | 'secondary' | null
          extracted_text?: string | null
          extracted_at?: string | null
          extraction_error?: string | null
          extracted_facts?: { key_claims: string[]; key_entities: string[]; key_dates: string[]; summary: string } | null
          ai_summary?: string | null
          ai_key_facts?: string[] | null
          ai_entities?: { name: string; type: string; context: string }[] | null
          ai_analyzed_at?: string | null
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
      case_entities: {
        Row: {
          id: string
          case_id: string
          user_id: string
          name: string
          entity_type: string
          mention_count: number
          created_at: string
        }
        Insert: {
          id?: string
          case_id: string
          user_id: string
          name: string
          entity_type: string
          mention_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          user_id?: string
          name?: string
          entity_type?: string
          mention_count?: number
          created_at?: string
        }
      }
      entity_mentions: {
        Row: {
          id: string
          case_id: string
          user_id: string
          entity_id: string
          evidence_kind: string
          evidence_id: string
          query_id: string | null
          source_ref: string | null
          context_snippet: string | null
          created_at: string
        }
        Insert: {
          id?: string
          case_id: string
          user_id: string
          entity_id: string
          evidence_kind: string
          evidence_id: string
          query_id?: string | null
          source_ref?: string | null
          context_snippet?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          user_id?: string
          entity_id?: string
          evidence_kind?: string
          evidence_id?: string
          query_id?: string | null
          source_ref?: string | null
          context_snippet?: string | null
          created_at?: string
        }
      }
      case_tasks: {
        Row: {
          id: string
          case_id: string
          user_id: string
          title: string
          detail: string | null
          priority: string
          status: string
          linked_entity_ids: string[] | null
          linked_evidence_ids: string[] | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          case_id: string
          user_id: string
          title: string
          detail?: string | null
          priority?: string
          status?: string
          linked_entity_ids?: string[] | null
          linked_evidence_ids?: string[] | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          user_id?: string
          title?: string
          detail?: string | null
          priority?: string
          status?: string
          linked_entity_ids?: string[] | null
          linked_evidence_ids?: string[] | null
          source?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
