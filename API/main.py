from fastapi import FastAPI, HTTPException, Path
from pydantic import BaseModel
from API.glpi import glpi_login, criar_chamado, consultar_chamado  # Certifique-se de que a pasta API contém um __init__.py

app = FastAPI()

# Modelo do corpo da requisição
class ChamadoRequest(BaseModel):
    phone: str
    message: str

# Endpoint para criação de chamado
@app.post("/chamado")
async def criar_chamado_api(data: ChamadoRequest):
    try:
        # Remove espaços extras e monta os campos
        titulo = f"Chamado de {data.phone.strip()}"
        descricao = data.message.strip()

        # Login no GLPI
        session_token = await glpi_login()

        # Criação do chamado
        resultado = await criar_chamado(session_token, titulo, descricao)

        # Verifica retorno
        chamado_id = resultado.get("id")
        if chamado_id is None:
            chamado_id = "Indisponível"

        return {
            "status": "sucesso",
            "chamado_id": chamado_id,
            "mensagem": "Chamado criado com sucesso!"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar chamado: {str(e)}")

# Endpoint para consulta de chamado
@app.get("/chamado/{chamado_id}")
async def consultar_chamado_api(chamado_id: int = Path(..., description="ID do chamado no GLPI")):
    try:
        session_token = await glpi_login()
        resultado = await consultar_chamado(session_token, chamado_id)

        return {
            "status": "sucesso",
            "dados": {
                "titulo": resultado.get("name"),
                "descricao": resultado.get("content"),
                "status_chamado": resultado.get("status"),  # 1=Novo, 2=Em andamento, 6=Fechado
                "data_abertura": resultado.get("date")
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao consultar chamado: {str(e)}")
