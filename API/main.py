from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from API.glpi import glpi_login, criar_chamado  # Certifique-se que API/ tenha __init__.py

app = FastAPI()

# Modelo dos dados esperados no corpo da requisição
class ChamadoRequest(BaseModel):
    phone: str
    message: str

# Endpoint POST para criação de chamado
@app.post("/chamado")
async def criar_chamado_api(data: ChamadoRequest):
    try:
        titulo = f"Chamado de {data.phone}"
        descricao = data.message

        # Login no GLPI e criação do chamado
        session_token = await glpi_login()  # Deve ser async
        resultado = await criar_chamado(session_token, titulo, descricao)  # Deve ser async

        return {
            "status": "sucesso",
            "chamado_id": resultado.get("id", "N/A"),
            "mensagem": "Chamado criado com sucesso!"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar chamado: {str(e)}")
