ALTER TABLE public.expenses ADD COLUMN on_credit boolean NOT NULL DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN purchase_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE;
ALTER TABLE public.expenses DROP CONSTRAINT expenses_kind_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_kind_check CHECK (kind IN ('entree','sortie','achat','salaire','fond','remboursement'));