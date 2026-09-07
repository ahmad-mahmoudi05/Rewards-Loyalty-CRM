import "server-only";

/**
 * The only variables a template may reference. Never evaluate arbitrary
 * merchant input as code — this is plain string substitution against a
 * fixed whitelist (Part 26).
 */
export const TEMPLATE_VARIABLES = [
  "first_name",
  "business_name",
  "points",
  "stamps",
  "remaining",
  "reward_name",
  "offer",
  "expiry",
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
export type TemplateContext = Partial<Record<TemplateVariable, string | number>>;

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/** Every `{{token}}` in `content` that isn't a supported variable name —
 * used to reject a template at save time, before it can ever be sent. */
export function findUnsupportedVariables(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(VARIABLE_PATTERN)) {
    const name = match[1];
    if (!TEMPLATE_VARIABLES.includes(name as TemplateVariable)) {
      found.add(name);
    }
  }
  return Array.from(found);
}

/** Renders `content` against `context`. Any supported variable not present
 * in `context` is replaced with an empty string rather than left literally
 * visible to the customer. */
export function renderTemplate(content: string, context: TemplateContext): string {
  return content.replace(VARIABLE_PATTERN, (full, name: string) => {
    if (!TEMPLATE_VARIABLES.includes(name as TemplateVariable)) return full;
    const value = context[name as TemplateVariable];
    return value === undefined || value === null ? "" : String(value);
  });
}

export const SAMPLE_PREVIEW_CONTEXT: Required<TemplateContext> = {
  first_name: "Ahmad",
  business_name: "Brew Café",
  points: 320,
  stamps: 4,
  remaining: 1,
  reward_name: "Free Regular Coffee",
  offer: "20% off",
  expiry: "September 14",
};
