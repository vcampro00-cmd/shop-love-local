ALTER TABLE public.expenses DROP CONSTRAINT expenses_kind_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_kind_check CHECK (kind IN ('entree','sortie','achat','salaire'));
COMMENT ON COLUMN public.expenses.kind IS 'entree = entrée manuelle, sortie = dépense, achat = achat de téléphones, salaire = salaire versé à un employé';