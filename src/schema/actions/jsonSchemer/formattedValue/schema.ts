import type {
  AnyOfSchema,
  AnySchema,
  ItemSchema,
  ListSchema,
  MapSchema,
  PrimitiveSchema,
  RecordSchema,
  Schema,
  SetSchema
} from '~/schema/index.js'
import type { LazySchema } from '~/schema/lazy/index.js'

import { SchemaReferences } from '../../utils/schemaReferences.js'
import type { FormattedAnyOfJSONSchema } from './anyOf.js'
import { getFormattedAnyOfJSONSchema } from './anyOf.js'
import type { FormattedItemJSONSchema } from './item.js'
import { getFormattedItemJSONSchema } from './item.js'
import type { FormattedListJSONSchema } from './list.js'
import { getFormattedListJSONSchema } from './list.js'
import type { FormattedMapJSONSchema } from './map.js'
import { getFormattedMapJSONSchema } from './map.js'
import type { FormattedPrimitiveJSONSchema } from './primitive.js'
import { getFormattedPrimitiveJSONSchema } from './primitive.js'
import type { FormattedRecordJSONSchema } from './record.js'
import { getFormattedRecordJSONSchema } from './record.js'
import type { FormattedSetJSONSchema } from './set.js'
import { getFormattedSetJSONSchema } from './set.js'

export type FormattedValueJSONSchema<SCHEMA extends Schema> = Schema extends SCHEMA
  ? Record<string, unknown>
  :
      | (SCHEMA extends LazySchema ? { $ref: string } : never)
      | (SCHEMA extends AnySchema ? {} : never)
      | (SCHEMA extends PrimitiveSchema ? FormattedPrimitiveJSONSchema<SCHEMA> : never)
      | (SCHEMA extends SetSchema ? FormattedSetJSONSchema<SCHEMA> : never)
      | (SCHEMA extends ListSchema ? FormattedListJSONSchema<SCHEMA> : never)
      | (SCHEMA extends MapSchema ? FormattedMapJSONSchema<SCHEMA> : never)
      | (SCHEMA extends RecordSchema ? FormattedRecordJSONSchema<SCHEMA> : never)
      | (SCHEMA extends AnyOfSchema ? FormattedAnyOfJSONSchema<SCHEMA> : never)
      | (SCHEMA extends ItemSchema ? FormattedItemJSONSchema<SCHEMA> : never)

export const getFormattedValueJSONSchema = <SCHEMA extends Schema>(
  schema: SCHEMA,
  references?: SchemaReferences<Record<string, unknown>>
): FormattedValueJSONSchema<SCHEMA> => {
  type RESPONSE = FormattedValueJSONSchema<SCHEMA>
  if (references === undefined) {
    const registry = new SchemaReferences<Record<string, unknown>>()
    const result = getFormattedValueJSONSchema(schema, registry)
    return (
      Object.keys(registry.definitions).length === 0
        ? result
        : { ...result, $defs: registry.definitions }
    ) as RESPONSE
  }

  switch (schema.type) {
    case 'lazy': {
      const { ref, target, fresh } = references.register(schema)
      if (fresh) {
        references.definitions[ref] = getFormattedValueJSONSchema(target, references)
      }
      return { $ref: '#/$defs/' + ref } as RESPONSE
    }
    case 'any':
      return {} as RESPONSE
    case 'null':
    case 'boolean':
    case 'number':
    case 'string':
    case 'binary':
      return getFormattedPrimitiveJSONSchema(schema) as RESPONSE
    case 'set':
      return getFormattedSetJSONSchema(schema, references) as RESPONSE
    case 'list':
      return getFormattedListJSONSchema(schema, references) as RESPONSE
    case 'map':
      return getFormattedMapJSONSchema(schema, references) as RESPONSE
    case 'record':
      return getFormattedRecordJSONSchema(schema, references) as RESPONSE
    case 'anyOf':
      return getFormattedAnyOfJSONSchema(schema, references) as RESPONSE
    case 'item':
      return getFormattedItemJSONSchema(schema, references) as RESPONSE
  }
}

type HasLazySchema<SCHEMA extends Schema> = Schema extends SCHEMA
  ? boolean
  : SCHEMA extends LazySchema
    ? true
    : SCHEMA extends MapSchema | ItemSchema
      ? true extends HasLazySchema<SCHEMA['attributes'][keyof SCHEMA['attributes']]>
        ? true
        : false
      : SCHEMA extends ListSchema | RecordSchema
        ? HasLazySchema<SCHEMA['elements']>
        : SCHEMA extends AnyOfSchema
          ? true extends HasLazySchema<SCHEMA['elements'][number]>
            ? true
            : false
          : false

export type JSONSchemaDocument<SCHEMA extends Schema> =
  true extends HasLazySchema<SCHEMA>
    ? FormattedValueJSONSchema<SCHEMA> & { $defs?: Record<string, Record<string, unknown>> }
    : FormattedValueJSONSchema<SCHEMA>
