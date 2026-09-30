const docsSlugs: Record<string, string> = {
  "README.md": "overview",
  "quickstart.md": "quickstart",
  "sdk.md": "sdk",
  "self-hosting.md": "self-hosting",
  "concepts.md": "concepts",
  "api.md": "api",
  "architecture.md": "architecture",
  "operations.md": "operations",
  "security.md": "security",
  "known-limitations.md": "known-limitations",
  "support-policy.md": "support-policy",
  "release-checklist.md": "release-checklist",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderDiagram(language: string): string | null {
  if (language === "diagram-system") {
    return `<figure class="docs-diagram docs-system-diagram" aria-labelledby="system-diagram-title">
      <figcaption id="system-diagram-title" class="docs-diagram-caption"><span class="docs-diagram-kicker">System boundary</span><span>Evidence moves through one clear evaluation surface</span></figcaption>
      <div class="docs-diagram-flow docs-system-flow">
        <section class="docs-diagram-node docs-diagram-node--client"><div class="docs-node-index">01</div><h3>Client / agent</h3><p>HTTP, TypeScript, or Python SDK</p><div class="docs-node-tags"><span>GET /score</span><span>POST /delegate</span></div></section>
        <div class="docs-diagram-connector" aria-hidden="true"><span>request</span><i></i></div>
        <section class="docs-diagram-node docs-diagram-node--service"><div class="docs-node-index">02</div><h3>Agent Passport API</h3><p>Validates, authenticates, scores, and explains.</p><div class="docs-node-grid"><span>Rate limits</span><span>HMAC / x402</span><span>Metrics</span><span>60s cache</span></div></section>
        <div class="docs-diagram-connector" aria-hidden="true"><span>evidence</span><i></i></div>
        <section class="docs-diagram-node docs-diagram-node--chain"><div class="docs-node-index">03</div><h3>Algorand</h3><p>algod, indexer, and optional applications.</p><div class="docs-node-tags"><span>registry.teal</span><span>reputation.teal</span></div></section>
      </div>
      <div class="docs-diagram-note"><span class="docs-note-dot"></span><span>Read paths remain self-hosted and application-database independent; stateful stores need shared infrastructure when replicas scale out.</span></div>
    </figure>`;
  }
  if (language === "diagram-flow") {
    return `<figure class="docs-diagram docs-request-diagram" aria-labelledby="request-diagram-title">
      <figcaption id="request-diagram-title" class="docs-diagram-caption"><span class="docs-diagram-kicker">Request lifecycle</span><span>One request, parallel chain evidence, explainable response</span></figcaption>
      <ol class="docs-request-flow">
        <li class="docs-request-step"><span class="docs-step-number">01</span><div><strong>Request</strong><p><code>GET /score?wallet=…</code></p></div></li>
        <li class="docs-request-step"><span class="docs-step-number">02</span><div><strong>Gateway</strong><p>Validate, identify, rate-limit</p></div></li>
        <li class="docs-request-step"><span class="docs-step-number">03</span><div><strong>Chain evidence</strong><p>Round, account, transactions</p></div></li>
        <li class="docs-request-step"><span class="docs-step-number">04</span><div><strong>Decision</strong><p>Five signals computed in process</p></div></li>
        <li class="docs-request-step docs-request-step--result"><span class="docs-step-number">05</span><div><strong>Response</strong><p>Score, risk, evidence, checksum</p></div></li>
      </ol>
      <div class="docs-diagram-foot"><span>parallel reads</span><span>1 status + 1 account lookup + optional transaction reads</span><span>200 JSON</span></div>
    </figure>`;
  }
  return null;
}

function inlineMarkdown(value: string, baseUrl: string): string {
  let output = escapeHtml(value);
  const codeSpans: string[] = [];
  output = output.replace(/`([^`]+)`/g, (_, code: string) => {
    codeSpans.push(`<code>${code}</code>`);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });
  output = output.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => {
    const [path, fragment] = href.split("#", 2);
    const markdownFile = path.split("/").pop() ?? "";
    const anchor = fragment ? `#${fragment}` : "";
    const localSlug = href.startsWith("../") ? undefined : docsSlugs[markdownFile];
    const rootFile = href.startsWith("../") ? path.slice(3) : "";
    const rootSlug = rootFile === "README.md"
      ? "overview"
      : rootFile === "sdk/README.md" || rootFile === "sdk/python/README.md"
        ? "sdk"
        : undefined;
    const docsAssetSlug = href === "api/openapi.yaml" ? "openapi" : undefined;
    const target = localSlug
      ? `${baseUrl}/docs/${localSlug}/${anchor}`
      : rootSlug
        ? `${baseUrl}/docs/${rootSlug}/${anchor}`
      : docsAssetSlug
        ? `${baseUrl}/docs/${docsAssetSlug}/${anchor}`
      : rootFile
        ? `https://github.com/sachncs/agent-passport/blob/master/${rootFile}${anchor}`
        : href;
    const external = target.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${target}"${external}>${label}</a>`;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  output = output.replace(/\u0000(\d+)\u0000/g, (_, index: string) => codeSpans[Number(index)] ?? "");
  return output;
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function tableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function renderMarkdown(source: string, baseUrl: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let index = 0;
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(" "), baseUrl)}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (!list) return;
    const tag = list.ordered ? "ol" : "ul";
    html.push(`<${tag}>${list.items.map((item) => `<li>${inlineMarkdown(item, baseUrl)}</li>`).join("")}</${tag}>`);
    list = null;
  };

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      const language = line.trim().slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      const diagram = renderDiagram(language);
      if (diagram) html.push(diagram);
      else {
        const codeId = `docs-code-${html.length}`;
        const languageLabel = language === "bash" ? "Shell" : language === "typescript" ? "TypeScript" : language === "json" ? "JSON" : language === "yaml" ? "YAML" : language || "Text";
        html.push(`<div class="docs-code-block"><div class="docs-code-header"><span>${languageLabel} example</span><button type="button" data-copy-code="${codeId}" aria-label="Copy ${languageLabel} example">Copy</button></div><pre id="${codeId}"><code class="language-${escapeHtml(language || "text")}">${escapeHtml(code.join("\n"))}</code></pre><span class="sr-only" data-copy-status="${codeId}" role="status" aria-live="polite"></span></div>`);
      }
      index += 1;
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      index += 1;
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(line)) {
      flushParagraph();
      flushList();
      html.push("<hr />");
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const text = heading[2];
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      html.push(`<h${level} id="${id}">${inlineMarkdown(text, baseUrl)}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^\s*>/.test(line)) {
      flushParagraph();
      flushList();
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      html.push(`<blockquote>${inlineMarkdown(quote.join(" "), baseUrl)}</blockquote>`);
      continue;
    }
    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      flushParagraph();
      flushList();
      const headers = tableRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableRow(lines[index]));
        index += 1;
      }
      html.push(`<div class="table-wrap" role="region" tabindex="0" aria-label="Scrollable table"><div class="table-scroll-hint" aria-hidden="true">Swipe horizontally to view more</div><table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell, baseUrl)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell, baseUrl)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const listItem = line.match(/^\s*([-*+] |\d+\. )(.+)$/);
    if (listItem) {
      flushParagraph();
      const ordered = /^\d/.test(listItem[1]);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(listItem[2]);
      index += 1;
      continue;
    }
    if (list && list.items.length && /^(?:\t+|\s{2,})\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      index += 1;
      continue;
    }
    paragraph.push(line.trim());
    index += 1;
  }
  flushParagraph();
  flushList();
  return html.join("\n");
}
