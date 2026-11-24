---
title: DTO
sidebar_custom_props:
  sidebarActionType: util
---

# SchemaDTO

Builds a [Data Transfer Object](https://en.wikipedia.org/wiki/Data_transfer_object) of the schema.

A DTO is a **JSON-stringifiable object** representing the schema that can be transferred or saved for later use:

```ts
import { SchemaDTO } from 'dynamodb-toolbox/schema/actions/dto'

const pokemonSchemaDTO = pokemonSchema.build(SchemaDTO)

const pokemonSchemaJSON = JSON.stringify(pokemonSchemaDTO)
```

On DTO retrieval, you can use the `fromDTO` util to re-create the original schema:

```ts
import { fromDTO } from 'dynamodb-toolbox/schema/actions/fromDTO'

const pokemonSchemaDTO = JSON.parse(pokemonSchemaJSON)

// 👇 Has a similar configuration to the original
const pokemonSchema = fromDTO(pokemonSchemaDTO)
```

:::note

All TS types are lost in the process.

:::

## Recursive schemas

[Lazy schemas](../19-lazy/index.md) are serialized as bare reference objects, with no `type` field or property overrides:

```json
{ "$ref": "schema1" }
```

The root DTO carries a `$schemaDefs` map. Each key is a reference identifier and each value is a full schema DTO. Optional, hidden, key, and renamed-field properties belong to the full definition, so references themselves remain bare objects.

```json
{
  "type": "item",
  "attributes": { "node": { "$ref": "schema1" } },
  "$schemaDefs": {
    "schema1": {
      "type": "map",
      "required": "never",
      "attributes": {
        "value": { "type": "number" },
        "next": { "$ref": "schema1" }
      }
    }
  }
}
```

`fromDTO` restores references at any depth, including nested maps, lists, records, and union alternatives. Shared references remain shared, and recursive references are resolved lazily. Unknown identifiers throw `DynamoDBToolboxError` with code `schema.dto.unknownReference` during restoration.

```ts
const restored = fromDTO(
  JSON.parse(JSON.stringify(pokemonSchemaDTO))
)
```

Literal defaults and supported transformers are restored along with schema properties. Schemas without references keep their existing inline DTO representation. JSON Schema export uses a separate format: [`$ref` with `$defs`](./6-json-schemer.md).

:::caution

Note that **functions are not serializable**, so parts of the schema may be lost in the process:

- **Getters defaults** are not serialized.
- **Links** are not serialized.
- **Validators** are not serialized.
- On-the-shelf **transformers** like [`prefix`](../18-transformers/2-prefix.md) and [`jsonStringify`](../18-transformers/4-json-stringify.md) are **correctly serialized**, but **custom transformers** are not.

:::
