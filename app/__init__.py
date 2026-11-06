"""Alerta Chuvas Cajamar - backend (Flask).

Rotas:
  /            página principal
  /api/clima    JSON com temperatura, chuva e nível de alerta de cada bairro
  /api/rios     vazão estimada dos rios (Open-Meteo Flood API)
  /api/reportes relatos da comunidade (GET lista / POST envia) - tabela reportes_comunidade
  /api/cadastro cadastro de usuários (Supabase)
  /api/login    login de usuários (Supabase)
  /api/social-login login/cadastro via redes sociais (Google, Facebook, Instagram)
  /api/logout   logout da sessão
  /api/usuario/atual status da sessão atual

Banco de dados (Supabase/PostgreSQL) é configurado no .env (DATABASE_URL).
Sem banco, o site continua funcionando com os bairros padrão e a previsão do Open-Meteo.
"""
import logging
import os
import time

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, session
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

log = logging.getLogger("alertachuva")

BAIRROS_PADRAO = [
    {"bairro": "Polvilho",   "latitude": -23.3590, "longitude": -46.8800},
    {"bairro": "Jordanésia", "latitude": -23.3830, "longitude": -46.8600},
    {"bairro": "Anhanguera", "latitude": -23.3960, "longitude": -46.8330},
]

RIOS = [
    {"nome": "Rio Juqueri (Cajamar)", "latitude": -23.3560, "longitude": -46.8770},
]

INTENSIDADES = ["Leve", "Moderada", "Forte", "Alagamento"]
CAJAMAR_BOX = (-23.45, -23.28, -46.96, -46.76)
_envios = {}

CACHE_SEGUNDOS = 300
_cache = {"t": 0, "dados": None}
_cache_rios = {"t": 0, "dados": None}
CACHE_RIOS_SEGUNDOS = 1800


def get_conn():
    import psycopg2
    url = os.getenv("DATABASE_URL")
    if url:
        return psycopg2.connect(url, connect_timeout=5)
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "postgres"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        sslmode=os.getenv("DB_SSLMODE", "prefer"),
        connect_timeout=5,
    )


def buscar_estacoes():
    try:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT e.id_estacao, COALESCE(b.nome_bairro, e.nome_estacao), e.latitude, e.longitude
                    FROM estacoes e LEFT JOIN bairros b ON b.id_bairro = e.id_bairro
                    WHERE COALESCE(e.ativa, TRUE)
                      AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL
                    ORDER BY 2, 1
                    """
                )
                linhas = cur.fetchall()
        finally:
            conn.close()
        if linhas:
            return [{"id_estacao": i, "bairro": n, "latitude": float(la), "longitude": float(lo)}
                    for i, n, la, lo in linhas]
    except Exception:
        pass
    return BAIRROS_PADRAO


def medicoes_recentes():
    try:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT DISTINCT ON (id_estacao) id_estacao, precipitacao_mm
                    FROM medicoes_chuva
                    WHERE data_hora >= NOW() - INTERVAL '1 hour' AND precipitacao_mm IS NOT NULL
                    ORDER BY id_estacao, data_hora DESC
                    """
                )
                return {i: float(mm) for i, mm in cur.fetchall()}
        finally:
            conn.close()
    except Exception:
        return {}


def classificar(mm):
    if mm >= 25:
        return {"nivel": "CRÍTICO", "classe_css": "alerta-critico",
                "mensagem": "Risco alto de alagamento. Procure local seguro e ligue 199."}
    if mm >= 7.6:
        return {"nivel": "ALERTA", "classe_css": "alerta-alerta",
                "mensagem": "Chuva forte. Evite deslocamentos e áreas de alagamento."}
    if mm >= 2.5:
        return {"nivel": "ATENÇÃO", "classe_css": "alerta-atencao",
                "mensagem": "Chuva moderada. Fique atento e evite áreas de risco."}
    return {"nivel": "NORMAL", "classe_css": "alerta-normal",
            "mensagem": "Condições meteorológicas estáveis. Sem risco iminente."}


def consultar_clima():
    estacoes = buscar_estacoes()
    lats = ",".join(str(e["latitude"]) for e in estacoes)
    lons = ",".join(str(e["longitude"]) for e in estacoes)

    r = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": lats,
            "longitude": lons,
            "current": "temperature_2m,precipitation",
            "hourly": "precipitation_probability",
            "forecast_hours": 1,
            "timezone": "America/Sao_Paulo",
        },
        timeout=10,
    )
    r.raise_for_status()
    resp = r.json()
    if isinstance(resp, dict):
        resp = [resp]

    medidas = medicoes_recentes()
    resultado = []
    for est, d in zip(estacoes, resp):
        mm = float(d["current"].get("precipitation") or 0)
        fonte = "modelo"
        if est.get("id_estacao") in medidas:
            mm = medidas[est["id_estacao"]]
            fonte = "estacao"
        prob = (d.get("hourly", {}).get("precipitation_probability") or [0])[0] or 0
        resultado.append({
            "bairro": est["bairro"],
            "latitude": est["latitude"],
            "longitude": est["longitude"],
            "temperatura_c": round(float(d["current"]["temperature_2m"]), 1),
            "precipitacao_mm": round(mm, 1),
            "probabilidade_chuva": int(prob),
            "alerta": classificar(mm),
            "fonte": fonte,
        })
    return resultado


