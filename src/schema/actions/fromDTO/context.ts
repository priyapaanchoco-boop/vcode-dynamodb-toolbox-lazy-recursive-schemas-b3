import { DynamoDBToolboxError } from '~/errors/index.js'
import type { Schema } from '~/schema/index.js'

import type { FullSchemaDTO, ISchemaDTO } from '../dto/types.js'

export interface SchemaDTOContext {
  definitions: Record<string, FullSchemaDTO>
  references: Map<string, Schema>
}
export const getDefinition = (context: SchemaDTOContext, ref: string): FullSchemaDTO => {
  if (!Object.prototype.hasOwnProperty.call(context.definitions, ref)) {
    throw new DynamoDBToolboxError('schema.dto.unknownReference', {
      message: 'Unknown schema DTO reference: ' + ref,
      payload: { ref }
    })
  }
  return context.definitions[ref] as FullSchemaDTO
}
export const createSchemaDTOContext = (root: ISchemaDTO): SchemaDTOContext => {
  const context: SchemaDTOContext = { definitions: root.$schemaDefs ?? {}, references: new Map() }
  const seen = new Set<ISchemaDTO>()
  const visit = (dto: ISchemaDTO): void => {
    if (seen.has(dto)) {
      return
    }
    seen.add(dto)
    if ('$ref' in dto) {
      visit(getDefinition(context, dto.$ref))
      return
    }
    switch (dto.type) {
      case 'map':
      case 'item':
        Object.values(dto.attributes).forEach(visit)
        break
      case 'list':
      case 'set':
        visit(dto.elements)
        break
      case 'record':
        visit(dto.keys)
        visit(dto.elements)
        break
      case 'anyOf':
        dto.elements.forEach(visit)
        break
    }
  }
  visit(root)
  Object.values(context.definitions).forEach(visit)
  return context
}
