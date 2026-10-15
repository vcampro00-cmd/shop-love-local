import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

/** Fetch wrapper qui propage l'ID de run émis par la passerelle Lovable AI. */
export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
      return response;
    },
    getRunId: () => runId,
  };
}

const INSTRUCTIONS =
  "Tu es un correcteur orthographique français. Corrige uniquement l'orthographe, la grammaire, les accents et la ponctuation du texte fourni. Ne change ni le sens, ni le ton, ni la mise en forme, ni les sauts de ligne. Ne réponds qu'avec le texte corrigé, sans aucun commentaire ni guillemet. Si le texte est déjà correct, renvoie-le tel quel.";

/** Corrige l'orthographe et la ponctuation d'un texte français via Lovable AI. Renvoie null si indisponible. */
export async function correctFrenchText(text: string): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses(MODEL),
    system: INSTRUCTIONS,
    messages: [{ role: "user", content: text }],
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const corrected = (await result.text).trim();
  return corrected || null;
}
