import type { MapSchema } from '~/schema/index.js'
import type { ComputeObject } from '~/types/computeObject.js'
import type { OmitKeys } from '~/types/omitKeys.js'

import type { SchemaReferences } from '../../utils/schemaReferences.js'
import type { FormattedValueJSONSchema } from './schema.js'
import { getFormattedValueJSONSchema } from './schema.js'
import type { RequiredProperties } from './shared.js'

export type FormattedMapJSONSchema<
  SCHEMA extends MapSchema,
  REQUIRED_PROPERTIES extends string = RequiredProperties<SCHEMA>
> = ComputeObject<
  {
    type: 'object'
    properties: {
      [KEY in OmitKeys<
        SCHEMA['attributes'],
        { props: { hidden: true } }
      >]: FormattedValueJSONSchema<SCHEMA['attributes'][KEY]>
    }
  } & ([REQUIRED_PROPERTIES] extends [never] ? {} : { required: REQUIRED_PROPERTIES[] })
>

export const getFormattedMapJSONSchema = <SCHEMA extends MapSchema>(
  schema: SCHEMA,
  references?: SchemaReferences<Record<string, unknown>>
): FormattedMapJSONSchema<SCHEMA> => {
  const displayedAttrEntries = Object.entries(schema.attributes).filter(
    ([, attr]) => !attr.props.hidden
  )

  const requiredProperties = displayedAttrEntries
    .filter(([, { props }]) => props.required !== 'never')
    .map(([attributeName]) => attributeName)

  return {
    type: 'object',
    properties: Object.fromEntries(
      displayedAttrEntries.map(([attributeName, attribute]) => [
        attributeName,
        getFormattedValueJSONSchema(attribute, references)
      ])
    ),
    ...(requiredProperties.length > 0 ? { required: requiredProperties } : {})
  } as FormattedMapJSONSchema<SCHEMA>
}
