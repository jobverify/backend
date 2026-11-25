import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentCelebalApi} from './currentPublicApi.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261125/current-declared.json.gz',import.meta.url))))
const CAREERS='https://celebaltech.com/careers',list=fixture.packets.find(p=>p.url.includes('/pages/careers-')),detail=fixture.packets.find(p=>p.url.includes('%5Bid%5D-'))
const body=url=>{const p=fixture.packets.find(p=>p.url===url);assert.ok(p,'Only genuine native declarations: '+url);const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),p.bodySHA256);return bytes.toString()}
const DONE=Object.freeze({stage:'after-reviewed-native-clients'})
async function replay(edit=text=>text){const calls=[];let afterClient=false,error
 try{await readCurrentCelebalApi({html:edit(body(CAREERS),CAREERS),now:()=>fixture.capturedAt,normalizeRole:()=>assert.fail('No role is admitted by this bounded client regression'),readText:async url=>{calls.push(url);if(afterClient)throw DONE;if(url===detail.url)afterClient=true;return edit(body(url),url)}})}catch(caught){error=caught}
 return{calls,error}
}
test('Celebal current exact list and detail clients reach the next native read without bundled fallback roles',async()=>{
 const result=await replay();assert.equal(result.error,DONE);assert.ok(result.calls.includes(list.url));assert.ok(result.calls.includes(detail.url))
})
for(const[label,client]of[['list',list],['detail',detail]])test('Celebal current '+label+' whole client bytes remain pinned',async()=>{
 const result=await replay((text,url)=>url===client.url?text+';unreviewedEmployerOverride()':text)
 assert.match(result.error?.message??'',/declared client program contract changed/)
})
for(const[label,edit]of[
 ['unreviewed list URL',text=>text.replaceAll('careers-091ce09ce7680f62.js','careers-ffffffffffffffff.js')],
 ['data-only list',text=>text.replace(/<script\b([^>]*src="[^"]*careers-091ce09ce7680f62\.js"[^>]*)>/,'<script type="application/json" $1>')],
 ['duplicate list',text=>text.replace('</head>','<script src="'+list.url+'"></script></head>')],
])test('Celebal current publisher rejects '+label,async()=>{
 const result=await replay((text,url)=>url===CAREERS?edit(text):text)
 assert.match(result.error?.message??'',/publisher surface|client contract/);assert.equal(result.calls.length,0)
})
test('Celebal current detail client remains bound to the same opening deployment',async()=>{
 const result=await replay((text,url)=>url.includes('/careers/')&&!url.endsWith('.js')?text.replaceAll('lUh58COLZgi2vV1yT7RiA','foreign-deployment'):text)
 assert.match(result.error?.message??'',/detail client handoff changed/);assert.ok(!result.calls.includes(detail.url))
})
for(const field of ['country','hiringOrganization'])test('Celebal current clients keep unknown native '+field+' authority held',async()=>{
 const result=await replay((text,url)=>{if(!url.endsWith('/getAllJobs'))return text;const value=JSON.parse(text);value.data[0][field]='Unreviewed authority';return JSON.stringify(value)})
 assert.match(result.error?.message??'',/native field contract changed/);assert.ok(!result.calls.includes(detail.url))
})
test('Celebal current client read preserves an opaque cancellation failure',async()=>{
 const reason=Object.freeze({cancel:'current-client-read'}),result=await replay((text,url)=>{if(url===list.url)throw reason;return text})
 assert.equal(result.error,reason)
})
