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
if (!text.includes("Unknown agent") || !text.includes("Operational action")) {
  throw new Error("Built site is missing the four-stage product journey");
}
console.log(`Site content gate passed: ${html.length} HTML pages checked`);
