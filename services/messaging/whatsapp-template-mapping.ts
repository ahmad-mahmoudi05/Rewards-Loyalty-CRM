// Pure data mapping, deliberately with no "server-only" import and no
// network/DB access — this is the part of Meta template sync that's
// testable in isolation with a fixture shaped like Meta's real
// `/{waba-id}/message_templates` response, per the Day 4.5 requirement to
// "test parsing/mapping using fixtures that reflect current official Meta
// response shape." See services/messaging/whatsapp.ts::fetchWhatsAppTemplates
// for the I/O (auth, pagination, error handling) around this.

export type MetaTemplateComponent = {
  type: string;
  format?: string;
  text?: string;
  buttons?: unknown[];
  example?: unknown;
};

export type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: MetaTemplateComponent[];
};

export function mapMetaTemplatesPage(raw: unknown): MetaTemplate[] {
  const data = (raw as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];

  return data.map((entry) => {
    const row = entry as Record<string, unknown>;
    return {
      id: String(row.id),
      name: String(row.name),
      language: String(row.language ?? "en"),
      category: String(row.category ?? "UTILITY"),
      status: String(row.status ?? "PENDING"),
      components: Array.isArray(row.components) ? (row.components as MetaTemplateComponent[]) : [],
    };
  });
}

export function nextPageUrl(raw: unknown): string | undefined {
  return (raw as { paging?: { next?: string } })?.paging?.next;
}
