import math
import re
from uuid import uuid4


RULES = [
    ("Unilateral contract changes", re.compile(r"(?:modify|change|amend).{0,65}(?:terms|agreement).{0,50}(?:any time|without notice|sole discretion)", re.I), "High", 4, 0.5, "The provider may change the agreement. Check whether notice and an opportunity to leave are offered."),
    ("Account termination", re.compile(r"(?:terminate|suspend).{0,65}(?:without (?:notice|cause)|sole discretion|any (?:time|reason))", re.I), "High", 1, 0.5, "The provider reserves broad powers to suspend or end access. Look for notice and appeal procedures."),
    ("Agreement through use", re.compile(r"(?:using|accessing|use of).{0,70}(?:agree|accept|bound)", re.I), "Medium", 4, 0.3, "Using the service is described as accepting the agreement. Consider how the terms were presented."),
    ("Liability limitation", re.compile(r"not.{0,15}liable|limit(?:ation)?.{0,15}liability|liability.{0,30}(?:exceed|limited)", re.I), "High", 2, 0.5, "This language may limit the provider’s responsibility for losses. Review the cap and its exceptions."),
    ("Indemnification", re.compile(r"indemnify|hold.{0,10}harmless", re.I), "Medium", 2, 0.35, "You may be asked to cover certain claims or costs. Check which circumstances trigger this obligation."),
    ("Mandatory arbitration", re.compile(r"(?:binding|mandatory) arbitration|(?:must|shall).{0,40}arbitrat", re.I), "High", 0, 0.5, "Disputes may be directed to arbitration. Look for exclusions, opt-out periods, and small-claims options."),
    ("Class action waiver", re.compile(r"waiv\w*.{0,65}class action|class action.{0,45}waiv\w*|individual basis only", re.I), "High", 0, 0.5, "This language addresses participation in group claims. Its effect depends on the agreement and applicable law."),
    ("Forum selection", re.compile(r"exclusive (?:jurisdiction|venue)|courts (?:of|located in)", re.I), "Medium", 0, 0.3, "A specific forum may be required for disputes. Check location, exceptions, and applicable rules."),
    ("Content licensing", re.compile(r"(?:irrevocable|perpetual|royalty.free).{0,70}licen[cs]e", re.I), "Medium", 3, 0.35, "The provider is granted rights to uploaded content. Look at duration, purpose, sublicensing, and revocation."),
]


def split_sentences(text: str) -> list[dict[str, str]]:
    parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", text) if part.strip()]
    return [{"id": f"S-{index:03d}", "text": part} for index, part in enumerate(parts, 1)]


def audit_contract(text: str) -> dict:
    sentences = split_sentences(text)
    flags = []
    penalties = []
    for category, pattern, severity, axis, weight, explanation in RULES:
        matches = [sentence for sentence in sentences if pattern.search(sentence["text"])]
        for sentence in matches:
            flags.append({
                "category": category,
                "severity": severity,
                "axis": axis,
                "sentenceId": sentence["id"],
                "quote": sentence["text"],
                "explanation": explanation,
            })
        penalties.append(weight * min(100, 30 * math.log1p(len(matches))))
    score = round(max(0, 100 - sum(penalties)))
    axes = [
        round(max(0, 100 - sum(penalty for penalty, rule in zip(penalties, RULES) if rule[3] == axis)))
        for axis in range(5)
    ]
    return {
        "id": str(uuid4()),
        "sentences": sentences,
        "flags": flags,
        "score": score,
        "axes": axes,
        "categories": [rule[0] for rule in RULES],
        "method": "transparent keyword screening; not a trained classifier or legal opinion",
    }
