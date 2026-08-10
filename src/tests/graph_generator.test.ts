import { describe, expect, it } from '@jest/globals'
import { join } from 'node:path'

import { generateGraph } from '../app/controller/graph_generator'

describe('generateGraph', () => {
  it('loads the test database recursively and creates directed wiki-link edges', async () => {
    const graph = await generateGraph(join(process.cwd(), 'src/tests/database'))

    expect(graph.order).toBe(11)
    expect(graph.size).toBe(13)
  })
})
