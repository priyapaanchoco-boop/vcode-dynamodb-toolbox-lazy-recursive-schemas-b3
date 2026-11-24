import type { Schema } from '~/schema/index.js'

import { SchemaReferences } from '../../utils/schemaReferences.js'
import type { FullSchemaDTO, ISchemaDTO } from '../types.js'
import { getAnySchemaDTO } from './any.js'
import { getAnyOfSchemaDTO } from './anyOf.js'
import { getItemSchemaDTO } from './item.js'
import { getListSchemaDTO } from './list.js'
import { getMapSchemaDTO } from './map.js'
import { getPrimitiveSchemaDTO } from './primitive.js'
import { getRecordSchemaDTO } from './record.js'
import { getSetSchemaDTO } from './set.js'

export const getSchemaDTO = (
  schema: Schema,
  references?: SchemaReferences<FullSchemaDTO>
): ISchemaDTO => {
  if (references === undefined) {
    const registry = new SchemaReferences<FullSchemaDTO>()
    const dto = getSchemaDTO(schema, registry)
    return Object.keys(registry.definitions).length === 0
      ? dto
      : { ...dto, $schemaDefs: registry.definitions }
  }
  /**
   * @debt feature "handle defaults, links & validators"
   */
  switch (schema.type) {
    case 'lazy': {
      const { ref, target, fresh } = references.register(schema)
      if (fresh) {
        references.definitions[ref] = getSchemaDTO(target, references) as FullSchemaDTO
      }
      return { $ref: ref }
    }
    case 'any':
      return getAnySchemaDTO(schema)
    case 'null':
    case 'boolean':
    case 'number':
    case 'string':
    case 'binary':
      return getPrimitiveSchemaDTO(schema)
    case 'set':
      return getSetSchemaDTO(schema, references)
    case 'list':
      return getListSchemaDTO(schema, references)
    case 'map':
      return getMapSchemaDTO(schema, references)
    case 'record':
      return getRecordSchemaDTO(schema, references)
    case 'anyOf':
      return getAnyOfSchemaDTO(schema, references)
    case 'item':
      return getItemSchemaDTO(schema, references)
  }
}
