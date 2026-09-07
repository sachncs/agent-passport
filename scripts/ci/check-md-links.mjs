#!/usr/bin/env node
/**
 * Markdown link checker.
 *
 * Walks every `*.md` file under the repo (excluding `node_modules`,
 * `dist`, `coverage`), extracts every relative `](...)` link, and
 * reports any link whose target does not resolve. Also validates
 * `#anchor` links by lower-casing the headings of the target file.
 *
 * Exits 0 on success, 1 on any broken link.
 *
 * Run via: `node scripts/ci/check-md-links.mjs`
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git']);
const MD_FILES = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (entry.endsWith('.md')) {
      MD_FILES.push(full);
    }
  }
}

walk(REPO);

const errors = [];

function extractLinks(file) {
  const text = readFileSync(file, 'utf8');
  const links = [];
  // Match [text](target) — handles relative paths, fragment-only, and
  // http(s) links. We ignore mailto:, http(s)://, and {variable} placeholders.
  const re = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    if (/^\{[^}]+\}$/.test(target)) continue;
    links.push({ target, offset: match.index });
  }
  return links;
}

function headingSlugs(file) {
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  const slugs = new Set();
  const re = /^#{1,6}\s+(.+?)\s*$/gm;
  let match;
  while ((match = re.exec(text)) !== null) {
    const heading = match[1].replace(/`/g, '').replace(/[*_]/g, '').trim();
    const slug = heading
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    slugs.add(slug);
  }
  return slugs;
}

for (const file of MD_FILES) {
  const links = extractLinks(file);
  for (const { target } of links) {
    const [pathPart, anchor] = target.split('#');
    const targetPath = pathPart ? resolve(dirname(file), pathPart) : file;
    const rel = relative(REPO, targetPath);
    if (!existsSync(targetPath)) {
      errors.push({
        file: relative(REPO, file),
        target,
        reason: `target does not exist (resolved to ${rel})`,
      });
      continue;
    }
    if (anchor) {
      const slugs = headingSlugs(targetPath);
      if (slugs && !slugs.has(anchor.toLowerCase())) {
        errors.push({
          file: relative(REPO, file),
          target,
          reason: `anchor #${anchor} not found in target (slugs: ${[...slugs].slice(0, 5).join(', ')}...)`,
        });
      }
    }
  }
}

if (errors.length === 0) {
  console.log(`[check-md-links] OK — checked ${MD_FILES.length} files, 0 broken links.`);
  process.exit(0);
}

console.error(`[check-md-links] FAIL — ${errors.length} broken link(s) across ${MD_FILES.length} files:\n`);
for (const e of errors) {
  console.error(`  ${e.file}`);
  console.error(`    → ${e.target}`);
  console.error(`    ${e.reason}\n`);
}
process.exit(1);
