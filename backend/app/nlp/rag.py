import re

STOP_WORDS = {"the", "are", "can", "what", "does", "this", "that", "will", "with", "have", "they", "and", "for", "you", "how"}
EXPANSIONS = {
    "cancel": ["terminate", "termination", "cancel", "cancellation"],
    "data": ["privacy", "data", "license", "content"],
    "change": ["modify", "amend", "change"],
    "renew": ["renew", "renews", "renewal", "subscription"],
    "arbitration": ["arbitration", "disputes"],
    "court": ["arbitration", "court", "disputes"],
}


def retrieve(sentences: list[dict[str, str]], question: str, limit: int = 3) -> list[dict[str, str]]:
    exact = {word for word in re.findall(r"\w{3,}", question.lower()) if word not in STOP_WORDS}
    terms = set(exact)
    for key, values in EXPANSIONS.items():
        if any(key in word for word in exact):
            terms.update(values)
    scored = []
    for sentence in sentences:
        words = re.findall(r"\w+", sentence["text"].lower())
        rank = sum(3 if word in exact else 1 if word in terms else 0 for word in words)
        if rank:
            scored.append({**sentence, "rank": rank})
    return sorted(scored, key=lambda row: (-row["rank"], row["id"]))[:limit]


def grounded_answer(sentences: list[dict[str, str]], question: str) -> dict:
    matches = retrieve(sentences, question)
    if not matches:
        return {
            "answer": "I couldn't find a sentence in this text that directly addresses that question. Try asking about a specific term or phrase.",
            "citations": [],
            "grounded": True,
        }
    citations = [
        {"sentence_id": row["id"], "quote": row["text"]}
        for row in matches
    ]
    answer = "The closest passages in the supplied text are:\n\n" + "\n\n".join(
        f'[{item["sentence_id"]}] “{item["quote"]}”' for item in citations
    ) + "\n\nThese are keyword matches, not a legal interpretation. Review the surrounding terms and any exceptions."
    # Every quoted citation is copied verbatim from an immutable stored sentence.
    return {"answer": answer, "citations": citations, "grounded": True}
