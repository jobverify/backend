import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readJasperCorporate} from './currentProgrammeData.js'
globalThis.fetch=()=>assert.fail('Structured carrier controls forbid publisher HTTP')
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-corporate-20261121.json.gz',import.meta.url))))
const original=Buffer.from(fixture.bodyBase64,'base64').toString()
const sha=body=>createHash('sha256').update(body).digest('hex')
const role=JSON.stringify({'@context':'https://schema.org','@type':'JobPosting',title:'India engineer',jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'India'}}})
const read=edit=>{const text=edit(original);assert.notEqual(text,original);const body=Buffer.from(text);return readJasperCorporate({...structuredClone(fixture.receipt),body,bodyBytes:body.length,bodySHA256:sha(body),consumedBodyBytes:body.length})}
const insert=html=>source=>source.replace('</body>',html+'</body>')
const cases=[
 ['parameterized JSON-LD','<script type="application/ld+json; charset=utf-8">'+role+'</script>'],
 ['case/quoted-parameter JSON-LD','<script type="Application/LD+JSON; charset=&quot;UTF-8&quot;">'+role+'</script>'],
 ['inert parameterized JSON-LD','<div inert><script type="application/ld+json; charset=utf-8">'+role+'</script></div>'],
 ['hidden parameterized JSON-LD','<script hidden type="application/ld+json; charset=utf-8">'+role+'</script>'],
 ['duplicate MIME carrier','<script type="application/json" type="application/ld+json; charset=utf-8">'+role+'</script>'],
 ['native microdata','<div itemscope itemtype="https://schema.org/JobPosting"><span itemprop="title">India engineer</span><meta itemprop="applicantLocationRequirements" content="India"></div>'],
 ['hidden native microdata','<div hidden itemscope itemtype="https://schema.org/JobPosting"><span itemprop="title">India engineer</span></div>'],
 ['duplicate microdata type','<div itemscope itemtype="https://schema.org/AboutPage" itemtype="https://schema.org/JobPosting"><span itemprop="title">India engineer</span></div>'],
 ['native RDFa role','<div vocab="https://schema.org/" typeof="JobPosting"><span property="title">India engineer</span></div>'],
]
for(const[name,markup]of cases)test('additional authored '+name+' holds before any native zero can qualify',()=>assert.throws(()=>read(insert(markup)),error=>error.code==='JASPER_PROGRAMME_HOLD'&&error.reason==='corporate-programme'))

test('semantic JSON-LD MIME parameters retain the genuine corporate employer/context',()=>{
 const result=read(source=>source.replace('type="application/ld+json"','type="Application/LD+JSON; charset=&quot;UTF-8&quot;"'))
 assert.equal(result.ordinaryHandoffs.length,2)
 assert.equal(result.originalStructuredCorporateContext[0].about.name,'Jasper')
 assert.equal(result.lifecycleCleanupAllowed,false)
 assert.equal(result.companyGlobalScopeQualified,false)
 assert.ok(result.originalDeclarations.some(row=>row.tag==='script'&&row.attributes.type==='Application/LD+JSON; charset="UTF-8"'))
})
