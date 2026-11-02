from datetime import date

from app.agents.crypto import calculate_estimate
from app.models import DisputeCase, EvidenceDocument, WarrantyItem
from app.schemas import CaseOut, EvidenceOut, WarrantyOut


def evidence_out(document: EvidenceDocument) -> EvidenceOut:
    return EvidenceOut(
        id=document.id,
        name=document.name,
        size=document.size,
        sha256=document.sha256,
        date=document.created_at.date(),
        content_type=document.content_type,
        download_url=f"/api/v1/documents/{document.id}/download",
    )


def case_out(case: DisputeCase) -> CaseOut:
    estimate = calculate_estimate(
        case.claim_amount,
        case.tax_paid,
        case.shipping_paid,
        case.incidental_expenses,
        case.interest_rate,
        case.purchase_date,
    )
    remaining = max(0, (case.deadline - date.today()).days) if case.deadline else None
    return CaseOut(
        id=case.id,
        consumer_name=case.consumer_name,
        merchant=case.merchant,
        product=case.product,
        purchase_date=case.purchase_date,
        defect_date=case.defect_date,
        claim_amount=case.claim_amount,
        narrative=case.narrative,
        status=case.status,
        created_date=case.created_at.date(),
        deadline=case.deadline,
        documents=[evidence_out(document) for document in case.documents],
        sample=case.sample,
        tax_paid=case.tax_paid,
        shipping_paid=case.shipping_paid,
        incidental_expenses=case.incidental_expenses,
        interest_rate=case.interest_rate,
        interest_estimate=estimate["interest_estimate"],
        total_demand_estimate=estimate["total_demand_estimate"],
        merkle_root=case.merkle_root,
        notice_markdown=case.notice_markdown,
        days_remaining=remaining,
    )


def warranty_out(item: WarrantyItem) -> WarrantyOut:
    remaining = (item.expiry_date - date.today()).days
    status = "expired" if remaining < 0 else "expiring_soon" if remaining <= 30 else "active"
    return WarrantyOut(
        id=item.id,
        name=item.name,
        brand=item.brand,
        category=item.category,
        model_number=item.model_number,
        serial_number=item.serial_number,
        seller=item.seller,
        purchase_date=item.purchase_date,
        purchase_price=item.purchase_price,
        warranty_duration_months=item.warranty_duration_months,
        expiry_date=item.expiry_date,
        documents=[evidence_out(document) for document in item.documents],
        sample=item.sample,
        days_remaining=max(0, remaining),
        status=status,
    )
