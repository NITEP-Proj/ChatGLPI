import httpx
import os
import logging
from dotenv import load_dotenv

# Carrega variáveis do .env
load_dotenv()

# Configura logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("API.glpi")

# Variáveis de ambiente
GLPI_URL = os.getenv("GLPI_URL")
APP_TOKEN = os.getenv("GLPI_APP_TOKEN")
USER_TOKEN = os.getenv("GLPI_USER_TOKEN")

# Verificações básicas
print("GLPI_URL:", GLPI_URL)
print("APP_TOKEN:", APP_TOKEN)
print("USER_TOKEN:", USER_TOKEN)

# Login no GLPI
async def glpi_login():
    logger.info("Iniciando login no GLPI...")
    async with httpx.AsyncClient() as client:
        headers = {
            "App-Token": APP_TOKEN,
            "Authorization": f"user_token {USER_TOKEN}"
        }
        response = await client.get(f"{GLPI_URL}/initSession", headers=headers)
        logger.info(f"Resposta login: {response.status_code} | {response.text}")
        response.raise_for_status()

        try:
            session_token = response.json().get("session_token")
            if not session_token:
                raise Exception("Token de sessão não encontrado na resposta.")
            logger.info("Sessão iniciada com sucesso.")
            return session_token
        except Exception as e:
            logger.error(f"Erro ao processar login no GLPI: {e}")
            raise

# Criação do chamado
async def criar_chamado(session_token: str, titulo: str, descricao: str):
    logger.info(f"Criando chamado: {titulo}")
    headers = {
        "App-Token": APP_TOKEN,
        "Session-Token": session_token,
        "Content-Type": "application/json"
    }

    payload = {
        "input": {
            "name": titulo,
            "content": descricao
        }
    }

    async with httpx.AsyncClient() as client:
        logger.info(f"Enviando requisição para: {GLPI_URL}/Ticket")
        response = await client.post(f"{GLPI_URL}/Ticket", headers=headers, json=payload)
        logger.info(f"Resposta criação: {response.status_code} | {response.text}")

        # Se estiver vazia mas status 200, retorna fallback
        if response.status_code == 200 and not response.text.strip():
            logger.warning("⚠️ Resposta vazia recebida do GLPI.")
            return {"id": None, "message": "Chamado criado, mas sem ID retornado."}

        try:
            return response.json()
        except Exception as e:
            logger.error(f"Erro ao converter resposta em JSON: {e}")
            logger.error(f"Conteúdo bruto da resposta: {response.text}")
            raise Exception(f"Erro ao criar chamado: {response.text}")

# Consulta do último chamado criado
async def consultar_chamado(session_token: str, chamado_id: int):
    logger.info(f"Consultando chamado ID: {chamado_id}")
    headers = {
        "App-Token": APP_TOKEN,
        "Session-Token": session_token,
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        url = f"{GLPI_URL}/Ticket/{chamado_id}"
        response = await client.get(url, headers=headers)
        logger.info(f"Resposta consulta: {response.status_code} | {response.text}")
        response.raise_for_status()

        try:
            return response.json()
        except Exception as e:
            logger.error(f"Erro ao converter resposta da consulta em JSON: {e}")
            raise Exception(f"Erro ao consultar chamado: {response.text}")

async def consultar_ultimo_chamado(session_token: str) -> dict:
    logger.info("Consultando o último chamado (mais recente)...")

    headers = {
        "App-Token": APP_TOKEN,
        "Session-Token": session_token,
        "Range": "0-0",  # devolve 1 único registro
        "Content-Type": "application/json"
    }
    params = {"sort": "id", "order": "DESC"}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{GLPI_URL}/Ticket", headers=headers, params=params)

        print(f"GLPI RESPOSTA STATUS: {resp.status_code}")
        print(f"GLPI RESPOSTA TEXTO: {resp.text}")


        # Aceita 200 ou 206 como sucesso
        if resp.status_code not in (200, 206):
            logger.error(f"GLPI erro {resp.status_code}: {resp.text}")
            raise Exception(f"Erro {resp.status_code} na consulta")

        data = resp.json()
        return data[0] if isinstance(data, list) and data else {}



# Verifica se as variáveis de ambiente estão configuradas
if not GLPI_URL or not APP_TOKEN or not USER_TOKEN:
    raise ValueError("As variáveis de ambiente GLPI_URL, APP_TOKEN e USER_TOKEN devem estar configuradas.")