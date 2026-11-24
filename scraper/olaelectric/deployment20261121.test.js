import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {ORIGIN,corporateContract,corporateStylesheets,sha256,surfaceAssets} from '../ola/nativeContract.js'

const load=file=>JSON.parse(gunzipSync(readFileSync(new URL(file,import.meta.url))))
const fixture=load('./test-data/corporate-style-20261121.json.gz')
const native=load('../ola/test-data/deployment-20261121.json.gz').responses.find(row=>row.kind==='dashboard').body
assert.equal(fixture.receipt.bodyOriginalUnmodified,true)
assert.equal(sha256(fixture.body),fixture.receipt.originalSHA256)
const body=fixture.body

test('Ola Electric selects the three actual current corporate styles without the obsolete 404 stylesheet',()=>{
 const expected=corporateStylesheets(body,'olaelectric').map(row=>row.url)
 const selected=surfaceAssets('olaelectric',native,body).filter(row=>row.kind==='css'&&!row.url.startsWith(ORIGIN+'/')).map(row=>row.url)
 assert.deepEqual(selected.sort(),expected.sort())
 assert.ok(!selected.some(url=>url.includes('175d834e4511513f235afe074baa9e4d')))
})

test('Ola Electric exact current inline selectors qualify only stylesheet visibility and retain every employer scope hold',()=>{
 const result=corporateContract(body,'olaelectric')
 assert.equal(result.delegationVisible,true)
 assert.ok(!result.reasons.includes('unreviewed-corporate-stylesheet-visibility'))
 assert.ok(result.reasons.includes('shared-tenant-brand-and-legal-employer-scope-unresolved'))
 assert.ok(result.reasons.includes('corporate-dynamic-hiring-paths-not-exhaustively-bound'))
})

for(const [name,change]of[
 ['unreviewed inline declaration',html=>html.replace('</style>','a{display:none!important}</style>')],
 ['extra inline stylesheet',html=>html.replace('</head>','<style>a{display:none}</style></head>')],
 ['changed external stylesheet',html=>html.replace('ba425f4b503867d814bcd6848d8bb896.min.css','unknown.min.css')],
 ['changed stylesheet media',html=>html.replace('media="all"','media="print"')],
])test('Ola Electric current corporate style profile holds '+name,()=>{
 const changed=change(body)
 assert.notEqual(changed,body,'The control must mutate actual original bytes')
 assert.ok(corporateContract(changed,'olaelectric').reasons.includes('unreviewed-corporate-stylesheet-visibility'))
})

test('Ola Electric current styles cannot qualify a foreign recruitment delegation',()=>{
 const changed=body.replaceAll('https://olacareers.turbohire.co/dashboardv2','https://foreign.invalid/dashboardv2')
 assert.notEqual(changed,body)
 assert.equal(corporateContract(changed,'olaelectric').delegationVisible,false)
})
