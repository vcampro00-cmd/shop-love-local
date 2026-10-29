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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      catalog_products: {
        Row: {
          active: boolean
          commission: number
          created_at: string
          description: string
          full_payment_only: boolean
          id: string
          image_url: string | null
          name: string
          price: number
          sort: number
          tag: string
        }
        Insert: {
          active?: boolean
          commission?: number
          created_at?: string
          description?: string
          full_payment_only?: boolean
          id: string
          image_url?: string | null
          name: string
          price: number
          sort?: number
          tag?: string
        }
        Update: {
          active?: boolean
          commission?: number
          created_at?: string
          description?: string
          full_payment_only?: boolean
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          sort?: number
          tag?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          id: string
          name: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          unit_price?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          employee_id: string | null
          id: string
          kind: string
          label: string
          on_credit: boolean
          order_id: string | null
          purchase_id: string | null
          spent_on: string
          unit_price: number | null
          units: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          employee_id?: string | null
          id?: string
          kind?: string
          label: string
          on_credit?: boolean
          order_id?: string | null
          purchase_id?: string | null
          spent_on?: string
          unit_price?: number | null
          units?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string | null
          id?: string
          kind?: string
          label?: string
          on_credit?: boolean
          order_id?: string | null
          purchase_id?: string | null
          spent_on?: string
          unit_price?: number | null
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          amount_paid: number
          created_at: string
          customer_email: string
          customer_id: string
          delivery_fee: number
          delivery_method: string
          discount: number
          id: string
          items: Json
          name: string
          notes: string | null
          payment_env: string | null
          payment_method: string
          payment_plan: string
          payment_status: string
          phone: string
          postal_code: string
          promo_code: string | null
          ref: string
          second_amount: number
          second_charge_due_at: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          subtotal: number
          total: number
          updated_at: string
          visionx_code: string | null
        }
        Insert: {
          address: string
          amount_paid?: number
          created_at?: string
          customer_email: string
          customer_id: string
          delivery_fee: number
          delivery_method?: string
          discount?: number
          id?: string
          items?: Json
          name: string
          notes?: string | null
          payment_env?: string | null
          payment_method?: string
          payment_plan?: string
          payment_status?: string
          phone: string
          postal_code: string
          promo_code?: string | null
          ref: string
          second_amount?: number
          second_charge_due_at?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          subtotal: number
          total: number
          updated_at?: string
          visionx_code?: string | null
        }
        Update: {
          address?: string
          amount_paid?: number
          created_at?: string
          customer_email?: string
          customer_id?: string
          delivery_fee?: number
          delivery_method?: string
          discount?: number
          id?: string
          items?: Json
          name?: string
          notes?: string | null
          payment_env?: string | null
          payment_method?: string
          payment_plan?: string
          payment_status?: string
          phone?: string
          postal_code?: string
          promo_code?: string | null
          ref?: string
          second_amount?: number
          second_charge_due_at?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          visionx_code?: string | null
        }
        Relationships: []
      }
      payment_reminders: {
        Row: {
          amount: number
          charge_error: string | null
          contract_accepted_at: string | null
          contract_lang: string
          created_at: string
          due_date: string | null
          group_id: string | null
          group_total: number | null
          id: string
          installment: number
          installments: number
          name: string
          note: string
          paid_at: string | null
          paid_session_id: string | null
          payment_env: string | null
          payment_link: string | null
          phone: string
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          warranty_error: string | null
          warranty_imei: string | null
          warranty_months: number | null
          warranty_sent_at: string | null
          warranty_token: string
        }
        Insert: {
          amount: number
          charge_error?: string | null
          contract_accepted_at?: string | null
          contract_lang?: string
          created_at?: string
          due_date?: string | null
          group_id?: string | null
          group_total?: number | null
          id?: string
          installment?: number
          installments?: number
          name: string
          note?: string
          paid_at?: string | null
          paid_session_id?: string | null
          payment_env?: string | null
          payment_link?: string | null
          phone: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          warranty_error?: string | null
          warranty_imei?: string | null
          warranty_months?: number | null
          warranty_sent_at?: string | null
          warranty_token?: string
        }
        Update: {
          amount?: number
          charge_error?: string | null
          contract_accepted_at?: string | null
          contract_lang?: string
          created_at?: string
          due_date?: string | null
          group_id?: string | null
          group_total?: number | null
          id?: string
          installment?: number
          installments?: number
          name?: string
          note?: string
          paid_at?: string | null
          paid_session_id?: string | null
          payment_env?: string | null
          payment_link?: string | null
          phone?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          warranty_error?: string | null
          warranty_imei?: string | null
          warranty_months?: number | null
          warranty_sent_at?: string | null
          warranty_token?: string
        }
        Relationships: []
      }
      product_stock: {
        Row: {
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          amount: number
          code: string
          created_at: string
          seller_id: string | null
        }
        Insert: {
          active?: boolean
          amount: number
          code: string
          created_at?: string
          seller_id?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          code?: string
          created_at?: string
          seller_id?: string | null
        }
        Relationships: []
      }
      site_texts: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      whatsapp_messages: {
        Row: {
          created_at: string
          due_on: string
          error: string | null
          id: string
          kind: string
          phone: string
          source_id: string
          status: string
          status_at: string | null
          wa_message_id: string | null
        }
        Insert: {
          created_at?: string
          due_on: string
          error?: string | null
          id?: string
          kind: string
          phone: string
          source_id: string
          status?: string
          status_at?: string | null
          wa_message_id?: string | null
        }
        Update: {
          created_at?: string
          due_on?: string
          error?: string | null
          id?: string
          kind?: string
          phone?: string
          source_id?: string
          status?: string
          status_at?: string | null
          wa_message_id?: string | null
        }
        Relationships: []
      }
      whatsapp_webhook_events: {
        Row: {
          delivery_id: string
          event: string
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          received_at: string
        }
        Insert: {
          delivery_id: string
          event: string
          id?: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Update: {
          delivery_id?: string
          event?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
      order_status: "nouveau" | "prepare" | "envoye" | "livre" | "annule"
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
  public: {
    Enums: {
      app_role: ["admin"],
      order_status: ["nouveau", "prepare", "envoye", "livre", "annule"],
    },
  },
} as const
