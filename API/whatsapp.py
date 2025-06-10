import httpx
import os

WPP_URL = os.getenv("WPP_URL")  # Ex: http://localhost:21465/api/send-message

async def enviar_mensagem(numero: str, mensagem: str):
    payload = {
        "phone": numero,
        "message": mensagem
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(WPP_URL, json=payload)
        response.raise_for_status()
        return response.json()
