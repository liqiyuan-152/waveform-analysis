import { describe, expect, it } from 'vitest'

import { routes } from '../router'

describe('WASM sampling demo route', () => {
  it('registers the hash-demo route', () => {
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/wasm-sampling', name: 'wasm-sampling' }),
      ]),
    )
  })
})
