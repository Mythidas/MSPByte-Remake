export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agent_api_logs: {
        Row: {
          agent_id: string
          created_at: string | null
          endpoint: string
          error_message: string | null
          external_id: string | null
          id: string
          method: Database["public"]["Enums"]["http_method"]
          psa_site_id: string | null
          req_metadata: Json
          res_metadata: Json
          rmm_device_id: string | null
          site_id: string
          status_code: number
          tenant_id: string
          time_elapsed_ms: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          endpoint: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          method: Database["public"]["Enums"]["http_method"]
          psa_site_id?: string | null
          req_metadata: Json
          res_metadata: Json
          rmm_device_id?: string | null
          site_id: string
          status_code: number
          tenant_id: string
          time_elapsed_ms?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          endpoint?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["http_method"]
          psa_site_id?: string | null
          req_metadata?: Json
          res_metadata?: Json
          rmm_device_id?: string | null
          site_id?: string
          status_code?: number
          tenant_id?: string
          time_elapsed_ms?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_api_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_api_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_api_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          created_at: string
          deleted_at: string | null
          ext_address: string | null
          guid: string
          hostname: string
          id: string
          ip_address: string | null
          last_checkin_at: string | null
          mac_address: string | null
          platform: string
          registered_at: string | null
          site_id: string
          tenant_id: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          ext_address?: string | null
          guid: string
          hostname: string
          id?: string
          ip_address?: string | null
          last_checkin_at?: string | null
          mac_address?: string | null
          platform?: string
          registered_at?: string | null
          site_id: string
          tenant_id: string
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          ext_address?: string | null
          guid?: string
          hostname?: string
          id?: string
          ip_address?: string | null
          last_checkin_at?: string | null
          mac_address?: string | null
          platform?: string
          registered_at?: string | null
          site_id?: string
          tenant_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_logs: {
        Row: {
          body: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          expires_at: string
          headers: Json | null
          id: string
          method: string
          response_body: string | null
          response_headers: Json | null
          status_code: number | null
          url: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          expires_at?: string
          headers?: Json | null
          id?: string
          method: string
          response_body?: string | null
          response_headers?: Json | null
          status_code?: number | null
          url: string
        }
        Update: {
          body?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          expires_at?: string
          headers?: Json | null
          id?: string
          method?: string
          response_body?: string | null
          response_headers?: Json | null
          status_code?: number | null
          url?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          changes: Json
          created_at: string
          id: string
          record_id: string
          table_name: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changes?: Json
          created_at?: string
          id?: string
          record_id: string
          table_name: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changes?: Json
          created_at?: string
          id?: string
          record_id?: string
          table_name?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      data_source_to_site: {
        Row: {
          created_at: string
          data_source_id: string
          deleted_at: string | null
          id: string
          site_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          data_source_id: string
          deleted_at?: string | null
          id?: string
          site_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          data_source_id?: string
          deleted_at?: string | null
          id?: string
          site_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_source_to_site_date_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_source_to_site_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_source_to_site_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          config: Json
          created_at: string
          credential_expiration_at: string
          deleted_at: string | null
          external_id: string | null
          id: string
          integration_id: string
          metadata: Json | null
          site_id: string | null
          status: Database["public"]["Enums"]["data_source_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config: Json
          created_at?: string
          credential_expiration_at: string
          deleted_at?: string | null
          external_id?: string | null
          id?: string
          integration_id: string
          metadata?: Json | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["data_source_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          credential_expiration_at?: string
          deleted_at?: string | null
          external_id?: string | null
          id?: string
          integration_id?: string
          metadata?: Json | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["data_source_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_sources_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_sources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          created_at: string
          data_hash: string
          data_source_id: string
          entity_type: string
          external_id: string
          id: string
          integration_id: string
          normalized_data: Json
          raw_data: Json
          site_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_hash: string
          data_source_id: string
          entity_type: string
          external_id: string
          id?: string
          integration_id: string
          normalized_data: Json
          raw_data: Json
          site_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_hash?: string
          data_source_id?: string
          entity_type?: string
          external_id?: string
          id?: string
          integration_id?: string
          normalized_data?: Json
          raw_data?: Json
          site_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_relationships: {
        Row: {
          child_entity_id: string
          created_at: string
          id: string
          metadata: Json | null
          parent_entity_id: string
          relationship_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          child_entity_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          parent_entity_id: string
          relationship_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          child_entity_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          parent_entity_id?: string
          relationship_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_relationships_child_entity_id_fkey"
            columns: ["child_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relationships_parent_entity_id_fkey"
            columns: ["parent_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relationships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      events_log: {
        Row: {
          created_at: string
          entity_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string
          retry_count: number | null
          status: Database["public"]["Enums"]["event_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at: string
          retry_count?: number | null
          status?: Database["public"]["Enums"]["event_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string
          retry_count?: number | null
          status?: Database["public"]["Enums"]["event_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_log_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      global_entities: {
        Row: {
          created_at: string
          data_hash: string
          entity_type: string
          external_id: string
          id: string
          integration_id: string
          normalized_data: Json
          raw_data: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_hash: string
          entity_type: string
          external_id: string
          id?: string
          integration_id: string
          normalized_data: Json
          raw_data: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_hash?: string
          entity_type?: string
          external_id?: string
          id?: string
          integration_id?: string
          normalized_data?: Json
          raw_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_entities_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      health_checks: {
        Row: {
          created_at: string
          error_message: string | null
          failure_count: number
          id: string
          last_check_at: string
          last_failure_at: string | null
          last_success_at: string | null
          metadata: Json | null
          resource_id: string
          resource_type: Database["public"]["Enums"]["resource_type"]
          status: Database["public"]["Enums"]["health_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          failure_count?: number
          id?: string
          last_check_at?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          metadata?: Json | null
          resource_id: string
          resource_type: Database["public"]["Enums"]["resource_type"]
          status?: Database["public"]["Enums"]["health_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          failure_count?: number
          id?: string
          last_check_at?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          metadata?: Json | null
          resource_id?: string
          resource_type?: Database["public"]["Enums"]["resource_type"]
          status?: Database["public"]["Enums"]["health_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_checks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_pricing_tiers: {
        Row: {
          created_at: string | null
          description: string
          effective_from: string
          effective_until: string | null
          id: string
          integration_id: string
          name: string
          tenant_id: string
          unit_cost: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          integration_id: string
          name: string
          tenant_id: string
          unit_cost: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          integration_id?: string
          name?: string
          tenant_id?: string
          unit_cost?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_pricing_tiers_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_pricing_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          category: string
          color: string | null
          config_schema: Json | null
          created_at: string
          description: string
          icon_url: string | null
          id: string
          is_active: boolean | null
          level: string | null
          name: string
          product_url: string | null
          supported_types: string[]
          updated_at: string
        }
        Insert: {
          category: string
          color?: string | null
          config_schema?: Json | null
          created_at?: string
          description: string
          icon_url?: string | null
          id: string
          is_active?: boolean | null
          level?: string | null
          name: string
          product_url?: string | null
          supported_types?: string[]
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string | null
          config_schema?: Json | null
          created_at?: string
          description?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          level?: string | null
          name?: string
          product_url?: string | null
          supported_types?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          name: string
          rights: Json
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description: string
          id?: string
          name: string
          rights?: Json
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          name?: string
          rights?: Json
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_jobs: {
        Row: {
          action: string
          attempts: number | null
          attempts_max: number | null
          created_at: string
          created_by: string
          data_source_id: string | null
          error: string | null
          id: string
          integration_id: string
          next_retry_at: string | null
          payload: Json
          priority: number | null
          scheduled_at: string
          started_at: string
          status: Database["public"]["Enums"]["job_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          action: string
          attempts?: number | null
          attempts_max?: number | null
          created_at?: string
          created_by: string
          data_source_id?: string | null
          error?: string | null
          id?: string
          integration_id: string
          next_retry_at?: string | null
          payload: Json
          priority?: number | null
          scheduled_at: string
          started_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          action?: string
          attempts?: number | null
          attempts_max?: number | null
          created_at?: string
          created_by?: string
          data_source_id?: string | null
          error?: string | null
          id?: string
          integration_id?: string
          next_retry_at?: string | null
          payload?: Json
          priority?: number | null
          scheduled_at?: string
          started_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_jobs_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          metadata: Json | null
          name: string
          psa_company_id: string | null
          psa_integration_id: string | null
          psa_parent_company_id: string | null
          slug: string
          status: Database["public"]["Enums"]["site_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          name: string
          psa_company_id?: string | null
          psa_integration_id?: string | null
          psa_parent_company_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["site_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          psa_company_id?: string | null
          psa_integration_id?: string | null
          psa_parent_company_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["site_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_psa_integration_id_fkey"
            columns: ["psa_integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_bill_line_items: {
        Row: {
          bill_id: string
          create_at: string | null
          description: string
          id: string
          integration_id: string
          metadata: Json | null
          pricing_tier_id: string
          tenant_id: string
          total: number
          units: number
          unti_cost: number
        }
        Insert: {
          bill_id: string
          create_at?: string | null
          description: string
          id?: string
          integration_id: string
          metadata?: Json | null
          pricing_tier_id: string
          tenant_id: string
          total: number
          units?: number
          unti_cost: number
        }
        Update: {
          bill_id?: string
          create_at?: string | null
          description?: string
          id?: string
          integration_id?: string
          metadata?: Json | null
          pricing_tier_id?: string
          tenant_id?: string
          total?: number
          units?: number
          unti_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_bill_line_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "tenant_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_bill_line_items_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_bill_line_items_pricing_tier_id_fkey"
            columns: ["pricing_tier_id"]
            isOneToOne: false
            referencedRelation: "integration_pricing_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_bill_line_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_billing_adjustments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          effective_from: string
          effective_to: string
          id: string
          integration_id: string | null
          reason: string
          tenant_id: string
          type: Database["public"]["Enums"]["tenant_billing_adjustment_types"]
          updated_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          effective_from: string
          effective_to: string
          id?: string
          integration_id?: string | null
          reason: string
          tenant_id: string
          type: Database["public"]["Enums"]["tenant_billing_adjustment_types"]
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_to?: string
          id?: string
          integration_id?: string | null
          reason?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["tenant_billing_adjustment_types"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_billing_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_billing_adjustments_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_billing_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_bills: {
        Row: {
          created_at: string | null
          finalized_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["tenant_bills_statuses"]
          tenant_id: string
          total: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          finalized_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["tenant_bills_statuses"]
          tenant_id: string
          total?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          finalized_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["tenant_bills_statuses"]
          tenant_id?: string
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_bills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          last_activity_at: string | null
          metadata: Json
          name: string
          role_id: string
          status: Database["public"]["Enums"]["user_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          id: string
          last_activity_at?: string | null
          metadata?: Json
          name: string
          role_id: string
          status?: Database["public"]["Enums"]["user_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          last_activity_at?: string | null
          metadata?: Json
          name?: string
          role_id?: string
          status?: Database["public"]["Enums"]["user_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_random_suuid: {
        Args: { length?: number }
        Returns: string
      }
      get_tenant: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_access: {
        Args: { access: string; module: string }
        Returns: boolean
      }
      is_tenant: {
        Args: { id: string }
        Returns: boolean
      }
    }
    Enums: {
      alert_severity: "info" | "warning" | "error" | "critical"
      alert_type: "credential_expiring" | "credential_expired"
      audit_action: "create" | "update" | "delete" | "restore"
      data_source_status: "active" | "inactive" | "failed" | "expired"
      event_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      health_status: "healthy" | "degraded" | "critical" | "unknown"
      http_method: "GET" | "POST" | "PUT" | "DELETE"
      job_status: "pending" | "running" | "completed" | "failed" | "cancelled"
      resource_type: "data_source" | "agent" | "scheduled_job" | "site"
      site_status: "active" | "inactive"
      tenant_billing_adjustment_types:
        | "percentage"
        | "fixed"
        | "credit"
        | "free"
      tenant_bills_statuses: "draft" | "finalized" | "paid" | "void" | "failed"
      user_status: "active" | "inactive" | "invited"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  views: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      enabled_integrations_view: {
        Row: {
          enabled_integration_count: number | null
          enabled_integration_ids: string[] | null
          enabled_integrations: string[] | null
          tenant_id: string | null
          tenant_name: string | null
        }
        Relationships: []
      }
      integrations_view: {
        Row: {
          category: string | null
          color: string | null
          config_schema: Json | null
          created_at: string | null
          data_sources_count: number | null
          description: string | null
          icon_url: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          product_url: string | null
          supported_types: string[] | null
          updated_at: string | null
        }
        Relationships: []
      }
      microsoft365_identities_view: {
        Row: {
          account_enabled: boolean | null
          created_at: string | null
          department: string | null
          display_name: string | null
          email: string | null
          enabled_policies_applied: number | null
          entity_type: string | null
          external_id: string | null
          group_count: number | null
          group_ids: string[] | null
          group_names: string[] | null
          group_types: string[] | null
          has_conditional_access: boolean | null
          has_security_defaults: boolean | null
          highest_mfa_coverage: string | null
          id: string | null
          job_title: string | null
          last_active: string | null
          last_sign_in_at: string | null
          license_count: number | null
          license_display_names: string[] | null
          license_ids: string[] | null
          license_names: string[] | null
          license_sku_ids: string[] | null
          mfa_enforcement_method: string | null
          mfa_method_count: number | null
          normalized_data: Json | null
          office_location: string | null
          policy_count: number | null
          policy_ids: string[] | null
          policy_names: string[] | null
          policy_states: string[] | null
          policy_types: string[] | null
          role_count: number | null
          role_ids: string[] | null
          role_names: string[] | null
          role_types: string[] | null
          site_id: string | null
          total_policies_applied: number | null
          total_relationships: number | null
          updated_at: string | null
          user_principal_name: string | null
          user_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "psa_companies_view"
            referencedColumns: ["linked_site_id"]
          },
          {
            foreignKeyName: "entities_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "site_integrations_view"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "entities_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_view"
            referencedColumns: ["parent_id"]
          },
          {
            foreignKeyName: "entities_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sophos_partner_sites_view"
            referencedColumns: ["id"]
          },
        ]
      }
      psa_companies_view: {
        Row: {
          created_at: string | null
          external_id: string | null
          external_parent_id: string | null
          id: string | null
          integration_id: string | null
          is_linked: boolean | null
          linked_site_id: string | null
          linked_site_name: string | null
          linked_site_slug: string | null
          linked_site_status: Database["public"]["Enums"]["site_status"] | null
          name: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations_view"
            referencedColumns: ["id"]
          },
        ]
      }
      site_integrations_view: {
        Row: {
          mapped_integration_count: number | null
          mapped_integration_ids: string[] | null
          mapped_integrations: string[] | null
          site_id: string | null
          site_name: string | null
          site_slug: string | null
          tenant_id: string | null
          tenant_name: string | null
        }
        Relationships: []
      }
      sites_view: {
        Row: {
          created_at: string | null
          id: string | null
          metadata: Json | null
          name: string | null
          parent_id: string | null
          parent_name: string | null
          parent_slug: string | null
          psa_company_id: string | null
          psa_integration_id: string | null
          psa_integration_name: string | null
          psa_parent_company_id: string | null
          slug: string | null
          status: Database["public"]["Enums"]["site_status"] | null
          tenant_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_psa_integration_id_fkey"
            columns: ["psa_integration_id"]
            isOneToOne: false
            referencedRelation: "integrations_view"
            referencedColumns: ["id"]
          },
        ]
      }
      sophos_partner_sites_view: {
        Row: {
          created_at: string | null
          data_source_status:
            | Database["public"]["Enums"]["data_source_status"]
            | null
          id: string | null
          is_linked: boolean | null
          linked_tenant_api_host: string | null
          linked_tenant_id: string | null
          linked_tenant_name: string | null
          mapped_at: string | null
          name: string | null
          slug: string | null
          status: Database["public"]["Enums"]["site_status"] | null
          tenant_id: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      users_view: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          last_activity_at: string | null
          metadata: Json | null
          name: string | null
          role_description: string | null
          role_id: string | null
          role_name: string | null
          role_rights: Json | null
          status: Database["public"]["Enums"]["user_status"] | null
          tenant_id: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_severity: ["info", "warning", "error", "critical"],
      alert_type: ["credential_expiring", "credential_expired"],
      audit_action: ["create", "update", "delete", "restore"],
      data_source_status: ["active", "inactive", "failed", "expired"],
      event_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      health_status: ["healthy", "degraded", "critical", "unknown"],
      http_method: ["GET", "POST", "PUT", "DELETE"],
      job_status: ["pending", "running", "completed", "failed", "cancelled"],
      resource_type: ["data_source", "agent", "scheduled_job", "site"],
      site_status: ["active", "inactive"],
      tenant_billing_adjustment_types: [
        "percentage",
        "fixed",
        "credit",
        "free",
      ],
      tenant_bills_statuses: ["draft", "finalized", "paid", "void", "failed"],
      user_status: ["active", "inactive", "invited"],
    },
  },
  views: {
    Enums: {},
  },
} as const
