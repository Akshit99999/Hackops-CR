import asyncio
import re
from datetime import datetime, timezone

import httpx

from app.config import settings

USER_AGENT = "Hackops-CR/0.1 (https://github.com/vishalbudhathoki/Hackops-CR; product lookup)"


def parse_gtin(value: str | None) -> dict:
    if not value:
        return {"gtin": None, "lot": None, "serial": None, "valid": False}
    raw = value.strip()
    lot = serial = None
    match = re.search(r"/01/(\d{8,14})(?:/10/([^/?]+))?(?:/21/([^/?]+))?", raw)
    if match:
        raw, lot, serial = match.groups()
    digits = re.sub(r"\D", "", raw)
    if len(digits) not in (8, 12, 13, 14):
        return {"gtin": digits or None, "lot": lot, "serial": serial, "valid": False}
    checksum = sum(int(digit) * (3 if (len(digits) - index) % 2 == 0 else 1) for index, digit in enumerate(digits[:-1]))
    valid = (10 - checksum % 10) % 10 == int(digits[-1])
    return {"gtin": digits, "lot": lot, "serial": serial, "valid": valid}


async def get_json(client: httpx.AsyncClient, url: str, params: dict | None = None) -> dict:
    response = await client.get(url, params=params)
    response.raise_for_status()
    return response.json()


async def open_food_facts(client: httpx.AsyncClient, gtin: str) -> dict:
    fields = "product_name,brands,categories,quantity,ingredients_text,allergens,nutriscore_grade,image_front_url,packaging_text"
    data = await get_json(
        client,
        f"https://world.openfoodfacts.org/api/v3/product/{gtin}",
        {"fields": fields},
    )
    product = data.get("product") or {}
    if data.get("status") not in (1, "success") or not product:
        return {"status": "no_match", "product": None}
    return {
        "status": "matched",
        "product": {
            "name": product.get("product_name"),
            "brand": product.get("brands"),
            "categories": product.get("categories"),
            "quantity": product.get("quantity"),
            "ingredients": product.get("ingredients_text"),
            "allergens": product.get("allergens"),
            "nutrition_grade": product.get("nutriscore_grade"),
            "image_url": product.get("image_front_url"),
            "packaging": product.get("packaging_text"),
            "source_url": f"https://world.openfoodfacts.org/product/{gtin}",
        },
        "note": "Community-contributed product data may be incomplete or inaccurate.",
    }


async def fda_recalls(client: httpx.AsyncClient, gtin: str) -> dict:
    results = []
    errors = []
    for category in ("food", "drug"):
        try:
            data = await get_json(
                client,
                f"https://api.fda.gov/{category}/enforcement.json",
                {"search": f'openfda.upc:"{gtin}"', "limit": 10},
            )
            for row in data.get("results", []):
                results.append({
                    "source": "openFDA",
                    "dataset": category,
                    "recall_number": row.get("recall_number"),
                    "date": row.get("recall_initiation_date"),
                    "classification": row.get("classification"),
                    "product": row.get("product_description"),
                    "reason": row.get("reason_for_recall"),
                    "firm": row.get("recalling_firm"),
                    "status": row.get("status"),
                    "source_url": f"https://api.fda.gov/{category}/enforcement.json",
                })
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code != 404:
                errors.append(category)
        except (httpx.HTTPError, ValueError):
            errors.append(category)
    return {
        "status": "matched" if results else "unavailable" if errors else "no_match",
        "recalls": results,
        "note": "A no-match response does not prove that a product is recall-free; FDA datasets can be incomplete.",
        "failed_datasets": errors,
    }


async def cpsc_recalls(client: httpx.AsyncClient, query: str | None) -> dict:
    if not query:
        return {"status": "not_queried", "recalls": []}
    try:
        data = await get_json(
            client,
            "https://www.saferproducts.gov/RestWebServices/Recall",
            {"format": "json", "RecallTitle": query[:160]},
        )
        recalls = []
        if isinstance(data, list):
            for row in data[:25]:
                recalls.append({
                    "source": "U.S. CPSC",
                    "recall_number": row.get("RecallNumber"),
                    "date": row.get("RecallDate"),
                    "title": row.get("RecallTitle"),
                    "description": row.get("Description"),
                    "hazard": row.get("Hazard"),
                    "remedy": row.get("Remedy"),
                    "source_url": row.get("URL") or "https://www.saferproducts.gov/",
                })
        return {"status": "matched" if recalls else "no_match", "recalls": recalls}
    except (httpx.HTTPError, ValueError):
        return {"status": "unavailable", "recalls": []}


async def lookup_product(
    barcode: str | None,
    product_name: str | None,
    brand: str | None,
    model_number: str | None,
) -> dict:
    gtin = parse_gtin(barcode)
    if barcode and not gtin["valid"]:
        raise ValueError("Barcode must be a valid GTIN-8, GTIN-12, GTIN-13, GTIN-14, or GS1 Digital Link.")
    title_query = " ".join(value.strip() for value in (product_name, brand, model_number) if value and value.strip())
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    timeout = httpx.Timeout(settings.external_api_timeout_seconds)
    async with httpx.AsyncClient(headers=headers, timeout=timeout, follow_redirects=True) as client:
        tasks = [cpsc_recalls(client, title_query or None)]
        if gtin["valid"]:
            tasks.extend([open_food_facts(client, gtin["gtin"]), fda_recalls(client, gtin["gtin"])])
        outcomes = await asyncio.gather(*tasks, return_exceptions=True)
        if gtin["valid"] and not title_query and len(outcomes) > 1 and isinstance(outcomes[1], dict):
            product = outcomes[1].get("product") or {}
            fallback_title = " ".join(value for value in (product.get("brand"), product.get("name")) if value)
            if fallback_title:
                outcomes[0] = await cpsc_recalls(client, fallback_title)
    cpsc = outcomes[0] if isinstance(outcomes[0], dict) else {"status": "unavailable", "recalls": []}
    offset = 1
    off = fda = {"status": "not_queried", "product": None} if not gtin["valid"] else {}
    if gtin["valid"]:
        off = outcomes[offset] if isinstance(outcomes[offset], dict) else {"status": "unavailable", "product": None}
        fda = outcomes[offset + 1] if isinstance(outcomes[offset + 1], dict) else {"status": "unavailable", "recalls": []}
    now = datetime.now(timezone.utc).isoformat()
    recall_list = list(cpsc.get("recalls", [])) + list(fda.get("recalls", []))
    fields_present = sum(bool(value) for value in (product_name, brand, model_number, gtin.get("gtin")))
    return {
        "lookup": {"gtin": gtin.get("gtin"), "lot": gtin.get("lot"), "serial": gtin.get("serial"), "valid_gtin": gtin.get("valid", False)},
        "product": off.get("product") if isinstance(off, dict) else None,
        "recalls": recall_list,
        "sources": {
            "cpsc": cpsc,
            "openfda": fda,
            "open_food_facts": off,
        },
        "data_completeness": {"provided_identifier_count": fields_present, "coverage_label": "source coverage only; not a safety rating"},
        "retrieved_at": now,
        "disclaimer": "No recall match does not establish that a product is safe or recall-free. Check the linked source and confirm model, lot, and date details.",
    }
