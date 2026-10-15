import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (data !== true) throw new Error("Accès réservé au propriétaire.");
}

/** Corrige l'orthographe et la ponctuation du message écrit par le propriétaire (réservé à l'admin). */
export const correctText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ text: z.string().min(2).max(3000) }).parse(i))
  .handler(async ({ data, context }): Promise<{ corrected: string } | { error: string }> => {
    await assertAdmin(context);
    try {
      const { correctFrenchText } = await import("@/lib/ai.server");
      const corrected = await correctFrenchText(data.text);
      if (!corrected) return { error: "Le correcteur est indisponible pour le moment." };
      return { corrected };
    } catch {
      return { error: "Le correcteur est indisponible pour le moment." };
    }
  });
