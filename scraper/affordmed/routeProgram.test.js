import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readAffordmedRouteProgram} from './routeProgram.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-public-20261103.json.gz', import.meta.url))))
const original = fixture.responses.find(row => row.url.includes('/assets/')).body
const change = (from, to) => {
  assert.equal(original.split(from).length, 2, 'Mutation must identify exactly one actual client binding')
  return original.replace(from, to)
}

test('Affordmed current root renderer binds the configured path to its home fallback, without vacancy authority', () => {
  const proof = readAffordmedRouteProgram(original)
  assert.deepEqual(proof.routes, ['/', '/catalog', '/product/:id', '/about', '/*'])
  assert.equal(proof.careersRouteDeclared, false)
  assert.equal(proof.configuredPathUsesHomeFallback, true)
  assert.match(proof.qualification, /not-hiring-inventory/)
})

test('Affordmed route evidence rejects wrong root and dynamic or duplicate current route configuration', () => {
  for (const javascript of [
    change('getElementById("root")', 'getElementById("other")'),
    change('path:"catalog"', 'path:window.location.pathname'),
    change('path:"catalog"', 'path:"catalog",path:"careers"'),
    'const document={};' + original,
  ]) assert.throws(() => readAffordmedRouteProgram(javascript), /route program unqualified/)
})

test('Affordmed unused or commented careers strings cannot create a current careers route', () => {
  const proof = readAffordmedRouteProgram(original + '\n/* {path:"careers",Component:Km} */\nconst unreferencedCareersString="careers";')
  assert.equal(proof.careersRouteDeclared, false)
  assert.equal(proof.configuredPathUsesHomeFallback, true)
})
