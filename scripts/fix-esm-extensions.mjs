import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const outputDirectory = new URL('../dist/', import.meta.url);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory.pathname, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(new URL(`file://${path}/`))));
    else if (entry.isFile() && extname(entry.name) === '.js') files.push(path);
  }
  return files;
}

const files = await filesIn(outputDirectory);
const extensionlessRelativeImport = /((?:from\s+|import\s*\(\s*)['"])(\.\.?\/[^'"?]+?)(['"])/g;

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const rewritten = source.replace(extensionlessRelativeImport, (match, prefix, specifier, suffix) => {
    if (extname(specifier) || specifier.endsWith('/')) return match;
    return `${prefix}${specifier}.js${suffix}`;
  });
  if (rewritten !== source) await writeFile(file, rewritten);
}
