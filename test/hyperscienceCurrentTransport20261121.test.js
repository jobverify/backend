import test from 'node:test'
import assert from 'node:assert/strict'
import {setTimeout as delay} from 'node:timers/promises'
import {runCurrentHyperscienceProgramme} from '../scraper/hyperscience/currentProgramme.js'
const url='https://www.hyperscience.ai/about-us/careers/'
function response({status=403,finalURL=url,type='text/html',cancel=()=>Promise.resolve(),reader=()=>{throw Error('rejected metadata entity must not be read')}}={}){
 return{status,url:finalURL,headers:new Headers({'content-type':type}),body:{cancel,getReader:reader}}
}
for(const [name,options,status]of[
 ['403',{status:403},403],['429',{status:429},429],['manual redirect',{status:302},302],
 ['wrong final URL',{status:403,finalURL:'https://foreign.example/'},403],['wrong MIME',{status:200,type:'text/htmlx'},200],
])test('metadata-first '+name+' rejects without reading and awaits owned cleanup',async()=>{
 let reads=0,cancels=0,held;const start=performance.now()
 try{await runCurrentHyperscienceProgramme({requestIntervalMs:0,requestTimeoutMs:10,fetchImpl:async()=>response({...options,reader:()=>{reads++;throw Error('reader must not be called')},cancel:async()=>{cancels++;await delay(30)}})})}catch(e){held=e}
 assert.equal(reads,0);assert.equal(cancels,1);assert.ok(performance.now()-start>=25)
 assert.equal(held.status,status)
 if([403,429].includes(status)&&name!=='wrong final URL')assert.equal(held.failureKind,'blocked_or_access_denied')
 if(name==='wrong final URL')assert.equal(held.failureKind,'parser_or_contract_error')
})
test('caller frozen reason wins after asynchronous metadata cleanup',async()=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'hyperscience-caller'});let canceled=0,held
 const timer=setTimeout(()=>controller.abort(reason),5)
 try{await runCurrentHyperscienceProgramme({signal:controller.signal,requestIntervalMs:0,fetchImpl:async()=>response({cancel:async()=>{await delay(30);canceled++}})})}catch(e){held=e}finally{clearTimeout(timer)}
 assert.equal(canceled,1);assert.equal(held,reason)
})
test('late acquired response is disposed before exact opaque caller failure settles',async()=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'late-hyperscience-caller'});let canceled=0,reads=0,held
 const timer=setTimeout(()=>controller.abort(reason),5),start=performance.now()
 try{await runCurrentHyperscienceProgramme({signal:controller.signal,requestIntervalMs:0,fetchImpl:async()=>{await delay(20);return response({status:200,reader:()=>{reads++;throw Error('late body must not read')},cancel:async()=>{await delay(30);canceled++}})}})}catch(e){held=e}finally{clearTimeout(timer)}
 assert.equal(held,reason);assert.equal(canceled,1);assert.equal(reads,0);assert.ok(performance.now()-start>=40)
})
test('request/source close checks opaque caller ownership after abort listeners run',async()=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'final-close'});let held
 try{await runCurrentHyperscienceProgramme({signal:controller.signal,requestIntervalMs:0,fetchImpl:async(_url,init)=>{
  init.signal.addEventListener('abort',()=>controller.abort(reason),{once:true})
  return response()
 }})}catch(e){held=e}
 assert.equal(held,reason)
})

test('late acquired response after request deadline is awaited and disposed without entity read',async()=>{
 let canceled=0,reads=0,requests=0,held;const start=performance.now()
 try{await runCurrentHyperscienceProgramme({requestIntervalMs:0,requestTimeoutMs:10,fetchImpl:async()=>{
  requests++;await delay(20);return response({status:200,reader:()=>{reads++;throw Error('expired body must not read')},cancel:async()=>{await delay(30);canceled++}})
 }})}catch(e){held=e}
 assert.equal(held.name,'TimeoutError');assert.equal(canceled,1);assert.equal(reads,0);assert.equal(requests,1);assert.ok(performance.now()-start>=40)
})
test('owned settlement never assimilates an opaque rejected reason',async()=>{
 let hooks=0,held;const reason={}
 Object.defineProperty(reason,'then',{get(){hooks++;return undefined}})
 try{await runCurrentHyperscienceProgramme({requestIntervalMs:0,fetchImpl:()=>Promise.reject(reason)})}catch(e){held=e}
 assert.equal(hooks,0);assert.equal(held.nativeCollectionEvidence.allChannelsClosed,false)
})

for(const status of [403,429])test('late known HTTP '+status+' retains denial over local deadline after awaited disposal',async()=>{
 let canceled=0,reads=0,requests=0,held;const start=performance.now()
 try{await runCurrentHyperscienceProgramme({requestIntervalMs:0,requestTimeoutMs:10,fetchImpl:async()=>{requests++;await delay(20);return response({status,reader:()=>{reads++;throw Error('late denial must not read')},cancel:async()=>{await delay(30);canceled++}})}})}catch(error){held=error}
 assert.equal(held.status,status);assert.equal(held.failureKind,'blocked_or_access_denied');assert.equal(reads,0);assert.equal(canceled,1);assert.equal(requests,1);assert.ok(performance.now()-start>=40)
})
