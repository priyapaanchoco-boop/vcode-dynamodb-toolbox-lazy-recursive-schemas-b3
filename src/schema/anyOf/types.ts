import type { LazySchema } from '../lazy/index.js'
import type { ResolveLazySchema } from '../lazy/resolve.js'
import type { MapSchema } from '../map/schema.js'
import type { StringSchema } from '../string/schema.js'
import type { Always, AtLeastOnce, Schema, SchemaProps } from '../types/index.js'
import type { AnyOfSchema } from './schema.js'

type DiscriminatorAttribute<ATTRIBUTE extends Schema> = ATTRIBUTE extends LazySchema
  ? ResolveLazySchema<ATTRIBUTE>
  : ATTRIBUTE

type ElementDiscriminator<ELEMENT extends Schema> = Schema extends ELEMENT
  ? string
  :
      | (ELEMENT extends LazySchema
          ? Schema extends ReturnType<ELEMENT['resolve']>
            ? string
            : ElementDiscriminator<ResolveLazySchema<ELEMENT>>
          : never)
      | (ELEMENT extends AnyOfSchema ? Discriminator<ELEMENT['elements']> : never)
      | (ELEMENT extends MapSchema
          ? {
              [KEY in keyof ELEMENT['attributes']]: DiscriminatorAttribute<
                ELEMENT['attributes'][KEY]
              > extends StringSchema
                ? DiscriminatorAttribute<ELEMENT['attributes'][KEY]>['props'] extends {
                    enum: string[]
                    required?: AtLeastOnce | Always
                    transform?: undefined
                  }
                  ? [
                      KEY,
                      DiscriminatorAttribute<ELEMENT['attributes'][KEY]>['props'] extends {
                        savedAs: string
                      }
                        ? DiscriminatorAttribute<ELEMENT['attributes'][KEY]>['props']['savedAs']
                        : KEY
                    ]
                  : never
                : never
            }[keyof ELEMENT['attributes']]
          : never)

export type Discriminator<
  ELEMENTS extends Schema[],
  RESULTS extends [string, string] = [string, string]
> = Schema[] extends ELEMENTS
  ? string
  : ELEMENTS extends [infer ELEMENTS_HEAD, ...infer ELEMENTS_TAIL]
    ? ELEMENTS_HEAD extends Schema
      ? ELEMENTS_TAIL extends Schema[]
        ? Discriminator<ELEMENTS_TAIL, RESULTS & ElementDiscriminator<ELEMENTS_HEAD>>
        : never
      : never
    : RESULTS[0]

export interface AnyOfSchemaProps extends SchemaProps {
  discriminator?: string
}

interface AnyOfElementProps extends SchemaProps {
  required?: AtLeastOnce
  hidden?: false
  savedAs?: undefined
  keyDefault?: undefined
  putDefault?: undefined
  updateDefault?: undefined
  keyLink?: undefined
  putLink?: undefined
  updateLink?: undefined
}

// TODO: Re-introduce constraint in interface (not only in typer)
export type AnyOfElementSchema = Schema & { props: AnyOfElementProps }
