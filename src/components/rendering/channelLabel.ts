/** Format display text without changing the series metadata or identity. */
export function formatChannelLabel(name: string, unit?: string, separator = ''): string {
  const normalizedUnit = unit?.trim()
  return normalizedUnit && normalizedUnit !== '--' ? `${name}${separator}(${normalizedUnit})` : name
}
