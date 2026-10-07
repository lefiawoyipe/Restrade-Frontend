export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string;
          actor_id: string;
          created_at: string;
          details: Json;
          id: string;
          reason: string;
          target_id: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          created_at?: string;
          details?: Json;
          id?: string;
          reason: string;
          target_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          created_at?: string;
          details?: Json;
          id?: string;
          reason?: string;
          target_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      case_evidence: {
        Row: {
          id: string;
          metadata: Json;
          object_path: string;
          order_id: string;
          registered_at: string;
          storage_created_at: string;
          storage_object_id: string;
          uploader_id: string;
        };
        Insert: {
          id?: string;
          metadata: Json;
          object_path: string;
          order_id: string;
          registered_at?: string;
          storage_created_at: string;
          storage_object_id: string;
          uploader_id: string;
        };
        Update: {
          id?: string;
          metadata?: Json;
          object_path?: string;
          order_id?: string;
          registered_at?: string;
          storage_created_at?: string;
          storage_object_id?: string;
          uploader_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_evidence_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "disputes";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "case_evidence_uploader_id_fkey";
            columns: ["uploader_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      case_evidence_hashes: {
        Row: {
          evidence_id: string;
          sha256: string;
          verified_at: string;
        };
        Insert: {
          evidence_id: string;
          sha256: string;
          verified_at?: string;
        };
        Update: {
          evidence_id?: string;
          sha256?: string;
          verified_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_evidence_hashes_evidence_id_fkey";
            columns: ["evidence_id"];
            isOneToOne: true;
            referencedRelation: "case_evidence";
            referencedColumns: ["id"];
          },
        ];
      };
      data_versions: {
        Row: {
          topic: string;
          updated_at: string;
          user_id: string | null;
          version: number;
        };
        Insert: {
          topic: string;
          updated_at?: string;
          user_id?: string | null;
          version?: number;
        };
        Update: {
          topic?: string;
          updated_at?: string;
          user_id?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "data_versions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dispute_messages: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          order_id: string;
        };
        Insert: {
          author_id?: string;
          body: string;
          created_at?: string;
          id?: string;
          order_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dispute_messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispute_messages_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "disputes";
            referencedColumns: ["order_id"];
          },
        ];
      };
      disputes: {
        Row: {
          description: string | null;
          escalated_at: string | null;
          favor_buyer: boolean | null;
          negotiation_due_at: string | null;
          opened_at: string;
          opened_by: string;
          order_id: string;
          reason: string | null;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          return_due_at: string | null;
          stage: string;
        };
        Insert: {
          description?: string | null;
          escalated_at?: string | null;
          favor_buyer?: boolean | null;
          negotiation_due_at?: string | null;
          opened_at?: string;
          opened_by: string;
          order_id: string;
          reason?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          return_due_at?: string | null;
          stage?: string;
        };
        Update: {
          description?: string | null;
          escalated_at?: string | null;
          favor_buyer?: boolean | null;
          negotiation_due_at?: string | null;
          opened_at?: string;
          opened_by?: string;
          order_id?: string;
          reason?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          return_due_at?: string | null;
          stage?: string;
        };
        Relationships: [
          {
            foreignKeyName: "disputes_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          marketplace_updates: boolean;
          order_alerts: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          marketplace_updates?: boolean;
          order_alerts?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          marketplace_updates?: boolean;
          order_alerts?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          message: string | null;
          order_id: string;
          read_at: string | null;
          status: Database["public"]["Enums"]["escrow_status"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_type?: string;
          id?: string;
          message?: string | null;
          order_id: string;
          read_at?: string | null;
          status: Database["public"]["Enums"]["escrow_status"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          message?: string | null;
          order_id?: string;
          read_at?: string | null;
          status?: Database["public"]["Enums"]["escrow_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          details: Json;
          event_type: string;
          id: string;
          order_id: string;
          previous_status: Database["public"]["Enums"]["escrow_status"] | null;
          status: Database["public"]["Enums"]["escrow_status"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          event_type?: string;
          id?: string;
          order_id: string;
          previous_status?: Database["public"]["Enums"]["escrow_status"] | null;
          status: Database["public"]["Enums"]["escrow_status"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          event_type?: string;
          id?: string;
          order_id?: string;
          previous_status?: Database["public"]["Enums"]["escrow_status"] | null;
          status?: Database["public"]["Enums"]["escrow_status"];
        };
        Relationships: [
          {
            foreignKeyName: "order_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          amount: number;
          buyer_id: string;
          created_at: string | null;
          fulfillment_status: string;
          handed_over_at: string | null;
          id: string;
          inspection_due_at: string | null;
          item_snapshot: Json;
          pickup_due_at: string | null;
          product_id: string;
          seller_id: string;
          settled_at: string | null;
          status: Database["public"]["Enums"]["escrow_status"] | null;
          updated_at: string | null;
          workflow_version: number;
        };
        Insert: {
          amount: number;
          buyer_id: string;
          created_at?: string | null;
          fulfillment_status?: string;
          handed_over_at?: string | null;
          id?: string;
          inspection_due_at?: string | null;
          item_snapshot: Json;
          pickup_due_at?: string | null;
          product_id: string;
          seller_id: string;
          settled_at?: string | null;
          status?: Database["public"]["Enums"]["escrow_status"] | null;
          updated_at?: string | null;
          workflow_version?: number;
        };
        Update: {
          amount?: number;
          buyer_id?: string;
          created_at?: string | null;
          fulfillment_status?: string;
          handed_over_at?: string | null;
          id?: string;
          inspection_due_at?: string | null;
          item_snapshot?: Json;
          pickup_due_at?: string | null;
          product_id?: string;
          seller_id?: string;
          settled_at?: string | null;
          status?: Database["public"]["Enums"]["escrow_status"] | null;
          updated_at?: string | null;
          workflow_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      product_categories: {
        Row: {
          name: string;
        };
        Insert: {
          name: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          campus: string | null;
          category: string | null;
          condition: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          image_url: string | null;
          location: string | null;
          moderation_status: string;
          price: number;
          search_document: unknown;
          seller_id: string;
          status: Database["public"]["Enums"]["product_status"] | null;
          title: string;
        };
        Insert: {
          campus?: string | null;
          category?: string | null;
          condition?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          location?: string | null;
          moderation_status?: string;
          price: number;
          search_document?: unknown;
          seller_id: string;
          status?: Database["public"]["Enums"]["product_status"] | null;
          title: string;
        };
        Update: {
          campus?: string | null;
          category?: string | null;
          condition?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          location?: string | null;
          moderation_status?: string;
          price?: number;
          search_document?: unknown;
          seller_id?: string;
          status?: Database["public"]["Enums"]["product_status"] | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_fk";
            columns: ["category"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["name"];
          },
          {
            foreignKeyName: "products_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          bio: string | null;
          campus: string | null;
          created_at: string | null;
          full_name: string;
          id: string;
          is_admin: boolean | null;
          is_suspended: boolean;
          total_reviews: number | null;
          trust_score: number | null;
        };
        Insert: {
          bio?: string | null;
          campus?: string | null;
          created_at?: string | null;
          full_name: string;
          id: string;
          is_admin?: boolean | null;
          is_suspended?: boolean;
          total_reviews?: number | null;
          trust_score?: number | null;
        };
        Update: {
          bio?: string | null;
          campus?: string | null;
          created_at?: string | null;
          full_name?: string;
          id?: string;
          is_admin?: boolean | null;
          is_suspended?: boolean;
          total_reviews?: number | null;
          trust_score?: number | null;
        };
        Relationships: [];
      };
      recommendation_preferences: {
        Row: {
          consented_at: string | null;
          email_enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          consented_at?: string | null;
          email_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          consented_at?: string | null;
          email_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recommendation_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          comment: string | null;
          created_at: string | null;
          id: string;
          order_id: string;
          rating: number | null;
          reviewer_id: string;
          seller_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string | null;
          id?: string;
          order_id: string;
          rating?: number | null;
          reviewer_id: string;
          seller_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string | null;
          id?: string;
          order_id?: string;
          rating?: number | null;
          reviewer_id?: string;
          seller_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_items: {
        Row: {
          created_at: string;
          product_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          product_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          product_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      settlement_offers: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          order_id: string;
          outcome: string;
          proposed_by: string;
          responded_at: string | null;
          responded_by: string | null;
          state: string;
          terms: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          order_id: string;
          outcome: string;
          proposed_by: string;
          responded_at?: string | null;
          responded_by?: string | null;
          state?: string;
          terms: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          order_id?: string;
          outcome?: string;
          proposed_by?: string;
          responded_at?: string | null;
          responded_by?: string | null;
          state?: string;
          terms?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_offers_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "disputes";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "settlement_offers_proposed_by_fkey";
            columns: ["proposed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_offers_responded_by_fkey";
            columns: ["responded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      wallets: {
        Row: {
          balance: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          balance?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          balance?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_case_queue: {
        Args: { p_limit?: number; p_offset?: number; p_resolved?: boolean };
        Returns: Json;
      };
      admin_moderate_product: {
        Args: { p_hidden: boolean; p_product_id: string; p_reason: string };
        Returns: undefined;
      };
      admin_open_case: {
        Args: { p_order_id: string; p_reason: string };
        Returns: Json;
      };
      admin_request_case_info: {
        Args: { p_message: string; p_order_id: string };
        Returns: undefined;
      };
      admin_suspend_trading: {
        Args: { p_reason: string; p_suspended: boolean; p_user_id: string };
        Returns: undefined;
      };
      claim_recommendation_emails: {
        Args: { p_limit?: number };
        Returns: {
          claim_token: string;
          job_id: string;
        }[];
      };
      confirm_pickup: {
        Args: { p_order_id: string; p_token: string };
        Returns: undefined;
      };
      confirm_return: { Args: { p_order_id: string }; Returns: undefined };
      create_pickup_challenge: { Args: { p_order_id: string }; Returns: Json };
      escalate_dispute: {
        Args: { p_order_id: string; p_reason: string; p_urgent?: boolean };
        Returns: undefined;
      };
      execute_case_decision: {
        Args: { p_intent_id: string };
        Returns: undefined;
      };
      finish_recommendation_email: {
        Args: {
          p_claim_token: string;
          p_error?: string;
          p_job_id: string;
          p_outcome: string;
          p_provider_id?: string;
        };
        Returns: undefined;
      };
      fund_wallet: { Args: { p_amount: number }; Returns: undefined };
      get_pickup_workflow_config: { Args: never; Returns: Json };
      initiate_purchase:
        | {
            Args: { p_buyer_id: string; p_product_id: string };
            Returns: undefined;
          }
        | { Args: { p_product_id: string }; Returns: undefined };
      open_dispute: {
        Args: { p_description: string; p_order_id: string; p_reason: string };
        Returns: undefined;
      };
      prepare_case_decision: {
        Args: { p_order_id: string; p_outcome: string; p_reason: string };
        Returns: string;
      };
      prepare_recommendation_email: {
        Args: { p_claim_token: string; p_job_id: string };
        Returns: Json;
      };
      propose_settlement: {
        Args: { p_order_id: string; p_outcome: string; p_terms: string };
        Returns: string;
      };
      raise_dispute:
        | { Args: { p_order_id: string }; Returns: undefined }
        | {
            Args: { p_buyer_id: string; p_order_id: string };
            Returns: undefined;
          };
      record_evidence_hash: {
        Args: { p_evidence_id: string; p_object_id: string; p_sha256: string };
        Returns: undefined;
      };
      register_case_evidence: {
        Args: { p_object_path: string; p_order_id: string };
        Returns: string;
      };
      release_escrow:
        | { Args: { p_order_id: string }; Returns: undefined }
        | {
            Args: { p_buyer_id: string; p_order_id: string };
            Returns: undefined;
          };
      resolve_dispute: {
        Args: { p_favor_buyer: boolean; p_order_id: string };
        Returns: undefined;
      };
      resolve_dispute_with_note: {
        Args: { p_favor_buyer: boolean; p_note: string; p_order_id: string };
        Returns: undefined;
      };
      respond_settlement: {
        Args: { p_accept: boolean; p_offer_id: string };
        Returns: undefined;
      };
      set_pickup_workflow_enabled: {
        Args: { p_enabled: boolean };
        Returns: undefined;
      };
      set_recommendation_email: {
        Args: { p_enabled: boolean };
        Returns: undefined;
      };
      unsubscribe_recommendations: {
        Args: { p_token: string };
        Returns: undefined;
      };
    };
    Enums: {
      escrow_status:
        "pending" | "escrow_funded" | "completed" | "disputed" | "refunded";
      product_status: "available" | "in_escrow" | "sold";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      escrow_status: [
        "pending",
        "escrow_funded",
        "completed",
        "disputed",
        "refunded",
      ],
      product_status: ["available", "in_escrow", "sold"],
    },
  },
} as const;
