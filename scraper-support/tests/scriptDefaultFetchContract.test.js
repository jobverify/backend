import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parse } from 'acorn'

import { getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const providersDir = path.resolve(currentDir, '../providers')

const hasImmediateBodyDefault = code => {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' })
  const exported = ast.body.find(node => node.type === 'ExportNamedDeclaration'
    && node.declaration?.type === 'VariableDeclaration'
    && node.declaration.declarations.some(item => item.id.name === 'run'))
  const fn = exported?.declaration.declarations.find(item => item.id.name === 'run')?.init
  if (fn?.body?.type !== 'BlockStatement') return false
  const parameter = fn.params[0]?.type === 'AssignmentPattern' ? fn.params[0].left : fn.params[0]
  const field = parameter?.properties?.find(item => item.key?.name === 'fetchText')
  if (field?.value?.type !== 'Identifier') return false
  const first = fn.body.body.find(node => node.type !== 'EmptyStatement' && !node.directive)?.expression
  return first?.type === 'AssignmentExpression' && ['??=', '||='].includes(first.operator)
    && first.left.type === 'Identifier' && first.left.name === field.value.name
    && ['ArrowFunctionExpression', 'FunctionExpression'].includes(first.right.type)
}

test('the default-fetch contract recognizes an immediate fallback but rejects missing, commented or late defaults', () => {
  assert.equal(hasImmediateBodyDefault('export const run=async({fetchText}={})=>{fetchText ??= url=>nativeRead(url);return fetchText(url)}'), true)
  for (const code of [
    'export const run=async({fetchText}={})=>{return fetchText(url)}',
    'export const run=async({fetchText}={})=>{/*fetchText ??= nativeRead*/return fetchText(url)}',
    'export const run=async({fetchText}={})=>{await fetchText(url);fetchText ??= nativeRead}',
  ]) assert.equal(hasImmediateBodyDefault(code), false)
})

test('the immediate fallback must be callable without relying on an unqualified identifier binding', () => {
  for (const code of [
    'const fallback=undefined;export const run=async({fetchText}={})=>{fetchText ??= fallback;return fetchText(url)}',
    'export const run=async({fetchText}={})=>{fetchText ??= missingDefault;return fetchText(url)}',
    'export const run=async({fetchText,fallback}={})=>{fetchText ??= fallback;return fetchText(url)}',
  ]) assert.equal(hasImmediateBodyDefault(code), false)
})

test('script catalog entries that destructure fetchText provide a production default fetcher', () => {
  const missingDefaults = getScraperCatalog()
    .filter((provider) => provider.adapter === 'script')
    .flatMap((provider) => {
      const scriptPath = path.resolve(providersDir, provider.modulePath)
      const code = readFileSync(scriptPath, 'utf8')
      const runLine = code
        .split(/\r?\n/)
        .find((line) => line.includes('export const run = async')) || ''

      if (!runLine.includes('{ fetchText')) return []
      if (/fetchText\s*=/.test(runLine)) return []
      if (hasImmediateBodyDefault(code)) return []

      return [`${provider.source}: ${path.relative(path.resolve(currentDir, '..', '..', 'scraper'), scriptPath)}`]
    })

  assert.deepEqual(missingDefaults, [])
})

test('Tricon actual registered implementation reaches its default HTTP boundary without an injected fetcher', async t => {
  const { run } = await import('../../scraper/triconinfotech/script.js')
  const marker = Object.assign(Error('controlled default HTTP boundary; no network'), { abortRetries: true })
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => { requests += 1;throw marker })
  await assert.rejects(run(), error => {
    const seen = new Set()
    for (let current = error; current && !seen.has(current); current = current.cause) {
      if (current === marker) return true
      seen.add(current)
    }
    return false
  })
  assert.equal(requests, 1)
})
