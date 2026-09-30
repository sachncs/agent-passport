import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "site/dist";
if (!existsSync(root)) throw new Error(`Site build directory not found: ${root}`);

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
}
walk(root);

const html = files.filter((file) => file.endsWith(".html"));
const text = html.map((file) => readFileSync(file, "utf8")).join("\n");
const stale = ["release candidate", "v1.0 rc", "v1.0-rc", "dev preview"];
const found = stale.filter((phrase) => text.toLowerCase().includes(phrase));
if (found.length) throw new Error(`Stale release language in built site: ${found.join(", ")}`);

const required = [
  "favicon.svg",
  "social-preview.svg",
  "docs/quickstart/index.html",
  "docs/sdk/index.html",
  "docs/self-hosting/index.html",
];
for (const relative of required) {
  if (!existsSync(join(root, relative))) throw new Error(`Missing built site artifact: ${relative}`);
}

if (!text.includes('property="og:image"') || !text.includes('name="twitter:card"')) {
  throw new Error("Built site is missing social metadata");
}
if (text.match(/href="(?!https?:\/\/)[^"]*\.md(?:[#"])/i)) {
  throw new Error("Built site contains an unresolved Markdown documentation link");
}
if (text.match(/href="https:\/\/github\.com\/sachncs\/agent-passport\/blob\/master\/docs\/[^\"]+\.md(?:[#"])/i)) {
  throw new Error("Built site exposes a docs repository Markdown page instead of a published documentation route");
}
const staleDocLanguage = [
  "missing from operations.md",
  "missing from api.md",
  "missing from concepts.md",
  ">../LICENSE</a>",
];
const staleDocMatches = staleDocLanguage.filter((phrase) => text.includes(phrase));
if (staleDocMatches.length) {
  throw new Error(`Built site contains repository-oriented documentation language: ${staleDocMatches.join(", ")}`);
}
if (!text.includes('/docs/openapi/')) {
  throw new Error("Built site is missing the published OpenAPI documentation route");
}
if (!text.includes('class="openapi-explorer"') || !text.includes('data-openapi-search')) {
  throw new Error("Built site is missing the interactive OpenAPI explorer");
}
if (!text.includes('class="release-checklist"') || !text.includes('class="release-group"')) {
  throw new Error("Built site is missing the structured release checklist");
}
if (!text.includes('class="docs-code-block"') || !text.includes('data-copy-code')) {
  throw new Error("Built site is missing labeled, copyable code examples");
}
if (!text.includes("Unknown agent") || !text.includes("Operational action")) {
  throw new Error("Built site is missing the four-stage product journey");
}
if (text.includes(">additional level.</p>") || text.includes(">endorsement chains.</p>")) {
  throw new Error("Built site contains detached Markdown list continuations");
}
if (!text.includes("Swipe horizontally to view more") || !text.includes('aria-label="Scrollable table"')) {
  throw new Error("Built site is missing accessible table overflow guidance");
}
if (!text.includes('id="copy-code-example"') || !text.includes('role="tabpanel"')) {
  throw new Error("Built site is missing the accessible code example interaction");
}
console.log(`Site content gate passed: ${html.length} HTML pages checked`);
