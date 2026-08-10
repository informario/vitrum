# AGENTS.md

## Project overview

Vitrum is a Vue 3 application that provides a static, Obsidian-like viewer for
the content in the `database/` directory. The database follows an Obsidian
vault structure: files are notes, links are cross-references, and the viewer
represents notes as vertices connected by reference edges.

## Repository guidance

- Treat `database/` as the source of truth for displayed content. Do not hardcode
  note content in Vue components.
- Parse supported files from the Obsidian-style structure and derive links from
  their references. Keep parsing, indexing, graph construction, and rendering
  as separate responsibilities.
- Preserve note identity and link targets consistently, including links to notes
  that are not currently visible or do not yet exist.
- Keep the UI responsive and readable for both individual-note browsing and graph
  exploration. Prefer small, focused Vue components and composables.
- Use Vue 3 idioms and the repository's existing conventions. Avoid introducing
  a new dependency when a small, well-tested utility is sufficient.
- Keep transformations deterministic and avoid mutating parsed source data.
- Handle malformed files, unresolved links, duplicate references, and empty
  databases gracefully.
- Add or update tests when changing parsing, link resolution, graph behavior, or
  user-visible interactions.
- Keep code clean: use descriptive names, explicit types where the project uses
  TypeScript, early returns for invalid input, and comments only for non-obvious
  decisions.

## Validation

Before handing off changes, run the project's relevant formatter, linter, type
checker, and test/build commands. If a command cannot be run, state why and
report what was verified instead.

## Scope

These instructions apply to the whole repository. More specific `AGENTS.md`
files in subdirectories may add or override them for files below those
directories.
