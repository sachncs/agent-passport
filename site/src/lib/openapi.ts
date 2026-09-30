export interface OpenApiRoute {
  path: string;
  method: string;
  summary: string;
  operationId: string;
  tag: string;
  parameters: string[];
  responses: string[];
}

export function parseOpenApiRoutes(source: string): OpenApiRoute[] {
  const lines = source.split(/\r?\n/);
  const routes: OpenApiRoute[] = [];
  let currentPath = "";
  let current: OpenApiRoute | null = null;
  let inParameters = false;
  let inResponses = false;

  const flush = () => {
    if (current) routes.push(current);
    current = null;
    inParameters = false;
    inResponses = false;
  };

  for (const line of lines) {
    const pathMatch = line.match(/^  (\/[^:]*|\/):$/);
    if (pathMatch) {
      flush();
      currentPath = pathMatch[1];
      continue;
    }
    const methodMatch = line.match(/^    (get|post|put|patch|delete|head|options):$/i);
    if (methodMatch && currentPath) {
      flush();
      current = {
        path: currentPath,
        method: methodMatch[1].toUpperCase(),
        summary: "",
        operationId: "",
        tag: "Other",
        parameters: [],
        responses: [],
      };
      continue;
    }
    if (!current) continue;
    const summary = line.match(/^      summary:\s*(.+)$/);
    if (summary) current.summary = summary[1].replace(/^['"]|['"]$/g, "");
    const operationId = line.match(/^      operationId:\s*(.+)$/);
    if (operationId) current.operationId = operationId[1].trim();
    const tags = line.match(/^      tags:\s*\[([^\]]+)\]/);
    if (tags) current.tag = tags[1].split(",")[0].trim();
    if (/^      parameters:$/.test(line)) {
      inParameters = true;
      inResponses = false;
    }
    if (/^      responses:$/.test(line)) {
      inResponses = true;
      inParameters = false;
    }
    if (inParameters) {
      const parameter = line.match(/^        - name:\s*(.+)$/);
      if (parameter) current.parameters.push(parameter[1].trim());
    }
    if (inResponses) {
      const response = line.match(/^        ['"]?(\d{3})['"]?:$/);
      if (response) current.responses.push(response[1]);
    }
  }
  flush();
  return routes;
}
