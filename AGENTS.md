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
