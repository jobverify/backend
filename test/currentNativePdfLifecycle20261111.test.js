import assert from 'node:assert/strict'
import test from 'node:test'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

// Each scenario runs in a strict, restricted process. The injected document
// and reviewed empty graphics program are authored protocol controls only:
// no retained employer PDF, native display capability or DOMMatrix substitute.
async function scenario({reader,kind}) {
  const {default:assert}=await import('node:assert/strict')
  const {registerHooks,syncBuiltinESMExports}=await import('node:module')
  const {pathToFileURL}=await import('node:url')
  const {createHash}=await import('node:crypto')
  let networkAttempts=0
  const deny=()=>{networkAttempts++;throw Error('Protocol controls forbid real network')}
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
  const ops={save:1,restore:2,setTextRenderingMode:3,setGState:4,showText:5,showSpacedText:6,
    nextLineShowText:7,nextLineSetSpacingShowText:8,dependency:9,setFont:10,unreviewedControlOperation:11}
  const pdfModule='data:text/javascript,'+encodeURIComponent('export const getDocument=value=>globalThis.__currentPdfFactory(value);export const OPS='+JSON.stringify(ops)+';export const VerbosityLevel={ERRORS:0};')
  const emptyGraphicsReview='data:application/json,'+encodeURIComponent(JSON.stringify({allowedGraphicsSHA256:[sha('[]')]}))
  registerHooks({resolve(specifier,context,next){
    if(specifier==='pdfjs-dist/legacy/build/pdf.mjs')return{url:pdfModule,shortCircuit:true}
    if(specifier==='./pdfGraphicsReview.json'&&context.parentURL.endsWith('/scraper/logelite/pdfDocument.js'))return{url:emptyGraphicsReview,shortCircuit:true}
    return next(specifier,context)
  }})
  const relative=({BHEL:'scraper/bharatheavyelectricals/pdf20261107.js',BTL:'scraper/btlindia/currentPdf.js',Logelite:'scraper/logelite/pdfDocument.js'})[reader]
  const module=await import(pathToFileURL(process.cwd()+'/'+relative))
  const read=module.readBhelNativePdf??module.readCurrentBtlPdf??module.readLogelitePDF
  const dummy=Buffer.from('%PDF-1.7\n% Authored invalid protocol sentinel, not an employer PDF. No native display, geography, criteria or vacancy evidence is claimed.\n')
  const reflect=promise=>promise.then(value=>({status:'fulfilled',value}),reason=>({status:'rejected',reason}))
  const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes});return{promise,resolve}}
  const turn=()=>new Promise(resolve=>setImmediate(resolve))
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
  const bounded=async promise=>{
    let timer
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Independent 2500ms lifecycle watchdog')),2500)})])}
    finally{clearTimeout(timer)}
  }
  const reasons=[['false',false],['zero',0],['empty',''],['null',null],
    ['frozen',Object.freeze(Error('Authored frozen caller reason'))],['native-default',AbortSignal.abort().reason]]
  const repeated=['preabort','init-abort','init-abort-reject','init-abort-throw','stage-abort-reject','stage-abort-throw',
    'abort-cleanup','between-passes','falsy-primary-cleanup-reject'].includes(kind)
  const observations=[]
  for(const [label,reason]of repeated?reasons:[['ordinary',Object.freeze(Error('Authored ordinary parser error'))]]){
    const caller=new AbortController(),original=Object.freeze(Error('Authored original parser error')),
      replacement=Object.freeze(Error('Authored replacement error')),cleanup=Object.freeze(Error('Authored cleanup error'))
    const entered=deferred(),late=deferred(),closing=deferred(),release=deferred(),target=reader==='Logelite'?2:1
    let initialized=0,ownedDestroyed=0,firstDestroyed=0,ownedClosed=0,lateAdmissions=0,lateDocumentTouches=0,returned=false
    const calls={metadata:0,optional:0,text:0,operators:0,pageActions:0}
    const page=active=>({view:[0,0,200,200],rotate:0,userUnit:1,ref:{num:1,gen:0},isPureXfa:false,
      getTextContent:()=>{
        if(active)calls.text++
        const content={items:[{str:'Authored complete protocol document text; no employer evidence.',dir:'ltr',width:120,height:10,
          transform:[10,0,0,10,10,50],fontName:'g_d42_control',hasEOL:true}],styles:{g_d42_control:{fontFamily:'Control'}},lang:'en'}
        if(active&&kind==='late-page'&&reader!=='Logelite'){entered.resolve();return late.promise.then(()=>content)}
        return Promise.resolve(content)
      },
      getOperatorList:()=>{
        if(active){calls.operators++;if(returned)lateAdmissions++}
        if(active&&kind==='late-page'&&reader==='Logelite'){entered.resolve();return late.promise.then(()=>({fnArray:[],argsArray:[]}))}
        return Promise.resolve(kind==='model-guard'&&active?{fnArray:[ops.unreviewedControlOperation],argsArray:[[]]}:{fnArray:[],argsArray:[]})
      },
      getAnnotations:async()=>[],getStructTree:async()=>({role:'Document',children:[]}),
      getJSActions:async()=>{if(active){calls.pageActions++;if(returned)lateAdmissions++}return null},
    })
    const document=active=>({numPages:1,fingerprints:['authored-fingerprint'],
      getMetadata:async()=>{if(active)calls.metadata++;return{info:{Title:'Authored control',Custom:{criterion:'Keep exact source data'}},metadata:{getRaw:()=>'<control/>'},contentLength:dummy.length}},
      getOptionalContentConfig:()=>{
        if(active)calls.optional++
        if(active&&kind==='stage-abort-reject'){caller.abort(reason);return Promise.reject(replacement)}
        if(active&&kind==='stage-abort-throw'){caller.abort(reason);throw replacement}
        return Promise.resolve(new Map())
      },
      getOpenAction:async()=>null,getPage:async()=>page(active),getPermissions:async()=>[4],getMarkInfo:async()=>({Marked:true}),
      getPageLabels:async()=>['1'],getOutline:async()=>[],getAttachments:async()=>null,getFieldObjects:async()=>null,
      getJSActions:async()=>null,getCalculationOrderIds:async()=>[],getDestinations:async()=>({control:[1,0]}),
    })
    const factory=()=>{
      const index=++initialized,active=index===target
      if(active&&kind==='init-throw')throw original
      if(active&&kind==='init-abort-throw'){caller.abort(reason);throw replacement}
      if(active&&['init-abort','init-abort-reject'].includes(kind))caller.abort(reason)
      let promise=Promise.resolve(document(active))
      if(active&&kind==='late-loading'){promise=late.promise;entered.resolve()}
      if(active&&['primary-cleanup-reject','primary-cleanup-hang'].includes(kind))promise=Promise.reject(original)
      if(active&&kind==='falsy-primary-cleanup-reject')promise=Promise.reject(reason)
      if(active&&kind==='init-abort-reject')promise=Promise.reject(replacement)
      return{promise,destroy:()=>{
        if(!active){firstDestroyed++;if(kind==='between-passes')caller.abort(reason);return Promise.resolve()}
        ownedDestroyed++;closing.resolve()
        if(['primary-cleanup-reject','falsy-primary-cleanup-reject','success-cleanup-reject'].includes(kind))return Promise.reject(cleanup)
        if(['primary-cleanup-hang','success-cleanup-hang','delayed-cleanup','abort-cleanup'].includes(kind)){
          if(kind==='abort-cleanup')caller.abort(reason)
          return release.promise.then(()=>{ownedClosed++})
        }
        ownedClosed++;return Promise.resolve()
      }}
    }
    globalThis.__currentPdfFactory=factory
    if(kind==='preabort')caller.abort(reason)
    const pending=reflect(read(dummy,{signal:caller.signal,...(reader==='Logelite'?{}:{loadDocument:factory})}))
    let outcome
    if(kind==='late-loading'||kind==='late-page'){
      await bounded(entered.promise);caller.abort(false);outcome=await bounded(pending);returned=true
      assert.equal(outcome.reason,false)
      if(kind==='late-loading')late.resolve({get numPages(){lateDocumentTouches++;return 1}})
      else late.resolve()
      await turn();await turn()
      assert.equal(lateAdmissions,0);assert.equal(lateDocumentTouches,0)
    }else if(kind==='delayed-cleanup'){
      await bounded(closing.promise)
      let settled=false;pending.then(()=>{settled=true});await pause(20)
      assert.equal(settled,false,'caller must wait for owned cleanup while it is within the grace')
      release.resolve();outcome=await bounded(pending);assert.equal(outcome.status,'fulfilled');assert.equal(ownedClosed,1)
    }else{
      try{outcome=await bounded(pending)}finally{release.resolve()}
    }
    if(kind==='preabort'){assert.equal(outcome.reason,reason);assert.equal(initialized,0);assert.equal(ownedDestroyed,0)}
    else if(['init-abort','init-abort-reject','init-abort-throw','stage-abort-reject','stage-abort-throw','abort-cleanup','between-passes'].includes(kind)){
      assert.equal(outcome.status,'rejected');assert.equal(outcome.reason,reason)
      if(kind==='between-passes'){assert.equal(initialized,1);assert.equal(firstDestroyed,1);assert.equal(ownedDestroyed,0)}
      else assert.equal(ownedDestroyed,kind==='init-abort-throw'?0:1)
    }else if(['init-throw','primary-cleanup-reject','primary-cleanup-hang'].includes(kind)){
      assert.equal(outcome.status,'rejected');assert.equal(outcome.reason,original)
      assert.equal(ownedDestroyed,kind==='init-throw'?0:1)
    }else if(kind==='falsy-primary-cleanup-reject'){assert.equal(outcome.status,'rejected');assert.equal(outcome.reason,reason);assert.equal(ownedDestroyed,1)}
    else if(kind==='success-cleanup-reject'){assert.equal(outcome.status,'rejected');assert.equal(outcome.reason,cleanup);assert.equal(ownedDestroyed,1)}
    else if(kind==='success-cleanup-hang'){assert.equal(outcome.status,'rejected');assert.equal(outcome.reason?.code,'NATIVE_PDF_CLEANUP_TIMEOUT');assert.equal(ownedDestroyed,1)}
    else if(kind==='model-guard'){
      if(reader==='Logelite'){assert.equal(outcome.status,'rejected');assert.match(outcome.reason.message,/new native PDF vector\/artwork program requires review/)}
      else{assert.equal(outcome.status,'fulfilled');assert.equal(outcome.value.pageModels[0].operatorList.fnArray[0],ops.unreviewedControlOperation)}
    }else if(kind==='model'){
      assert.equal(outcome.status,'fulfilled')
      const model=reader==='Logelite'?outcome.value.document:outcome.value
      assert.match(model.text,/Authored complete protocol document text/)
      assert.equal(reader==='Logelite'?model.totalPages:model.pageCount,1)
      assert.equal(model.metadata.info.Custom.criterion,'Keep exact source data')
      if(reader==='Logelite'){
        assert.deepEqual(model.pages[0].graphicsOperations,[]);assert.equal(model.pages[0].graphicsSHA256,sha('[]'))
        assert.deepEqual(model.pages[0].images,[]);assert.equal(model.openAction,null)
      }else{
        assert.deepEqual(model.pageModels[0].textContent.items[0].transform,[10,0,0,10,10,50])
        assert.equal(model.pageModels[0].textContent.items[0].fontName,'control')
        assert.deepEqual(model.permissions,[4]);assert.deepEqual(model.destinations,{control:[1,0]})
        assert.equal(model.renderedCriteriaVisibilityQualified,false);assert.equal(model.publicationDateQualified,false)
      }
      assert.equal(ownedDestroyed,1)
    }
    await turn();await turn()
    observations.push({reason:label,initialized,ownedDestroyed,firstDestroyed,lateAdmissions,lateDocumentTouches,status:outcome.status,calls})
  }
  assert.equal(networkAttempts,0)
  console.log(JSON.stringify({reader,kind,syntheticProtocolOnly:true,authoredGraphicsReviewOnly:true,permissions,networkAttempts,observations}))
}

