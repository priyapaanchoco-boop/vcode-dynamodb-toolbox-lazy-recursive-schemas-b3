import { EntityDTO } from '~/entity/actions/dto/index.js'
import { fromEntityDTO } from '~/entity/actions/fromDTO/index.js'
import { Entity } from '~/entity/entity.js'
import { DynamoDBToolboxError } from '~/errors/index.js'
import { Finder } from '~/schema/actions/finder/index.js'
import { Formatter } from '~/schema/actions/format/index.js'
import { fromSchemaDTO } from '~/schema/actions/fromDTO/index.js'
import { JSONSchemer } from '~/schema/actions/jsonSchemer/index.js'
import { Parser } from '~/schema/actions/parse/index.js'
import { ConditionParser } from '~/schema/actions/parseCondition/index.js'
import { anyOf, item, lazy, list, map, number, record, string } from '~/schema/index.js'
import type { MapSchema, Schema } from '~/schema/index.js'
import { Table } from '~/table/table.js'
import { prefix } from '~/transformers/prefix.js'

import { SchemaDTO, getSchemaDTO } from './index.js'
import type { ISchemaDTO, ItemSchemaDTO } from './types.js'

const jsonRoundTrip = (dto: ISchemaDTO): ISchemaDTO => JSON.parse(JSON.stringify(dto)) as ISchemaDTO

const roundTrip = (schema: Schema, value: unknown): Schema => {
  const dto = jsonRoundTrip(getSchemaDTO(schema))
  const restored = fromSchemaDTO(dto)
  restored.check()
  const parsed = new Parser(schema).parse(value)
  expect(new Parser(restored).parse(value)).toEqual(parsed)
  expect(new Formatter(restored).format(parsed)).toEqual(new Formatter(schema).format(parsed))
  expect(getSchemaDTO(restored)).toEqual(dto)
  return restored
}