def classificar_rio(razao):
    if razao >= 4:
        return {"nivel": "CRÍTICO", "mensagem": "Vazão muito acima do normal. Risco de transbordamento."}
    if razao >= 2.5:
        return {"nivel": "ALERTA", "mensagem": "Vazão bem acima do normal. Evite margens e áreas baixas."}
    if razao >= 1.5:
        return {"nivel": "ATENÇÃO", "mensagem": "Vazão acima do normal. Acompanhe a evolução."}
    return {"nivel": "NORMAL", "mensagem": "Vazão dentro do esperado."}


def consultar_rios():
    saida = []
    for rio in RIOS:
        r = requests.get(
            "https://flood-api.open-meteo.com/v1/flood",
            params={
                "latitude": rio["latitude"],
                "longitude": rio["longitude"],
                "daily": "river_discharge",
                "past_days": 30,
                "forecast_days": 7,
            },
            timeout=10,
        )
        r.raise_for_status()
        d = r.json()["daily"]
        datas, vaz = d["time"], d["river_discharge"]
        hoje = 30
        passado = [v for v in vaz[:hoje] if v is not None]
        atual = vaz[hoje]
        if atual is None or not passado:
            continue
        media = sum(passado) / len(passado)
        razao = atual / media if media > 0 else 1
        ontem = vaz[hoje - 1] if vaz[hoje - 1] is not None else atual
        diff = atual - ontem
        tend = "subindo" if diff > 0.05 * max(atual, 0.1) else "caindo" if diff < -0.05 * max(atual, 0.1) else "estável"
        saida.append({
            "nome": rio["nome"],
            "latitude": rio["latitude"],
            "longitude": rio["longitude"],
            "vazao_m3s": round(atual, 2),
            "media_30d": round(media, 2),
            "razao": round(razao, 2),
            "tendencia": tend,
            "previsao": [{"data": datas[i], "vazao": round(vaz[i], 2)} for i in range(hoje, len(vaz)) if vaz[i] is not None],
            "alerta": classificar_rio(razao),
            "estimado": True,
            "fonte": "Open-Meteo Flood API (modelo GloFAS)",
        })
    return saida


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev")

    @app.context_processor
    def versao_estatico():
        def v(nome):
            try:
                return int(os.path.getmtime(os.path.join(app.static_folder, nome)))
            except OSError:
                return 0
        return {"v": v}

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/api/clima")
    def api_clima():
        agora = time.time()
        if _cache["dados"] is not None and agora - _cache["t"] < CACHE_SEGUNDOS:
            return jsonify(_cache["dados"])
        try:
            dados = consultar_clima()
            _cache.update(t=agora, dados=dados)
            return jsonify(dados)
        except Exception:
            if _cache["dados"] is not None:
                return jsonify(_cache["dados"])
            return jsonify({"erro": "Não foi possível obter os dados do clima."}), 502

    @app.route("/api/rios")
    def api_rios():
        agora = time.time()
        if _cache_rios["dados"] is not None and agora - _cache_rios["t"] < CACHE_RIOS_SEGUNDOS:
            return jsonify(_cache_rios["dados"])
        try:
            dados = consultar_rios()
            _cache_rios.update(t=agora, dados=dados)
            return jsonify(dados)
        except Exception:
            if _cache_rios["dados"] is not None:
                return jsonify(_cache_rios["dados"])
            return jsonify({"erro": "Não foi possível obter os dados dos rios."}), 502

    @app.route("/api/reportes", methods=["GET", "POST"])
    def api_reportes():
        if request.method == "GET":
            try:
                conn = get_conn()
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            SELECT id_reporte, latitude, longitude, intensidade, descricao, data_hora
                            FROM reportes_comunidade
                            WHERE data_hora >= NOW() - INTERVAL '24 hours'
                            ORDER BY data_hora DESC LIMIT 200
                            """
                        )
                        linhas = cur.fetchall()
                finally:
                    conn.close()
                return jsonify([
                    {"id": i, "latitude": la, "longitude": lo, "intensidade": it,
                     "descricao": ds or "", "data_hora": dh.isoformat()}
                    for i, la, lo, it, ds, dh in linhas
                ])
            except Exception:
                return jsonify([])

        ip = request.headers.get("X-Forwarded-For", request.remote_addr or "?").split(",")[0].strip()
        agora = time.time()
        recentes = [t for t in _envios.get(ip, []) if agora - t < 3600]
        if len(recentes) >= 5:
            return jsonify({"erro": "Muitos relatos enviados. Tente novamente mais tarde."}), 429

        d = request.get_json(silent=True) or {}
        try:
            lat, lon = float(d.get("latitude")), float(d.get("longitude"))
        except (TypeError, ValueError):
            return jsonify({"erro": "Localização inválida."}), 400
        if not (CAJAMAR_BOX[0] <= lat <= CAJAMAR_BOX[1] and CAJAMAR_BOX[2] <= lon <= CAJAMAR_BOX[3]):
            return jsonify({"erro": "O relato precisa ser dentro de Cajamar."}), 400
        intensidade = d.get("intensidade")
        if intensidade not in INTENSIDADES:
            return jsonify({"erro": "Escolha a intensidade da chuva."}), 400
        descricao = str(d.get("descricao") or "").strip()[:300]

        try:
            conn = get_conn()
            try:
                with conn, conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO reportes_comunidade (latitude, longitude, intensidade, descricao) VALUES (%s, %s, %s, %s)",
                        (lat, lon, intensidade, descricao or None),
                    )
            finally:
                conn.close()
        except Exception:
            return jsonify({"erro": "Não foi possível salvar agora. Tente novamente."}), 503
        _envios[ip] = recentes + [agora]
        return jsonify({"ok": True}), 201

    @app.route("/api/cadastro", methods=["POST"])
    def api_cadastro():
        d = request.get_json(silent=True) or {}
        nome = str(d.get("nome") or "").strip()
        email = str(d.get("email") or "").strip().lower()
        senha = str(d.get("senha") or "")
        confirma = str(d.get("confirma_senha") or "")

        if not nome or not email or not senha:
            return jsonify({"erro": "Preencha todos os campos obrigatórios."}), 400
        if senha != confirma:
            return jsonify({"erro": "As senhas não coincidem. Digite novamente."}), 400

        senha_hash = generate_password_hash(senha)

        try:
            conn = get_conn()
            try:
                with conn, conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO public.usuarios (nome, email, senha_hash) VALUES (%s, %s, %s)",
                        (nome, email, senha_hash)
                    )
            finally:
                conn.close()
        except Exception as e:
            if "unique constraint" in str(e).lower() or "duplicate key" in str(e).lower():
                return jsonify({"erro": "Este e-mail já está cadastrado. Faça login."}), 400
            log.exception("Falha no cadastro")
            print("ERRO CADASTRO:", type(e).__name__, getattr(e, "pgcode", None), str(e))
            return jsonify({"erro": "Não foi possível realizar o cadastro no banco de dados."}), 503

        session["usuario_email"] = email
        session["usuario_nome"] = nome
        return jsonify({"ok": True, "nome": nome, "email": email}), 201

    @app.route("/api/login", methods=["POST"])
    def api_login():
        d = request.get_json(silent=True) or {}
        email = str(d.get("email") or "").strip().lower()
        senha = str(d.get("senha") or "")

        if not email or not senha:
            return jsonify({"erro": "Informe seu e-mail e senha."}), 400

        try:
            conn = get_conn()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT nome, email, senha_hash FROM public.usuarios WHERE email = %s",
                        (email,)
                    )
                    row = cur.fetchone()
            finally:
                conn.close()
        except Exception as e:
            log.exception("Falha no login")
            print("ERRO LOGIN:", type(e).__name__, getattr(e, "pgcode", None), str(e))
            return jsonify({"erro": "Erro ao conectar com o banco de dados."}), 503

        if not row or not check_password_hash(row[2], senha):
            return jsonify({"erro": "E-mail ou senha inválidos, ou conta não cadastrada."}), 401

        session["usuario_email"] = row[1]
        session["usuario_nome"] = row[0]
        return jsonify({"ok": True, "nome": row[0], "email": row[1]})

    @app.route("/api/social-login", methods=["POST"])
    def api_social_login():
        d = request.get_json(silent=True) or {}
        email = str(d.get("email") or "").strip().lower()
        nome = str(d.get("nome") or "Usuário").strip()
        provedor = str(d.get("provedor") or "social").strip()

        if not email or "@" not in email:
            return jsonify({"erro": "E-mail inválido fornecido pela rede social."}), 400

        try:
            conn = get_conn()
            try:
                with conn, conn.cursor() as cur:
                    cur.execute(
                        "SELECT nome, email FROM public.usuarios WHERE email = %s",
                        (email,)
                    )
                    row = cur.fetchone()

                    if not row:
                        cur.execute(
                            "INSERT INTO public.usuarios (nome, email, senha_hash) VALUES (%s, %s, %s) "
                            "ON CONFLICT (email) DO NOTHING",
                            (nome, email, f"SOCIAL_AUTH_{provedor.upper()}")
                        )
            finally:
                conn.close()
        except Exception as e:
            log.exception("Falha no social-login")
            print("ERRO SOCIAL-LOGIN:", type(e).__name__, getattr(e, "pgcode", None), str(e))
            return jsonify({"erro": "Erro ao salvar usuário no banco de dados."}), 503

        session["usuario_email"] = email
        session["usuario_nome"] = nome
        return jsonify({"ok": True, "nome": nome, "email": email})

    @app.route("/api/logout", methods=["POST"])
    def api_logout():
        session.clear()
        return jsonify({"ok": True})

    @app.route("/api/usuario/atual", methods=["GET"])
    def api_usuario_atual():
        if "usuario_email" in session:
            return jsonify({
                "logado": True,
                "nome": session.get("usuario_nome"),
                "email": session.get("usuario_email")
            })
        return jsonify({"logado": False})

    return app
