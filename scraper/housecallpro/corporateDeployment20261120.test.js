import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {corporateProgramme,CLIENT,sha} from './currentProgrammeData.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-corporate-20261120.json.gz',import.meta.url))))
const bytes=Buffer.from(fixture.bodyBase64,'base64'),html=bytes.toString('utf8')
assert.equal(fixture.bodyOriginalUnmodified,true)
assert.equal(sha(bytes),fixture.bodySHA256)

test('Housecall admits the coherent current 2.7.8 corporate deployment with its original declared native account',()=>{
 const model=corporateProgramme(html)
 assert.equal(model.currentDeclaredClient,CLIENT)
 assert.equal(model.canonicalSHA256,'db72ee6b31e5024dce3c7599c2ff090bc5b4ce732874c6cfde5fe57c6b3a0ad6')
 assert.equal(model.unknownDifferencesIgnored,false)
 assert.equal(model.externalVideoCriteriaAcquired,false)
 assert.equal(model.fragments.length,2)
})

for(const [name,from,to]of [
 ['different native account',CLIENT,CLIENT.replace('for=housecall','for=other')],
 ['changed native load callback','onload="greenhouseLoaded()"','onload="otherProgramme()"'],
 ['unknown release','"release":"2.7.8"','"release":"2.7.9"'],
 ['mixed old/new script deployment','greenhouse.js?ver=23354f20a7222687d5bf','greenhouse.js?ver=ea276f0f46f37675b9d8'],
 ['new role scope text','Black Friday: 50% off your first 3 months.','Hiring engineers in India.'],
])test('Housecall holds '+name+' outside the reviewed whole deployment',()=>{
 assert.ok(html.includes(from),'control targets actual retained original bytes')
 assert.throws(()=>corporateProgramme(html.replace(from,to)),/corporate|native client|programme/i)
})
