import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createVideoUpload, setHomeVideo } from "@/lib/content.functions";
import { siteTextsQueryOptions } from "@/lib/content";
import { useX } from "@/lib/lang";
import { Button } from "@/components/ui/button";

const MAX = 100 * 1024 * 1024;

export function HomeVideoManager({ code, current }: { code: string; current: string }) {
  const x = useX();
  const qc = useQueryClient();
  const prepare = useServerFn(createVideoUpload);
  const setVideo = useServerFn(setHomeVideo);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) return toast.error(x("Ce fichier n'est pas une vidéo.", "Este arquivo não é um vídeo."));
    if (file.size > MAX)
      return toast.error(x(`Vidéo trop lourde (${(file.size / 1048576).toFixed(0)} Mo). Maximum : 100 Mo.`, `Vídeo muito grande (${(file.size / 1048576).toFixed(0)} MB). Máximo: 100 MB.`));
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "mp4";
      const { path, token } = await prepare({ data: { code: code.trim(), type: file.type, size: file.size, ext } });
      const { error } = await supabase.storage.from("site-media").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      await setVideo({ data: { code: code.trim(), path } });
      await qc.invalidateQueries({ queryKey: siteTextsQueryOptions.queryKey });
      toast.success(x("Vidéo enregistrée.", "Vídeo salvo."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : x("Envoi impossible.", "Envio impossível."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await setVideo({ data: { code: code.trim(), path: "" } });
      await qc.invalidateQueries({ queryKey: siteTextsQueryOptions.queryKey });
      toast.success(x("Vidéo retirée.", "Vídeo removido."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border bg-card p-6">
      <h2 className="text-lg font-bold">{x("Vidéo de la page d'accueil", "Vídeo da página inicial")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {x("Affichée sous le titre de l'accueil. Fichier vidéo, 100 Mo maximum.", "Exibido abaixo do título da página inicial. Arquivo de vídeo, máximo 100 MB.")}
      </p>
      {current ? (
        <video src={current} controls preload="metadata" className="mt-4 aspect-video w-full rounded-2xl border bg-background" />
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{x("Aucune vidéo pour le moment.", "Nenhum vídeo no momento.")}</p>
      )}
      <input ref={input} type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" onClick={() => input.current?.click()} disabled={busy}>
          <Upload className="h-4 w-4" /> {busy ? x("Envoi…", "Enviando…") : current ? x("Remplacer la vidéo", "Substituir o vídeo") : x("Choisir une vidéo", "Escolher um vídeo")}
        </Button>
        {current && (
          <Button type="button" variant="outline" onClick={remove} disabled={busy}>
            <Trash2 className="h-4 w-4" /> {x("Retirer", "Remover")}
          </Button>
        )}
      </div>
    </section>
  );
}
