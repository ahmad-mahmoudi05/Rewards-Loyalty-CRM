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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_profile_id: string | null
          after: Json | null
          before: Json | null
          business_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          after?: Json | null
          before?: Json | null
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          after?: Json | null
          before?: Json | null
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          action_result: Json
          automation_id: string
          business_id: string
          customer_id: string
          dedupe_key: string
          id: string
          message_id: string | null
          status: string
          trigger_entity_id: string | null
          triggered_at: string
        }
        Insert: {
          action_result?: Json
          automation_id: string
          business_id: string
          customer_id: string
          dedupe_key: string
          id?: string
          message_id?: string | null
          status?: string
          trigger_entity_id?: string | null
          triggered_at?: string
        }
        Update: {
          action_result?: Json
          automation_id?: string
          business_id?: string
          customer_id?: string
          dedupe_key?: string
          id?: string
          message_id?: string | null
          status?: string
          trigger_entity_id?: string | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          business_id: string
          channel: string
          configuration: Json
          created_at: string
          enabled: boolean
          id: string
          message_template_id: string | null
          name: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          business_id: string
          channel: string
          configuration?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          message_template_id?: string | null
          name: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          channel?: string
          configuration?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          message_template_id?: string | null
          name?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_message_template_id_fkey"
            columns: ["message_template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      business_branding: {
        Row: {
          background_color: string
          business_id: string
          button_style: string
          created_at: string
          custom_terminology: Json
          font_family: string | null
          id: string
          logo_url: string | null
          primary_color: string
          secondary_color: string | null
          square_logo_url: string | null
          text_color: string
          updated_at: string
          wallet_logo_url: string | null
          white_label_level: string
        }
        Insert: {
          background_color?: string
          business_id: string
          button_style?: string
          created_at?: string
          custom_terminology?: Json
          font_family?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string | null
          square_logo_url?: string | null
          text_color?: string
          updated_at?: string
          wallet_logo_url?: string | null
          white_label_level?: string
        }
        Update: {
          background_color?: string
          business_id?: string
          button_style?: string
          created_at?: string
          custom_terminology?: Json
          font_family?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string | null
          square_logo_url?: string | null
          text_color?: string
          updated_at?: string
          wallet_logo_url?: string | null
          white_label_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_branding_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_integrations: {
        Row: {
          business_id: string
          config: Json
          connected_at: string | null
          created_at: string
          id: string
          provider: string
          secrets_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          config?: Json
          connected_at?: string | null
          created_at?: string
          id?: string
          provider: string
          secrets_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          config?: Json
          connected_at?: string | null
          created_at?: string
          id?: string
          provider?: string
          secrets_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_invitations: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          invited_by: string | null
          permissions: Json
          profile_id: string
          role: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          profile_id: string
          role: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Json
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          business_type: string
          country: string
          created_at: string
          currency: string
          id: string
          name: string
          owner_profile_id: string
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          business_type?: string
          country?: string
          created_at?: string
          currency?: string
          id?: string
          name: string
          owner_profile_id: string
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          business_type?: string
          country?: string
          created_at?: string
          currency?: string
          id?: string
          name?: string
          owner_profile_id?: string
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          attempt_count: number
          business_id: string
          campaign_id: string
          channel_address: string
          clicked_at: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          next_attempt_at: string | null
          provider_message_id: string | null
          read_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          attempt_count?: number
          business_id: string
          campaign_id: string
          channel_address: string
          clicked_at?: string | null
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          next_attempt_at?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempt_count?: number
          business_id?: string
          campaign_id?: string
          channel_address?: string
          clicked_at?: string | null
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          next_attempt_at?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience_definition: Json
          business_id: string
          channel: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          message_body: string | null
          message_template_id: string | null
          name: string
          offer_description: string | null
          offer_expiry_days: number | null
          offer_type: string | null
          offer_value: number | null
          scheduled_at: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          audience_definition?: Json
          business_id: string
          channel: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message_body?: string | null
          message_template_id?: string | null
          name: string
          offer_description?: string | null
          offer_expiry_days?: number | null
          offer_type?: string | null
          offer_value?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          audience_definition?: Json
          business_id?: string
          channel?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message_body?: string | null
          message_template_id?: string | null
          name?: string
          offer_description?: string | null
          offer_expiry_days?: number | null
          offer_type?: string | null
          offer_value?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_message_template_id_fkey"
            columns: ["message_template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_consents: {
        Row: {
          business_id: string
          channel: string
          consented_at: string | null
          created_at: string
          customer_id: string
          id: string
          policy_version: string | null
          revoked_at: string | null
          source: string | null
          status: string
        }
        Insert: {
          business_id: string
          channel: string
          consented_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          policy_version?: string | null
          revoked_at?: string | null
          source?: string | null
          status: string
        }
        Update: {
          business_id?: string
          channel?: string
          consented_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          policy_version?: string | null
          revoked_at?: string | null
          source?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_consents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_offers: {
        Row: {
          business_id: string
          campaign_id: string | null
          created_at: string
          customer_id: string
          expires_at: string | null
          id: string
          offer_type: string
          redeemed_at: string | null
          status: string
          valid_from: string
          value: number | null
        }
        Insert: {
          business_id: string
          campaign_id?: string | null
          created_at?: string
          customer_id: string
          expires_at?: string | null
          id?: string
          offer_type: string
          redeemed_at?: string | null
          status?: string
          valid_from?: string
          value?: number | null
        }
        Update: {
          business_id?: string
          campaign_id?: string | null
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          offer_type?: string
          redeemed_at?: string | null
          status?: string
          valid_from?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_offers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_offers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          created_at: string
          customer_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          birthday: string | null
          business_id: string
          created_at: string
          email: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string | null
          notes: string | null
          phone_normalized: string
          phone_raw: string
          source: string
          unsubscribe_token: string
          updated_at: string
          wallet_token: string
        }
        Insert: {
          birthday?: string | null
          business_id: string
          created_at?: string
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone_normalized: string
          phone_raw: string
          source?: string
          unsubscribe_token?: string
          updated_at?: string
          wallet_token?: string
        }
        Update: {
          birthday?: string | null
          business_id?: string
          created_at?: string
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone_normalized?: string
          phone_raw?: string
          source?: string
          unsubscribe_token?: string
          updated_at?: string
          wallet_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_messages: {
        Row: {
          body: string | null
          business_id: string | null
          channel: string
          created_at: string
          customer_id: string | null
          from_address: string
          id: string
          is_optout: boolean
          provider_message_id: string | null
          raw_payload: Json
          to_address: string | null
        }
        Insert: {
          body?: string | null
          business_id?: string | null
          channel: string
          created_at?: string
          customer_id?: string | null
          from_address: string
          id?: string
          is_optout?: boolean
          provider_message_id?: string | null
          raw_payload?: Json
          to_address?: string | null
        }
        Update: {
          body?: string | null
          business_id?: string | null
          channel?: string
          created_at?: string
          customer_id?: string | null
          from_address?: string
          id?: string
          is_optout?: boolean
          provider_message_id?: string | null
          raw_payload?: Json
          to_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          id: string
          is_primary: boolean
          map_url: string | null
          name: string
          phone: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          map_url?: string | null
          name: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          map_url?: string | null
          name?: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_accounts: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          id: string
          lifetime_points: number
          loyalty_program_id: string
          points_balance: number
          stamps_count: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          lifetime_points?: number
          loyalty_program_id: string
          points_balance?: number
          stamps_count?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          lifetime_points?: number
          loyalty_program_id?: string
          points_balance?: number
          stamps_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_accounts_loyalty_program_id_fkey"
            columns: ["loyalty_program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          allow_multiple_rewards: boolean
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          points_min_transaction_value: number | null
          points_per_currency_unit: number | null
          points_reward_threshold: number | null
          progress_resets_on_redeem: boolean
          reward_description: string | null
          reward_expiry_days: number | null
          reward_name: string
          reward_type: string
          reward_value: number | null
          stamp_min_transaction_value: number | null
          stamp_required_count: number | null
          type: string
          updated_at: string
        }
        Insert: {
          allow_multiple_rewards?: boolean
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          points_min_transaction_value?: number | null
          points_per_currency_unit?: number | null
          points_reward_threshold?: number | null
          progress_resets_on_redeem?: boolean
          reward_description?: string | null
          reward_expiry_days?: number | null
          reward_name: string
          reward_type?: string
          reward_value?: number | null
          stamp_min_transaction_value?: number | null
          stamp_required_count?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          allow_multiple_rewards?: boolean
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          points_min_transaction_value?: number | null
          points_per_currency_unit?: number | null
          points_reward_threshold?: number | null
          progress_resets_on_redeem?: boolean
          reward_description?: string | null
          reward_expiry_days?: number | null
          reward_name?: string
          reward_type?: string
          reward_value?: number | null
          stamp_min_transaction_value?: number | null
          stamp_required_count?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          description: string | null
          id: string
          location_id: string | null
          loyalty_program_id: string
          points_delta: number
          reversal_reason: string | null
          reversed_at: string | null
          source_transaction_id: string | null
          staff_user_id: string | null
          stamps_delta: number
          transaction_type: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          location_id?: string | null
          loyalty_program_id: string
          points_delta?: number
          reversal_reason?: string | null
          reversed_at?: string | null
          source_transaction_id?: string | null
          staff_user_id?: string | null
          stamps_delta?: number
          transaction_type: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          location_id?: string | null
          loyalty_program_id?: string
          points_delta?: number
          reversal_reason?: string | null
          reversed_at?: string | null
          source_transaction_id?: string | null
          staff_user_id?: string | null
          stamps_delta?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_loyalty_program_id_fkey"
            columns: ["loyalty_program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_events: {
        Row: {
          business_id: string
          campaign_recipient_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          provider_message_id: string | null
        }
        Insert: {
          business_id: string
          campaign_recipient_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          provider_message_id?: string | null
        }
        Update: {
          business_id?: string
          campaign_recipient_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          provider_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_events_campaign_recipient_id_fkey"
            columns: ["campaign_recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          business_id: string
          category: string | null
          channel: string
          components: Json
          content: string
          created_at: string
          id: string
          language: string
          last_synced_at: string | null
          name: string
          provider_template_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          category?: string | null
          channel: string
          components?: Json
          content: string
          created_at?: string
          id?: string
          language?: string
          last_synced_at?: string | null
          name: string
          provider_template_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          category?: string | null
          channel?: string
          components?: Json
          content?: string
          created_at?: string
          id?: string
          language?: string
          last_synced_at?: string | null
          name?: string
          provider_template_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          advanced_analytics: boolean
          automation_enabled: boolean
          code: string
          created_at: string
          currency: string
          custom_domain_enabled: boolean
          email_enabled: boolean
          id: string
          max_customers: number
          max_locations: number
          max_staff: number
          name: string
          price_monthly: number
          sms_enabled: boolean
          whatsapp_enabled: boolean
          white_label_enabled: boolean
        }
        Insert: {
          advanced_analytics?: boolean
          automation_enabled?: boolean
          code: string
          created_at?: string
          currency?: string
          custom_domain_enabled?: boolean
          email_enabled?: boolean
          id?: string
          max_customers: number
          max_locations: number
          max_staff: number
          name: string
          price_monthly: number
          sms_enabled?: boolean
          whatsapp_enabled?: boolean
          white_label_enabled?: boolean
        }
        Update: {
          advanced_analytics?: boolean
          automation_enabled?: boolean
          code?: string
          created_at?: string
          currency?: string
          custom_domain_enabled?: boolean
          email_enabled?: boolean
          id?: string
          max_customers?: number
          max_locations?: number
          max_staff?: number
          name?: string
          price_monthly?: number
          sms_enabled?: boolean
          whatsapp_enabled?: boolean
          white_label_enabled?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_platform_admin: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_platform_admin?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          business_id: string
          customer_id: string
          id: string
          location_id: string | null
          notes: string | null
          redeemed_at: string
          reward_id: string
          staff_user_id: string | null
        }
        Insert: {
          business_id: string
          customer_id: string
          id?: string
          location_id?: string | null
          notes?: string | null
          redeemed_at?: string
          reward_id: string
          staff_user_id?: string | null
        }
        Update: {
          business_id?: string
          customer_id?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          redeemed_at?: string
          reward_id?: string
          staff_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: true
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          description: string | null
          expires_at: string | null
          generated_at: string
          id: string
          loyalty_account_id: string
          loyalty_program_id: string
          name: string
          redeemed_at: string | null
          reward_type: string
          source_loyalty_transaction_id: string | null
          status: string
          value: number | null
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          description?: string | null
          expires_at?: string | null
          generated_at?: string
          id?: string
          loyalty_account_id: string
          loyalty_program_id: string
          name: string
          redeemed_at?: string | null
          reward_type: string
          source_loyalty_transaction_id?: string | null
          status?: string
          value?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          description?: string | null
          expires_at?: string | null
          generated_at?: string
          id?: string
          loyalty_account_id?: string
          loyalty_program_id?: string
          name?: string
          redeemed_at?: string | null
          reward_type?: string
          source_loyalty_transaction_id?: string | null
          status?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rewards_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_loyalty_account_id_fkey"
            columns: ["loyalty_account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_loyalty_program_id_fkey"
            columns: ["loyalty_program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_source_loyalty_transaction_id_fkey"
            columns: ["source_loyalty_transaction_id"]
            isOneToOne: false
            referencedRelation: "loyalty_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          business_id: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          business_id: string
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          business_id: string
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          business_id?: string
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          business_id: string
          created_at: string
          currency: string
          customer_id: string
          external_reference: string | null
          id: string
          location_id: string | null
          metadata: Json
          source: string
          staff_user_id: string | null
          status: string
          subtotal: number | null
          total: number
        }
        Insert: {
          business_id: string
          created_at?: string
          currency?: string
          customer_id: string
          external_reference?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json
          source?: string
          staff_user_id?: string | null
          status?: string
          subtotal?: number | null
          total: number
        }
        Update: {
          business_id?: string
          created_at?: string
          currency?: string
          customer_id?: string
          external_reference?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json
          source?: string
          staff_user_id?: string | null
          status?: string
          subtotal?: number | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          business_id: string
          created_at: string
          id: string
          metric: string
          period_end: string
          period_start: string
          quantity: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          metric: string
          period_end: string
          period_start: string
          quantity: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          metric?: string
          period_end?: string
          period_start?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_passes: {
        Row: {
          auth_token: string | null
          business_id: string
          created_at: string
          customer_id: string
          id: string
          last_pushed_at: string | null
          pass_type_identifier: string | null
          platform: string
          serial_number: string | null
        }
        Insert: {
          auth_token?: string | null
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          last_pushed_at?: string | null
          pass_type_identifier?: string | null
          platform: string
          serial_number?: string | null
        }
        Update: {
          auth_token?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          last_pushed_at?: string | null
          pass_type_identifier?: string | null
          platform?: string
          serial_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_passes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_passes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_passes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      customer_summary: {
        Row: {
          available_rewards_count: number | null
          birthday: string | null
          business_id: string | null
          created_at: string | null
          email: string | null
          email_subscribed: boolean | null
          first_name: string | null
          id: string | null
          last_name: string | null
          last_transaction_at: string | null
          loyalty_program_id: string | null
          loyalty_program_name: string | null
          loyalty_type: string | null
          notes: string | null
          phone_normalized: string | null
          phone_raw: string | null
          points_balance: number | null
          points_reward_threshold: number | null
          sms_subscribed: boolean | null
          source: string | null
          stamp_required_count: number | null
          stamps_count: number | null
          total_spend: number | null
          transaction_count: number | null
          unsubscribe_token: string | null
          updated_at: string | null
          wallet_token: string | null
          whatsapp_subscribed: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_accounts_loyalty_program_id_fkey"
            columns: ["loyalty_program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_business_invitation: { Args: { p_token: string }; Returns: Json }
      claim_queued_recipients: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          business_id: string
          campaign_id: string
          channel_address: string
          clicked_at: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          next_attempt_at: string | null
          provider_message_id: string | null
          read_at: string | null
          sent_at: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "campaign_recipients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ensure_system_tag: {
        Args: { p_business_id: string; p_color?: string; p_name: string }
        Returns: string
      }
      finalize_campaign_if_complete: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      grant_automation_bonus: {
        Args: {
          p_business_id: string
          p_customer_id: string
          p_description?: string
          p_loyalty_program_id: string
          p_points_delta?: number
          p_stamps_delta?: number
        }
        Returns: Json
      }
      record_transaction: {
        Args: {
          p_business_id: string
          p_currency?: string
          p_customer_id: string
          p_external_reference?: string
          p_location_id?: string
          p_loyalty_program_id: string
          p_subtotal?: number
          p_total: number
        }
        Returns: Json
      }
      redeem_customer_offer: {
        Args: {
          p_business_id: string
          p_location_id?: string
          p_offer_id: string
        }
        Returns: Json
      }
      redeem_reward: {
        Args: {
          p_business_id: string
          p_location_id?: string
          p_notes?: string
          p_reward_id: string
        }
        Returns: Json
      }
      reverse_transaction: {
        Args: {
          p_business_id: string
          p_reason?: string
          p_transaction_id: string
        }
        Returns: Json
      }
      rotate_customer_wallet_token: {
        Args: { p_business_id: string; p_customer_id: string }
        Returns: Json
      }
      snapshot_campaign_recipients: {
        Args: {
          p_business_id: string
          p_campaign_id: string
          p_customer_ids: string[]
        }
        Returns: Json
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
