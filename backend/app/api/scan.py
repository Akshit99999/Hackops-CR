from fastapi import APIRouter, Depends, HTTPException

from app.integrations.scan import lookup_product
from app.models import Workspace
from app.schemas import ScanRequest
from app.security import get_workspace

router = APIRouter(prefix="/scan", tags=["product lookup"])


@router.post("/lookup")
async def scan_lookup(
    payload: ScanRequest,
    workspace: Workspace = Depends(get_workspace),
):
    del workspace  # Only public lookup terms are sent to external services.
    try:
        return await lookup_product(payload.barcode, payload.product_name, payload.brand, payload.model_number)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