describe('recursive schema documents', () => {
  test('exports bare DTO refs with full definitions only at the document root', () => {
    const tree: MapSchema = map({ value: number<{}>(), children: list(lazy(() => tree)) })
    const schema = item({ tree })
    const dto = new SchemaDTO(schema).toJSON()
    expect(dto.attributes.tree).toEqual({
      type: 'map',
      attributes: {
        value: { type: 'number' },
        children: { type: 'list', elements: { $ref: 'schema1' } }
      }
    })
    expect(dto.$schemaDefs).toEqual({
      schema1: {
        type: 'map',
        attributes: {
          value: { type: 'number' },
          children: { type: 'list', elements: { $ref: 'schema1' } }
        }
      }
    })
    const value = { tree: { value: 1, children: [{ value: 2, children: [] }] } }
    roundTrip(schema, value)
  })
  test('preserves optional linked-list edges, transforms, defaults and renamed fields', () => {
    const node: MapSchema = map({
      name: string<{}>().transform(prefix('NAME')),
      fallback: lazy(() => number()).default(7),
      next: lazy(() => node)
        .optional()
        .savedAs('_next')
    })
    const schema = item({ node })
    const restored = roundTrip(schema, { node: { name: 'one', next: { name: 'two' } } })
    expect(new Parser(restored).parse({ node: { name: 'one', next: { name: 'two' } } })).toEqual({
      node: { name: 'NAME#one', fallback: 7, _next: { name: 'NAME#two', fallback: 7 } }
    })
    expect(new Finder(restored).search('node.next.name')[0]?.transformedPath.strPath).toBe(
      'node._next.name'
    )
    expect(
      new ConditionParser(restored).parse({ attr: 'node.next.name', eq: 'two' })
        .ExpressionAttributeValues
    ).toEqual({ ':c_1': 'NAME#two' })
  })

  test('preserves recursive definitions through entity DTOs', () => {
    const node: MapSchema = map({ value: number<{}>(), next: lazy(() => node).optional() })
    const table = new Table({ partitionKey: { name: 'pk', type: 'string' } })
    const entity = new Entity({
      name: 'recursive',
      table,
      schema: item({ pk: string().key(), node }),
      timestamps: false,
      entityAttribute: false
    })
    const dto = entity.build(EntityDTO).toJSON()
    expect(dto.schema.$schemaDefs).toBeDefined()
    const restored = fromEntityDTO(JSON.parse(JSON.stringify(dto)))
    const value = { pk: 'key', node: { value: 1, next: { value: 2 } } }
    expect(new Parser(restored.schema).parse(value)).toEqual(new Parser(entity.schema).parse(value))
  })
  test('shares references across root attributes without mixing export calls', () => {
    const shared = lazy(() => map({ value: number() }))
    const dto = new SchemaDTO(item({ first: shared, second: shared })).toJSON()
    expect(dto.attributes.first).toEqual({ $ref: 'schema1' })
    expect(dto.attributes.second).toEqual({ $ref: 'schema1' })
    expect(Object.keys(dto.$schemaDefs ?? {})).toEqual(['schema1'])
    const restored = fromSchemaDTO(dto)
    expect(restored.attributes.first).toBe(restored.attributes.second)
    const other = new SchemaDTO(item({ plain: string() })).toJSON()
    expect(other).not.toHaveProperty('$schemaDefs')
  })
  test('round-trips mutually recursive definitions', () => {
    const left: MapSchema = map({ right: lazy(() => right).optional() })
    const right: MapSchema = map({ left: lazy(() => left).optional() })
    roundTrip(item({ left, right }), { left: { right: { left: {} } }, right: { left: {} } })
  })
  test('resolves references inside lists, maps, records and union alternatives', () => {
    const leaf = lazy(() => number())
    const schema = item({ nested: list(map({ values: record(string(), anyOf(leaf, string())) })) })
    roundTrip(schema, { nested: [{ values: { a: 1, b: 'two' } }] })
  })
  test('round-trips lazy roots and primitive definitions', () => {
    roundTrip(lazy(() => number()).default(4), undefined)
    const node: MapSchema = map({ value: number<{}>(), next: lazy(() => node).optional() })
    roundTrip(
      lazy(() => node),
      { value: 1, next: { value: 2 } }
    )
  })
  test.each([
    { type: 'item', attributes: { missing: { $ref: 'missing' } } },
    {
      type: 'item',
      attributes: {
        nodes: {
          type: 'list',
          elements: {
            type: 'map',
            attributes: {
              nested: {
                type: 'record',
                keys: { type: 'string' },
                elements: { type: 'anyOf', elements: [{ $ref: 'missing' }] }
              }
            }
          }
        }
      }
    },
    {
      type: 'item',
      attributes: { ref: { $ref: 'known' } },
      $schemaDefs: { known: { type: 'map', attributes: { nested: { $ref: 'missing' } } } }
    },
    { type: 'item', attributes: { ref: { $ref: '__proto__' } }, $schemaDefs: {} },
    { type: 'item', attributes: { ref: { $ref: 'constructor' } }, $schemaDefs: {} }
  ])('rejects unknown refs at any depth immediately', dto => {
    try {
      fromSchemaDTO(dto as unknown as ItemSchemaDTO)
      throw new Error('Expected missing ref error')
    } catch (error) {
      expect(error).toBeInstanceOf(DynamoDBToolboxError)
      expect(error).toMatchObject({ code: 'schema.dto.unknownReference' })
    }
  })

  test('resolves references used as record keys and set elements', () => {
    const dto: ItemSchemaDTO = {
      type: 'item',
      attributes: {
        values: { type: 'record', keys: { $ref: 'key' }, elements: { $ref: 'value' } },
        numbers: { type: 'set', elements: { $ref: 'value' } }
      },
      $schemaDefs: { key: { type: 'string' }, value: { type: 'number' } }
    }
    const schema = fromSchemaDTO(dto)
    schema.check()
    const value = { values: { a: 1 }, numbers: new Set([2, 3]) }
    expect(new Parser(schema).parse(value)).toEqual(value)
  })
  test('keeps invalid data invalid after a recursive round-trip', () => {
    const node: MapSchema = map({ value: number<{}>(), next: lazy(() => node).optional() })
    const restored = fromSchemaDTO(jsonRoundTrip(getSchemaDTO(item({ node }))))
    expect(() =>
      new Parser(restored).parse({ node: { value: 1, next: { value: 'bad' } } })
    ).toThrow()
    expect(() =>
      new Formatter(restored).format({ node: { value: 1, next: { value: 'bad' } } })
    ).toThrow()
  })
  test('supports forward references and restores their schema metadata', () => {
    const dto: ItemSchemaDTO = {
      type: 'item',
      attributes: { next: { $ref: 'optional' } },
      $schemaDefs: {
        optional: {
          type: 'map',
          required: 'never',
          attributes: { next: { $ref: 'optional' }, value: { type: 'number' } }
        }
      }
    }
    const schema = fromSchemaDTO(jsonRoundTrip(dto))
    schema.check()
    expect(new Parser(schema).parse({})).toEqual({})
    expect(new Parser(schema).parse({ next: { value: 1, next: { value: 2 } } })).toEqual({
      next: { value: 1, next: { value: 2 } }
    })
  })
})

