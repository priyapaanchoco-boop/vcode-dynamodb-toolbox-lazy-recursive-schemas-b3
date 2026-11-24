import type { ISchemaDTO } from '~/schema/actions/dto/index.js'
import type { ItemSchema } from '~/schema/item/index.js'
import { item } from '~/schema/item/index.js'

import type { SchemaDTOContext } from '../context.js'
import { fromSchemaDTO } from './attribute.js'

type ItemSchemaDTO = Extract<ISchemaDTO, { type: 'item' }>

/**
 * @debt feature "handle defaults, links & validators"
 */
export const fromItemSchemaDTO = (
  {
    keyDefault,
    putDefault,
    updateDefault,
    keyLink,
    putLink,
    updateLink,
    attributes
  }: ItemSchemaDTO,
  context?: SchemaDTOContext
): ItemSchema => {
  keyDefault
  putDefault
  updateDefault
  keyLink
  putLink
  updateLink

  return item(
    Object.fromEntries(
      Object.entries(attributes).map(([attributeName, attribute]) => [
        attributeName,
        fromSchemaDTO(attribute, context)
      ])
    )
  )
}
