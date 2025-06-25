from fastapi import FastAPI, HTTPException, Path
from pydantic import BaseModel
from API.glpi import glpi_login, criar_chamado, consultar_chamado, consultar_ultimo_chamado  # Certifique-se de que a pasta API contém um __init__.py

app = FastAPI()

# Modelo do corpo da requisição
class ChamadoRequest(BaseModel):
    phone: str
    name: str
    message: str

# Endpoint para criação de chamado
@app.post("/chamado")
async def criar_chamado_api(data: ChamadoRequest):
    try:
        # Remove espaços extras e monta os campos
        titulo = f"Chamado de {data.name.strip()} - {data.phone.strip()}"
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

# Endpoint para consulta do último chamado criado
@app.get("/chamado/ultimo", summary="Consulta o último chamado criado")
async def consultar_ultimo_chamado_api():
    try:
        session_token = await glpi_login()
        ticket = await consultar_ultimo_chamado(session_token)  # chama a função correta

        if not ticket:
            raise HTTPException(status_code=404, detail="Nenhum chamado encontrado.")

        return {
            "status": "sucesso",
            "dados": {
                "id": ticket.get("id")
                # outras informações comentadas
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao consultar último chamado: {str(e)}")

# Endpoint para consulta de chamado global
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
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao consultar chamado: {str(e)}")
