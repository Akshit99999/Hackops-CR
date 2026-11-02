import type { ClauseFlag, ContractAudit } from "./types";

export const SAMPLE_TERMS = `By using this service, you agree to be bound by these terms.
We may modify these terms at any time without notice.
We may terminate your account for any reason at our sole discretion.
All disputes shall be resolved through binding arbitration.
You waive your right to participate in a class action.
Our liability shall not exceed the amount paid in the preceding month.
You grant us a perpetual, irrevocable, royalty-free license to use your uploaded content.
You may cancel your subscription at any time from your account settings.
We will notify you by email 30 days before your subscription renews.`;

const rules: {
  category: string;
  pattern: RegExp;
  severity: ClauseFlag["severity"];
  axis: number;
  explanation: string;
  weight: number;
}[] = [
  {
    category: "Unilateral contract changes",
    pattern:
      /(?:modify|change|amend).{0,65}(?:terms|agreement).{0,50}(?:any time|without notice|sole discretion)/i,
    severity: "High",
    axis: 4,
    weight: 0.5,
    explanation:
      "The provider may change the agreement. Check whether notice and an opportunity to leave are offered.",
  },
  {
    category: "Account termination",
    pattern:
      /(?:terminate|suspend).{0,65}(?:without (?:notice|cause)|sole discretion|any (?:time|reason))/i,
    severity: "High",
    axis: 1,
    weight: 0.5,
    explanation:
      "The provider reserves broad powers to suspend or end access. Look for notice and appeal procedures.",
  },
  {
    category: "Agreement through use",
    pattern: /(?:using|accessing|use of).{0,70}(?:agree|accept|bound)/i,
    severity: "Medium",
    axis: 4,
    weight: 0.3,
    explanation:
      "Using the service is described as accepting the agreement. Consider how the terms were presented.",
  },
  {
    category: "Liability limitation",
    pattern:
      /not.{0,15}liable|limit(?:ation)?.{0,15}liability|liability.{0,30}(?:exceed|limited)/i,
    severity: "High",
    axis: 2,
    weight: 0.5,
    explanation:
      "This language may limit the provider’s responsibility for losses. Review the cap and its exceptions.",
  },
  {
    category: "Indemnification",
    pattern: /indemnify|hold.{0,10}harmless/i,
    severity: "Medium",
    axis: 2,
    weight: 0.35,
    explanation:
      "You may be asked to cover certain claims or costs. Check which circumstances trigger this obligation.",
  },
  {
    category: "Mandatory arbitration",
    pattern: /(?:binding|mandatory) arbitration|(?:must|shall).{0,40}arbitrat/i,
    severity: "High",
    axis: 0,
    weight: 0.5,
    explanation:
      "Disputes may be directed to arbitration. Look for exclusions, opt-out periods, and small-claims options.",
  },
  {
    category: "Class action waiver",
    pattern:
      /waiv\w*.{0,65}class action|class action.{0,45}waiv\w*|individual basis only/i,
    severity: "High",
    axis: 0,
    weight: 0.5,
    explanation:
      "This language addresses participation in group claims. Its effect depends on the agreement and applicable law.",
  },
  {
    category: "Forum selection",
    pattern: /exclusive (?:jurisdiction|venue)|courts (?:of|located in)/i,
    severity: "Medium",
    axis: 0,
    weight: 0.3,
    explanation:
      "A specific forum may be required for disputes. Check location, exceptions, and applicable rules.",
  },
  {
    category: "Content licensing",
    pattern: /(?:irrevocable|perpetual|royalty.free).{0,70}licen[cs]e/i,
    severity: "Medium",
    axis: 3,
    weight: 0.35,
    explanation:
      "The provider is granted rights to uploaded content. Look at duration, purpose, sublicensing, and revocation.",
  },
];

export function auditContract(text: string): ContractAudit {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => ({
      id: `S-${String(index + 1).padStart(3, "0")}`,
      text: part,
    }));
  const flags: ClauseFlag[] = [];
  const penalties = rules.map((rule) => {
    const matched = sentences.filter((sentence) =>
      rule.pattern.test(sentence.text),
    );
    for (const sentence of matched)
      flags.push({
        category: rule.category,
        severity: rule.severity,
        axis: rule.axis,
        sentenceId: sentence.id,
        quote: sentence.text,
        explanation: rule.explanation,
      });
    return rule.weight * Math.min(100, 30 * Math.log1p(matched.length));
  });
  return {
    id: crypto.randomUUID(),
    sentences,
    flags,
    score: Math.round(
      Math.max(0, 100 - penalties.reduce((sum, value) => sum + value, 0)),
    ),
    axes: Array.from({ length: 5 }, (_, axis) =>
      Math.round(
        Math.max(
          0,
          100 -
            penalties.reduce(
              (sum, value, index) =>
                sum + (rules[index].axis === axis ? value : 0),
              0,
            ),
        ),
      ),
    ),
  };
}

export function findPassages(audit: ContractAudit, question: string) {
  const stop = new Set([
    "the",
    "are",
    "can",
    "what",
    "does",
    "this",
    "that",
    "will",
    "with",
    "have",
    "they",
    "and",
    "for",
    "you",
    "how",
  ]);
  const words = new Set(
    question
      .toLowerCase()
      .match(/\w{3,}/g)
      ?.filter((word) => !stop.has(word)) || [],
  );
  const exactWords = new Set(words);
  const expand: Record<string, string[]> = {
    cancel: ["terminate", "termination", "cancel", "cancellation"],
    data: ["privacy", "data", "license", "content"],
    change: ["modify", "amend", "change"],
    renew: ["renew", "renews", "renewal", "subscription"],
    arbitration: ["arbitration", "disputes"],
    court: ["arbitration", "court", "disputes"],
  };
  for (const [key, values] of Object.entries(expand))
    if ([...words].some((word) => word.includes(key)))
      values.forEach((value) => words.add(value));
  return audit.sentences
    .map((sentence) => ({
      ...sentence,
      rank: (sentence.text.toLowerCase().match(/\w+/g) || []).reduce(
        (score, word) =>
          score + (exactWords.has(word) ? 3 : words.has(word) ? 1 : 0),
        0,
      ),
    }))
    .filter((sentence) => sentence.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3);
}
