const clientToken = import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN'] as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-destructive/40 bg-destructive/15 px-4 py-2 text-center text-sm text-foreground">
        Le paiement en ligne n'est pas encore activé sur ce site.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-accent/40 bg-accent/15 px-4 py-2 text-center text-sm text-foreground">
        Paiements en mode test dans l'aperçu — aucune vraie carte n'est débitée.
      </div>
    );
  }
  return null;
}
