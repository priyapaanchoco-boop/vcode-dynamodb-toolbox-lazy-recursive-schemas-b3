---
title: JSONSchemer
sidebar_custom_props:
  sidebarActionType: util
---

# JSONSchemer

Export the shape of formatted values as JSON Schema:

```ts
import { JSONSchemer } from 'dynamodb-toolbox/schema/actions/jsonSchemer'

const jsonSchema = pokemonSchema
  .build(JSONSchemer)
  .formattedValueSchema()
```

Items and maps become objects, lists become arrays, records use `additionalProperties`, and unions use `anyOf`. Hidden attributes are omitted. Optional attributes are excluded from `required`. Property names describe formatted values, before `savedAs` renaming.

## Recursive schemas

[Lazy schemas](../19-lazy/index.md) export as reference objects:

```json
{ "$ref": "#/$defs/schema1" }
```

The document root contains a `$defs` map with the full schema for each reference. Definitions are registered before their children are exported, so recursive children refer back to an existing definition. Shared lazy schemas reuse their reference within the document. Each export has its own registry.

A lazy root may contain both `$ref` and `$defs`. Nested references contain only `$ref`. Schema definitions are emitted only when needed; schemas without lazy references retain their inline representation.

JSON Schema export describes formatted value shapes. It does not encode custom validators, default getters, or links. For a representation that can reconstruct a Toolbox schema, use [SchemaDTO](./3-dto.md).
