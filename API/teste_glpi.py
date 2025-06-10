import httpx
import os
from dotenv import load_dotenv

# Carrega as variáveis do .env
load_dotenv()

GLPI_URL = os.getenv("GLPI_URL")
APP_TOKEN = os.getenv("GLPI_APP_TOKEN")
USER_TOKEN = os.getenv("GLPI_USER_TOKEN")

print("Testando conexão com o GLPI...")

# Verificações básicas
if not GLPI_URL or not APP_TOKEN or not USER_TOKEN:
    raise ValueError("As variáveis de ambiente GLPI_URL, GLPI_APP_TOKEN e GLPI_USER_TOKEN devem estar definidas.")

print("GLPI_URL:", GLPI_URL)
print("APP_TOKEN:", repr(APP_TOKEN))  # Use repr para ver se tem \n ou espaços
print("USER_TOKEN:", repr(USER_TOKEN))

# Prepara os headers
headers = {
    "App-Token": APP_TOKEN,
    "Authorization": f"user_token {USER_TOKEN}"
}

# Monta a URL corretamente (sem barra dupla!)
url = f"{GLPI_URL.rstrip('/')}/initSession"
print("Testando conexão com:", url)

# Faz a requisição
try:
    resp = httpx.get(url, headers=headers)
    print("Status:", resp.status_code)
    print("Resposta:", resp.text)
except httpx.RequestError as e:
    print("Erro de requisição:", str(e))
