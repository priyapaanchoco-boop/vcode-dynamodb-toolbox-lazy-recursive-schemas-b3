import type { ErrorBlueprint } from '~/errors/blueprint.js'

export type LazySchemaErrorBlueprint = ErrorBlueprint<{
  code: 'schema.lazy.invalidResolution'
  hasPath: true
  payload: undefined
}>
