from pydantic import BaseModel

class ChamadoRequest(BaseModel):
    phone: str
    message: str
