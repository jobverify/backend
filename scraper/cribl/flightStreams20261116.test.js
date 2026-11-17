import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { flightDocument, primaryDeclaration, reviewedAsset, nativeCollection, ownRole } from './data20261107.js'

const wrap = stream => '<script>self.__next_f.push(' + JSON.stringify([1, stream]) + ')</script>'

test('the current official Cribl primary binds its native component through a closed Flight async iterable', () => {
  const html = gunzipSync(readFileSync(new URL('./fixtures/flight-primary-20261116.html.gz', import.meta.url))).toString()
  const declaration = primaryDeclaration(html)
  assert.equal(declaration.moduleId, 656347)
  assert.equal(declaration.assetURL, 'https://cribl.io/_next/static/immutable/chunks/23x-uopl6z22m.js')
  assert.equal(declaration.sectionId, 'open-roles')
})

test('Flight follows outlined router maps from the root while leaving unrelated role props detached', () => {
  const data = '1:[["children","$2"]]\n2:["$","$L3",null,{"sectionId":"open-roles"}]\n4:["$","$L3",null,{"sectionId":"unrelated"}]\n'
  const parsed = flightDocument(wrap('0:{"tree":"$Q1"}\n' + data))
  assert.deepEqual(parsed.elements.map(row => row[3].sectionId), ['open-roles'])
  assert.deepEqual(flightDocument(wrap('0:{}\n' + data)).elements, [])
})

for (const [label, stream] of [
  ['missing outlined map', '0:{"tree":"$Q1"}\n'],
  ['non-map outlined value', '0:{"tree":"$Q1"}\n1:{"children":[]}\n'],
  ['duplicate router map keys', '0:{"tree":"$Q1"}\n1:[["children",{}],["children",{}]]\n'],
]) test('Flight rejects ' + label, () => {
  assert.throws(() => flightDocument(wrap(stream)), /Flight.*map/)
})

test('the reviewed immutable client and current full own role reconcile with their original native feed', () => {
  const captures = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-http-20261116.json.gz', import.meta.url))))
  const contract = reviewedAsset(Buffer.from(captures[1].body))
  assert.equal(contract.feedURL, 'https://boards-api.greenhouse.io/v1/boards/cribl/jobs?content=true')
  assert.equal(contract.roleRoute, '/job-detail/<native-id>')
  const feed = nativeCollection(captures[2].body), role = ownRole(captures[3].body, feed.jobs[0])
  assert.deepEqual(role.model, feed.jobs[0])
  assert.ok(role.full.jobDescription.length > 100)
})

test('Flight stream start and close share an identity without overwriting native model data', () => {
  const parsed = flightDocument(wrap('f:X\n0:{"content":"$1"}\n1:{"title":"Native role"}\nf:C\n'))
  assert.deepEqual(parsed.resolve({ native: '$1' }), { native: { title: 'Native role' } })
})

for (const [label, stream] of [
  ['duplicate model', '0:{}\n0:{}\n'],
  ['conflicting model', '0:{}\n0:{"title":"Other role"}\n'],
  ['model overwriting stream', '0:{}\nf:X\nf:{"title":"Other role"}\nf:C\n'],
  ['stream overwriting model', '0:{}\nf:{}\nf:X\nf:C\n'],
  ['duplicate stream start', '0:{}\nf:X\nf:X\nf:C\n'],
  ['duplicate stream close', '0:{}\nf:X\nf:C\nf:C\n'],
  ['close without start', '0:{}\nf:C\n'],
  ['unclosed stream', '0:{}\nf:X\n'],
]) test('Flight still rejects ' + label, () => {
  assert.throws(() => flightDocument(wrap(stream)), /duplicate Flight|Flight stream/)
})
