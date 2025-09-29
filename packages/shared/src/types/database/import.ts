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
      agents: {
        Row: {
          created_at: string | null
          ext_address: string | null
          guid: string
          hostname: string
          id: string
          ip_address: string | null
          last_checkin_at: string | null
          last_online_at: string | null
          mac_address: string | null
          online: boolean
          platform: string
          registered_at: string | null
          site_id: string
          tenant_id: string
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          ext_address?: string | null
          guid: string
          hostname: string
          id?: string
          ip_address?: string | null
          last_checkin_at?: string | null
          last_online_at?: string | null
          mac_address?: string | null
          online: boolean
          platform?: string
          registered_at?: string | null
          site_id: string
          tenant_id: string
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          ext_address?: string | null
          guid?: string
          hostname?: string
          id?: string
          ip_address?: string | null
          last_checkin_at?: string | null
          last_online_at?: string | null
          mac_address?: string | null
          online?: boolean
          platform?: string
          registered_at?: string | null
          site_id?: string
          tenant_id?: string
          updated_at?: string | null
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
      data_source_to_site: {
        Row: {
          created_at: string
          data_source_id: string
          id: string
          site_id: string
        }
        Insert: {
          created_at?: string
          data_source_id: string
          id?: string
          site_id: string
        }
        Update: {
          created_at?: string
          data_source_id?: string
          id?: string
          site_id?: string
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
        ]
      }
      data_sources: {
        Row: {
          config: Json
          created_at: string
          credential_expiration_at: string
          external_id: string | null
          id: string
          integration_id: string
          metadata: Json | null
          site_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config: Json
          created_at?: string
          credential_expiration_at: string
          external_id?: string | null
          id?: string
          integration_id: string
          metadata?: Json | null
          site_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          credential_expiration_at?: string
          external_id?: string | null
          id?: string
          integration_id?: string
          metadata?: Json | null
          site_id?: string | null
          status?: string
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
          status: string
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
          status?: string
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
          status?: string
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
          description: string
          id: string
          name: string
          rights: Json
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          name: string
          rights?: Json
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
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
          status: string
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
          status?: string
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
          status?: string
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
          id: string
          metadata: Json | null
          name: string
          psa_company_id: string | null
          psa_integration_id: string | null
          psa_parent_company_id: string | null
          slug: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          psa_company_id?: string | null
          psa_integration_id?: string | null
          psa_parent_company_id?: string | null
          slug?: string
          status: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          psa_company_id?: string | null
          psa_integration_id?: string | null
          psa_parent_company_id?: string | null
          slug?: string
          status?: string
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
          email: string
          id: string
          last_activity_at: string | null
          name: string
          role_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          last_activity_at?: string | null
          name: string
          role_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_activity_at?: string | null
          name?: string
          role_id?: string
          status?: string
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
      [_ in never]: never
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
      autotask_companies_view: {
        Row: {
          created_at: string | null
          external_id: string | null
          id: string | null
          integration_id: string | null
          is_linked: boolean | null
          linked_site_id: string | null
          linked_site_name: string | null
          linked_site_slug: string | null
          linked_site_status: string | null
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
            referencedRelation: "autotask_companies_view"
            referencedColumns: ["linked_site_id"]
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
          psa_parent_company_id: string | null
          slug: string | null
          status: string | null
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
          data_source_status: string | null
          id: string | null
          is_linked: boolean | null
          linked_tenant_api_host: string | null
          linked_tenant_id: string | null
          linked_tenant_name: string | null
          mapped_at: string | null
          name: string | null
          slug: string | null
          status: string | null
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
          name: string | null
          role_description: string | null
          role_id: string | null
          role_name: string | null
          role_rights: Json | null
          status: string | null
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
    Enums: {},
  },
  views: {
    Enums: {},
  },
} as const
