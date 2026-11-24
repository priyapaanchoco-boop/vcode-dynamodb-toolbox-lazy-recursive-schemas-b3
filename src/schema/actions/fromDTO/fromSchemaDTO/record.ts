import type { ISchemaDTO } from '~/schema/actions/dto/index.js'
import { resolveLazySchema } from '~/schema/lazy/schema.js'
import type { RecordSchema } from '~/schema/record/index.js'
import { record } from '~/schema/record/index.js'
import type { RecordElementSchema, RecordKeySchema } from '~/schema/record/types.js'

import type { SchemaDTOContext } from '../context.js'
import { fromSchemaDTO } from './attribute.js'

type RecordSchemaDTO = Extract<ISchemaDTO, { type: 'record' }>

/**
 * @debt feature "handle defaults, links & validators"
 */
export const fromRecordSchemaDTO = (
  {
    keyDefault,
    putDefault,
    updateDefault,
    keyLink,
    putLink,
    updateLink,
    keys,
    elements,
    ...props
  }: RecordSchemaDTO,
  context?: SchemaDTOContext
): RecordSchema => {
  keyDefault
  putDefault
  updateDefault
  keyLink
  putLink
  updateLink

  return record(
    resolveLazySchema(fromSchemaDTO(keys, context)) as RecordKeySchema,
    fromSchemaDTO(elements, context) as RecordElementSchema,
    props
  )
}
