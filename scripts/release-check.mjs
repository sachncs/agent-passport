import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const required = [
  "README.md", "CHANGELOG.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md",
  "SECURITY.md", "LICENSE", "docs/README.md", "docs/release-checklist.md",
  "docs/known-limitations.md", "brand/README.md", "brand/assets/mark.svg",
  "site/public/social-preview.svg",
];
const missing = required.filter((file) => !existsSync(join(root, file)));
if (missing.length) {
  console.error(`Missing release files:\n${missing.map((file) => `- ${file}`).join("\n")}`);
  process.exit(1);
}
const readme = readFileSync(join(root, "README.md"), "utf8");
if (/dev preview|developer preview|will land|sister issue/i.test(readme)) {
  console.error("README still contains release-blocking preview language.");
  process.exit(1);
}
const docs = readFileSync(join(root, "docs/README.md"), "utf8").toLowerCase();
for (const heading of ["quick start", "api reference", "security", "operations", "known limitations", "contributing"]) {
  if (!docs.includes(heading)) {
    console.error(`docs/README.md is missing the '${heading}' path.`);
    process.exit(1);
  }
}
console.log(`Release checklist baseline passed (${required.length} required files).`);
