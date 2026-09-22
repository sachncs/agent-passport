export const docsPages = [
  { slug: "overview", file: "README.md", label: "Overview", summary: "A map of the service, its source of truth, and where to begin.", code: false },
  { slug: "concepts", file: "concepts.md", label: "Concepts", summary: "Trust scoring, delegation, Sybil indicators, reputation, underwriting, and passports.", code: false },
  { slug: "api", file: "api.md", label: "API reference", summary: "Routes, request semantics, responses, errors, and operational endpoints.", code: false },
  { slug: "architecture", file: "architecture.md", label: "Architecture", summary: "The request lifecycle, caches, state boundaries, and scaling model.", code: false },
  { slug: "operations", file: "operations.md", label: "Operations", summary: "Configuration, deployment, observability, limits, and runbooks.", code: false },
  { slug: "security", file: "security.md", label: "Security", summary: "Threat model, defensive layers, assumptions, and deployment guidance.", code: false },
  { slug: "known-limitations", file: "known-limitations.md", label: "Known limitations", summary: "The public boundaries of scores, state, payments, and hosted-service claims.", code: false },
  { slug: "support-policy", file: "support-policy.md", label: "Support policy", summary: "Community support, compatibility, and vulnerability-reporting paths.", code: false },
  { slug: "release-checklist", file: "release-checklist.md", label: "Release checklist", summary: "The v1.0 verification gate for maintainers and contributors.", code: false },
  { slug: "openapi", file: "api/openapi.yaml", label: "OpenAPI", summary: "The checked-in OpenAPI contract for generating clients.", code: true },
] as const;
