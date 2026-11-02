"""Fact prompts for consumer case review; these are not legal eligibility rules."""

from datetime import date


def review_prompts(purchase_date: date, defect_date: date, narrative: str) -> list[dict[str, str]]:
    days = (defect_date - purchase_date).days
    prompts: list[dict[str, str]] = []
    if any(word in narrative.lower() for word in ("warranty", "repair", "defect", "broken", "failed")):
        prompts.append({
            "topic": "Product or warranty issue",
            "question": "Keep the warranty terms, repair attempts, dates, and written responses with the original purchase proof.",
            "basis": f"The reported issue occurred {days} days after the recorded purchase date.",
        })
    if any(word in narrative.lower() for word in ("subscription", "renew", "cancel", "recurring")):
        prompts.append({
            "topic": "Recurring charge or cancellation",
            "question": "Preserve the signup terms, cancellation steps, confirmation, and charges after cancellation.",
            "basis": "The narrative mentions a subscription, renewal, or cancellation.",
        })
    if not prompts:
        prompts.append({
            "topic": "Organize the record",
            "question": "Record the timeline, the requested outcome, and each response. Keep original evidence files.",
            "basis": "Prompt generated from the information supplied; no legal issue has been determined.",
        })
    return prompts
