import type { MapSchema } from '~/schema/map/index.js'

import type { SchemaReferences } from '../../utils/schemaReferences.js'
import type { FullSchemaDTO } from '../types.js'
import type { MapSchemaDTO } from '../types.js'
import { getSchemaDTO } from './schema.js'
import { getDefaultsDTO } from './utils.js'

/**
 * @debt feature "handle defaults, links & validators DTOs"
 */
export const getMapSchemaDTO = (
  schema: MapSchema,
  references?: SchemaReferences<FullSchemaDTO>
): MapSchemaDTO => {
  const defaultsDTO = getDefaultsDTO(schema)
  const { required, hidden, key, savedAs } = schema.props

  return {
    type: 'map',
    attributes: Object.fromEntries(
      Object.entries(schema.attributes).map(([attributeName, attribute]) => [
        attributeName,
        getSchemaDTO(attribute, references)
      ])
    ),
    ...(required !== undefined && required !== 'atLeastOnce' ? { required } : {}),
    ...(hidden !== undefined && hidden ? { hidden } : {}),
    ...(key !== undefined && key ? { key } : {}),
    ...(savedAs !== undefined ? { savedAs } : {}),
    ...defaultsDTO
  }
}
