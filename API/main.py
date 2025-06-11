from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from API.glpi import glpi_login, criar_chamado  # Rode o Venv antes de executar este script

app = FastAPI()

# Modelo do corpo da requisição
class ChamadoRequest(BaseModel):
    phone: str
    message: str

@app.post("/chamado")
async def criar_chamado_api(data: ChamadoRequest):
    try:
        titulo = f"Chamado de {data.phone}"
        descricao = data.message.strip()  # Evita espaços em branco acidentais

        # Autenticação e criação do chamado no GLPI
        session_token = await glpi_login()
        resultado = await criar_chamado(session_token, titulo, descricao)

        chamado_id = resultado.get("id")
        if not chamado_id:
            raise Exception("ID do chamado não retornado pelo GLPI.")

        return {
            "status": "sucesso",
            "chamado_id": chamado_id,
            "mensagem": "Chamado criado com sucesso!"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar chamado: {str(e)}")
