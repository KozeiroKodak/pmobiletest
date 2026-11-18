-- PMobile: fundo individual privado, validado por credenciais do PMobile.
BEGIN;
CREATE TABLE IF NOT EXISTS public.pmobile_fundos_perfil (
  usuario_id bigint PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  imagem_jpeg bytea,
  pos_x smallint NOT NULL DEFAULT 50 CHECK (pos_x BETWEEN 0 AND 100),
  pos_y smallint NOT NULL DEFAULT 50 CHECK (pos_y BETWEEN 0 AND 100),
  zoom smallint NOT NULL DEFAULT 100 CHECK (zoom BETWEEN 100 AND 200),
  degrade smallint NOT NULL DEFAULT 55 CHECK (degrade BETWEEN 20 AND 85),
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pmobile_fundo_jpeg_valid CHECK (
    imagem_jpeg IS NULL OR (
      octet_length(imagem_jpeg) BETWEEN 100 AND 1250000
      AND substring(imagem_jpeg FROM 1 FOR 3) = decode('ffd8ff','hex')
    )
  )
);
ALTER TABLE public.pmobile_fundos_perfil ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pmobile_fundos_perfil FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pmobile_fundo_perfil_ler(p_usuario text, p_credencial text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_id bigint;
BEGIN
  v_id := private.pmobile_foto_credencial_id(p_usuario,p_credencial);
  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN COALESCE((
     SELECT jsonb_build_object(
       'imagem', CASE WHEN f.imagem_jpeg IS NULL THEN NULL ELSE encode(f.imagem_jpeg,'base64') END,
       'x',f.pos_x,'y',f.pos_y,'zoom',f.zoom,'degrade',f.degrade
     )
     FROM public.pmobile_fundos_perfil f WHERE f.usuario_id = v_id
  ), jsonb_build_object('imagem',NULL,'x',50,'y',50,'zoom',100,'degrade',55));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.pmobile_fundo_perfil_salvar(
 p_usuario text, p_credencial text, p_imagem_base64 text,
 p_x integer, p_y integer, p_zoom integer, p_degrade integer, p_remover boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_id bigint; v_img bytea;
BEGIN
 v_id:=private.pmobile_foto_credencial_id(p_usuario,p_credencial);
 IF v_id IS NULL THEN RETURN false; END IF;
 IF p_x NOT BETWEEN 0 AND 100 OR p_y NOT BETWEEN 0 AND 100
   OR p_zoom NOT BETWEEN 100 AND 200 OR p_degrade NOT BETWEEN 20 AND 85
   OR p_x IS NULL OR p_y IS NULL OR p_zoom IS NULL OR p_degrade IS NULL
 THEN RAISE EXCEPTION 'Ajustes de fundo invalidos' USING ERRCODE='22023'; END IF;
 IF p_remover IS NOT TRUE AND p_imagem_base64 IS NOT NULL THEN
  IF length(p_imagem_base64) > 1667000 THEN
    RAISE EXCEPTION 'Imagem de fundo excede o limite' USING ERRCODE='22023';
  END IF;
  v_img:=decode(p_imagem_base64,'base64');
  IF octet_length(v_img) NOT BETWEEN 100 AND 1250000
    OR substring(v_img FROM 1 FOR 3) <> decode('ffd8ff','hex') THEN
    RAISE EXCEPTION 'Imagem JPEG invalida' USING ERRCODE='22023';
  END IF;
 END IF;
 INSERT INTO public.pmobile_fundos_perfil(usuario_id,imagem_jpeg,pos_x,pos_y,zoom,degrade)
 VALUES(v_id,CASE WHEN p_remover THEN NULL ELSE v_img END,p_x,p_y,p_zoom,p_degrade)
 ON CONFLICT(usuario_id) DO UPDATE SET
  imagem_jpeg=CASE WHEN p_remover THEN NULL
                  WHEN v_img IS NOT NULL THEN v_img
                  ELSE public.pmobile_fundos_perfil.imagem_jpeg END,
  pos_x=EXCLUDED.pos_x,
  pos_y=EXCLUDED.pos_y,
  zoom=EXCLUDED.zoom,
  degrade=EXCLUDED.degrade,
  atualizada_em=now();
 RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.pmobile_fundo_perfil_ler(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pmobile_fundo_perfil_salvar(text,text,text,integer,integer,integer,integer,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pmobile_fundo_perfil_ler(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pmobile_fundo_perfil_salvar(text,text,text,integer,integer,integer,integer,boolean) TO anon, authenticated;
COMMIT;
