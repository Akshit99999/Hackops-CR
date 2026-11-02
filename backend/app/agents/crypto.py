import hashlib
import json
from datetime import date
from typing import Any


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def merkle_root(facts: dict[str, Any], evidence_hashes: list[str]) -> str:
    """Bind normalized case facts and evidence digests into a deterministic SHA-256 tree."""
    canonical = json.dumps(facts, sort_keys=True, separators=(",", ":"), default=str).encode()
    leaves = [hashlib.sha256(b"facts:" + canonical).digest()]
    leaves.extend(hashlib.sha256(b"evidence:" + item.lower().encode()).digest() for item in sorted(evidence_hashes))
    while len(leaves) > 1:
        if len(leaves) % 2:
            leaves.append(leaves[-1])
        leaves = [
            hashlib.sha256(leaves[index] + leaves[index + 1]).digest()
            for index in range(0, len(leaves), 2)
        ]
    return leaves[0].hex()


def case_facts(case: Any) -> dict[str, Any]:
    return {
        "id": case.id,
        "consumer_name": case.consumer_name,
        "consumer_address": case.consumer_address,
        "merchant": case.merchant,
        "product": case.product,
        "purchase_date": case.purchase_date,
        "defect_date": case.defect_date,
        "claim_amount": round(case.claim_amount, 2),
        "tax_paid": round(case.tax_paid, 2),
        "shipping_paid": round(case.shipping_paid, 2),
        "incidental_expenses": round(case.incidental_expenses, 2),
        "interest_rate": case.interest_rate,
        "narrative": case.narrative,
    }


def calculate_estimate(
    amount: float,
    tax: float,
    shipping: float,
    incidental_expenses: float,
    annual_rate: float,
    purchase_date: date,
    as_of: date | None = None,
) -> dict[str, float]:
    """Return a transparent arithmetic estimate; rate is user-provided, never assumed statutory."""
    days = max(0, ((as_of or date.today()) - purchase_date).days)
    base = amount + tax + shipping
    interest = round(base * (annual_rate / 365) * days, 2)
    return {
        "interest_estimate": interest,
        "total_demand_estimate": round(base + incidental_expenses + interest, 2),
    }
