import type { ISchemaDTO } from '~/schema/actions/dto/index.js'
import type { Schema } from '~/schema/index.js'
import { lazy } from '~/schema/lazy/index.js'

import { createSchemaDTOContext, getDefinition } from '../context.js'
import type { SchemaDTOContext } from '../context.js'
import { fromAnySchemaDTO } from './any.js'
import { fromAnyOfSchemaDTO } from './anyOf.js'
import { fromItemSchemaDTO } from './item.js'
import { fromListSchemaDTO } from './list.js'
import { fromMapSchemaDTO } from './map.js'
import { fromPrimitiveSchemaDTO } from './primitive.js'
import { fromRecordSchemaDTO } from './record.js'
import { fromSetSchemaDTO } from './set.js'

export const fromSchemaDTO = (schemaDTO: ISchemaDTO, context?: SchemaDTOContext): Schema => {
  if (context === undefined) {
    return fromSchemaDTO(schemaDTO, createSchemaDTOContext(schemaDTO))
  }
  if ('$ref' in schemaDTO) {
    const existing = context.references.get(schemaDTO.$ref)
    if (existing !== undefined) {
      return existing
    }
    const definition = getDefinition(context, schemaDTO.$ref)
    const { required, hidden, key, savedAs } = definition
    const schema = lazy(() => fromSchemaDTO(definition, context), {
      ...(required === undefined ? {} : { required }),
      ...(hidden === undefined ? {} : { hidden }),
      ...(key === undefined ? {} : { key }),
      ...(savedAs === undefined ? {} : { savedAs })
    })
    context.references.set(schemaDTO.$ref, schema)
    return schema
  }
  const { $schemaDefs: _definitions, ...dto } = schemaDTO
  void _definitions
  const schema = fromFullSchemaDTO(dto, context)
  for (const mode of ['keyDefault', 'putDefault', 'updateDefault'] as const) {
    const value = schemaDTO[mode]
    if (value?.defaulterId === 'value') {
      schema.props[mode] = value.value
    }
  }
  return schema
}

const fromFullSchemaDTO = (
  schemaDTO: Exclude<ISchemaDTO, { $ref: string }>,
  context: SchemaDTOContext
): Schema => {
  switch (schemaDTO.type) {
    case 'any':
      return fromAnySchemaDTO(schemaDTO)
    case 'null':
    case 'boolean':
    case 'number':
    case 'string':
    case 'binary':
      return fromPrimitiveSchemaDTO(schemaDTO)
    case 'set':
      return fromSetSchemaDTO(schemaDTO, context)
    case 'list':
      return fromListSchemaDTO(schemaDTO, context)
    case 'map':
      return fromMapSchemaDTO(schemaDTO, context)
    case 'record':
      return fromRecordSchemaDTO(schemaDTO, context)
    case 'anyOf':
      return fromAnyOfSchemaDTO(schemaDTO, context)
    case 'item':
      return fromItemSchemaDTO(schemaDTO, context)
  }
}
