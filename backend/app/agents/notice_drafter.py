from datetime import date

from app.agents.crypto import calculate_estimate
from app.models import DisputeCase


def draft_notice(case: DisputeCase, merkle_root: str | None = None) -> str:
    estimate = calculate_estimate(
        case.claim_amount,
        case.tax_paid,
        case.shipping_paid,
        case.incidental_expenses,
        case.interest_rate,
        case.purchase_date,
    )
    evidence = case.documents or []
    evidence_list = "\n".join(
        f"- {document.name} — SHA-256 `{document.sha256}`" for document in evidence
    ) or "- No evidence files are attached."
    address = f"\nConsumer address: {case.consumer_address}" if case.consumer_address else ""
    deadline = (
        f"\nRequested response date: {case.deadline.isoformat()} (based on a user-entered response period)."
        if case.deadline
        else ""
    )
    return f"""# Draft consumer resolution request

**Status:** Draft for review; nothing has been sent.

To: {case.merchant}
From: {case.consumer_name}{address}
Date prepared: {date.today().isoformat()}

## Purchase and issue

- Product: {case.product}
- Purchase date: {case.purchase_date.isoformat()}
- Issue reported: {case.defect_date.isoformat()}
- Amount requested by consumer: ${case.claim_amount:,.2f}
- Tax entered: ${case.tax_paid:,.2f}
- Shipping entered: ${case.shipping_paid:,.2f}
- Other expenses entered: ${case.incidental_expenses:,.2f}
- User-selected annual interest rate: {case.interest_rate:.2%}
- Arithmetic estimate (not a legal damages determination): ${estimate['total_demand_estimate']:,.2f}
{deadline}

## Consumer's account

{case.narrative}

Please review the facts above and contact me to discuss an appropriate resolution. This request is a draft for the consumer to edit and deliver through a channel they choose. It does not state a legal conclusion, establish eligibility, or guarantee a remedy.

## Evidence inventory

{evidence_list}

Evidence bundle SHA-256 Merkle root: `{merkle_root or case.merkle_root}`

This generated document is not legal advice and has not been reviewed or served by a lawyer. Confirm every fact, calculation, deadline, and applicable rule before sending.
"""
