import { readdir, readFile } from 'node:fs/promises'
import { join, basename, extname, relative, sep } from 'node:path'

import Graph from 'graphology'

export type Database = Record<string, string>

export const WIKI_LINK_PATTERN = /(?<!\!)\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g

/** Recursively loads Markdown notes, keyed by their filename without `.md`. */
export async function loadDatabase(databaseDirectory: string): Promise<Database> {
  const database: Database = {}

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })

    for (const entry of entries) {
      const path = join(directory, entry.name)

      if (entry.isDirectory()) {
        await visit(path)
        continue
      }

      if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.md') {
        continue
      }

      const key = basename(entry.name, '.md')
      if (key in database) {
        const location = relative(databaseDirectory, path).split(sep).join('/')
        throw new Error(`Duplicate note filename "${key}" at ${location}`)
      }

      database[key] = await readFile(path, 'utf8')
    }
  }

  await visit(databaseDirectory)
  return database
}

export function findCrossReferences(content: string): string[] {
  return [...content.matchAll(WIKI_LINK_PATTERN)].map((match) => match[1]!)
}

/** Builds a directed graph whose nodes are note filenames and edges are wiki-links. */
export function createGraph(database: Database): Graph {
  const graph = new Graph({ type: 'directed' })

  for (const filename of Object.keys(database)) {
    graph.addNode(filename)
  }

  for (const [filename, content] of Object.entries(database)) {
    for (const target of findCrossReferences(content)) {
      if (!graph.hasNode(target)) {
        continue
      }

      if (!graph.hasEdge(filename, target)) {
        graph.addDirectedEdge(filename, target)
      }
    }
  }

  return graph
}

export async function generateGraph(databaseDirectory: string): Promise<Graph> {
  return createGraph(await loadDatabase(databaseDirectory))
}
