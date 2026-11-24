import type { RecordSchema } from '~/schema/record/index.js'

import type { SchemaReferences } from '../../utils/schemaReferences.js'
import type { FullSchemaDTO } from '../types.js'
import type { RecordSchemaDTO } from '../types.js'
import { getSchemaDTO } from './schema.js'
import { getDefaultsDTO } from './utils.js'

/**
 * @debt feature "handle defaults, links & validators DTOs"
 */
export const getRecordSchemaDTO = (
  schema: RecordSchema,
  references?: SchemaReferences<FullSchemaDTO>
): RecordSchemaDTO => {
  const defaultsDTO = getDefaultsDTO(schema)
  const { required, hidden, key, savedAs } = schema.props

  return {
    type: 'record',
    keys: getSchemaDTO(schema.keys, references) as RecordSchemaDTO['keys'],
    elements: getSchemaDTO(schema.elements, references) as RecordSchemaDTO['elements'],
    ...(required !== undefined && required !== 'atLeastOnce' ? { required } : {}),
    ...(hidden !== undefined && hidden ? { hidden } : {}),
    ...(key !== undefined && key ? { key } : {}),
    ...(savedAs !== undefined ? { savedAs } : {}),
    ...defaultsDTO
  }
}
