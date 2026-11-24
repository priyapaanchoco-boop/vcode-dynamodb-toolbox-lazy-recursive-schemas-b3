import type { Schema } from '~/schema/index.js'
import { resolveLazySchema } from '~/schema/lazy/schema.js'

/** One registry per exported document; register before descending into a definition. */
export class SchemaReferences<DEFINITION> {
  readonly definitions: Record<string, DEFINITION> = Object.create(null)
  private readonly references = new Map<Schema, string>()
  private nextReference = 1

  register(schema: Schema): {
    ref: string
    target: Exclude<Schema, { type: 'lazy' }>
    fresh: boolean
  } {
    const existing = this.references.get(schema)
    if (existing !== undefined) {
      return { ref: existing, target: resolveLazySchema(schema), fresh: false }
    }
    const target = resolveLazySchema(schema)
    const key = Object.keys(schema.props).length === 0 ? target : schema
    const shared = this.references.get(key)
    if (shared !== undefined) {
      this.references.set(schema, shared)
      return { ref: shared, target, fresh: false }
    }
    const ref = 'schema' + this.nextReference++
    this.references.set(key, ref)
    this.references.set(schema, ref)
    return { ref, target, fresh: true }
  }
}
