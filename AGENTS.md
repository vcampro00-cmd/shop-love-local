<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Règles du projet
- Les textes affichés et les prix viennent de la couche de contenu éditable : valeurs par défaut dans `src/lib/content.defaults.ts` (avec `EDITOR_GROUPS`), saisies du propriétaire dans la table `site_texts`, lues via `src/lib/content.ts` (`useText`, `numFromText`). Ajouter un texte éditable = une clé dans `content.defaults.ts` + une entrée dans `EDITOR_GROUPS`, jamais de copie figée dans les fichiers de route. Pourquoi : le propriétaire écrit lui-même ses textes dans `/editar` et une modification de code écraserait les siens.
- `/editar` écrit avec le code d'accès du propriétaire (`SITE_EDIT_CODE`, secret serveur) vérifié dans `saveSiteTexts` ; la table n'a aucune politique d'écriture, seule cette fonction enregistrée peut y écrire. Pourquoi : la page est atteignable par n'importe quel visiteur du site publié.
- Order amounts are never taken from the browser: `createOrder` re-reads prices and the delivery fee from `site_texts` (falling back to `DEFAULTS`) and recomputes the totals with `src/lib/pricing.ts`, and it rejects product ids outside `PRODUCT_IDS`. Why: the checkout is reachable by any visitor, so the stored totals must be the owner's real prices.
- Application roles live only in `public.user_roles`, checked through the `has_role` security-definer function; every admin-only server function verifies the role server-side. The owner's admin role is granted by the `assign_owner_admin` trigger keyed on the owner's e-mail — change that function (or add a row) to move ownership, never derive a role from user-editable data.
- Anything a customer must keep lives under `src/routes/_authenticated/`: checkout and order pages read the order back from the database rather than from URL parameters. Why: Row-Level Security scopes each customer to their own orders, and an order must stay readable after the browser is closed.
- Card payments go through the built-in Stripe connection (`src/lib/stripe.server.ts`, `startPayment` in `orders.functions.ts`); the amount charged is recomputed from the stored order, and payment fields on `orders` are written only server-side (`payments.server.ts`, webhook, hourly cron `/api/public/cron/second-payments` for the second instalment). Why: customers can insert orders, so they must never be able to set what is paid.
- AI calls go through src/lib/ai.server.ts (Lovable AI Gateway, openai/gpt-6-astra via Responses, streamed server-side); client code only calls the *.functions.ts wrapper. Why: LOVABLE_API_KEY must stay server-side.

- The phone catalogue (name, tag, description, price, seller commission, one-payment-only flag, photo as a reduced data URL) lives in `public.catalog_products`, managed by the owner on `/stock` via `catalog.functions.ts`; removing a phone sets `active=false`. Shop pages read it with `useCatalog()`, and `createOrder`/`concludeSale` re-read prices and commissions from it server-side. Why: the owner adds and removes phones himself, and old orders must still show their phones.
- WhatsApp payment reminders: src/lib/whatsapp.server.ts sends approved Meta templates from the hourly cron /api/public/cron/whatsapp-reminders, deduped per item and day in whatsapp_messages; statuses arrive at /api/public/whatsapp/webhook. Why: Meta only allows business-initiated messages via templates.
- Second-payment rescheduling uses the same authenticated owner action in orders and Caisse, returns failed balances to the scheduled state, and scopes Stripe idempotency to the saved due timestamp. Why: renegotiated payments must run on their new date without replaying the old failed attempt.
- The 2-payment option in the cart opens only with the owner's secret code (SPLIT_PAYMENT_CODE), checked server-side in createOrder/checkSplitCode, and never for full-payment-only phones. Why: the owner decides case by case who may split.
