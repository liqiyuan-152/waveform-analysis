/** Series and their Y axes keep their identifying colors in both themes. */
export function displayThemeColors(dark: boolean): Record<string, string> {
  const text = dark ? '#e2e8f0' : '#334155'
  return {
    'frame.backgroundColor': dark ? '#000000' : '#ffffff',
    'frame.borderColor': dark ? '#94a3b8' : '#475569',
    'shot.color': text,
    'legend.color': text,
    'xAxis.color': text,
    'xAxis.fontColor': text,
    'xAxis.title.color': text,
    'grid.color': dark ? '#475569' : '#dfe5ef',
  }
}
