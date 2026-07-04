export type MarkupRow = { network: string; markup_type: string; markup_value: number };

export function applyMarkup(wholesale: number, markup?: MarkupRow | null): number {
  if (!markup) return Math.round(wholesale);
  if (markup.markup_type === "percent") {
    return Math.round(wholesale * (1 + Number(markup.markup_value) / 100));
  }
  return Math.round(wholesale + Number(markup.markup_value));
}