const backend=fileURLToPath(new URL('../',import.meta.url))
const run=(reader,kind)=>{
  const script='('+scenario.toString()+')('+JSON.stringify({reader,kind})+')'
  const result=spawnSync(process.execPath,['--permission','--allow-fs-read='+backend,'--unhandled-rejections=strict','--input-type=module','--eval',script],{
    cwd:backend,encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:1024*1024,
    // The child embeds its own network guard inside its allowed filesystem.
    env:{...process.env,NODE_OPTIONS:''},
  })
  assert.equal(result.error,undefined)
  assert.equal(result.status,0,result.stderr||result.stdout)
  const receipt=JSON.parse(result.stdout)
  assert.equal(receipt.networkAttempts,0)
  assert.deepEqual(receipt.permissions,{addons:false,worker:false,child:false})
}
for(const reader of ['BHEL','BTL','Logelite'])for(const kind of [
  'preabort','init-abort','init-abort-reject','init-abort-throw','init-throw','stage-abort-reject','stage-abort-throw',
  'late-loading','late-page','primary-cleanup-reject','falsy-primary-cleanup-reject','success-cleanup-reject',
  'primary-cleanup-hang','success-cleanup-hang','delayed-cleanup','abort-cleanup','model','model-guard',
])test(`${reader} strict native PDF lifecycle: ${kind}`,()=>run(reader,kind))
test('Logelite cancellation between native passes starts no second task and leaves no orphan rejection',()=>run('Logelite','between-passes'))
