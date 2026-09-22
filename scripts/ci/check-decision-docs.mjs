import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const siteRoot = process.argv[2];
const read = (file) => readFileSync(file, "utf8");
const trustSource = read("src/trust-score.ts");
const creditSource = read("src/credit.ts");
const concepts = read("docs/concepts.md");

const required = {
  "trust-score.ts": [
    "Math.max(1, days)",
    "days === 0",
    "Math.log10(txns + 1) * 25",
    "FRESH_WALLET_THRESHOLD_DAYS = 30",
    "FRESH_WALLET_MAX_SCORE = 30",
    "(score / 100) * 500",
    "score >= 80 ? 1.5",
    "score >= 60 ? 1.2",
    "score >= 40 ? 1.0",
  ],
  "credit.ts": [
    "balanceAlgo * 0.5",
    "totalTxns * 2",
    "accountAgeDays / 365",
    "velocityScore < 40",
    "complianceScore < 60",
    "Math.min(1350",
  ],
  "docs/concepts.md": [
    "txns / max(1, days)",
    "days === 0",
    "stepped bot/spam signal",
    "balancePenalty",
    "transactionPenalty",
    "99 or more",
    "accountAgeDays < 30",
    "exactly 30 days is not capped",
    "final staleness-adjusted and",
    "score / 100 × 500 × tier",
    "standalone credit estimate",
    "velocity is below 40",
    "compliance\nis below 60",
    "clamp(0, 1350",
  ],
};

for (const [file, phrases] of Object.entries(required)) {
  const content = file === "trust-score.ts" ? trustSource
    : file === "credit.ts" ? creditSource
      : concepts;
  const missing = phrases.filter((phrase) => !content.includes(phrase));
  if (missing.length) {
    throw new Error(`${file} is missing decision-model evidence: ${missing.join(", ")}`);
  }
}

const generated = siteRoot && join(siteRoot, "docs/concepts/index.html");
if (generated && existsSync(generated)) {
  const html = read(generated);
  const generatedPhrases = [
    "txns / max(1, days)",
    "days === 0",
    "stepped bot/spam signal",
    "99 or more",
    "accountAgeDays &lt; 30",
    "exactly 30 days is not capped",
    "final staleness-adjusted and",
    "score / 100 × 500 × tier",
    "standalone credit estimate",
    "velocity is below 40",
    "compliance",
    "below 60",
    "clamp(0, 1350",
  ];
  const missing = generatedPhrases.filter((phrase) => !html.includes(phrase));
  if (missing.length) {
    throw new Error(`Generated concepts page is stale or incomplete: ${missing.join(", ")}`);
  }
} else if (siteRoot) {
  throw new Error(`Generated concepts page not found: ${generated}`);
}

console.log("Decision documentation consistency check passed");
