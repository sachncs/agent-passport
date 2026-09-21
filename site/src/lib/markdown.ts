const docsSlugs: Record<string, string> = {
  "README.md": "overview",
  "concepts.md": "concepts",
  "api.md": "api",
  "architecture.md": "architecture",
  "operations.md": "operations",
  "security.md": "security",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
    const markdownFile = href.split("#")[0].split("/").pop() ?? "";
    const anchor = href.includes("#") ? `#${href.split("#")[1]}` : "";
    const localSlug = href.startsWith("../") ? undefined : docsSlugs[markdownFile];
    const rootFile = href.startsWith("../") ? href.slice(3) : "";
    const target = localSlug
      ? `${baseUrl}/docs/${localSlug}/${anchor}`
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
      html.push(`<pre><code class="language-${escapeHtml(language || "text")}">${escapeHtml(code.join("\n"))}</code></pre>`);
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
      html.push(`<div class="table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell, baseUrl)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell, baseUrl)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
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
    paragraph.push(line.trim());
    index += 1;
  }
  flushParagraph();
  flushList();
  return html.join("\n");
}
