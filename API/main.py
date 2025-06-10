from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from API.glpi import glpi_login, criar_chamado

app = FastAPI()

class ChamadoRequest(BaseModel):
    phone: str
    message: str

@app.post("/chamado")
async def criar_chamado_api(data: ChamadoRequest):
    try:
        titulo = f"Chamado de {data.phone}"
        descricao = data.message
        session_token = await glpi_login()
        resultado = await criar_chamado(session_token, titulo, descricao)
        return {"status": "sucesso", "dados": resultado}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