const assertReferences = (document: Record<string, unknown>): void => {
  const definitions = document.$defs as Record<string, Record<string, unknown>> | undefined
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const object = value as Record<string, unknown>
    if ('$ref' in object) {
      expect(Object.keys(object).filter(key => object !== document || key !== '$defs')).toEqual([
        '$ref'
      ])
      const ref = object.$ref as string
      expect(ref.startsWith('#/$defs/')).toBe(true)
      expect(definitions).toHaveProperty(ref.slice('#/$defs/'.length))
    }
    Object.values(object).forEach(visit)
  }
  visit(document)
}

describe('recursive JSON Schema export', () => {
  test('exports standard local refs and definitions for trees', () => {
    const tree: MapSchema = map({ value: number<{}>(), children: list(lazy(() => tree)) })
    const document = new JSONSchemer(item({ tree })).formattedValueSchema()
    expect(document).toEqual({
      type: 'object',
      properties: {
        tree: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            children: { type: 'array', items: { $ref: '#/$defs/schema1' } }
          },
          required: ['value', 'children']
        }
      },
      required: ['tree'],
      $defs: {
        schema1: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            children: { type: 'array', items: { $ref: '#/$defs/schema1' } }
          },
          required: ['value', 'children']
        }
      }
    })
    assertReferences(document)
  })
  test('keeps optional and hidden recursive fields correct', () => {
    const node: MapSchema = map({
      value: number<{}>(),
      next: lazy(() => node).optional(),
      secret: lazy(() => node)
        .hidden()
        .optional()
    })
    const document = new JSONSchemer(lazy(() => node)).formattedValueSchema()
    expect(document.$ref).toBe('#/$defs/schema1')
    const definitions = document.$defs ?? {}
    for (const definition of Object.values(definitions)) {
      expect(definition.required).toEqual(['value'])
      expect(definition.properties).not.toHaveProperty('secret')
    }
    assertReferences(document)
  })
  test('threads refs through records and union branches and reuses shared definitions', () => {
    const leaf = lazy(() => number())
    const schema = item({
      first: leaf,
      second: leaf,
      nested: record(string(), anyOf(leaf, list(leaf)))
    })
    const document = new JSONSchemer(schema).formattedValueSchema()
    expect(Object.keys(document.$defs ?? {})).toEqual(['schema1'])
    assertReferences(document)
    const restored = fromSchemaDTO(new SchemaDTO(schema).toJSON())
    expect(new JSONSchemer(restored).formattedValueSchema()).toEqual(document)
  })
  test('does not leak definitions between exports or change plain schemas', () => {
    const schema = lazy(() => number())
    const document = new JSONSchemer(schema).formattedValueSchema()
    expect(new JSONSchemer(schema).formattedValueSchema()).toEqual(document)
    expect(new JSONSchemer(item({ value: number() })).formattedValueSchema()).toEqual({
      type: 'object',
      properties: { value: { type: 'number' } },
      required: ['value']
    })
  })
})
