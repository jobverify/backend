import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {verifyCurrentDocumentActivation} from './currentPublisher.js'

// Original portable fixture remains byte-exact. New issued-data values below
// are synthetic static-parser controls, never credentials or executed programs.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-publisher-20261106.json.gz',import.meta.url))))
const original=fixture.packets.filter(p=>['https://gcore.com/careers','https://gcore.com/open-positions'].includes(p.requestedURL))
const paths={
 0:['body.0.expression.callee.body.body.0.consequent.body.1.declarations.1.init'],
 3:['body.2.body.body.0.argument.left.arguments.0','body.2.body.body.0.argument.right.arguments.0'],
 4:['body.4.declarations.0.init.body.body.9.expression.right.body.body.1.expression.right.right','body.4.declarations.0.init.body.body.10.expression.right.body.body.8.alternate.expression.arguments.0','body.6.body.body.0.block.body.3.consequent.body.0.expression.arguments.1.right.arguments.0','body.6.body.body.0.block.body.15.expression.right.left.right.right'],
}
const sha=s=>createHash('sha256').update(s).digest('hex')
const walk=n=>[n,...n.children.filter(x=>typeof x!=='string').flatMap(walk)]
const scripts=html=>{const doc=readNativeDocument(html);return walk(doc.nodes(n=>n.tag==='root')[0]).filter(n=>n.tag==='script')}
const nodeAt=(text,slot,index)=>paths[slot][index].split('.').reduce((n,k)=>n[k],parse(text,{ecmaVersion:'latest',sourceType:'script'}))
function literal(html,slot,index,replace){
 const text=scripts(html)[slot].raw,node=nodeAt(text,slot,index)
 const changed=text.slice(0,node.start)+replace(node.value,text.slice(node.start,node.end))+text.slice(node.end)
 return html.replace(text,changed)
}
function synthetic(html){
 html=literal(html,0,0,()=>JSON.stringify('a'.repeat(32)))
 html=literal(html,3,0,()=> '65')
 html=literal(html,3,1,()=> '122')
 html=literal(html,4,0,value=>"'"+value.replace(/(expires=)[^;]*/i,'$1Wed, 31-Dec-25 23:59:59 GMT')+"'")
 html=literal(html,4,1,value=>JSON.stringify(value.slice(0,3)+'b'.repeat(35)))
 html=literal(html,4,2,()=>JSON.stringify('c'.repeat(32)))
 return literal(html,4,3,()=> '1735689600')
}
const assertRejected=(html,url)=>assert.throws(()=>verifyCurrentDocumentActivation(html,url),error=>error.failureKind==='surface_drift_or_fail_closed'&&error.softFailure===true&&error.abortRetries===true,'unreviewed static activation must fail closed')
for(const packet of original)test('static typed activation accepts original and safe synthetic data on '+packet.requestedURL,()=>{
 assert.equal(sha(packet.body),packet.sha256)
 const raw=verifyCurrentDocumentActivation(packet.body,packet.requestedURL)
 const changed=synthetic(packet.body)
 const signature=verifyCurrentDocumentActivation(changed,packet.requestedURL)
 assert.equal(/^[a-f0-9]{64}$/.test(signature),true)
 assert.notEqual(signature,raw,'return actual changed raw signature, not the class signature')
 assert.equal(verifyCurrentDocumentActivation(changed,packet.requestedURL),signature)
})
const packet=original.find(p=>p.requestedURL==='https://gcore.com/careers')
const clean=()=>synthetic(packet.body)
for(const [name,slot,index,change]of[
 ['slot0 excluded zero sentinel',0,0,()=>JSON.stringify('0'.repeat(32))],
 ['slot0 uppercase',0,0,()=>JSON.stringify('A'.repeat(32))],
 ['slot0 short',0,0,()=>JSON.stringify('a'.repeat(31))],
 ['slot0 escaped raw',0,0,()=> '"\\u0061'+'a'.repeat(31)+'"'],
 ['slot0 single quote',0,0,()=>"'"+'a'.repeat(32)+"'"],
 ['charcode before uppercase',3,0,()=> '64'],
 ['charcode after uppercase',3,0,()=> '91'],
 ['charcode before lowercase',3,1,()=> '96'],
 ['charcode after lowercase',3,1,()=> '123'],
 ['charcode exponent',3,0,()=> '6.5e1'],
 ['charcode hexadecimal',3,0,()=> '0x41'],
 ['charcode string',3,0,()=> '"65"'],
 ['cookie invalid day',4,0,v=>"'"+v.replace(/(expires=)[^;]*/i,'$1Mon, 31-Feb-25 23:59:59 GMT')+"'"],
 ['cookie wrong weekday',4,0,v=>"'"+v.replace(/(expires=)[^;]*/i,'$1Thu, 31-Dec-25 23:59:59 GMT')+"'"],
 ['cookie extra directive',4,0,v=>"'"+v+';secure'+"'"],
 ['cookie double quote',4,0,v=>JSON.stringify(v)],
 ['cookie escape',4,0,v=>"'\\x20"+v.slice(1)+"'"],
 ['fallback prefix drift',4,1,v=>JSON.stringify('xyz'+v.slice(3))],
 ['fallback uppercase',4,1,v=>JSON.stringify(v.slice(0,3)+'B'.repeat(35))],
 ['fallback short',4,1,v=>JSON.stringify(v.slice(0,-1))],
 ['fallback single quote',4,1,v=>"'"+v+"'"],
 ['hash uppercase',4,2,()=>JSON.stringify('C'.repeat(32))],
 ['hash short',4,2,()=>JSON.stringify('c'.repeat(31))],
 ['hash escaped raw',4,2,()=> '"\\u0063'+'c'.repeat(31)+'"'],
 ['timestamp string',4,3,()=> '"1735689600"'],
 ['timestamp nine digits',4,3,()=> '735689600'],
 ['timestamp eleven digits',4,3,()=> '11735689600'],
 ['timestamp exponent',4,3,()=> '1.7356896e9'],
 ['timestamp fraction',4,3,()=> '1735689600.0'],
])test('static typed activation rejects '+name,()=>assertRejected(literal(clean(),slot,index,change),packet.requestedURL))
for(const slot of [0,3,4])for(const [name,addition]of[
 ['comment','/* unreviewed source comment */'],
 ['whitespace',' '],
 ['DOM removal',';document.querySelector("[data-angular-vacancies]").remove();'],
 ['other literal',';void 1;'],
])test('whole source frame rejects '+name+' in slot'+slot,()=>{
 const html=clean(),text=scripts(html)[slot].raw
 assertRejected(html.replace(text,text+addition),packet.requestedURL)
})
for(const [name,mutate]of[
 ['added script',html=>html.replace('<head>','<head><script type="application/json">{}</script>')],
 ['hidden added script',html=>html.replace('<head>','<head><script hidden>void 0</script>')],
 ['inert added script',html=>html.replace('<head>','<head><div inert><script>void 0</script></div>')],
 ['script attribute',html=>html.replace('<script','<script data-unreviewed="true"')],
 ['base target',html=>html.replace('<base href="/">','<base href="/" target="_blank">')],
 ['added hidden base',html=>html.replace('<head>','<head><base hidden href="/">')],
 ['added event',html=>html+'<div hidden onclick="void 0"></div>'],
 ['added iframe',html=>html+'<iframe hidden src="about:blank"></iframe>'],
 ['refresh',html=>html.replace('<head>','<head><meta http-equiv="refresh" content="0;url=/">')],
 ['script URL',html=>html.replace('/main-O7XHEPYM.js','https://unrelated.invalid/main-O7XHEPYM.js')],
])test('whole activation carrier rejects '+name,()=>assertRejected(mutate(clean()),packet.requestedURL))
test('static typed activation does not accept an unreviewed URL class',()=>assertRejected(clean(),'https://gcore.com/unreviewed'))
