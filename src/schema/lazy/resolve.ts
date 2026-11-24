import type { Overwrite } from '~/types/index.js'

import type { Schema, SchemaProps } from '../types/index.js'
import type { LazySchema } from './schema.js'

type WithProps<TARGET extends Schema, PROPS extends SchemaProps> = Schema extends TARGET
  ? Schema
  : TARGET extends Schema
    ? Extract<Omit<TARGET, 'props'> & { props: Overwrite<TARGET['props'], PROPS> }, Schema>
    : never
export type ResolveLazySchema<SCHEMA extends LazySchema> = WithProps<
  ReturnType<SCHEMA['resolve']>,
  SCHEMA['props']
>
