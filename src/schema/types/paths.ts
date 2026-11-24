import type {
  AnyOfSchema,
  AnySchema,
  ItemSchema,
  ListSchema,
  MapSchema,
  RecordSchema,
  ResolveStringSchema,
  Schema
} from '~/schema/index.js'
import type { Extends, If } from '~/types/index.js'

import type { LazySchema } from '../lazy/index.js'
import type { ResolveLazySchema } from '../lazy/resolve.js'

export type CharsToEscape = '[' | ']' | '.'
export type StringToEscape = `${string}${CharsToEscape}${string}`

export type AppendKey<PATH extends string, KEY extends string> =
  | `${PATH}['${KEY}']`
  | If<Extends<KEY, StringToEscape>, never, `${PATH}.${KEY}`>

// string is there to simplify type-constraint checks when using Paths
export type Paths<SCHEMA extends Schema = Schema> = string &
  (SCHEMA extends ItemSchema
    ? ItemSchemaPaths<SCHEMA>
    : SCHEMA extends Schema
      ? SchemaPaths<SCHEMA>
      : never)

export type SchemaPaths<
  SCHEMA extends Schema,
  SCHEMA_PATH extends string = '',
  DEPTH extends unknown[] = []
> =
  | (SCHEMA extends LazySchema
      ? Schema extends ReturnType<SCHEMA['resolve']>
        ? AnySchemaPaths<SCHEMA_PATH>
        : DEPTH['length'] extends 8
          ? AnySchemaPaths<SCHEMA_PATH>
          : SchemaPaths<ResolveLazySchema<SCHEMA>, SCHEMA_PATH, [...DEPTH, unknown]>
      : never)
  | (SCHEMA extends AnySchema ? AnySchemaPaths<SCHEMA_PATH> : never)
  | (SCHEMA extends ListSchema ? ListSchemaPaths<SCHEMA, SCHEMA_PATH, DEPTH> : never)
  | (SCHEMA extends MapSchema ? MapSchemaPaths<SCHEMA, SCHEMA_PATH, DEPTH> : never)
  | (SCHEMA extends RecordSchema ? RecordSchemaPaths<SCHEMA, SCHEMA_PATH, DEPTH> : never)
  | (SCHEMA extends AnyOfSchema ? AnyOfSchemaPaths<SCHEMA, SCHEMA_PATH, DEPTH> : never)

export type ItemSchemaPaths<SCHEMA extends ItemSchema = ItemSchema> = ItemSchema extends SCHEMA
  ? string
  : keyof SCHEMA['attributes'] extends infer SCHEMA_PATH
    ? SCHEMA_PATH extends string
      ?
          | `['${SCHEMA_PATH}']`
          | If<Extends<SCHEMA_PATH, StringToEscape>, never, SCHEMA_PATH>
          | SchemaPaths<
              SCHEMA['attributes'][SCHEMA_PATH],
              `['${SCHEMA_PATH}']` | If<Extends<SCHEMA_PATH, StringToEscape>, never, SCHEMA_PATH>
            >
      : never
    : never

type AnySchemaPaths<SCHEMA_PATH extends string = ''> = SCHEMA_PATH extends ''
  ? string
  : SCHEMA_PATH | `${SCHEMA_PATH}${'.' | '['}${string}`

type ListSchemaPaths<
  SCHEMA extends ListSchema,
  SCHEMA_PATH extends string = '',
  DEPTH extends unknown[] = []
> = ListSchema extends SCHEMA
  ? string
  :
      | `${SCHEMA_PATH}[${number}]`
      | SchemaPaths<SCHEMA['elements'], `${SCHEMA_PATH}[${number}]`, DEPTH>

type MapSchemaPaths<
  SCHEMA extends MapSchema,
  SCHEMA_PATH extends string = '',
  DEPTH extends unknown[] = []
> = MapSchema extends SCHEMA
  ? string
  : {
      [KEY in keyof SCHEMA['attributes'] & string]:
        | AppendKey<SCHEMA_PATH, KEY>
        | SchemaPaths<SCHEMA['attributes'][KEY], AppendKey<SCHEMA_PATH, KEY>, DEPTH>
    }[keyof SCHEMA['attributes'] & string]

type RecordSchemaPaths<
  SCHEMA extends RecordSchema,
  SCHEMA_PATH extends string = '',
  DEPTH extends unknown[] = [],
  RESOLVED_KEYS extends string = ResolveStringSchema<SCHEMA['keys']>
> = RecordSchema extends SCHEMA
  ? string
  :
      | AppendKey<SCHEMA_PATH, RESOLVED_KEYS>
      | SchemaPaths<SCHEMA['elements'], AppendKey<SCHEMA_PATH, RESOLVED_KEYS>, DEPTH>

type AnyOfSchemaPaths<
  SCHEMA extends AnyOfSchema,
  SCHEMA_PATH extends string = '',
  DEPTH extends unknown[] = []
> = AnyOfSchema extends SCHEMA
  ? string
  : AnyOfSchemaPathsRec<SCHEMA['elements'], SCHEMA_PATH, never, DEPTH>

type AnyOfSchemaPathsRec<
  SCHEMAS extends Schema[],
  SCHEMA_PATH extends string = '',
  RESULTS = never,
  DEPTH extends unknown[] = []
> = SCHEMAS extends [infer SCHEMAS_HEAD, ...infer SCHEMAS_TAIL]
  ? SCHEMAS_HEAD extends Schema
    ? SCHEMAS_TAIL extends Schema[]
      ? AnyOfSchemaPathsRec<
          SCHEMAS_TAIL,
          SCHEMA_PATH,
          RESULTS | SchemaPaths<SCHEMAS_HEAD, SCHEMA_PATH, DEPTH>,
          DEPTH
        >
      : never
    : never
  : RESULTS
