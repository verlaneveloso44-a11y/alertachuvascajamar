-- ==========================================================
-- SEGURANCA NO SUPABASE  (rode no SQL Editor, uma vez)
-- ==========================================================
-- O Supabase expoe as tabelas do schema public por uma API publica (REST) com a chave "anon".
-- Sem RLS ligado, qualquer pessoa com essa chave poderia LER e ALTERAR as tabelas,
-- inclusive telefones e e-mails de contatos_alerta (dados pessoais, LGPD).
--
-- Ligando o RLS SEM criar politicas, a API publica fica bloqueada.
-- O backend Flask conecta direto no Postgres (DATABASE_URL) e continua funcionando normalmente.

ALTER TABLE public.bairros             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estacoes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicoes_chuva      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contatos_alerta     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes_comunidade ENABLE ROW LEVEL SECURITY;

-- A tabela spatial_ref_sys do PostGIS tambem aparece no schema public; pode ser ignorada.
