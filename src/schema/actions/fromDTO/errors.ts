import type { ErrorBlueprint } from '~/errors/blueprint.js'

export type SchemaDTOErrorBlueprint = ErrorBlueprint<{
  code: 'schema.dto.unknownReference'
  hasPath: false
  payload: { ref: string }
}>
