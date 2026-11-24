import { DynamoDBToolboxError } from '~/errors/index.js'

import { AnySchema } from '../any/schema.js'
import { AnyOfSchema } from '../anyOf/schema.js'
import { BinarySchema } from '../binary/schema.js'
import { BooleanSchema } from '../boolean/schema.js'
import { ItemSchema } from '../item/schema.js'
import { ListSchema } from '../list/schema.js'
import { MapSchema } from '../map/schema.js'
import { NullSchema } from '../null/schema.js'
import { NumberSchema } from '../number/schema.js'
import { RecordSchema } from '../record/schema.js'
import { SetSchema } from '../set/schema.js'
import { StringSchema } from '../string/schema.js'
import type { Schema, SchemaProps } from '../types/index.js'
import { checkSchemaProps } from '../utils/checkSchemaProps.js'

const resolutions = new WeakMap<object, unknown>()
const failures = new WeakMap<object, unknown>()
const resolving = new WeakSet<object>()
const checking = new WeakSet<object>()
const schemaClasses = () => [
  AnySchema,
  AnyOfSchema,
  BinarySchema,
  BooleanSchema,
  ItemSchema,
  ListSchema,
  MapSchema,
  NullSchema,
  NumberSchema,
  RecordSchema,
  SetSchema,
  StringSchema
]
const invalidResolution = (path?: string) =>
  new DynamoDBToolboxError('schema.lazy.invalidResolution', {
    message: 'Invalid lazy schema resolution: Expected a schema with a productive resolution.',
    path
  })
export class LazySchema<TARGET extends Schema = Schema, PROPS extends SchemaProps = SchemaProps> {
  readonly type = 'lazy' as const
  constructor(
    readonly thunk: () => TARGET,
    readonly props: PROPS
  ) {}
  get checked(): boolean {
    return Object.isFrozen(this.props)
  }
  resolve(): TARGET {
    if (resolving.has(this)) {
      throw invalidResolution()
    }
    if (failures.has(this)) {
      throw failures.get(this)
    }
    if (!resolutions.has(this)) {
      resolving.add(this)
      try {
        resolutions.set(this, this.thunk())
      } catch (error) {
        failures.set(this, error)
        throw error
      } finally {
        resolving.delete(this)
      }
    }
    const target = resolutions.get(this)
    if (
      !(target instanceof LazySchema) &&
      !schemaClasses().some(SchemaClass => target instanceof SchemaClass)
    ) {
      throw invalidResolution()
    }
    return target as TARGET
  }
  check(path?: string): void {
    if (this.checked || checking.has(this)) {
      return
    }
    checking.add(this)
    try {
      checkSchemaProps(this.props, path)
      let target: Schema
      try {
        target = resolveLazySchema(this)
      } catch (error) {
        if (
          error instanceof DynamoDBToolboxError &&
          error.code === 'schema.lazy.invalidResolution'
        ) {
          throw invalidResolution(path)
        }
        throw error
      }
      target.check(path)
      Object.freeze(this.props)
    } finally {
      checking.delete(this)
    }
  }
}
// A recursive branch must cross a container before returning to the same schema.
const assertProductive = (schema: Schema, active = new Set<Schema>()): void => {
  if (schema.type !== 'lazy' && schema.type !== 'anyOf') {
    return
  }
  if (active.has(schema)) {
    throw invalidResolution()
  }
  active.add(schema)
  try {
    if (schema.type === 'lazy') {
      assertProductive(schema.resolve(), active)
    } else {
      for (const element of schema.elements) {
        assertProductive(element, active)
      }
    }
  } finally {
    active.delete(schema)
  }
}

/** Resolve lazy chains without unfolding recursive children. Outer props override target props. */
export const resolveLazySchema = (schema: Schema): Exclude<Schema, LazySchema> => {
  if (schema.type === 'lazy') {
    assertProductive(schema)
  }
  const seen = new Set<Schema>()
  let props: SchemaProps = {}
  while (schema.type === 'lazy') {
    if (seen.has(schema)) {
      throw invalidResolution()
    }
    seen.add(schema)
    props = { ...schema.props, ...props }
    schema = schema.resolve()
  }
  if (Object.keys(props).length === 0) {
    return schema
  }
  return Object.assign(Object.create(Object.getPrototypeOf(schema)), schema, {
    props: { ...schema.props, ...props }
  }) as Exclude<Schema, LazySchema>
}
