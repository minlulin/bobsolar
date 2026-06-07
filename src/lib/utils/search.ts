export function escapeLikePattern(value: string): string {
  return value.replace(/%/g, "\\%").replace(/_/g, "\\_");
}
