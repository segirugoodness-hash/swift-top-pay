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
      admin_earnings: {
        Row: {
          balance: number
          id: string
          lifetime_revenue: number
          updated_at: string
        }
        Insert: {
          balance?: number
          id?: string
          lifetime_revenue?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: string
          lifetime_revenue?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          id: string
          updated_at: string
          use_dedicated_accounts: boolean
        }
        Insert: {
          id?: string
          updated_at?: string
          use_dedicated_accounts?: boolean
        }
        Update: {
          id?: string
          updated_at?: string
          use_dedicated_accounts?: boolean
        }
        Relationships: []
      }
      data_plans: {
        Row: {
          category: string
          created_at: string
          external_id: string | null
          id: string
          is_active: boolean
          name: string
          network: string
          sort_order: number
          updated_at: string
          validity: string | null
          wholesale_price: number
        }
        Insert: {
          category: string
          created_at?: string
          external_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          network: string
          sort_order?: number
          updated_at?: string
          validity?: string | null
          wholesale_price: number
        }
        Update: {
          category?: string
          created_at?: string
          external_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          network?: string
          sort_order?: number
          updated_at?: string
          validity?: string | null
          wholesale_price?: number
        }
        Relationships: []
      }
      funding_requests: {
        Row: {
          account_name: string
          account_number: string
          amount: number
          bank_name: string
          created_at: string
          expires_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          amount: number
          bank_name: string
          created_at?: string
          expires_at: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          amount?: number
          bank_name?: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      network_markups: {
        Row: {
          markup_type: string
          markup_value: number
          network: string
          updated_at: string
        }
        Insert: {
          markup_type?: string
          markup_value?: number
          network: string
          updated_at?: string
        }
        Update: {
          markup_type?: string
          markup_value?: number
          network?: string
          updated_at?: string
        }
        Relationships: []
      }
      paystack_events: {
        Row: {
          amount: number | null
          event_id: string
          event_type: string
          id: string
          processed_at: string
          raw: Json
          reference: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          event_id: string
          event_type: string
          id?: string
          processed_at?: string
          raw: Json
          reference?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          event_id?: string
          event_type?: string
          id?: string
          processed_at?: string
          raw?: Json
          reference?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_tier: string
          bvn: string | null
          bvn_verified: boolean
          created_at: string
          dedicated_account_bank: string | null
          dedicated_account_name: string | null
          dedicated_account_number: string | null
          full_name: string | null
          id: string
          phone: string | null
          transaction_pin_hash: string | null
          updated_at: string
          verification_email: string | null
          verification_first_name: string | null
          verification_last_name: string | null
          verification_status: string
          verification_submitted_at: string | null
          wallet_balance: number
        }
        Insert: {
          account_tier?: string
          bvn?: string | null
          bvn_verified?: boolean
          created_at?: string
          dedicated_account_bank?: string | null
          dedicated_account_name?: string | null
          dedicated_account_number?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          transaction_pin_hash?: string | null
          updated_at?: string
          verification_email?: string | null
          verification_first_name?: string | null
          verification_last_name?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          wallet_balance?: number
        }
        Update: {
          account_tier?: string
          bvn?: string | null
          bvn_verified?: boolean
          created_at?: string
          dedicated_account_bank?: string | null
          dedicated_account_name?: string | null
          dedicated_account_number?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          transaction_pin_hash?: string | null
          updated_at?: string
          verification_email?: string | null
          verification_first_name?: string | null
          verification_last_name?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          wallet_balance?: number
        }
        Relationships: []
      }
      service_locks: {
        Row: {
          acquired_at: string
          expires_at: string
          service_type: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          expires_at?: string
          service_type: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          service_type?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          reference: string | null
          status: string
          type: string
          user_id: string
          wholesale_price: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          reference?: string | null
          status?: string
          type: string
          user_id: string
          wholesale_price?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          reference?: string | null
          status?: string
          type?: string
          user_id?: string
          wholesale_price?: number | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      begin_vend: {
        Args: {
          _metadata: Json
          _pin: string
          _reference: string
          _retail: number
          _type: string
          _wholesale: number
        }
        Returns: string
      }
      change_transaction_pin: {
        Args: { _current: string; _new: string }
        Returns: undefined
      }
      complete_vend: {
        Args: { _provider_ref?: string; _txn_id: string }
        Returns: undefined
      }
      credit_a2c_settlement: {
        Args: {
          _airtime_amount: number
          _metadata: Json
          _reference: string
          _user_id: string
        }
        Returns: undefined
      }
      debit_admin_earnings: {
        Args: { _amount: number; _note: string }
        Returns: undefined
      }
      fail_vend: {
        Args: { _error: string; _txn_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      release_service_lock: {
        Args: { _service_type: string }
        Returns: undefined
      }
      set_transaction_pin: { Args: { _pin: string }; Returns: undefined }
      try_acquire_service_lock: {
        Args: { _service_type: string }
        Returns: boolean
      }
      verify_transaction_pin: { Args: { _pin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
