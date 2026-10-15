/** The internal set survives controlled overrides; defaults only seed the constructor. */
export class SeriesVisibilityModel {
  private internal: Set<string>

  constructor(defaultHiddenSeriesIds: readonly string[] = []) {
    this.internal = new Set(defaultHiddenSeriesIds)
  }

  snapshot(controlled?: readonly string[]): Set<string> {
    return new Set(controlled ?? this.internal)
  }

  request(seriesId: string, visible: boolean, controlled?: readonly string[]) {
    const hidden = this.snapshot(controlled)
    if (visible) hidden.delete(seriesId)
    else hidden.add(seriesId)
    if (controlled === undefined) this.internal = hidden
    return Array.from(hidden)
  }

  retain(availableIds: readonly string[]) {
    const available = new Set(availableIds)
    this.internal = new Set(Array.from(this.internal).filter((id) => available.has(id)))
  }
}
