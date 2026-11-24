import type { ItemSchema } from '~/schema/index.js'
import { SchemaAction } from '~/schema/index.js'

import { getSchemaDTO } from './getSchemaDTO/index.js'
import type { ItemSchemaDTO } from './types.js'

export class SchemaDTO<SCHEMA extends ItemSchema = ItemSchema>
  extends SchemaAction<SCHEMA>
  implements ItemSchemaDTO
{
  static override actionName = 'dto' as const

  type: ItemSchemaDTO['type']
  attributes: ItemSchemaDTO['attributes']
  $schemaDefs?: ItemSchemaDTO['$schemaDefs']

  constructor(schema: SCHEMA) {
    super(schema)
    this.type = 'item'
    const dto = getSchemaDTO(schema) as ItemSchemaDTO
    this.attributes = dto.attributes
    this.$schemaDefs = dto.$schemaDefs
  }

  toJSON(): ItemSchemaDTO {
    return {
      type: this.type,
      attributes: this.attributes,
      ...(this.$schemaDefs === undefined ? {} : { $schemaDefs: this.$schemaDefs })
    }
  }
}
