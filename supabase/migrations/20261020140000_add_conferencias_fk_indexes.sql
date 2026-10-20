-- PMOBILE
-- Performance indexes for conferencia foreign-key lookups.
--
-- Safe, additive migration: no data or behavior is changed.

CREATE INDEX IF NOT EXISTS idx_conferencias_material_id
    ON public.conferencias (material_id);

CREATE INDEX IF NOT EXISTS idx_conferencias_usuario_id
    ON public.conferencias (usuario_id);
