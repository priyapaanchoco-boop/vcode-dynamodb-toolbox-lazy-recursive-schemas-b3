import type { ISchemaDTO, ItemSchemaDTO } from '~/schema/actions/dto/index.js'
import type { Schema } from '~/schema/index.js'
import type { ItemSchema } from '~/schema/item/index.js'

import { fromSchemaDTO as restoreSchemaDTO } from './fromSchemaDTO/index.js'

export const fromSchemaDTO = restoreSchemaDTO as {
  (schemaDTO: ItemSchemaDTO): ItemSchema
  (schemaDTO: ISchemaDTO): Schema
}
