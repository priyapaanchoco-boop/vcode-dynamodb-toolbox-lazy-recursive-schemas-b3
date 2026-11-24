/**
 * @debt circular "Remove & prevent imports from entity to schema"
 */
import type { UpdateValueInput } from '~/entity/actions/update/types.js'
import type { Paths, SchemaAction, ValidValue } from '~/schema/index.js'
import type { If, NarrowObject, Overwrite, ValueOrGetter } from '~/types/index.js'
import { ifThenElse } from '~/utils/ifThenElse.js'
import { overwrite } from '~/utils/overwrite.js'

import type {
  Always,
  AtLeastOnce,
  Never,
  Schema,
  SchemaRequiredProp,
  Validator
} from '../types/index.js'
import type { SchemaProps } from '../types/index.js'
import { LazySchema } from './schema.js'

export const lazy = <TARGET extends Schema, PROPS extends SchemaProps = {}>(
  thunk: () => TARGET,
  props: NarrowObject<PROPS> = {} as PROPS
): LazySchema_<TARGET, PROPS> => new LazySchema_(thunk, props)

/**
 * Deferred schema builder
 */
export class LazySchema_<
  TARGET extends Schema = Schema,
  PROPS extends SchemaProps = SchemaProps
> extends LazySchema<TARGET, PROPS> {
  /**
   * Tag attribute as required. Possible values are:
   * - `'atLeastOnce'` _(default)_: Required in PUTs, optional in UPDATEs
   * - `'never'`: Optional in PUTs and UPDATEs
   * - `'always'`: Required in PUTs and UPDATEs
   *
   * @param nextRequired SchemaRequiredProp
   */
  required<NEXT_IS_REQUIRED extends SchemaRequiredProp = AtLeastOnce>(
    nextRequired: NEXT_IS_REQUIRED = 'atLeastOnce' as NEXT_IS_REQUIRED
  ): LazySchema_<TARGET, Overwrite<PROPS, { required: NEXT_IS_REQUIRED }>> {
    return new LazySchema_(this.thunk, overwrite(this.props, { required: nextRequired }))
  }

  /**
   * Shorthand for `required('never')`
   */
  optional(): LazySchema_<TARGET, Overwrite<PROPS, { required: Never }>> {
    return this.required('never')
  }

  /**
   * Hide attribute after fetch commands and formatting
   */
  hidden<NEXT_HIDDEN extends boolean = true>(
    nextHidden: NEXT_HIDDEN = true as NEXT_HIDDEN
  ): LazySchema_<TARGET, Overwrite<PROPS, { hidden: NEXT_HIDDEN }>> {
    return new LazySchema_(this.thunk, overwrite(this.props, { hidden: nextHidden }))
  }

  /**
   * Tag attribute as a primary key attribute or linked to a primary attribute
   */
  key<NEXT_KEY extends boolean = true>(
    nextKey: NEXT_KEY = true as NEXT_KEY
  ): LazySchema_<TARGET, Overwrite<PROPS, { key: NEXT_KEY; required: Always }>> {
    return new LazySchema_(this.thunk, overwrite(this.props, { key: nextKey, required: 'always' }))
  }

  /**
   * Rename attribute before save commands
   */
  savedAs<NEXT_SAVED_AS extends string | undefined>(
    nextSavedAs: NEXT_SAVED_AS
  ): LazySchema_<TARGET, Overwrite<PROPS, { savedAs: NEXT_SAVED_AS }>> {
    return new LazySchema_(this.thunk, overwrite(this.props, { savedAs: nextSavedAs }))
  }

  /**
   * Provide a default value for attribute in Primary Key computing
   *
   * @param nextKeyDefault `keyAttributeInput | (() => keyAttributeInput)`
   */
  keyDefault(
    nextKeyDefault: ValueOrGetter<ValidValue<this, { mode: 'key' }>>
  ): LazySchema_<TARGET, Overwrite<PROPS, { keyDefault: unknown }>> {
    return new LazySchema_(
      this.thunk,
      overwrite(this.props, { keyDefault: nextKeyDefault as unknown })
    )
  }

  /**
   * Provide a default value for attribute in PUT commands
   *
   * @param nextPutDefault `putAttributeInput | (() => putAttributeInput)`
   */
  putDefault(
    nextPutDefault: ValueOrGetter<ValidValue<this>>
  ): LazySchema_<TARGET, Overwrite<PROPS, { putDefault: unknown }>> {
    return new LazySchema_(
      this.thunk,
      overwrite(this.props, { putDefault: nextPutDefault as unknown })
    )
  }

  /**
   * Provide a default value for attribute in UPDATE commands
   *
   * @param nextUpdateDefault `updateAttributeInput | (() => updateAttributeInput)`
   */
  updateDefault(
    nextUpdateDefault: ValueOrGetter<UpdateValueInput<this, { filled: true }>>
  ): LazySchema_<TARGET, Overwrite<PROPS, { updateDefault: unknown }>> {
    return new LazySchema_(
      this.thunk,
      overwrite(this.props, { updateDefault: nextUpdateDefault as unknown })
    )
  }

  /**
   * Provide a default value for attribute in PUT commands OR Primary Key computing if attribute is tagged as key
   *
   * @param nextDefault `key/putAttributeInput | (() => key/putAttributeInput)`
   */
  default(
    nextDefault: ValueOrGetter<
      If<PROPS['key'], ValidValue<this, { mode: 'key' }>, ValidValue<this>>
    >
  ): If<
    PROPS['key'],
    LazySchema_<TARGET, Overwrite<PROPS, { keyDefault: unknown }>>,
    LazySchema_<TARGET, Overwrite<PROPS, { putDefault: unknown }>>
  > {
    return ifThenElse(
      this.props.key as PROPS['key'],
      new LazySchema_(this.thunk, overwrite(this.props, { keyDefault: nextDefault as unknown })),
      new LazySchema_(this.thunk, overwrite(this.props, { putDefault: nextDefault as unknown }))
    )
  }

  /**
   * Provide a **linked** default value for attribute in Primary Key computing
   *
   * @param nextKeyLink `keyAttributeInput | ((keyInput) => keyAttributeInput)`
   */
  keyLink<SCHEMA extends Schema>(
    nextKeyLink: (
      keyInput: ValidValue<SCHEMA, { mode: 'key'; defined: true }>
    ) => ValidValue<this, { mode: 'key' }>
  ): LazySchema_<TARGET, Overwrite<PROPS, { keyLink: unknown }>> {
    return new LazySchema_(this.thunk, overwrite(this.props, { keyLink: nextKeyLink as unknown }))
  }

  /**
   * Provide a **linked** default value for attribute in PUT commands
   *
   * @param nextPutLink `putAttributeInput | ((putItemInput) => putAttributeInput)`
   */
  putLink<SCHEMA extends Schema>(
    nextPutLink: (putItemInput: ValidValue<SCHEMA, { defined: true }>) => ValidValue<this>
  ): LazySchema_<TARGET, Overwrite<PROPS, { putLink: unknown }>> {
    return new LazySchema_(this.thunk, overwrite(this.props, { putLink: nextPutLink as unknown }))
  }

  /**
   * Provide a **linked** default value for attribute in UPDATE commands
   *
   * @param nextUpdateLink `unknown | ((updateItemInput) => updateAttributeInput)`
   */
  updateLink<SCHEMA extends Schema>(
    nextUpdateLink: (
      updateItemInput: UpdateValueInput<SCHEMA, { defined: true; extended: false }, Paths<SCHEMA>>
    ) => UpdateValueInput<this, { filled: true }>
  ): LazySchema_<TARGET, Overwrite<PROPS, { updateLink: unknown }>> {
    return new LazySchema_(
      this.thunk,
      overwrite(this.props, { updateLink: nextUpdateLink as unknown })
    )
  }

  /**
   * Provide a **linked** default value for attribute in PUT commands OR Primary Key computing if attribute is tagged as key
   *
   * @param nextLink `key/putAttributeInput | (() => key/putAttributeInput)`
   */
  link<SCHEMA extends Schema>(
    nextLink: (
      keyOrPutItemInput: If<
        PROPS['key'],
        ValidValue<SCHEMA, { mode: 'key'; defined: true }>,
        ValidValue<SCHEMA, { defined: true }>
      >
    ) => If<PROPS['key'], ValidValue<this, { mode: 'key' }>, ValidValue<this>>
  ): If<
    PROPS['key'],
    LazySchema_<TARGET, Overwrite<PROPS, { keyLink: unknown }>>,
    LazySchema_<TARGET, Overwrite<PROPS, { putLink: unknown }>>
  > {
    return ifThenElse(
      this.props.key as PROPS['key'],
      new LazySchema_(this.thunk, overwrite(this.props, { keyLink: nextLink as unknown })),
      new LazySchema_(this.thunk, overwrite(this.props, { putLink: nextLink as unknown }))
    )
  }

  /**
   * Provide a custom validator for attribute in Primary Key computing
   *
   * @param nextKeyValidator `(keyAttributeInput) => boolean | string`
   */
  keyValidate(
    nextKeyValidator: Validator<ValidValue<this, { mode: 'key'; defined: true }>, this>
  ): LazySchema_<TARGET, Overwrite<PROPS, { keyValidator: Validator }>> {
    return new LazySchema_(
      this.thunk,
      overwrite(this.props, { keyValidator: nextKeyValidator as Validator })
    )
  }

  /**
   * Provide a custom validator for attribute in PUT commands
   *
   * @param nextPutValidator `(putAttributeInput) => boolean | string`
   */
  putValidate(
    nextPutValidator: Validator<ValidValue<this, { defined: true }>, this>
  ): LazySchema_<TARGET, Overwrite<PROPS, { putValidator: Validator }>> {
    return new LazySchema_(
      this.thunk,
      overwrite(this.props, { putValidator: nextPutValidator as Validator })
    )
  }

  /**
   * Provide a custom validator for attribute in UPDATE commands
   *
   * @param nextUpdateValidator `(updateAttributeInput) => boolean | string`
   */
  updateValidate(
    nextUpdateValidator: Validator<UpdateValueInput<this, { filled: true }>, this>
  ): LazySchema_<TARGET, Overwrite<PROPS, { updateValidator: Validator }>> {
    return new LazySchema_(
      this.thunk,
      overwrite(this.props, { updateValidator: nextUpdateValidator as Validator })
    )
  }

  /**
   * Provide a custom validator for attribute in PUT commands OR Primary Key computing if attribute is tagged as key
   *
   * @param nextValidator `(key/putAttributeInput) => boolean | string`
   */
  validate(
    nextValidator: Validator<
      If<
        PROPS['key'],
        ValidValue<this, { mode: 'key'; defined: true }>,
        ValidValue<this, { defined: true }>
      >,
      this
    >
  ): If<
    PROPS['key'],
    LazySchema_<TARGET, Overwrite<PROPS, { keyValidator: Validator }>>,
    LazySchema_<TARGET, Overwrite<PROPS, { putValidator: Validator }>>
  > {
    return ifThenElse(
      this.props.key as PROPS['key'],
      new LazySchema_(
        this.thunk,
        overwrite(this.props, { keyValidator: nextValidator as Validator })
      ),
      new LazySchema_(
        this.thunk,
        overwrite(this.props, { putValidator: nextValidator as Validator })
      )
    )
  }

  clone<NEXT_PROPS extends SchemaProps = {}>(
    nextProps: NarrowObject<NEXT_PROPS> = {} as NEXT_PROPS
  ): LazySchema_<TARGET, Overwrite<PROPS, NEXT_PROPS>> {
    return new LazySchema_(this.thunk, overwrite(this.props, nextProps))
  }

  build<ACTION extends SchemaAction<this> = SchemaAction<this>>(
    Action: new (schema: this) => ACTION
  ): ACTION {
    return new Action(this)
  }
}
