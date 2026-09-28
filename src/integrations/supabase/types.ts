export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      clientes: {
        Row: {
          id: string;
          user_id: string;
          nome: string;
          telefone: string | null;
          documento: string | null;
          email: string | null;
          cep: string | null;
          logradouro: string | null;
          numero: string | null;
          complemento: string | null;
          bairro: string | null;
          cidade: string | null;
          uf: string | null;
          observacoes: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          nome: string;
          telefone?: string | null;
          documento?: string | null;
          email?: string | null;
          cep?: string | null;
          logradouro?: string | null;
          numero?: string | null;
          complemento?: string | null;
          bairro?: string | null;
          cidade?: string | null;
          uf?: string | null;
          observacoes?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          nome?: string;
          telefone?: string | null;
          documento?: string | null;
          email?: string | null;
          cep?: string | null;
          logradouro?: string | null;
          numero?: string | null;
          complemento?: string | null;
          bairro?: string | null;
          cidade?: string | null;
          uf?: string | null;
          observacoes?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [];
      };
      equipamentos: {
        Row: {
          id: string;
          user_id: string;
          cliente_id: string;
          tipo: string;
          marca: string | null;
          modelo: string | null;
          serie: string | null;
          apelido: string | null;
          observacoes: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          cliente_id: string;
          tipo: string;
          marca?: string | null;
          modelo?: string | null;
          serie?: string | null;
          apelido?: string | null;
          observacoes?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          cliente_id?: string;
          tipo?: string;
          marca?: string | null;
          modelo?: string | null;
          serie?: string | null;
          apelido?: string | null;
          observacoes?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [];
      };
      cobrancas: {
        Row: {
          id: string;
          user_id: string;
          ordem_id: string;
          valor: number;
          forma: string;
          status: string;
          criada_em: string;
          informada_em: string | null;
          confirmada_em: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          ordem_id: string;
          valor: number;
          forma: string;
          status?: string;
          criada_em?: string;
          informada_em?: string | null;
          confirmada_em?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          ordem_id?: string;
          valor?: number;
          forma?: string;
          status?: string;
          criada_em?: string;
          informada_em?: string | null;
          confirmada_em?: string | null;
        };
        Relationships: [];
      };
      ordens: {
        Row: {
          cliente: string;
          cliente_id: string | null;
          equipamento_id: string | null;
          concluida_em: string | null;
          criada_em: string;
          entregue_em: string | null;
          historico: Json;
          id: string;
          itens: Json;
          marca: string | null;
          modelo: string | null;
          numero: string;
          revisao: number;
          observacoes: string | null;
          pagamentos: Json;
          prazo: string | null;
          problema: string;
          serie: string | null;
          status: string;
          telefone: string | null;
          tipo_maquina: string;
          user_id: string;
        };
        Insert: {
          cliente: string;
          cliente_id?: string | null;
          equipamento_id?: string | null;
          concluida_em?: string | null;
          criada_em?: string;
          entregue_em?: string | null;
          historico?: Json;
          id?: string;
          itens?: Json;
          marca?: string | null;
          modelo?: string | null;
          numero?: string;
          revisao?: number;
          observacoes?: string | null;
          pagamentos?: Json;
          prazo?: string | null;
          problema: string;
          serie?: string | null;
          status?: string;
          telefone?: string | null;
          tipo_maquina: string;
          user_id?: string;
        };
        Update: {
          cliente?: string;
          cliente_id?: string | null;
          equipamento_id?: string | null;
          concluida_em?: string | null;
          criada_em?: string;
          entregue_em?: string | null;
          historico?: Json;
          id?: string;
          itens?: Json;
          marca?: string | null;
          modelo?: string | null;
          numero?: string;
          revisao?: number;
          observacoes?: string | null;
          pagamentos?: Json;
          prazo?: string | null;
          problema?: string;
          serie?: string | null;
          status?: string;
          telefone?: string | null;
          tipo_maquina?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      oficinia_criar_cobranca: {
        Args: { p_ordem: string; p_id: string; p_valor: number; p_forma: string };
        Returns: Database["public"]["Tables"]["cobrancas"]["Row"];
      };
      oficinia_marcar_cobranca: {
        Args: { p_cobranca: string; p_estado: string };
        Returns: Database["public"]["Tables"]["cobrancas"]["Row"];
      };
      oficinia_confirmar_cobranca: {
        Args: { p_cobranca: string };
        Returns: Database["public"]["Tables"]["cobrancas"]["Row"];
      };
      oficinia_registrar_pagamento: {
        Args: { p_ordem: string; p_pagamento_id: string; p_valor: number; p_forma: string };
        Returns: Database["public"]["Tables"]["ordens"]["Row"];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
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
    Enums: {},
  },
} as const;
