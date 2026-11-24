import { DynamoDBToolboxError } from '~/errors/index.js'
import { Finder } from '~/schema/actions/finder/index.js'
import { Formatter } from '~/schema/actions/format/index.js'
import { Parser } from '~/schema/actions/parse/index.js'
import { ConditionParser } from '~/schema/actions/parseCondition/index.js'
import { PathParser } from '~/schema/actions/parsePaths/index.js'
import { ZodSchemer } from '~/schema/actions/zodSchemer/index.js'
import { anyOf, item, lazy, list, map, number, string } from '~/schema/index.js'
import type { LazySchema, MapSchema, Schema } from '~/schema/index.js'
import { prefix } from '~/transformers/prefix.js'

describe('lazy schemas', () => {
  test('defers the thunk and caches the exact schema, even when frozen', () => {
    const target = string()
    const thunk = vi.fn(() => target)
    const deferred = lazy(thunk)
    expect(thunk).not.toHaveBeenCalled()
    Object.freeze(deferred)
    expect(deferred.resolve()).toBe(target)
    expect(deferred.resolve()).toBe(target)
    expect(thunk).toHaveBeenCalledTimes(1)
  })
  test('caches thrown thunk failures', () => {
    const failure = new Error('failure')
    const thunk = vi.fn(() => {
      throw failure
    })
    const deferred = lazy(thunk)
    expect(() => deferred.resolve()).toThrow(failure)
    expect(() => deferred.resolve()).toThrow(failure)
    expect(thunk).toHaveBeenCalledTimes(1)
  })
  test.each([undefined, null, {}, { type: 'string', props: {}, check() {} }, 42])(
    'rejects invalid resolution %j with the schema path',
    value => {
      const thunk = vi.fn(() => value as Schema)
      const deferred = lazy(thunk)
      for (let i = 0; i < 2; i++) {
        try {
          deferred.check('node.next')
          throw new Error('Expected invalid resolution')
        } catch (error) {
          expect(error).toBeInstanceOf(DynamoDBToolboxError)
          expect(error).toMatchObject({ code: 'schema.lazy.invalidResolution', path: 'node.next' })
        }
      }
      expect(thunk).toHaveBeenCalledTimes(1)
    }
  )
  test('rejects direct and mutual lazy-only cycles', () => {
    const direct: Schema = lazy(() => direct)
    const first: Schema = lazy(() => second)
    const second: Schema = lazy(() => first)
    for (const schema of [direct, first]) {
      expect(() => schema.check()).toThrow(
        expect.objectContaining({ code: 'schema.lazy.invalidResolution' })
      )
      expect(() => new Parser(schema).parse({})).toThrow(
        expect.objectContaining({ code: 'schema.lazy.invalidResolution' })
      )
      expect(() => new Formatter(schema).format({})).toThrow(
        expect.objectContaining({ code: 'schema.lazy.invalidResolution' })
      )
      expect(() => new Finder(schema).search('x')).toThrow(
        expect.objectContaining({ code: 'schema.lazy.invalidResolution' })
      )
    }
  })
  test('rejects union-only recursive branches without overflowing', () => {
    const schema: LazySchema<Schema, {}> = lazy(() => anyOf(schema, string()))
    expect(() => schema.check()).toThrow(
      expect.objectContaining({ code: 'schema.lazy.invalidResolution' })
    )
    expect(() => new Finder(schema).search('x')).toThrow(
      expect.objectContaining({ code: 'schema.lazy.invalidResolution' })
    )
  })
  test('checks and processes recursive trees', () => {
    const tree: MapSchema = map({ value: number<{}>(), children: list(lazy(() => tree)) })
    const value = { value: 1, children: [{ value: 2, children: [] }] }
    expect(() => tree.check()).not.toThrow()
    expect(new Parser(tree).parse(value)).toEqual(value)
    expect(new Formatter(tree).format(value)).toEqual(value)
    expect(() =>
      new Parser(tree).parse({ value: 1, children: [{ value: 'bad', children: [] }] })
    ).toThrow()
    expect(new Finder(tree).search('children[0].value')[0]?.schema.type).toBe('number')
  })
  test('checks optional linked lists and mutual recursive maps', () => {
    const node: MapSchema = map({ value: number<{}>(), next: lazy(() => node).optional() })
    const value = { value: 1, next: { value: 2 } }
    expect(() => node.check()).not.toThrow()
    expect(new Parser(node).parse(value)).toEqual(value)
    expect(new Formatter(node).format(value)).toEqual(value)
    const a: MapSchema = map({ b: lazy(() => b).optional() })
    const b: MapSchema = map({ a: lazy(() => a).optional() })
    expect(() => a.check()).not.toThrow()
    expect(new Parser(a).parse({ b: { a: {} } })).toEqual({ b: { a: {} } })
  })
  test('preserves target transforms, wrapper defaults and renamed paths', () => {
    const target = string().transform(prefix('ID'))
    const schema = item({
      child: lazy(() => map({ name: target })).savedAs('_child'),
      fallback: lazy(() => number()).default(7)
    })
    schema.check()
    expect(new Parser(schema).parse({ child: { name: 'hello' } })).toEqual({
      _child: { name: 'ID#hello' },
      fallback: 7
    })
    expect(new Formatter(schema).format({ _child: { name: 'ID#hello' }, fallback: 7 })).toEqual({
      child: { name: 'hello' },
      fallback: 7
    })
    expect(
      new ConditionParser(schema).parse({ attr: 'child.name', eq: 'hello' })
        .ExpressionAttributeValues
    ).toEqual({ ':c_1': 'ID#hello' })
    expect(new PathParser(schema).parse(['child.name']).ExpressionAttributeNames).toBeDefined()
    expect(new Finder(schema).search('child.name')[0]?.transformedPath.strPath).toBe('_child.name')
  })
  test('supports lazy item roots and nested chains', () => {
    const target = item({ value: number() })
    const schema = lazy(() => lazy(() => target))
    schema.check()
    expect(new Parser(schema).parse({ value: 3 })).toEqual({ value: 3 })
    expect(new Formatter(schema).format({ value: 3 })).toEqual({ value: 3 })
    expect(new Finder(schema).search('')[0]?.schema).toBe(target)
  })
  test('delegates discriminated unions through lazy variants and discriminator attributes', () => {
    const first = lazy(() => map({ kind: lazy(() => string().const('first')), value: number() }))
    const second = lazy(() => map({ kind: string().const('second'), value: string() }))
    const schema = anyOf(first, second).discriminate('kind')
    schema.check()
    expect(new Parser(schema).parse({ kind: 'first', value: 2 })).toEqual({
      kind: 'first',
      value: 2
    })
    expect(new Formatter(schema).format({ kind: 'second', value: 'hello' })).toEqual({
      kind: 'second',
      value: 'hello'
    })
  })

  test('resolves a lazy alternative in a mixed discriminated union exactly once', () => {
    const target = map({
      kind: string().const('text').savedAs('_kind'),
      value: string().transform(prefix('VALUE'))
    })
    const thunk = vi.fn(() => target)
    const schema = anyOf(
      lazy(thunk),
      map({ kind: string().const('number').savedAs('_kind'), value: number() })
    ).discriminate('kind')
    expect(thunk).not.toHaveBeenCalled()
    schema.check()
    schema.check()
    expect(schema.match('text')).toBe(target)
    expect(new Parser(schema).parse({ kind: 'text', value: 'hello' })).toEqual({
      _kind: 'text',
      value: 'VALUE#hello'
    })
    expect(new Formatter(schema).format({ _kind: 'text', value: 'VALUE#hello' })).toEqual({
      kind: 'text',
      value: 'hello'
    })
    expect(new Parser(schema).parse({ kind: 'number', value: 42 })).toEqual({
      _kind: 'number',
      value: 42
    })
    expect(() => new Parser(schema).parse({ kind: 'text', value: 42 })).toThrow()
    expect(thunk).toHaveBeenCalledTimes(1)
  })
  test('builds deferred Zod parsers and formatters for recursive trees', () => {
    const tree: MapSchema = map({ value: number<{}>(), children: list(lazy(() => tree)) })
    const value = { value: 1, children: [{ value: 2, children: [] }] }
    const zod = new ZodSchemer(tree)
    expect(zod.parser().parse(value)).toEqual(value)
    expect(zod.formatter().parse(value)).toEqual(value)
  })
})
