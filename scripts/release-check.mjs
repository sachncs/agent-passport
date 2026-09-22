import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
execFileSync(process.execPath, [join(root, "scripts/brand-check.mjs")], { stdio: "inherit" });
const required = [
  "README.md", "CHANGELOG.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md",
  "SECURITY.md", "LICENSE", "docs/README.md", "docs/release-checklist.md",
  "docs/known-limitations.md", "brand/README.md", "brand/assets/mark.svg",
  "brand/assets/favicon.svg",
  ".github/workflows/release.yml",
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
const publicDocs = [
  "CONTRIBUTING.md",
  "SECURITY.md",
  "frontend/README.md",
  "site/README.md",
  "docs/README.md",
  "docs/img/README.md",
  "docs/reports/site-redesign-audit.md",
];
const staleDocumentation = publicDocs.flatMap((file) => {
  const content = read(file);
  return /status:\s*in progress|remaining verification|outstanding|once a hosted demo is live|0\.1\.x.*current|pnpm (?:install|dev|build|test|lint|typecheck)/i.test(content)
    ? [file]
    : [];
});
if (staleDocumentation.length) {
  console.error(`Stale release documentation in:\n${staleDocumentation.map((file) => `- ${file}`).join("\n")}`);
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
