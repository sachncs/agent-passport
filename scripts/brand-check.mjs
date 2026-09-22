import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const canonicalFavicon = read("brand/assets/favicon.svg");

for (const path of [
  "brand/assets/mark.svg",
  "brand/assets/mark-mono.svg",
  "brand/assets/wordmark.svg",
  "brand/assets/lockup-dark.svg",
  "brand/assets/lockup-light.svg",
  "brand/assets/favicon.svg",
  "brand/tokens.css",
]) {
  if (!existsSync(join(root, path))) throw new Error(`Missing canonical brand asset: ${path}`);
}

for (const path of ["frontend/public/favicon.svg", "site/public/favicon.svg"]) {
  if (read(path) !== canonicalFavicon) throw new Error(`${path} is out of sync with brand/assets/favicon.svg`);
}

for (const path of ["frontend/src/components/brand/logo.tsx", "site/src/components/brand/Mark.astro"]) {
  const source = read(path);
  for (const geometry of [
    "M16 52V12h34v40H16",
    "M24 12v40",
    "M31 22h11",
    "M50 12h7v7",
    "cx=\"50\" cy=\"12\"",
  ]) {
    if (!source.includes(geometry)) throw new Error(`${path} is missing canonical mark geometry: ${geometry}`);
  }
}

for (const path of ["frontend/src/components/brand/logo.tsx", "site/src/components/brand/Logo.astro"]) {
  if (!read(path).includes("Evidence-led trust infrastructure for AI agents")) {
    throw new Error(`${path} is missing the approved descriptor`);
  }
}

if (!read("frontend/src/app/globals.css").includes("--verified: oklch(0.78 0.16 162)")) {
  throw new Error("Frontend verified token is not aligned with the brand system");
}
if (!read("site/src/styles/tokens.css").includes("--color-accent: oklch(0.78 0.16 162)")) {
  throw new Error("Site accent token is not aligned with the brand system");
}
if (!read("frontend/src/app/globals.css").includes("--info: oklch(0.72 0.13 200)")) {
  throw new Error("Frontend info token is not aligned with the brand system");
}

console.log("Brand synchronization check passed");
