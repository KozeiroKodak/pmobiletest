-- PMOBILE
-- Atomic inventory import support.
--
-- This migration captures the staging table and PostgreSQL RPC used by
-- importacao.js. The official inventory is replaced only after the full
-- temporary import has arrived.

CREATE TABLE IF NOT EXISTS public.materiais_importacao_temporaria (
    importacao_id uuid NOT NULL,
    ordem bigint NOT NULL,
    codigo text NOT NULL DEFAULT '',
    descricao text NOT NULL DEFAULT '',
    referencia text,
    marca text,
    local text,
    quantidade numeric DEFAULT 0,
    quantidade_reservada numeric DEFAULT 0,
    disponivel numeric DEFAULT 0,
    ultima_entrada text,
    criado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT materiais_importacao_temporaria_pkey
        PRIMARY KEY (importacao_id, ordem)
);

CREATE OR REPLACE FUNCTION public.pmobile_finalizar_importacao_materiais(
    p_importacao_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
    v_total_staging bigint;
    v_total_inserido bigint;
BEGIN
    SELECT count(*)
      INTO v_total_staging
      FROM public.materiais_importacao_temporaria
     WHERE importacao_id = p_importacao_id;

    IF v_total_staging = 0 THEN
        RAISE EXCEPTION
            'PMOBILE: nenhuma linha temporária encontrada para a importação %.',
            p_importacao_id;
    END IF;

    DELETE FROM public.materiais;

    INSERT INTO public.materiais (
        codigo,
        descricao,
        referencia,
        marca,
        local,
        quantidade,
        quantidade_reservada,
        disponivel,
        ultima_entrada
    )
    SELECT
        codigo,
        descricao,
        referencia,
        marca,
        local,
        quantidade,
        quantidade_reservada,
        disponivel,
        ultima_entrada
    FROM public.materiais_importacao_temporaria
    WHERE importacao_id = p_importacao_id
    ORDER BY ordem;

    GET DIAGNOSTICS v_total_inserido = ROW_COUNT;

    IF v_total_inserido <> v_total_staging THEN
        RAISE EXCEPTION
            'PMOBILE: quantidade inserida (%) diferente da quantidade preparada (%).',
            v_total_inserido,
            v_total_staging;
    END IF;

    DELETE FROM public.materiais_importacao_temporaria
    WHERE importacao_id = p_importacao_id;

    RETURN v_total_inserido;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.pmobile_finalizar_importacao_materiais(uuid)
    TO anon, authenticated;
