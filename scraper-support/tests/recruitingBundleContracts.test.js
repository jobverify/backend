import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectRecruitingBundle } from '../utils/recruitingBundleContracts.js'

const api = 'https://api.ashbyhq.com/posting-api/job-board/example'
test('bundle contracts resolve lexical static templates without executing downloaded code', () => {
  const source = 'const tenant="example",api=`https://api.ashbyhq.com/posting-api/job-board/${tenant}`;async function load(){return fetch(api)};globalThis.__bundleExecuted=true;'
  assert.deepEqual(inspectRecruitingBundle(source).fetchUrls, [api])
  assert.equal(globalThis.__bundleExecuted, undefined)
})
test('bundle comments and quoted snippets do not create executable requests', () => {
  const call = `fetch(${JSON.stringify(api)})`
  for (const source of [`/* ${call} */`, `// ${call}`, `const sample=${JSON.stringify(call)}`]) {
    assert.deepEqual(inspectRecruitingBundle(source).fetchUrls, [])
  }
})
test('local functions, imports, destructured and default parameters cannot masquerade as global fetch', () => {
  for (const source of [`function fetch(){};fetch(${JSON.stringify(api)})`,
    `import {fetch} from 'shim';fetch(${JSON.stringify(api)})`,
    `function load({fetch}){fetch(${JSON.stringify(api)})}`,
    `function load(fetch=()=>null){fetch(${JSON.stringify(api)})}`,
    `const {fetch}={fetch:()=>null};fetch(${JSON.stringify(api)})`,
    `try{}catch(fetch){fetch(${JSON.stringify(api)})}`,
    `const fn=function fetch(){fetch(${JSON.stringify(api)})}`]) {
    assert.deepEqual(inspectRecruitingBundle(source).fetchUrls, [], source)
  }
})
test('mutable tenant initialization cannot retain a stale default tenant write', () => {
  const source='let tenant="dittoinsurance";tenant="other";sessionStorage.setItem("TENANT",tenant)'
  assert.deepEqual(inspectRecruitingBundle(source).tenantWrites, [])
})
test('reassigned request URLs and literal inactive calls do not establish a static fetch contract', () => {
  for (const source of [`let api=${JSON.stringify(api)};api=dynamicEndpoint();fetch(api)`,
    `if(false){fetch(${JSON.stringify(api)})}`, `false&&fetch(${JSON.stringify(api)})`, `true||fetch(${JSON.stringify(api)})`]) {
    assert.deepEqual(inspectRecruitingBundle(source).fetchUrls, [], source)
  }
})
test('scope shadowing cannot borrow another function tenant binding', () => {
  const source = `const tenant='example';function load(tenant){const url=\`https://api.ashbyhq.com/posting-api/job-board/\${tenant}\`;fetch(url)}`
  assert.deepEqual(inspectRecruitingBundle(source).fetchUrls, [])
})
