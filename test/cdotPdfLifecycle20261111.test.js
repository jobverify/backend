import assert from 'node:assert/strict'
import test from 'node:test'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {pdfBoxText} from '../scraper/cdot/pdfDocument.js'

// Authored task/document protocols in strict restricted processes only. The
// sentinel is invalid PDF data and no native display, employer or criteria
// evidence is provided by the test-only import hook. No DOMMatrix substitute.
async function scenario({kind}) {
  const {default:assert}=await import('node:assert/strict')
  const {registerHooks,syncBuiltinESMExports}=await import('node:module')
  const {getEventListeners}=await import('node:events')
  const {pathToFileURL}=await import('node:url')
  const {createHash}=await import('node:crypto')
  let networkAttempts=0
  const deny=()=>{networkAttempts++;throw Error('CDOT protocol test forbids real network')}
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
  registerHooks({resolve(specifier,context,next){
    if(specifier==='pdfjs-dist/legacy/build/pdf.mjs')return{url:'data:text/javascript,'+encodeURIComponent('export const getDocument=value=>globalThis.__cdotProtocolFactory(value);'),shortCircuit:true}
    return next(specifier,context)
  }})
  const {readPublishedPdf}=await import(pathToFileURL(process.cwd()+'/scraper/cdot/pdfDocument.js'))
  const dummy=Buffer.from('%PDF-1.7\n% Authored invalid CDOT lifecycle sentinel, not a native employer PDF. No geography, criteria or native visual proof is supplied.\n')
  const sha=value=>createHash('sha256').update(value).digest('hex')
  const reflect=promise=>promise.then(value=>({ok:true,value}),reason=>({ok:false,reason}))
  const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes});return{promise,resolve}}
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
  const turn=()=>new Promise(resolve=>setImmediate(resolve))
  const within=async promise=>{
    let timer
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Independent2500ms lifecycle watchdog')),2500)})])}
    finally{clearTimeout(timer)}
  }
  const reasons=[['null',null],['false',false],['zero',0],['empty',''],['frozen',Object.freeze(Error('Authored frozen caller'))],['default',AbortSignal.abort().reason]]
  const falsy=[['undefined',undefined],['null',null],['false',false],['zero',0],['empty',''],['frozen',Object.freeze(Error('Authored original error'))]]
  const repeated=['preabort','init-abort','init-abort-reject','init-abort-throw','page-abort-throw','text-abort-reject',
    'annotation-abort-throw','metadata-abort-return','abort-cleanup'].includes(kind)
  const identities=['primary-cleanup-reject','success-cleanup-reject'].includes(kind)
  const observations=[]
  for(const [label,reason]of repeated?reasons:identities?falsy:[['ordinary',Object.freeze(Error('Authored original error'))]]){
    const caller=new AbortController(),replacement=Object.freeze(Error('Authored replacement error')),
      primary=identities?reason:Object.freeze(Error('Authored parser failure')),cleanup=kind==='success-cleanup-reject'?reason:Object.freeze(Error('Authored cleanup failure'))
    const entered=deferred(),late=deferred(),closing=deferred(),release=deferred()
    const annotations=[{subtype:'Link',url:'mailto:authored@example.test',contentsObj:{str:'Authored annotation'}}]
    let initialized=0,destroyed=0,closed=0,returned=false,lateAdmissions=0,lateDocumentTouches=0,settled=false,options
    const calls={page:0,text:0,annotations:0,attachments:0}
    const content={items:[{str:'Authored complete CDOT protocol text and exact display geometry.',transform:[10,0,0,10,10,50],width:120,height:10,
      fontName:'g_d42_control',dir:'ltr',hasEOL:true}],styles:{g_d42_control:{fontFamily:'Authored control',ascent:.9}}}
    const page={view:[0,0,200,100],getTextContent:()=>{
      calls.text++
      if(kind==='text-abort-reject'){caller.abort(reason);return Promise.reject(replacement)}
      if(kind==='late-page'){entered.resolve();return late.promise.then(()=>content)}
      return Promise.resolve(kind==='short-text'?{...content,items:[{...content.items[0],str:'Short'}]}:content)
    },getAnnotations:()=>{
      calls.annotations++;if(returned)lateAdmissions++
      if(kind==='annotation-abort-throw'){caller.abort(reason);throw replacement}
      return Promise.resolve(annotations)
    }}
    const doc={numPages:kind==='page-bound'?101:1,getPage:()=>{
      calls.page++
      if(kind==='page-abort-throw'){caller.abort(reason);throw replacement}
      return Promise.resolve(page)
    },getMetadata:()=>{
      if(kind==='metadata-abort-return')caller.abort(reason)
      return Promise.resolve({info:{Title:'Authored CDOT control',Custom:{retained:'Exact source facts'}},metadata:{getRaw:()=>'<authored/>'}})
    },getAttachments:async()=>{calls.attachments++;return kind==='attachments'?{unreviewed:{filename:'authored.bin'}}:null},
    getFieldObjects:async()=>kind==='fields'?{unreviewed:[]}:null,getJSActions:async()=>kind==='actions'?{unreviewed:[]}:null}
    const originalNow=performance.now
    let elapsed=0
    if(['sync-cleanup-overrun','unsettled-cleanup-overrun'].includes(kind))performance.now=()=>elapsed
    globalThis.__cdotProtocolFactory=value=>{
      initialized++;options=value
      if(kind==='init-abort-throw'){caller.abort(reason);throw replacement}
      if(['init-abort','init-abort-reject'].includes(kind))caller.abort(reason)
      let promise=Promise.resolve(doc)
      if(['primary-cleanup-reject','primary-cleanup-hang','primary-delayed-cleanup'].includes(kind))promise=Promise.reject(primary)
      if(kind==='init-abort-reject')promise=Promise.reject(replacement)
      if(kind==='late-loading'){promise=late.promise;entered.resolve()}
      return{promise,destroy:()=>{
        destroyed++;closing.resolve()
        if(['sync-cleanup-overrun','unsettled-cleanup-overrun'].includes(kind))elapsed=1001
        if(kind==='abort-cleanup')caller.abort(reason)
        if(['primary-cleanup-reject','success-cleanup-reject','abort-cleanup'].includes(kind))return Promise.reject(cleanup)
        if(['primary-cleanup-hang','success-cleanup-hang','delayed-cleanup','primary-delayed-cleanup','unsettled-cleanup-overrun'].includes(kind))return release.promise.then(()=>{closed++})
        closed++;return Promise.resolve()
      }}
    }
    if(kind==='preabort')caller.abort(reason)
    const started=Date.now(),pending=reflect(readPublishedPdf(dummy,{signal:caller.signal}))
    pending.then(()=>{settled=true})
    let outcome
    try{
      if(['late-loading','late-page'].includes(kind)){
        await within(entered.promise);caller.abort(false);outcome=await within(pending);returned=true
        assert.equal(outcome.ok,false);assert.equal(outcome.reason,false)
        if(kind==='late-loading')late.resolve({get numPages(){lateDocumentTouches++;return 1}})
        else late.resolve()
        await turn();await turn();assert.equal(lateAdmissions,0);assert.equal(lateDocumentTouches,0)
      }else if(['delayed-cleanup','primary-delayed-cleanup'].includes(kind)){
        await within(closing.promise);await pause(20)
        assert.equal(settled,false,'a caller must await disposal within its grace')
        release.resolve();outcome=await within(pending)
        if(kind==='primary-delayed-cleanup'){assert.equal(outcome.ok,false);assert.equal(outcome.reason,primary)}
        else{assert.equal(outcome.ok,true);assert.equal(closed,1)}
      }else if(kind==='unsettled-cleanup-overrun'){
        await within(closing.promise)
        // A synchronous elapsed overrun must reject before a wall-clock timer
        // can dispatch, even when destroy returns an unsettled owned promise.
        await turn();await turn();assert.equal(settled,true)
        outcome=await within(pending)
      }else outcome=await within(pending)
    }finally{release.resolve();performance.now=originalNow}
    if(kind==='preabort'){assert.equal(outcome.reason,reason);assert.equal(initialized,0);assert.equal(destroyed,0)}
    else if(repeated){assert.equal(outcome.ok,false);assert.equal(outcome.reason,reason);assert.equal(destroyed,kind==='init-abort-throw'?0:1)}
    else if(kind==='primary-cleanup-reject'||kind==='primary-cleanup-hang'){assert.equal(outcome.ok,false);assert.equal(outcome.reason,primary);assert.equal(destroyed,1)}
    else if(kind==='success-cleanup-reject'){assert.equal(outcome.ok,false);assert.equal(outcome.reason,cleanup);assert.equal(destroyed,1)}
    else if(['success-cleanup-hang','sync-cleanup-overrun','unsettled-cleanup-overrun'].includes(kind)){
      assert.equal(outcome.ok,false);assert.equal(outcome.reason.code,'NATIVE_PDF_CLEANUP_TIMEOUT');assert.equal(destroyed,1)
      if(kind==='success-cleanup-hang')assert.ok(Date.now()-started<2000)
    }else if(['attachments','fields','actions','page-bound','short-text'].includes(kind)){
      assert.equal(outcome.ok,false);assert.equal(outcome.reason.code,'PUBLISHED_PDF_UNQUALIFIED');assert.equal(destroyed,1)
      assert.match(outcome.reason.message,kind==='page-bound'?/native page count/:kind==='short-text'?/native page text/:new RegExp(kind==='fields'?'form fields':kind))
    }else if(kind==='model'){
      assert.equal(outcome.ok,true);assert.equal(destroyed,1);assert.equal(closed,1)
      const result=outcome.value
      assert.equal(result.totalPages,1);assert.equal(result.text,content.items[0].str);assert.equal(result.sha256,sha(dummy))
      assert.deepEqual(result.metadata,{info:{Title:'Authored CDOT control',Custom:{retained:'Exact source facts'}},xml:'<authored/>'})
      assert.deepEqual(result.pages[0],{number:1,width:200,height:100,text:content.items[0].str,items:[{text:content.items[0].str,x:10,y:50,endOfLine:true,width:120,height:10,
        fontReference:'font-1',dir:'ltr',transform:[10,0,0,10,10,50]}],styles:{'font-1':{fontFamily:'Authored control',ascent:.9}},annotations})
      assert.deepEqual(result.rendererFontAliases,[{rendererFontName:'g_d42_control',localReference:'font-1'}])
      assert.deepEqual([result.attachments,result.fields,result.actions],[null,null,null])
      assert.deepEqual(Buffer.from(options.data),dummy)
      assert.deepEqual(Object.keys(options).sort(),['data','disableFontFace','isEvalSupported','stopAtErrors','useSystemFonts','useWorkerFetch','verbosity'])
      assert.equal(options.isEvalSupported,false);assert.equal(options.useWorkerFetch,false);assert.equal(options.useSystemFonts,false)
      assert.equal(options.disableFontFace,true);assert.equal(options.stopAtErrors,true);assert.equal(options.verbosity,0)
    }
    if(kind==='metadata-abort-return')assert.equal(calls.attachments,0,'an aborted metadata producer cannot admit the next API')
    assert.equal(getEventListeners(caller.signal,'abort').length,0)
    await turn();await turn()
    observations.push({reason:label,initialized,destroyed,lateAdmissions,lateDocumentTouches,ok:outcome.ok,calls})
  }
  assert.equal(networkAttempts,0)
  console.log(JSON.stringify({syntheticProtocolOnly:true,kind,permissions,networkAttempts,observations}))
}
const backend=fileURLToPath(new URL('../',import.meta.url))
const run=kind=>{
  const result=spawnSync(process.execPath,['--permission','--allow-fs-read='+backend,'--unhandled-rejections=strict','--input-type=module','--eval','('+scenario.toString()+')('+JSON.stringify({kind})+')'],
    {cwd:backend,env:{...process.env,NODE_OPTIONS:''},encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:1024*1024})
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr||result.stdout)
  const record=JSON.parse(result.stdout);assert.equal(record.networkAttempts,0);assert.deepEqual(record.permissions,{addons:false,worker:false,child:false})
}
for(const kind of ['preabort','init-abort','init-abort-reject','init-abort-throw','page-abort-throw','text-abort-reject',
  'annotation-abort-throw','metadata-abort-return','late-loading','late-page','primary-cleanup-reject','success-cleanup-reject',
  'primary-cleanup-hang','success-cleanup-hang','delayed-cleanup','primary-delayed-cleanup','abort-cleanup',
  'sync-cleanup-overrun','unsettled-cleanup-overrun','attachments','fields','actions','page-bound','short-text','model']){
  test('CDOT strict PDF lifecycle: '+kind,()=>run(kind))
}
test('CDOT pdfBoxText retains source geometry selection and reading order',()=>{
  const page={items:[{text:'right',x:80,y:90},{text:'left',x:10,y:90},{text:'next line',x:10,y:50},
    {text:'excluded right boundary',x:100,y:90},{text:'excluded bottom',x:10,y:9},{text:' ',x:15,y:50}]}
  assert.equal(pdfBoxText(page,{left:0,right:100,bottom:10,top:90}),'left right next line')
})
