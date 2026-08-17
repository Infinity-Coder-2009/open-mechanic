"""
OpenMechanic Python CAD Microservice
FastAPI service that generates CAD models using CadQuery
"""
import os
import json
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from fan_generator import generate_fan_stl, FanParameters

app = FastAPI(
    title="OpenMechanic CAD Service",
    description="CAD generation microservice using CadQuery",
    version="1.0.0",
)

API_KEY = os.getenv("PYTHON_CAD_API_KEY", "dev_key_change_in_production")
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "/app/output"))

class CadRequest(BaseModel):
    type: str = Field(..., description="Type of CAD to generate (currently only 'fan')")
    parameters: FanParameters

class CadResponse(BaseModel):
    success: bool
    stl_path: Optional[str] = None
    error: Optional[str] = None
    metadata: dict = {}

def verify_api_key(api_key: str = Header(..., alias="X-API-Key")):
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return api_key

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "openmechanic-cad"}

@app.post("/generate", response_model=CadResponse)
async def generate_cad(request: CadRequest, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    
    try:
        if request.type != "fan":
            raise HTTPException(status_code=400, detail=f"Unsupported CAD type: {request.type}")
        
        # Generate unique output filename
        job_id = str(uuid.uuid4())[:8]
        output_filename = f"fan_{job_id}.stl"
        output_path = OUTPUT_DIR / output_filename
        
        # Generate STL
        metadata = generate_fan_stl(request.parameters, output_path)
        
        return CadResponse(
            success=True,
            stl_path=str(output_path),
            metadata=metadata,
        )
    except Exception as e:
        return CadResponse(
            success=False,
            error=str(e),
        )

@app.get("/download/{filename}")
async def download_stl(filename: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        media_type="application/octet-stream",
        filename=filename,
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)