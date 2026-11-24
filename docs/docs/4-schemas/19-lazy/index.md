---
title: lazy
sidebar_position: 16.5
sidebar_custom_props:
  code: true
---

# Lazy

Use `lazy(() => schema)` to defer a schema definition until it is needed. The thunk can refer to the schema being defined, which supports trees, linked lists, and mutually recursive schemas.

## Recursive trees

Give recursive schemas an explicit type annotation:

```ts
import { lazy } from 'dynamodb-toolbox/schema/lazy'
import { list } from 'dynamodb-toolbox/schema/list'
import { map } from 'dynamodb-toolbox/schema/map'
import { number } from 'dynamodb-toolbox/schema/number'
import { Parser } from 'dynamodb-toolbox/schema/actions/parse'
import type { MapSchema } from 'dynamodb-toolbox/schema/map'

const tree: MapSchema = map({
  value: number<{}>(),
  children: list(lazy(() => tree))
})

tree.check()

new Parser(tree).parse({
  value: 1,
  children: [{ value: 2, children: [] }]
})
```

A broad `MapSchema` annotation keeps construction simple. To retain recursive value inference, declare the attribute types explicitly:

```ts
import type { LazySchema } from 'dynamodb-toolbox/schema/lazy'
import type { NumberSchema } from 'dynamodb-toolbox/schema/number'

type NodeSchema = MapSchema<
  {
    value: NumberSchema<{}>
    next: LazySchema<NodeSchema, { required: 'never' }>
  },
  {}
>

const node: NodeSchema = map({
  value: number<{}>(),
  next: lazy(() => node).optional()
})
```

An optional tail terminates a linked list. An empty children list terminates a tree.

## Resolution and checking

`lazy` accepts a thunk returning a schema. Construction does not run the thunk. `.resolve()` evaluates it once and caches the returned schema. Thunk failures are cached too.

```ts
const target = number()
const deferred = lazy(() => target)

deferred.resolve() === target // true
```

`.check()` validates the resolved schema and safely follows recursive children. Invalid resolutions and lazy-only cycles throw `DynamoDBToolboxError` with code `schema.lazy.invalidResolution`. A recursive branch must cross a container before returning to itself.

Parsing, formatting, conditions, path finding, and Zod transpilation delegate to the resolved schema. Lazy wrappers support common properties such as `.optional()`, `.hidden()`, `.savedAs()`, defaults, links, and validators. Wrapper properties override properties on the resolved schema.

Recursive path and condition types expand through eight lazy levels, then accept broader paths to avoid infinite TypeScript expansion. Runtime traversal is not limited to eight levels.

## Serialization

[Schema DTOs](../17-actions/3-dto.md#recursive-schemas) store references in a root `$schemaDefs` map. [JSON Schema export](../17-actions/6-json-schemer.md) uses standard `$ref` pointers into a root `$defs` map.
