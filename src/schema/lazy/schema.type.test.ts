import type { SchemaCondition } from '~/schema/actions/parseCondition/index.js'
import type { ItemSchema, LazySchema, MapSchema, NumberSchema, Paths } from '~/schema/index.js'
import { item, lazy, list, map, number, string } from '~/schema/index.js'
import type {
  DecodedValue,
  FormattedValue,
  InputValue,
  TransformedValue,
  ValidValue
} from '~/schema/index.js'

const text = lazy(() => string())
const optional = lazy(() => number()).optional()
const object = item({ text, optional, nested: lazy(() => map({ values: list(number()) })) })
type Value = { text: string; optional?: number; nested: { values: number[] } }
type Assert<T extends true> = T
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
export type Input = Assert<Equal<InputValue<typeof object>, Value>>
export type Valid = Assert<Equal<ValidValue<typeof object>, Value>>
export type Transformed = Assert<Equal<TransformedValue<typeof object>, Value>>
export type Decoded = Assert<Equal<DecodedValue<typeof object>, Value>>
export type Formatted = Assert<Equal<FormattedValue<typeof object>, Value>>

const primitive: ValidValue<typeof text> = 'hello'
// @ts-expect-error Lazy string schemas reject numbers.
const invalidPrimitive: ValidValue<typeof text> = 123
void primitive
void invalidPrimitive

type NodeSchema = MapSchema<
  {
    value: NumberSchema<{}>
    next: LazySchema<NodeSchema, { required: 'never' }>
  },
  {}
>
const recursiveValue: ValidValue<NodeSchema> = { value: 1, next: { value: 2 } }
const recursiveInput: InputValue<NodeSchema> = recursiveValue
const recursiveOutput: FormattedValue<NodeSchema> = recursiveValue
void recursiveInput
void recursiveOutput

type NodeItem = ItemSchema<{ node: LazySchema<NodeSchema, {}> }>
const recursivePath: Paths<NodeItem> = 'node.next.next.value'
const recursiveCondition: SchemaCondition<NodeItem> = { attr: 'node.next.value', eq: 2 }
void recursivePath
void recursiveCondition
