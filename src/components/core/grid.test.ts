import { describe, expect, it } from 'vitest'

import {
  getBottomRowCellIndexes,
  getPageCount,
  normalizeGridOptions,
  paginateSeries,
  resolveGridCellGeometry,
  X_AXIS_BAND,
} from './grid'

describe('waveform grid helpers', () => {
  it('normalizes grid counts and uses a two by one default', () => {
    expect(normalizeGridOptions()).toEqual({
      rowCount: 2,
      columnCount: 1,
      showPagination: true,
      fillIncompleteLastRow: false,
      trackLines: {},
    })
    expect(normalizeGridOptions({ rowCount: 0, columnCount: 99 })).toEqual({
      rowCount: 1,
      columnCount: 10,
      showPagination: true,
      fillIncompleteLastRow: false,
      trackLines: {},
    })
  })

  it('normalizes per-track grid line visibility with visible defaults', () => {
    expect(
      normalizeGridOptions({
        trackLines: {
          voltage: { horizontal: false },
          current: { vertical: false },
        },
      }).trackLines,
    ).toEqual({
      voltage: { horizontal: false, vertical: true },
      current: { horizontal: true, vertical: false },
    })
  })

  it('preserves optional per-direction grid colors and ignores blank values', () => {
    expect(
      normalizeGridOptions({
        trackLines: {
          voltage: {
            horizontalColor: '#ef4444',
            verticalColor: '  #2563eb  ',
          },
          current: { horizontalColor: '  ' },
        },
      }).trackLines,
    ).toEqual({
      voltage: {
        horizontal: true,
        vertical: true,
        horizontalColor: '#ef4444',
        verticalColor: '  #2563eb  ',
      },
      current: {
        horizontal: true,
        vertical: true,
      },
    })
  })

  it('falls back to visible grid lines for invalid runtime values', () => {
    const options = {
      trackLines: {
        voltage: { horizontal: 'invalid', vertical: null },
      },
    } as unknown as Parameters<typeof normalizeGridOptions>[0]

    expect(normalizeGridOptions(options).trackLines.voltage).toEqual({
      horizontal: true,
      vertical: true,
    })
  })

  it('paginates row-major slots and keeps at least one page for empty data', () => {
    const options = normalizeGridOptions({ rowCount: 2, columnCount: 2 })
    expect(getPageCount([1, 2, 3, 4, 5].length, options)).toBe(2)
    expect(paginateSeries([1, 2, 3, 4, 5], 2, options)).toEqual([5])
    expect(getPageCount(0, options)).toBe(1)
  })

  it('resolves mode-specific gaps and bottom cells', () => {
    const options = normalizeGridOptions({ rowCount: 2, columnCount: 2 })
    const separated = resolveGridCellGeometry(400, 200, options, 'separated', [
      true,
      true,
      true,
      true,
    ])
    const compact = resolveGridCellGeometry(400, 200, options, 'compact', [true, true, true, true])
    const independent = resolveGridCellGeometry(400, 200, options, 'independent', [
      true,
      true,
      false,
      false,
    ])
    expect(separated[1].left).toBeGreaterThan(separated[0].left + separated[0].width)
    expect(separated[2].top).toBe(separated[0].plotHeight + 16)
    expect(separated[2].xAxisBand).toBe(X_AXIS_BAND)
    expect(compact[2].top).toBe(compact[0].top + compact[0].plotHeight)
    expect(compact[2].xAxisBand).toBe(X_AXIS_BAND)
    expect(independent[2].top).toBe(
      independent[0].top + independent[0].plotHeight + X_AXIS_BAND + 14,
    )
    expect(independent[0].cellHeight).toBe(independent[0].plotHeight + X_AXIS_BAND)
    expect(
      getBottomRowCellIndexes(
        separated.map((cell, index) => ({ ...cell, hasSeries: index !== 3 })),
        2,
      ),
    ).toEqual(new Set([2, 1]))
  })

  it('accepts an independent horizontal gap without changing vertical spacing', () => {
    const options = normalizeGridOptions({ rowCount: 2, columnCount: 2 })
    const cells = resolveGridCellGeometry(
      400,
      200,
      options,
      'independent',
      [true, true, true, true],
      64,
    )

    expect(cells[0].width).toBe(168)
    expect(cells[1].left).toBe(232)
    expect(cells[2].top).toBe(cells[0].plotHeight + X_AXIS_BAND + 14)
  })

  it('fills incomplete final rows without changing page capacity', () => {
    const oneColumn = resolveGridCellGeometry(
      400,
      400,
      normalizeGridOptions({ rowCount: 4, columnCount: 1, fillIncompleteLastRow: true }),
      'separated',
      [true, true, true],
    )
    expect(oneColumn).toHaveLength(3)
    expect(oneColumn.map((cell) => cell.width)).toEqual([400, 400, 400])
    expect(oneColumn.at(-1)?.isLastRow).toBe(true)

    const twoColumns = resolveGridCellGeometry(
      400,
      300,
      normalizeGridOptions({ rowCount: 2, columnCount: 2, fillIncompleteLastRow: true }),
      'separated',
      [true, true, true],
    )
    expect(twoColumns).toHaveLength(3)
    expect(twoColumns[2]).toMatchObject({ row: 1, column: 0, left: 0, width: 400 })

    const threeColumns = resolveGridCellGeometry(
      400,
      300,
      normalizeGridOptions({ rowCount: 2, columnCount: 3, fillIncompleteLastRow: true }),
      'separated',
      [true, true, true, true, true],
    )
    expect(threeColumns).toHaveLength(5)
    expect(threeColumns.slice(3).map((cell) => cell.width)).toEqual([192, 192])
    expect(threeColumns.slice(3).map((cell) => cell.left)).toEqual([0, 208])
  })

  it('keeps full pages and the disabled option byte-for-byte compatible', () => {
    const base = normalizeGridOptions({ rowCount: 2, columnCount: 2 })
    const filled = normalizeGridOptions({ rowCount: 2, columnCount: 2, fillIncompleteLastRow: true })
    const fullSlots = [true, true, true, true]
    expect(resolveGridCellGeometry(400, 300, filled, 'independent', fullSlots)).toEqual(
      resolveGridCellGeometry(400, 300, base, 'independent', fullSlots),
    )
    expect(resolveGridCellGeometry(400, 300, base, 'independent', [true, true, true])).toHaveLength(
      4,
    )
  })
})
