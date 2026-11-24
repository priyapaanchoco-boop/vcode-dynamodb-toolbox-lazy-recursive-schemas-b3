import type { ItemSchema } from '~/schema/item/index.js'

import type { SchemaReferences } from '../../utils/schemaReferences.js'
import type { FullSchemaDTO } from '../types.js'
import type { ItemSchemaDTO } from '../types.js'
import { getSchemaDTO } from './schema.js'

export const getItemSchemaDTO = (
  schema: ItemSchema,
  references?: SchemaReferences<FullSchemaDTO>
): ItemSchemaDTO => ({
  type: 'item',
  attributes: Object.fromEntries(
    Object.entries(schema.attributes).map(([attributeName, attribute]) => [
      attributeName,
      getSchemaDTO(attribute, references)
    ])
  ) as ItemSchemaDTO['attributes']
})
