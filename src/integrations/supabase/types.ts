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
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_kind: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_kind?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_kind?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          agent: Database["public"]["Enums"]["ai_agent"]
          created_at: string
          deleted_at: string | null
          id: string
          message_count: number
          metadata: Json
          model: string | null
          provider: string | null
          status: string
          title: string | null
          total_cost_micros: number
          total_tokens: number
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent?: Database["public"]["Enums"]["ai_agent"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          message_count?: number
          metadata?: Json
          model?: string | null
          provider?: string | null
          status?: string
          title?: string | null
          total_cost_micros?: number
          total_tokens?: number
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent?: Database["public"]["Enums"]["ai_agent"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          message_count?: number
          metadata?: Json
          model?: string | null
          provider?: string | null
          status?: string
          title?: string | null
          total_cost_micros?: number
          total_tokens?: number
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string | null
          content_structured: Json | null
          conversation_id: string
          cost_micros: number | null
          created_at: string
          finish_reason: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string | null
          output_tokens: number | null
          position: number
          prompt_template_id: string | null
          role: Database["public"]["Enums"]["ai_role"]
          tool_input: Json | null
          tool_name: string | null
          tool_output: Json | null
        }
        Insert: {
          content?: string | null
          content_structured?: Json | null
          conversation_id: string
          cost_micros?: number | null
          created_at?: string
          finish_reason?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          position?: number
          prompt_template_id?: string | null
          role: Database["public"]["Enums"]["ai_role"]
          tool_input?: Json | null
          tool_name?: string | null
          tool_output?: Json | null
        }
        Update: {
          content?: string | null
          content_structured?: Json | null
          conversation_id?: string
          cost_micros?: number | null
          created_at?: string
          finish_reason?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          position?: number
          prompt_template_id?: string | null
          role?: Database["public"]["Enums"]["ai_role"]
          tool_input?: Json | null
          tool_name?: string | null
          tool_output?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_prompt_template_id_fkey"
            columns: ["prompt_template_id"]
            isOneToOne: false
            referencedRelation: "prompt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_planner_history: {
        Row: {
          conversation_id: string | null
          cost_micros: number | null
          created_at: string
          duration_ms: number | null
          id: string
          model: string | null
          plan: Json
          request: Json
          tokens_input: number | null
          tokens_output: number | null
          trip_id: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          cost_micros?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          model?: string | null
          plan: Json
          request: Json
          tokens_input?: number | null
          tokens_output?: number | null
          trip_id?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          cost_micros?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          model?: string | null
          plan?: Json
          request?: Json
          tokens_input?: number | null
          tokens_output?: number | null
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_planner_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_planner_history_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_planner_history_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendations: {
        Row: {
          agent: Database["public"]["Enums"]["ai_agent"]
          clicked_at: string | null
          created_at: string
          dismissed_at: string | null
          expires_at: string | null
          id: string
          payload: Json
          reason: string | null
          score: number | null
          shown_at: string | null
          subject_id: string | null
          subject_kind: string
          user_id: string
        }
        Insert: {
          agent: Database["public"]["Enums"]["ai_agent"]
          clicked_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          score?: number | null
          shown_at?: string | null
          subject_id?: string | null
          subject_kind: string
          user_id: string
        }
        Update: {
          agent?: Database["public"]["Enums"]["ai_agent"]
          clicked_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          score?: number | null
          shown_at?: string | null
          subject_id?: string | null
          subject_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          agent: Database["public"]["Enums"]["ai_agent"] | null
          conversation_id: string | null
          cost_micros: number
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          input_tokens: number
          model: string
          operation: string
          output_tokens: number
          provider: string
          status: string
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          agent?: Database["public"]["Enums"]["ai_agent"] | null
          conversation_id?: string | null
          cost_micros?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          input_tokens?: number
          model: string
          operation: string
          output_tokens?: number
          provider: string
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          agent?: Database["public"]["Enums"]["ai_agent"] | null
          conversation_id?: string | null
          cost_micros?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          input_tokens?: number
          model?: string
          operation?: string
          output_tokens?: number
          provider?: string
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_sessions: {
        Row: {
          device_id: string | null
          ended_at: string | null
          id: string
          ip: unknown
          last_active_at: string
          location: string | null
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          device_id?: string | null
          ended_at?: string | null
          id?: string
          ip?: unknown
          last_active_at?: string
          location?: string | null
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          device_id?: string | null
          ended_at?: string | null
          id?: string
          ip?: unknown
          last_active_at?: string
          location?: string | null
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          ip: unknown
          target_id: string | null
          target_table: string | null
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip?: unknown
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip?: unknown
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      booking_history: {
        Row: {
          booking_id: string
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: string
          metadata: Json
          reason: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          metadata?: Json
          reason?: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          metadata?: Json
          reason?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_items: {
        Row: {
          booking_id: string
          created_at: string
          description: string | null
          ends_at: string | null
          experience_id: string | null
          flight_id: string | null
          hotel_id: string | null
          id: string
          item_type: Database["public"]["Enums"]["booking_type"]
          metadata: Json
          quantity: number
          restaurant_id: string | null
          starts_at: string | null
          title: string
          total_cents: number
          travelers: Json
          unit_price_cents: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          experience_id?: string | null
          flight_id?: string | null
          hotel_id?: string | null
          id?: string
          item_type: Database["public"]["Enums"]["booking_type"]
          metadata?: Json
          quantity?: number
          restaurant_id?: string | null
          starts_at?: string | null
          title: string
          total_cents?: number
          travelers?: Json
          unit_price_cents?: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          experience_id?: string | null
          flight_id?: string | null
          hotel_id?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["booking_type"]
          metadata?: Json
          quantity?: number
          restaurant_id?: string | null
          starts_at?: string | null
          title?: string
          total_cents?: number
          travelers?: Json
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_type: Database["public"]["Enums"]["booking_type"]
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          ends_at: string | null
          fees_cents: number
          id: string
          metadata: Json
          primary_traveler_name: string | null
          provider_id: string | null
          provider_ref: string | null
          reference: string
          starts_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_type: Database["public"]["Enums"]["booking_type"]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          ends_at?: string | null
          fees_cents?: number
          id?: string
          metadata?: Json
          primary_traveler_name?: string | null
          provider_id?: string | null
          provider_ref?: string | null
          reference: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_type?: Database["public"]["Enums"]["booking_type"]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          ends_at?: string | null
          fees_cents?: number
          id?: string
          metadata?: Json
          primary_traveler_name?: string | null
          provider_id?: string | null
          provider_ref?: string | null
          reference?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "transport_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          country_id: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          population: number | null
          region_id: string | null
          slug: string
          timezone: string | null
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          population?: number | null
          region_id?: string | null
          slug: string
          timezone?: string | null
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          population?: number | null
          region_id?: string | null
          slug?: string
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      context_snapshots: {
        Row: {
          context: Json
          conversation_id: string | null
          created_at: string
          id: string
          purpose: string
          token_estimate: number | null
          user_id: string
        }
        Insert: {
          context: Json
          conversation_id?: string | null
          created_at?: string
          id?: string
          purpose: string
          token_estimate?: number | null
          user_id: string
        }
        Update: {
          context?: Json
          conversation_id?: string | null
          created_at?: string
          id?: string
          purpose?: string
          token_estimate?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "context_snapshots_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_memory: {
        Row: {
          conversation_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          importance: number
          key: string
          scope: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          importance?: number
          key: string
          scope: string
          updated_at?: string
          user_id: string
          value: Json
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          importance?: number
          key?: string
          scope?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "conversation_memory_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          continent: string | null
          created_at: string
          currency: string | null
          emoji: string | null
          id: string
          iso2: string
          iso3: string
          name: string
          phone_code: string | null
        }
        Insert: {
          continent?: string | null
          created_at?: string
          currency?: string | null
          emoji?: string | null
          id?: string
          iso2: string
          iso3: string
          name: string
          phone_code?: string | null
        }
        Update: {
          continent?: string | null
          created_at?: string
          currency?: string | null
          emoji?: string | null
          id?: string
          iso2?: string
          iso3?: string
          name?: string
          phone_code?: string | null
        }
        Relationships: []
      }
      destinations: {
        Row: {
          avg_budget_usd: number | null
          best_months: number[] | null
          city_id: string | null
          country_id: string | null
          created_at: string
          description: string | null
          featured: boolean
          hero_image: string | null
          id: string
          metadata: Json
          name: string
          slug: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          avg_budget_usd?: number | null
          best_months?: number[] | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          hero_image?: string | null
          id?: string
          metadata?: Json
          name: string
          slug: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          avg_budget_usd?: number | null
          best_months?: number[] | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          hero_image?: string | null
          id?: string
          metadata?: Json
          name?: string
          slug?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destinations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          name: string | null
          platform: Database["public"]["Enums"]["device_platform"]
          push_token: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          name?: string | null
          platform: Database["public"]["Enums"]["device_platform"]
          push_token?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          name?: string | null
          platform?: Database["public"]["Enums"]["device_platform"]
          push_token?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          from_email: string | null
          id: string
          provider_ref: string | null
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          template_slug: string | null
          to_email: string
          updated_at: string
          user_id: string | null
          variables: Json
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          from_email?: string | null
          id?: string
          provider_ref?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
          template_slug?: string | null
          to_email: string
          updated_at?: string
          user_id?: string | null
          variables?: Json
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          from_email?: string | null
          id?: string
          provider_ref?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          template_slug?: string | null
          to_email?: string
          updated_at?: string
          user_id?: string | null
          variables?: Json
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          id: string
          name: string
          occurred_at: string
          properties: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          occurred_at?: string
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          occurred_at?: string
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      experiences: {
        Row: {
          category: string | null
          city_id: string | null
          country_id: string | null
          created_at: string
          currency: string
          description: string | null
          duration_min: number | null
          external_ref: Json
          hero_image: string | null
          id: string
          name: string
          price_cents: number | null
          provider_id: string | null
          rating: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number | null
          external_ref?: Json
          hero_image?: string | null
          id?: string
          name: string
          price_cents?: number | null
          provider_id?: string | null
          rating?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number | null
          external_ref?: Json
          hero_image?: string | null
          id?: string
          name?: string
          price_cents?: number | null
          provider_id?: string | null
          rating?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiences_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiences_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiences_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "transport_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_usage: {
        Row: {
          count: number
          created_at: string
          feature: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          count?: number
          created_at?: string
          feature: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          count?: number
          created_at?: string
          feature?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      flights: {
        Row: {
          aircraft: string | null
          arrive_at: string
          cabin: string | null
          carrier: string
          created_at: string
          currency: string
          depart_at: string
          destination_iata: string
          external_ref: Json
          flight_number: string
          id: string
          origin_iata: string
          price_cents: number | null
          provider_id: string | null
          updated_at: string
        }
        Insert: {
          aircraft?: string | null
          arrive_at: string
          cabin?: string | null
          carrier: string
          created_at?: string
          currency?: string
          depart_at: string
          destination_iata: string
          external_ref?: Json
          flight_number: string
          id?: string
          origin_iata: string
          price_cents?: number | null
          provider_id?: string | null
          updated_at?: string
        }
        Update: {
          aircraft?: string | null
          arrive_at?: string
          cabin?: string | null
          carrier?: string
          created_at?: string
          currency?: string
          depart_at?: string
          destination_iata?: string
          external_ref?: Json
          flight_number?: string
          id?: string
          origin_iata?: string
          price_cents?: number | null
          provider_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flights_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "transport_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          amenities: string[]
          brand: string | null
          city_id: string | null
          country_id: string | null
          created_at: string
          external_ref: Json
          hero_image: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          price_tier: number | null
          provider_id: string | null
          rating: number | null
          slug: string
          stars: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          amenities?: string[]
          brand?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          external_ref?: Json
          hero_image?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          price_tier?: number | null
          provider_id?: string | null
          rating?: number | null
          slug: string
          stars?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          amenities?: string[]
          brand?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          external_ref?: Json
          hero_image?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          price_tier?: number | null
          provider_id?: string | null
          rating?: number | null
          slug?: string
          stars?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotels_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotels_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotels_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "transport_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      images: {
        Row: {
          alt: string | null
          bytes: number | null
          created_at: string
          height: number | null
          id: string
          owner_id: string
          owner_kind: Database["public"]["Enums"]["image_owner_kind"]
          position: number
          storage_path: string | null
          uploader_id: string | null
          url: string
          width: number | null
        }
        Insert: {
          alt?: string | null
          bytes?: number | null
          created_at?: string
          height?: number | null
          id?: string
          owner_id: string
          owner_kind: Database["public"]["Enums"]["image_owner_kind"]
          position?: number
          storage_path?: string | null
          uploader_id?: string | null
          url: string
          width?: number | null
        }
        Update: {
          alt?: string | null
          bytes?: number | null
          created_at?: string
          height?: number | null
          id?: string
          owner_id?: string
          owner_kind?: Database["public"]["Enums"]["image_owner_kind"]
          position?: number
          storage_path?: string | null
          uploader_id?: string | null
          url?: string
          width?: number | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          booking_id: string | null
          created_at: string
          currency: string
          due_at: string | null
          id: string
          issued_at: string
          metadata: Json
          number: string
          pdf_url: string | null
          status: string
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          issued_at?: string
          metadata?: Json
          number: string
          pdf_url?: string | null
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          issued_at?: string
          metadata?: Json
          number?: string
          pdf_url?: string | null
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      itineraries: {
        Row: {
          ai_conversation_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          snapshot: Json
          source: string
          trip_id: string
          version: number
        }
        Insert: {
          ai_conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          snapshot: Json
          source?: string
          trip_id: string
          version?: number
        }
        Update: {
          ai_conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          snapshot?: Json
          source?: string
          trip_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "itineraries_ai_conversation_fk"
            columns: ["ai_conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itineraries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itineraries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          enabled: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          enabled?: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          enabled?: boolean
          kind?: Database["public"]["Enums"]["notification_kind"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          archived_at: string | null
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          payload: Json
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          archived_at?: string | null
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          payload?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          archived_at?: string | null
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          payload?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_accounts: {
        Row: {
          connected_at: string
          email: string | null
          id: string
          last_used_at: string | null
          metadata: Json
          provider: string
          provider_account_id: string
          user_id: string
        }
        Insert: {
          connected_at?: string
          email?: string | null
          id?: string
          last_used_at?: string | null
          metadata?: Json
          provider: string
          provider_account_id: string
          user_id: string
        }
        Update: {
          connected_at?: string
          email?: string | null
          id?: string
          last_used_at?: string | null
          metadata?: Json
          provider?: string
          provider_account_id?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          booking_id: string | null
          captured_at: string | null
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          metadata: Json
          method: Database["public"]["Enums"]["payment_method"]
          provider: string
          provider_ref: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          booking_id?: string | null
          captured_at?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          metadata?: Json
          method: Database["public"]["Enums"]["payment_method"]
          provider: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string | null
          captured_at?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          metadata?: Json
          method?: Database["public"]["Enums"]["payment_method"]
          provider?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      places: {
        Row: {
          address: string | null
          city_id: string | null
          country_id: string | null
          created_at: string
          description: string | null
          external_ref: Json
          hero_image: string | null
          id: string
          kind: Database["public"]["Enums"]["place_kind"]
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          price_tier: number | null
          rating: number | null
          slug: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          description?: string | null
          external_ref?: Json
          hero_image?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["place_kind"]
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          price_tier?: number | null
          rating?: number | null
          slug?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          description?: string | null
          external_ref?: Json
          hero_image?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["place_kind"]
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          price_tier?: number | null
          rating?: number | null
          slug?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          currency: string
          display_name: string | null
          full_name: string | null
          home_city: string | null
          home_country: string | null
          id: string
          locale: string
          marketing_opt_in: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          full_name?: string | null
          home_city?: string | null
          home_country?: string | null
          id: string
          locale?: string
          marketing_opt_in?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          full_name?: string | null
          home_city?: string | null
          home_country?: string | null
          id?: string
          locale?: string
          marketing_opt_in?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      prompt_templates: {
        Row: {
          agent: Database["public"]["Enums"]["ai_agent"]
          created_at: string
          id: string
          input_schema: Json
          is_active: boolean
          output_schema: Json
          slug: string
          system_prompt: string
          updated_at: string
          user_prompt_template: string | null
          version: number
        }
        Insert: {
          agent: Database["public"]["Enums"]["ai_agent"]
          created_at?: string
          id?: string
          input_schema?: Json
          is_active?: boolean
          output_schema?: Json
          slug: string
          system_prompt: string
          updated_at?: string
          user_prompt_template?: string | null
          version?: number
        }
        Update: {
          agent?: Database["public"]["Enums"]["ai_agent"]
          created_at?: string
          id?: string
          input_schema?: Json
          is_active?: boolean
          output_schema?: Json
          slug?: string
          system_prompt?: string
          updated_at?: string
          user_prompt_template?: string | null
          version?: number
        }
        Relationships: []
      }
      push_queue: {
        Row: {
          attempts: number
          body: string | null
          created_at: string
          data: Json
          device_id: string | null
          error: string | null
          id: string
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["push_status"]
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          body?: string | null
          created_at?: string
          data?: Json
          device_id?: string | null
          error?: string | null
          id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["push_status"]
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          body?: string | null
          created_at?: string
          data?: Json
          device_id?: string | null
          error?: string | null
          id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["push_status"]
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_queue_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          payment_id: string
          provider_ref: string | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          payment_id: string
          provider_ref?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          payment_id?: string
          provider_ref?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string | null
          country_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          country_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          country_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          city_id: string | null
          country_id: string | null
          created_at: string
          cuisine: string[]
          external_ref: Json
          hero_image: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          price_tier: number | null
          rating: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          cuisine?: string[]
          external_ref?: Json
          hero_image?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          price_tier?: number | null
          rating?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          cuisine?: string[]
          external_ref?: Json
          hero_image?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          price_tier?: number | null
          rating?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          helpful_count: number
          id: string
          is_verified: boolean
          rating: number
          status: string
          target_id: string
          target_kind: Database["public"]["Enums"]["review_target_kind"]
          title: string | null
          updated_at: string
          user_id: string
          visited_on: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          helpful_count?: number
          id?: string
          is_verified?: boolean
          rating: number
          status?: string
          target_id: string
          target_kind: Database["public"]["Enums"]["review_target_kind"]
          title?: string | null
          updated_at?: string
          user_id: string
          visited_on?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          helpful_count?: number
          id?: string
          is_verified?: boolean
          rating?: number
          status?: string
          target_id?: string
          target_kind?: Database["public"]["Enums"]["review_target_kind"]
          title?: string | null
          updated_at?: string
          user_id?: string
          visited_on?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_places: {
        Row: {
          created_at: string
          deleted_at: string | null
          destination_id: string | null
          id: string
          note: string | null
          place_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          destination_id?: string | null
          id?: string
          note?: string | null
          place_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          destination_id?: string | null
          id?: string
          note?: string | null
          place_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_places_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_places_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      search_history: {
        Row: {
          created_at: string
          filters: Json
          id: string
          query: string
          result_count: number | null
          scope: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          query: string
          result_count?: number | null
          scope: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          query?: string
          result_count?: number | null
          scope?: string
          user_id?: string | null
        }
        Relationships: []
      }
      support_attachments: {
        Row: {
          bytes: number | null
          content_type: string | null
          created_at: string
          filename: string
          id: string
          message_id: string
          url: string
        }
        Insert: {
          bytes?: number | null
          content_type?: string | null
          created_at?: string
          filename: string
          id?: string
          message_id: string
          url: string
        }
        Update: {
          bytes?: number | null
          content_type?: string | null
          created_at?: string
          filename?: string
          id?: string
          message_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_staff: boolean
          ticket_id: string
          visibility: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id: string
          visibility?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assignee_id: string | null
          booking_id: string | null
          category: string | null
          created_at: string
          deleted_at: string | null
          id: string
          last_message_at: string
          metadata: Json
          priority: Database["public"]["Enums"]["ticket_priority"]
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee_id?: string | null
          booking_id?: string | null
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_message_at?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee_id?: string | null
          booking_id?: string | null
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_message_at?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      taggables: {
        Row: {
          created_at: string
          tag_id: string
          target_id: string
          target_kind: Database["public"]["Enums"]["taggable_kind"]
        }
        Insert: {
          created_at?: string
          tag_id: string
          target_id: string
          target_kind: Database["public"]["Enums"]["taggable_kind"]
        }
        Update: {
          created_at?: string
          tag_id?: string
          target_id?: string
          target_kind?: Database["public"]["Enums"]["taggable_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "taggables_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          kind: string | null
          label: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string | null
          label: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string | null
          label?: string
          slug?: string
        }
        Relationships: []
      }
      transport_providers: {
        Row: {
          code: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["booking_type"]
          logo_url: string | null
          metadata: Json
          name: string
          website: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["booking_type"]
          logo_url?: string | null
          metadata?: Json
          name: string
          website?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["booking_type"]
          logo_url?: string | null
          metadata?: Json
          name?: string
          website?: string | null
        }
        Relationships: []
      }
      travel_companions: {
        Row: {
          created_at: string
          date_of_birth: string | null
          dietary: string[]
          email: string | null
          full_name: string
          id: string
          notes: string | null
          passport_country: string | null
          passport_expiry: string | null
          passport_number: string | null
          phone: string | null
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          dietary?: string[]
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          passport_country?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone?: string | null
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          dietary?: string[]
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          passport_country?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone?: string | null
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trip_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          booking_item_id: string | null
          cost_cents: number | null
          created_at: string
          currency: string
          description: string | null
          duration_min: number | null
          ends_at: string | null
          id: string
          metadata: Json
          notes: string | null
          place_id: string | null
          position: number
          starts_at: string | null
          title: string
          trip_day_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          booking_item_id?: string | null
          cost_cents?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number | null
          ends_at?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          place_id?: string | null
          position?: number
          starts_at?: string | null
          title: string
          trip_day_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          booking_item_id?: string | null
          cost_cents?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number | null
          ends_at?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          place_id?: string | null
          position?: number
          starts_at?: string | null
          title?: string
          trip_day_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_activities_booking_item_fk"
            columns: ["booking_item_id"]
            isOneToOne: false
            referencedRelation: "booking_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_activities_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_activities_trip_day_id_fkey"
            columns: ["trip_day_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_companions: {
        Row: {
          added_at: string
          companion_id: string
          role: string
          trip_id: string
        }
        Insert: {
          added_at?: string
          companion_id: string
          role?: string
          trip_id: string
        }
        Update: {
          added_at?: string
          companion_id?: string
          role?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_companions_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "travel_companions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_companions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_companions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_days: {
        Row: {
          city_id: string | null
          created_at: string
          date: string | null
          day_index: number
          id: string
          summary: string | null
          title: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          date?: string | null
          day_index: number
          id?: string
          summary?: string | null
          title?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          date?: string | null
          day_index?: number
          id?: string
          summary?: string | null
          title?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_days_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          budget_total_cents: number | null
          cover_image: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          end_date: string | null
          id: string
          origin_city_id: string | null
          pace: Database["public"]["Enums"]["trip_pace"]
          primary_destination_id: string | null
          slug: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["trip_status"]
          summary: string | null
          tags: string[]
          title: string
          traveler_count: number
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["trip_visibility"]
        }
        Insert: {
          budget_total_cents?: number | null
          cover_image?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          origin_city_id?: string | null
          pace?: Database["public"]["Enums"]["trip_pace"]
          primary_destination_id?: string | null
          slug?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          summary?: string | null
          tags?: string[]
          title: string
          traveler_count?: number
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["trip_visibility"]
        }
        Update: {
          budget_total_cents?: number | null
          cover_image?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          origin_city_id?: string | null
          pace?: Database["public"]["Enums"]["trip_pace"]
          primary_destination_id?: string | null
          slug?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          summary?: string | null
          tags?: string[]
          title?: string
          traveler_count?: number
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["trip_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "trips_origin_city_id_fkey"
            columns: ["origin_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_primary_destination_id_fkey"
            columns: ["primary_destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          accessibility_needs: string[]
          avoid: string[]
          budget_tier: string | null
          created_at: string
          cuisines: string[]
          data: Json
          home_airport: string | null
          meal_preference: string | null
          measurement_system: string
          preferred_airlines: string[]
          preferred_hotel_brands: string[]
          seat_preference: string | null
          travel_style: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          accessibility_needs?: string[]
          avoid?: string[]
          budget_tier?: string | null
          created_at?: string
          cuisines?: string[]
          data?: Json
          home_airport?: string | null
          meal_preference?: string | null
          measurement_system?: string
          preferred_airlines?: string[]
          preferred_hotel_brands?: string[]
          seat_preference?: string | null
          travel_style?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          accessibility_needs?: string[]
          avoid?: string[]
          budget_tier?: string | null
          created_at?: string
          cuisines?: string[]
          data?: Json
          home_airport?: string | null
          meal_preference?: string | null
          measurement_system?: string
          preferred_airlines?: string[]
          preferred_hotel_brands?: string[]
          seat_preference?: string | null
          travel_style?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          destination_id: string | null
          id: string
          note: string | null
          place_id: string | null
          position: number
          target_month: number | null
          target_year: number | null
          title: string | null
          wishlist_id: string
        }
        Insert: {
          created_at?: string
          destination_id?: string | null
          id?: string
          note?: string | null
          place_id?: string | null
          position?: number
          target_month?: number | null
          target_year?: number | null
          title?: string | null
          wishlist_id: string
        }
        Update: {
          created_at?: string
          destination_id?: string | null
          id?: string
          note?: string | null
          place_id?: string | null
          position?: number
          target_month?: number | null
          target_year?: number | null
          title?: string | null
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["trip_visibility"]
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["trip_visibility"]
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["trip_visibility"]
        }
        Relationships: []
      }
    }
    Views: {
      v_booking_summary: {
        Row: {
          booking_type: Database["public"]["Enums"]["booking_type"] | null
          created_at: string | null
          currency: string | null
          ends_at: string | null
          id: string | null
          item_count: number | null
          paid_cents: number | null
          reference: string | null
          refunded_cents: number | null
          starts_at: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          total_cents: number | null
          trip_id: string | null
          user_id: string | null
        }
        Insert: {
          booking_type?: Database["public"]["Enums"]["booking_type"] | null
          created_at?: string | null
          currency?: string | null
          ends_at?: string | null
          id?: string | null
          item_count?: never
          paid_cents?: never
          reference?: string | null
          refunded_cents?: never
          starts_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          total_cents?: number | null
          trip_id?: string | null
          user_id?: string | null
        }
        Update: {
          booking_type?: Database["public"]["Enums"]["booking_type"] | null
          created_at?: string | null
          currency?: string | null
          ends_at?: string | null
          id?: string | null
          item_count?: never
          paid_cents?: never
          reference?: string | null
          refunded_cents?: never
          starts_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          total_cents?: number | null
          trip_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      v_trip_overview: {
        Row: {
          activity_count: number | null
          booking_count: number | null
          budget_total_cents: number | null
          currency: string | null
          day_count: number | null
          destination_name: string | null
          destination_slug: string | null
          end_date: string | null
          id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["trip_status"] | null
          title: string | null
          traveler_count: number | null
          user_id: string | null
          visibility: Database["public"]["Enums"]["trip_visibility"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_type:
        | "flight"
        | "transit"
        | "lodging"
        | "meal"
        | "attraction"
        | "experience"
        | "free_time"
        | "note"
        | "other"
      ai_agent:
        | "planner"
        | "budget"
        | "booking"
        | "recommendation"
        | "weather"
        | "safety"
        | "memory"
        | "translator"
        | "general"
      ai_role: "system" | "user" | "assistant" | "tool"
      app_role: "admin" | "moderator" | "user"
      audit_action:
        | "insert"
        | "update"
        | "delete"
        | "login"
        | "logout"
        | "role_change"
        | "password_change"
        | "permission_change"
        | "export"
        | "impersonate"
      booking_status:
        | "pending"
        | "confirmed"
        | "ticketed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "refunded"
        | "failed"
      booking_type:
        | "flight"
        | "hotel"
        | "train"
        | "bus"
        | "cab"
        | "experience"
        | "restaurant"
        | "package"
        | "other"
      device_platform: "web" | "ios" | "android" | "desktop" | "other"
      email_status: "queued" | "sending" | "sent" | "failed" | "cancelled"
      image_owner_kind:
        | "user"
        | "trip"
        | "place"
        | "hotel"
        | "experience"
        | "restaurant"
        | "destination"
        | "review"
      notification_channel: "in_app" | "email" | "push" | "sms"
      notification_kind:
        | "trip"
        | "booking"
        | "payment"
        | "ai"
        | "support"
        | "security"
        | "system"
        | "marketing"
      notification_priority: "low" | "normal" | "high" | "critical"
      payment_method:
        | "card"
        | "upi"
        | "wallet"
        | "netbanking"
        | "bank_transfer"
        | "apple_pay"
        | "google_pay"
        | "paypal"
        | "crypto"
        | "other"
      payment_status:
        | "initiated"
        | "authorized"
        | "captured"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "chargeback"
      place_kind:
        | "attraction"
        | "landmark"
        | "museum"
        | "park"
        | "beach"
        | "nightlife"
        | "shopping"
        | "viewpoint"
        | "activity"
        | "other"
      push_status: "queued" | "sending" | "sent" | "failed" | "cancelled"
      review_target_kind:
        | "hotel"
        | "flight"
        | "experience"
        | "restaurant"
        | "place"
        | "trip"
      taggable_kind:
        | "trip"
        | "place"
        | "hotel"
        | "experience"
        | "restaurant"
        | "destination"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status: "open" | "pending" | "on_hold" | "resolved" | "closed"
      trip_pace: "relaxed" | "balanced" | "packed"
      trip_status:
        | "draft"
        | "planning"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "archived"
      trip_visibility: "private" | "unlisted" | "public"
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
      activity_type: [
        "flight",
        "transit",
        "lodging",
        "meal",
        "attraction",
        "experience",
        "free_time",
        "note",
        "other",
      ],
      ai_agent: [
        "planner",
        "budget",
        "booking",
        "recommendation",
        "weather",
        "safety",
        "memory",
        "translator",
        "general",
      ],
      ai_role: ["system", "user", "assistant", "tool"],
      app_role: ["admin", "moderator", "user"],
      audit_action: [
        "insert",
        "update",
        "delete",
        "login",
        "logout",
        "role_change",
        "password_change",
        "permission_change",
        "export",
        "impersonate",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "ticketed",
        "in_progress",
        "completed",
        "cancelled",
        "refunded",
        "failed",
      ],
      booking_type: [
        "flight",
        "hotel",
        "train",
        "bus",
        "cab",
        "experience",
        "restaurant",
        "package",
        "other",
      ],
      device_platform: ["web", "ios", "android", "desktop", "other"],
      email_status: ["queued", "sending", "sent", "failed", "cancelled"],
      image_owner_kind: [
        "user",
        "trip",
        "place",
        "hotel",
        "experience",
        "restaurant",
        "destination",
        "review",
      ],
      notification_channel: ["in_app", "email", "push", "sms"],
      notification_kind: [
        "trip",
        "booking",
        "payment",
        "ai",
        "support",
        "security",
        "system",
        "marketing",
      ],
      notification_priority: ["low", "normal", "high", "critical"],
      payment_method: [
        "card",
        "upi",
        "wallet",
        "netbanking",
        "bank_transfer",
        "apple_pay",
        "google_pay",
        "paypal",
        "crypto",
        "other",
      ],
      payment_status: [
        "initiated",
        "authorized",
        "captured",
        "failed",
        "refunded",
        "partially_refunded",
        "chargeback",
      ],
      place_kind: [
        "attraction",
        "landmark",
        "museum",
        "park",
        "beach",
        "nightlife",
        "shopping",
        "viewpoint",
        "activity",
        "other",
      ],
      push_status: ["queued", "sending", "sent", "failed", "cancelled"],
      review_target_kind: [
        "hotel",
        "flight",
        "experience",
        "restaurant",
        "place",
        "trip",
      ],
      taggable_kind: [
        "trip",
        "place",
        "hotel",
        "experience",
        "restaurant",
        "destination",
      ],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: ["open", "pending", "on_hold", "resolved", "closed"],
      trip_pace: ["relaxed", "balanced", "packed"],
      trip_status: [
        "draft",
        "planning",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "archived",
      ],
      trip_visibility: ["private", "unlisted", "public"],
    },
  },
} as const
