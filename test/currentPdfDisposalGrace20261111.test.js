import assert from 'node:assert/strict'
import test from 'node:test'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

// Authored complete task/document protocols with a controlled monotonic clock.
// The invalid sentinel and test-only first pass/empty graphics review do not
// supply native display, employer criteria, geography or inventory evidence.
async function scenario({reader,kind}){
  const {default:assert}=await import('node:assert/strict')
  const {registerHooks,syncBuiltinESMExports}=await import('node:module')
  const {pathToFileURL}=await import('node:url')
  const {getEventListeners}=await import('node:events')
  const {createHash}=await import('node:crypto')
  let networkAttempts=0
  const deny=()=>{networkAttempts++;throw Error('PDF disposal controls forbid real network')}
  globalThis.fetch=deny
  for(const name of ['node:http','node:https']){const module=(await import(name)).default;module.get=deny;module.request=deny}
  ;(await import('node:http2')).default.connect=deny
  const net=(await import('node:net')).default
  net.connect=deny;net.createConnection=deny;net.Socket.prototype.connect=deny
  ;(await import('node:tls')).default.connect=deny
  ;(await import('node:dgram')).default.createSocket=deny
  syncBuiltinESMExports()
  const permissions=Object.fromEntries(['addons','worker','child'].map(name=>[name,process.permission.has(name)]))
  assert.deepEqual(permissions,{addons:false,worker:false,child:false})
  assert.equal(typeof globalThis.DOMMatrix,'undefined')
  const sha=value=>createHash('sha256').update(value).digest('hex')
  registerHooks({resolve(specifier,context,next){
    if(specifier==='pdfjs-dist/legacy/build/pdf.mjs')return{url:'data:text/javascript,'+encodeURIComponent('export const getDocument=value=>globalThis.__disposalGraceFactory(value);export const OPS={};export const VerbosityLevel={ERRORS:0};'),shortCircuit:true}
    if(context.parentURL.endsWith('/scraper/logelite/pdfDocument.js')&&specifier==='../cdot/pdfDocument.js')return{url:'data:text/javascript,'+encodeURIComponent('export const readPublishedPdf=async()=>globalThis.__disposalGraceFirstPass();'),shortCircuit:true}
    if(context.parentURL.endsWith('/scraper/logelite/pdfDocument.js')&&specifier==='./pdfGraphicsReview.json')return{url:'data:application/json,'+encodeURIComponent(JSON.stringify({allowedGraphicsSHA256:[sha('[]')]})),shortCircuit:true}
    return next(specifier,context)
  }})
  const paths={BHEL:'scraper/bharatheavyelectricals/pdf20261107.js',BTL:'scraper/btlindia/currentPdf.js',Logelite:'scraper/logelite/pdfDocument.js'}
  const module=await import(pathToFileURL(process.cwd()+'/'+paths[reader]))
  const read=module.readBhelNativePdf??module.readCurrentBtlPdf??module.readLogelitePDF
  const dummy=Buffer.from('%PDF-1.7\n% Authored invalid disposal sentinel, not a native employer document. No native vacancy or visual proof.\n')
  const reflect=promise=>promise.then(value=>({ok:true,value}),reason=>({ok:false,reason}))
  const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
  const turn=()=>new Promise(resolve=>setImmediate(resolve))
  const bounded=async promise=>{
    let timer
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Independent2500ms disposal watchdog')),2500)})])}
    finally{clearTimeout(timer)}
  }
  const callerReasons=[['null',null],['false',false],['zero',0],['empty',''],['frozen',Object.freeze(Error('Authored frozen caller'))],['default',AbortSignal.abort().reason]]
  const primaryReasons=[['undefined',undefined],['null',null],['false',false],['zero',0],['empty',''],['frozen',Object.freeze(Error('Authored frozen primary'))]]
  const variants=kind==='primary-overrun'?primaryReasons:kind.startsWith('caller-')?callerReasons:[['ordinary',null]]
  const originalNow=performance.now,observations=[]
  try{
    for(const [index,[label,reason]]of variants.entries()){
      const caller=new AbortController(),entered=deferred(),late=deferred(),primary=kind==='primary-overrun'?reason:primaryReasons[index][1]
      let tasks=0,destroys=0,elapsed=0,settled=false
      performance.now=()=>elapsed
      const content={items:[{str:'Authored complete disposal model with retained source fields.',dir:'ltr',width:120,height:10,
        transform:[10,0,0,10,10,50],fontName:'g_d42_control',hasEOL:true}],styles:{g_d42_control:{fontFamily:'Authored'}},lang:'en'}
      const page={view:[0,0,200,200],rotate:0,userUnit:1,ref:{num:1,gen:0},isPureXfa:false,
        getTextContent:async()=>content,getOperatorList:async()=>({fnArray:[],argsArray:[]}),getAnnotations:async()=>[],
        getStructTree:async()=>({role:'Document',children:[]}),getJSActions:async()=>null}
      const document={numPages:1,fingerprints:['authored'],getMetadata:async()=>({info:{Title:'Authored exact source model'},metadata:{getRaw:()=>'<authored/>'}}),
        getOptionalContentConfig:async()=>new Map(),getOpenAction:async()=>null,getPage:async()=>page,getPermissions:async()=>[4],
        getMarkInfo:async()=>({Marked:true}),getPageLabels:async()=>['1'],getOutline:async()=>[],getAttachments:async()=>null,
        getFieldObjects:async()=>null,getJSActions:async()=>null,getCalculationOrderIds:async()=>[],getDestinations:async()=>({authored:[1,0]})}
      globalThis.__disposalGraceFirstPass=()=>({totalPages:1,pages:[{number:1,width:200,height:200,text:content.items[0].str,items:[],styles:{},annotations:[]}],
        text:content.items[0].str,sha256:sha(dummy),metadata:{info:{Title:'Authored exact source model'},xml:'<authored/>'},attachments:null,fields:null,actions:null,rendererFontAliases:[]})
      const factory=()=>{
        tasks++
        return{promise:['primary-overrun','caller-primary-overrun'].includes(kind)?Promise.reject(primary):Promise.resolve(document),destroy:()=>{
          destroys++;entered.resolve();elapsed=kind==='within-grace'?999:1001
          if(kind.startsWith('caller-'))caller.abort(reason)
          return ['unsettled-overrun','late-reject-overrun'].includes(kind)?late.promise:Promise.resolve()
        }}
      }
      globalThis.__disposalGraceFactory=factory
      const pending=reflect(read(dummy,{...(kind.startsWith('caller-')||kind==='primary-overrun'?{signal:caller.signal}:{}),...(reader==='Logelite'?{}:{loadDocument:factory})}))
      pending.then(()=>{settled=true})
      let outcome
      try{
        await bounded(entered.promise);await turn();await turn()
        assert.equal(settled,true,'elapsed disposal grace must settle without waiting for the timer callback')
        outcome=await bounded(pending)
        if(kind==='within-grace'){
          assert.equal(outcome.ok,true)
          const model=reader==='Logelite'?outcome.value.document:outcome.value
          assert.equal(reader==='Logelite'?model.totalPages:model.pageCount,1)
          assert.equal(model.metadata.info.Title,'Authored exact source model')
        }else{
          assert.equal(outcome.ok,false)
          if(kind==='primary-overrun')assert.equal(outcome.reason,primary)
          else if(kind.startsWith('caller-'))assert.equal(outcome.reason,reason)
          else assert.equal(outcome.reason?.code,'NATIVE_PDF_CLEANUP_TIMEOUT')
        }
        if(kind==='late-reject-overrun')late.reject(Object.freeze(Error('Authored late disposal failure')))
        else late.resolve()
        await turn();await turn()
        assert.equal(tasks,1);assert.equal(destroys,1)
        assert.equal(getEventListeners(caller.signal,'abort').length,0)
        observations.push({reason:label,tasks,destroys,settledBeforeTimer:true,ok:outcome.ok,exactExpectedResult:true})
      }finally{late.resolve()}
    }
  }finally{performance.now=originalNow}
  assert.equal(networkAttempts,0)
  console.log(JSON.stringify({reader,kind,syntheticProtocolOnly:true,permissions,networkAttempts,observations}))
}

const backend=fileURLToPath(new URL('../',import.meta.url))
const run=(reader,kind)=>{
  const result=spawnSync(process.execPath,['--permission','--allow-fs-read='+backend,'--unhandled-rejections=strict','--input-type=module','--eval',
    '('+scenario.toString()+')('+JSON.stringify({reader,kind})+')'],{cwd:backend,env:{...process.env,NODE_OPTIONS:''},encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:1024*1024})
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr||result.stdout)
  const receipt=JSON.parse(result.stdout)
  assert.equal(receipt.networkAttempts,0);assert.deepEqual(receipt.permissions,{addons:false,worker:false,child:false})
}
for(const reader of ['BHEL','BTL','Logelite'])for(const kind of ['resolved-overrun','unsettled-overrun','late-reject-overrun','within-grace','primary-overrun','caller-overrun','caller-primary-overrun']){
  test(`${reader} native PDF disposal grace: ${kind}`,()=>run(reader,kind))
}
