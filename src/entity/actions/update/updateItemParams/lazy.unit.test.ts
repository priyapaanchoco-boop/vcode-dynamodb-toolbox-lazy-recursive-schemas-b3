import {
  $append,
  $remove,
  $set,
  Entity,
  Table,
  UpdateItemCommand,
  item,
  lazy,
  list,
  map,
  number,
  prefix,
  string
} from '~/index.js'

const table = new Table({ name: 'lazy-updates', partitionKey: { name: 'pk', type: 'string' } })
const values = list(string().transform(prefix('VALUE')))
const attributes = map({
  title: string().optional().savedAs('_title'),
  values: lazy(() => values)
    .optional()
    .savedAs('_values'),
  count: number().optional()
})
const lazyEntity = new Entity({
  name: 'LazyUpdates',
  table,
  schema: item({
    pk: string().key(),
    values: lazy(() => values)
      .optional()
      .savedAs('_values'),
    details: lazy(() => attributes)
      .optional()
      .savedAs('_details')
  }),
  timestamps: false,
  entityAttribute: false
})
const eagerEntity = new Entity({
  name: 'LazyUpdates',
  table,
  schema: item({
    pk: string().key(),
    values: values.optional().savedAs('_values'),
    details: attributes.optional().savedAs('_details')
  }),
  timestamps: false,
  entityAttribute: false
})

describe('update expressions through lazy lists and maps', () => {
  test('appends transformed elements to a renamed lazy list', () => {
    const input = { pk: 'key', values: $append(['one', 'two']) }
    const params = lazyEntity.build(UpdateItemCommand).item(input).params()
    expect(params).toEqual(eagerEntity.build(UpdateItemCommand).item(input).params())
    expect(params.UpdateExpression).toBe('SET #s_1 = list_append(if_not_exists(#s_1, :s_1), :s_2)')
    expect(params.ExpressionAttributeNames).toEqual({ '#s_1': '_values' })
    expect(params.ExpressionAttributeValues).toEqual({
      ':s_1': [],
      ':s_2': ['VALUE#one', 'VALUE#two']
    })
  })
  test('removes optional lazy lists and maps', () => {
    const input = { pk: 'key', values: $remove(), details: $remove() }
    const params = lazyEntity.build(UpdateItemCommand).item(input).params()
    expect(params).toEqual(eagerEntity.build(UpdateItemCommand).item(input).params())
    expect(params.UpdateExpression).toBe('REMOVE #r_1, #r_2')
    expect(params.ExpressionAttributeNames).toEqual({ '#r_1': '_values', '#r_2': '_details' })
  })
  test('removes a list element through a lazy list', () => {
    const input = { pk: 'key', values: { 1: $remove() } }
    const params = lazyEntity.build(UpdateItemCommand).item(input).params()
    expect(params).toEqual(eagerEntity.build(UpdateItemCommand).item(input).params())
    expect(params.UpdateExpression).toBe('REMOVE #r_1[1]')
    expect(params.ExpressionAttributeNames).toEqual({ '#r_1': '_values' })
  })
  test('appends to a lazy list and removes a renamed field inside a lazy map', () => {
    const input = { pk: 'key', details: { title: $remove(), values: $append(['nested']) } }
    const params = lazyEntity.build(UpdateItemCommand).item(input).params()
    expect(params).toEqual(eagerEntity.build(UpdateItemCommand).item(input).params())
    expect(params.UpdateExpression).toBe(
      'SET #s_1.#s_2 = list_append(if_not_exists(#s_1.#s_2, :s_1), :s_2) REMOVE #r_1.#r_2'
    )
    expect(params.ExpressionAttributeNames).toEqual({
      '#s_1': '_details',
      '#s_2': '_values',
      '#r_1': '_details',
      '#r_2': '_title'
    })
    expect(params.ExpressionAttributeValues).toEqual({ ':s_1': [], ':s_2': ['VALUE#nested'] })
  })
  test('replaces lazy lists and maps using set expressions', () => {
    const input = {
      pk: 'key',
      values: $set(['one']),
      details: $set({ title: 'new', values: ['two'] })
    }
    const params = lazyEntity.build(UpdateItemCommand).item(input).params()
    expect(params).toEqual(eagerEntity.build(UpdateItemCommand).item(input).params())
    expect(params.ExpressionAttributeValues).toEqual({
      ':s_1': ['VALUE#one'],
      ':s_2': { _title: 'new', _values: ['VALUE#two'] }
    })
  })
  test('rejects removal of required lazy collections', () => {
    const entity = new Entity({
      name: 'RequiredLazy',
      table,
      schema: item({
        pk: string().key(),
        values: lazy(() => list(string())),
        details: lazy(() => map({ count: number() }))
      }),
      timestamps: false,
      entityAttribute: false
    })
    expect(() =>
      entity
        .build(UpdateItemCommand)
        .item({
          pk: 'key',
          // @ts-expect-error Required lazy attributes cannot be removed.
          values: $remove()
        })
        .params()
    ).toThrow(expect.objectContaining({ code: 'parsing.attributeRequired' }))
    expect(() =>
      entity
        .build(UpdateItemCommand)
        .item({
          pk: 'key',
          // @ts-expect-error Required lazy attributes cannot be removed.
          details: $remove()
        })
        .params()
    ).toThrow(expect.objectContaining({ code: 'parsing.attributeRequired' }))
  })
})
