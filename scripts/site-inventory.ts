/** Build the public-site evidence inventory from implementation, not README counts.
 * Run with: npx tsx scripts/site-inventory.ts
 * This inventories declarations; it does not certify runtime behavior or security.
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const hmacBypass = [/^\/(health|health\/deep|ready|metrics|openapi\.json|version|dashboard)$/,
  /^\/(score|delegation|counterparty-check|credit-estimate|sybil-check|reputation|underwrite|trust-graph|passport|verify|discovery\/search)$/];
const paidPaths: Record<string, number> = {
  '/score': 0.001, '/delegation': 0.001, '/counterparty-check': 0.002,
  '/credit-estimate': 0.002, '/sybil-check': 0.003, '/reputation': 0.001,
  '/reputation/record': 0.005, '/underwrite': 0.01, '/trust-graph': 0.005,
  '/passport': 0.005,
};
const appText = read('src/app.ts');
const routes: Array<{ method: string; path: string; line: number }> = [];
for (const match of appText.matchAll(/app\.(get|post|put|patch|delete|head|options)\(\s*['"]([^'"]+)['"]/g)) {
  routes.push({ method: match[1].toUpperCase(), path: match[2],
    line: appText.slice(0, match.index ?? 0).split('\n').length });
}
if (!routes.length) throw new Error('No Express route declarations found');

// The checked-in YAML uses two-space path keys and four-space HTTP method keys.
// Fail if this shape changes instead of silently claiming an empty contract.
const yamlOperations = new Set<string>();
let yamlPath = '';
for (const line of read('docs/api/openapi.yaml').split('\n')) {
  const path = /^  (\/[^:]*):\s*$/.exec(line);
  if (path) yamlPath = path[1];
  const method = /^    (get|post|put|patch|delete|head|options):\s*$/.exec(line);
  if (method && yamlPath) yamlOperations.add(`${method[1].toUpperCase()} ${yamlPath}`);
}
if (!yamlOperations.size) throw new Error('Static OpenAPI inventory could not be parsed');
const operationKey = (route: { method: string; path: string }) =>
  `${route.method} ${route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`;
const registered = new Set(routes.map(operationKey));

function files(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.next', 'dist', '__pycache__', '.venv'].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const envReferences: Record<string, string[]> = {};
for (const path of ['src', 'scripts', 'frontend/src'].flatMap(files)) {
  if (!/\.[cm]?[jt]sx?$/.test(path) || /(__tests__|\.test\.|site-inventory)/.test(path)) continue;
  const text = read(path);
  for (const match of text.matchAll(/process\.env(?:\.([A-Z][A-Z0-9_]+)|\[['"]([A-Z][A-Z0-9_]+)['"]\])/g)) {
    const name = match[1] || match[2];
    const location = `${path}:${text.slice(0, match.index ?? 0).split('\n').length}`;
    const refs = envReferences[name] ??= [];
    if (!refs.includes(location)) refs.push(location);
  }
}
const alertRules = [...read('alerts/alert-rules.yml').matchAll(/^\s*- alert:\s*(\S+)/gm)].map(match => match[1]);
const dashboard = JSON.parse(read('alerts/grafana-dashboard.json')).dashboard;
const panels = dashboard.panels.map((panel: { id: number; title: string; type: string }) =>
  ({ id: panel.id, title: panel.title, type: panel.type }));
const consoleRoutes = files('frontend/src/app').filter(path => /\/page\.tsx$/.test(path))
  .map(path => '/' + relative('frontend/src/app', path).replace(/\/?page\.tsx$/, ''));
const inventory = {
  version: JSON.parse(read('package.json')).version,
  scope: 'Declared routes and source references. Not a runtime security certification.',
  routeCount: routes.length,
  routes: routes.map(route => ({ ...route, source: `src/app.ts:${route.line}`,
    hmacWhenConfigured: !hmacBypass.some(pattern => pattern.test(route.path)),
    idempotencyHeaderRequired: !['GET', 'HEAD', 'OPTIONS'].includes(route.method),
    optionalPayment: paidPaths[route.path] === undefined ? null : { price: paidPaths[route.path], currency: 'configured x402 network' },
    sideEffect: route.path === '/underwrite' ? 'May reserve local exposure'
      : ['/delegate', '/revoke', '/reputation/record'].includes(route.path) ? 'Submits contract operation'
      : route.path.startsWith('/reputation/subscribe') && route.method !== 'GET' ? 'Changes local webhook subscriptions'
      : 'No business mutation; operational caches, metrics, and rate limits may change',
    checkedInOpenApi: yamlOperations.has(operationKey(route)),
  })),
  unregisteredCheckedInOperations: [...yamlOperations].filter(op => !registered.has(op)),
  environmentReferences: Object.fromEntries(Object.entries(envReferences).sort(([a], [b]) => a.localeCompare(b))),
  environmentScope: 'Literal process.env references in service, CLI scripts, and console. Dynamic lookups and Python/load-test configuration require separate review.',
  consoleRoutes,
  activeAlertCount: alertRules.length,
  activeAlerts: alertRules,
  grafanaPanelCount: panels.length,
  grafanaPanels: panels,
};
mkdirSync(join(root, 'docs/reports'), { recursive: true });
writeFileSync(join(root, 'docs/reports/site-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(`${routes.length} declared routes; ${yamlOperations.size} checked-in OpenAPI operations`);
console.log(`${alertRules.length} active alerts; ${panels.length} Grafana panels; ${consoleRoutes.length} console routes`);
console.log('Wrote docs/reports/site-inventory.json');
