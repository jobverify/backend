import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import test from 'node:test'
const backend=fileURLToPath(new URL('../',import.meta.url)),adapter=new URL('../scraper-support/shared/pdfTextWorkerCore.js',import.meta.url).href,fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/pdf-text-core-20261111.json.gz',import.meta.url))))
const sha=x=>createHash('sha256').update(x).digest('hex')
const pdfHelper=new URL('../scraper-support/shared/pdfText.js',import.meta.url).href
// Locally generated, explicitly synthetic PDF: two text pages, one URI link.
// No downloaded PDF JavaScript is evaluated by this test or the extractor.
function linkedPdf(action='/S /URI /URI (mailto:careers@cloudphysician.net)',firstText='Page one'){
 const stream=text=>{const value=`BT /F1 12 Tf 10 70 Td (${text}) Tj ET`;return`<< /Length ${value.length} >>\nstream\n${value}\nendstream`}
 const objects=['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',stream(firstText),`<< /Type /Annot /Subtype /Link /Rect [0 0 80 20] /A << ${action} >> >>`,'<< /Type /Page /Parent 7 0 R /MediaBox [0 0 300 144] /Contents 2 0 R /Resources << /Font << /F1 1 0 R >> >> /Annots [3 0 R] >>',stream('Page two'),'<< /Type /Page /Parent 7 0 R /MediaBox [0 0 300 144] /Contents 5 0 R /Resources << /Font << /F1 1 0 R >> >> >>','<< /Type /Pages /Count 2 /Kids [4 0 R 6 0 R] >>','<< /Type /Catalog /Pages 7 0 R >>'],offsets=[0]
 let value='%PDF-1.4\n';for(let i=0;i<objects.length;i++){offsets.push(value.length);value+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`}
 const start=value.length;value+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(const offset of offsets.slice(1))value+=`${String(offset).padStart(10,'0')} 00000 n \n`;value+=`trailer\n<< /Size ${objects.length+1} /Root 8 0 R >>\nstartxref\n${start}\n%%EOF`
 return Buffer.from(value)
}
function context(signal=null,timeoutMs=10000){
 const expires=performance.now()+timeoutMs,timeout=Object.assign(Error('controlled PDF deadline'),{name:'TimeoutError'}),controller=new AbortController(),timer=setTimeout(()=>controller.abort(timeout),timeoutMs)
 const check=()=>{signal?.throwIfAborted();if(performance.now()>=expires&&!controller.signal.aborted)controller.abort(timeout);controller.signal.throwIfAborted()}
 const wait=promise=>{check();return new Promise((resolve,reject)=>{const onAbort=()=>{dispose();reject(signal?.aborted?signal.reason:controller.signal.reason)},dispose=()=>{signal?.removeEventListener('abort',onAbort);controller.signal.removeEventListener('abort',onAbort)};signal?.addEventListener('abort',onAbort,{once:true});controller.signal.addEventListener('abort',onAbort,{once:true});Promise.resolve(promise).then(v=>{dispose();try{check();resolve(v)}catch(e){reject(e)}},e=>{dispose();try{check()}catch(deadline){e=deadline}reject(e)})})}
 return {check,wait,dispose:()=>clearTimeout(timer)}
}
for(const d of fixture.documents)test('genuine complete PDF text parity without DOMMatrix/OCR: '+d.label,async()=>{
 const {extractPdfTextWorkerCore}=await import(adapter),bytes=Buffer.from(d.bodyBase64,'base64'),ctx=context()
 assert.equal(sha(bytes),d.packet.bodySHA256)
 try{const result=await extractPdfTextWorkerCore(bytes,ctx);assert.equal(result.numPages,d.expected.numPages);assert.equal(result.pages.length,d.expected.numPages);assert.equal(result.textBytes,d.expected.textBytes);assert.equal(sha(result.text),d.expected.textSHA256);assert.deepEqual(result.pages.map(p=>p.textSHA256),d.expected.pages.map(p=>p.textSHA256));assert.ok(Array.isArray(result.pageTexts));assert.deepEqual(result.pageTexts.map(sha),d.expected.pages.map(p=>p.textSHA256));assert.equal(result.cleanup.terminated,true);assert.equal(result.cleanup.portsClosed,2);assert.equal(result.cleanup.pendingOperations,0)}finally{ctx.dispose()}
})
test('already cancelled falsy/frozen caller reasons preserve exact identity before parser resources',async()=>{
 const {extractPdfTextWorkerCore}=await import(adapter)
 for(const reason of [null,false,'stop worker core',Object.freeze(Error('frozen caller reason'))]){const c=new AbortController();c.abort(reason);const ctx=context(c.signal);try{let caught=false;await extractPdfTextWorkerCore(new Uint8Array(),ctx).catch(e=>{caught=true;assert.equal(e,reason)});assert.equal(caught,true)}finally{ctx.dispose()}}
})
const mockWorker=options=>`
 const options=${JSON.stringify(options)};
 ${options.importDelay?`await new Promise(resolve=>setTimeout(resolve,${options.importDelay}));`:''}
 ${options.importBusy?`const until=performance.now()+${options.importBusy};while(performance.now()<until){/* Controlled module evaluation. */}`:''}
 ${options.importReject?"throw Error('controlled rejected module');":''}
 export class WorkerMessageHandler {static createDocumentHandler(params,port){
  globalThis.coreStarted=(globalThis.coreStarted||0)+1;
  ${options.factoryBusy?`const until=performance.now()+${options.factoryBusy};while(performance.now()<until){/* Controlled synchronous factory. */}`:''}
  ${options.factoryReject?"throw Error('controlled factory rejection');":''}
  const name=params.docId+'_worker',send=data=>port.postMessage({sourceName:name,targetName:params.docId,...data});let assetWaiting;
  const emitText=data=>{
    send({stream:8,streamId:data.streamId,success:options.startFailure?false:true,...(options.startFailure?{reason:{name:'UnknownErrorException',message:'controlled stream start failure'}}:{})});
    if(options.startFailure)return;
    if(options.chunkError&&data.data.pageIndex===1){send({stream:5,streamId:data.streamId,reason:{name:'UnknownErrorException',message:'controlled second-page failure'}});return}
    if(options.badRoute){port.postMessage({sourceName:'foreign_worker',targetName:params.docId,stream:4,streamId:data.streamId,chunk:{items:[]}});return}
    if(options.unknownStream){send({stream:4,streamId:99999,chunk:{items:[]}});return}
    const item={str:options.itemStr??(options.itemSize?'x'.repeat(options.itemSize):'Page '+(data.data.pageIndex+1)),hasEOL:true};
    for(let i=0;i<(options.chunks??1);i++)send({stream:4,streamId:data.streamId,chunk:options.malformed?{items:[{str:42,hasEOL:true}]}:{items:options.rawItems??Array(options.items??1).fill(item)}});
    if(options.noClose)return;
    send({stream:3,streamId:data.streamId});
    if(options.lateTextError)send({stream:5,streamId:data.streamId,reason:{name:'UnknownErrorException',message:'controlled error after page close'}});
  };
  port.addEventListener('message',({data})=>{
   if(data.callbackId===91&&data.callback){if(options.assetSuccess){if(data.callback!==1||!(data.data instanceof Uint8Array)||data.data.length===0)throw Error('Expected local installed binary asset bytes');globalThis.assetDelivered=(globalThis.assetDelivered||0)+1;emitText(assetWaiting)}return}
   if(data.stream===1){send({stream:2,streamId:data.streamId,success:true});return}
   if(data.action==='Ready'){
    if(options.docException){send({action:'DocException',data:{name:'InvalidPDFException',message:'controlled invalid document'}});return}
    if(options.action){send({action:options.action,data:{}});return}
    send({action:'GetDoc',data:{pdfInfo:{numPages:options.pages??2,...(options.xfa?{htmlForXfa:{}}:{})}}});
    if(options.duplicateDoc)send({action:'GetDoc',data:{pdfInfo:{numPages:2}}});return
   }
   if(data.action==='GetPage'){globalThis.corePages=(globalThis.corePages||0)+1;send({callback:1,callbackId:data.callbackId,data:{}});if(options.duplicateCallback)send({callback:1,callbackId:data.callbackId,data:{}});return}
   if(data.action==='GetAnnotations'){
    if(data.data.intent!==2)throw Error('Expected native display annotation intent');globalThis.coreAnnotations=(globalThis.coreAnnotations||0)+1;
    if(options.annotationHang)return;
    if(options.annotationError){send({callback:2,callbackId:data.callbackId,reason:{name:'UnknownErrorException',message:'controlled annotation failure'}});return}
    const annotations=options.annotationMalformed?{url:'mailto:wrong.example'}:options.annotationCount?Array(options.annotationCount).fill({url:options.annotationUrl??'mailto:careers@cloudphysician.net'}):options.annotationInherited?[Object.create({url:'mailto:inherited.example'}),{id:'non-link'}]:options.annotations??[];
    send({callback:1,callbackId:data.callbackId,data:annotations});return
   }
   if(data.action==='GetTextContent'){
    if(options.hang)return;
    if(options.asset){assetWaiting=data;send({action:'FetchBinaryData',callbackId:91,data:options.asset});if(options.fatalWhileAsset)send({action:'FetchURL',data:{}});return}
    emitText(data);return
   }
   if(data.action==='Cleanup'){if(options.lateDocError)send({action:'DocException',data:{name:'UnknownErrorException',message:'controlled document failure during cleanup'}});if(options.cleanupError)send({callback:2,callbackId:data.callbackId,reason:{name:'UnknownErrorException',message:'controlled cleanup error'}});else send({callback:1,callbackId:data.callbackId,data:null});return}
   if(data.action==='Terminate'){if(options.hangTerminate)return;send({callback:1,callbackId:data.callbackId,data:null})}
  });
  return name;
 }}
`
function restricted(script,timeout=12000){
 const result=spawnSync(process.execPath,['--permission','--allow-fs-read='+backend,'--input-type=module','--eval',script],{cwd:backend,encoding:'utf8',timeout,windowsHide:true})
 assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr||result.stdout);return result
}
function isolated(options,body){
 return restricted(`import assert from 'node:assert/strict';import {registerHooks}from'node:module';const context=${context.toString()};
 registerHooks({resolve(specifier,c,next){if(specifier.endsWith('/pdfjs-dist/legacy/build/pdf.worker.mjs'))return{url:${JSON.stringify('data:text/javascript,'+encodeURIComponent(mockWorker(options)))},shortCircuit:true};return next(specifier,c)}});
 const core=await import(${JSON.stringify(adapter)});${body}
 assert.deepEqual(core.pdfTextWorkerCoreResourceState(),{documents:0,ports:0,listeners:0,pendingOperations:0});
 `)
}
test('restricted genuine PDFs need no addon, worker thread, child process or DOMMatrix substitute',()=>{
 restricted(`import assert from'node:assert/strict';import fs from'node:fs';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';const context=${context.toString()},core=await import(${JSON.stringify(adapter)}),fixture=JSON.parse(gunzipSync(fs.readFileSync(${JSON.stringify(fileURLToPath(new URL('./fixtures/pdf-text-core-20261111.json.gz',import.meta.url)))})));
 const originalFetch=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('Network disabled')};
 for(const d of fixture.documents){const ctx=context();try{const r=await core.extractPdfTextWorkerCore(Buffer.from(d.bodyBase64,'base64'),ctx);assert.equal(createHash('sha256').update(r.text).digest('hex'),d.expected.textSHA256);assert.equal(r.numPages,d.expected.numPages)}finally{ctx.dispose()}}
 assert.equal(calls,0);assert.equal(typeof globalThis.DOMMatrix,'undefined');for(const permission of ['addons','worker','child'])assert.equal(process.permission.has(permission),false);globalThis.fetch=originalFetch;
 assert.deepEqual(core.pdfTextWorkerCoreResourceState(),{documents:0,ports:0,listeners:0,pendingOperations:0});`)
})
test('synthetic valid protocol retains all pages and acknowledges complete cleanup',()=>isolated({},`const ctx=context();try{const r=await core.extractPdfTextWorkerCore(new Uint8Array([1]),ctx);assert.equal(r.text,'Page 1'+String.fromCharCode(10,10)+'Page 2');assert.equal(r.pages.length,2);assert.equal(r.cleanup.terminated,true);assert.equal(r.cleanup.portsClosed,2)}finally{ctx.dispose()}`))
for(const [label,options,match]of [
 ['partial-page',{chunkError:true},'second-page failure'],['malformed-items',{malformed:true},'malformed text item'],['unknown-action',{action:'GetReader'},'unsupported worker action'],['arbitrary-network-action',{action:'FetchURL'},'unsupported worker action'],['wrong-route',{badRoute:true},'unexpected message route'],['unknown-stream',{unknownStream:true},'unsupported stream message'],['too-many-pages',{pages:1001},'page count'],['zero-pages',{pages:0},'page count'],['XFA',{xfa:true},'page count/XFA'],['oversized-item',{itemSize:1048577},'output limit'],['total-output',{itemSize:1048576,items:9},'output limit'],['too-many-items',{items:100001},'item/chunk limit'],['too-many-chunks',{items:0,chunks:10001},'item/chunk limit'],['invalid-document',{docException:true},'invalid document'],['cleanup-failed',{cleanupError:true},'cleanup error'],['late-document-failure',{lateDocError:true},'document failure during cleanup'],['late-stream-error',{lateTextError:true},'unexpected/retired stream'],['stream-start-failure',{startFailure:true},'stream start failure'],['duplicate-document',{duplicateDoc:true},'duplicate/malformed document'],['duplicate-callback',{duplicateCallback:true},'unexpected/duplicate callback'],['foreign-asset',{asset:{kind:'standardFontDataUrl',filename:'https://foreign.example/font.ttf'}},'unreviewed installed asset'],['asset-traversal',{asset:{kind:'cMapUrl',filename:'../../package.json'}},'unreviewed installed asset'],['wasm-not-allowed',{asset:{kind:'wasmUrl',filename:'openjpeg.wasm'}},'unreviewed installed asset'],['fatal-while-local-asset-pending',{fatalWhileAsset:true,asset:{kind:'standardFontDataUrl',filename:'FoxitFixed.pfb'}},'unsupported worker action']
])test('synthetic '+label+' rejects without partial text or leaked resources',()=>isolated(options,`const ctx=context();try{await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),ctx),new RegExp(${JSON.stringify(match)}))}finally{ctx.dispose()}`))
for(const options of [{hang:true},{noClose:true},{hangTerminate:true}])test('synthetic stalled protocol is deadline bounded and releases resources: '+JSON.stringify(options),()=>isolated(options,`const ctx=context(null,80);try{await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),ctx),{name:'TimeoutError'})}finally{ctx.dispose()}`))
for(const kind of ['null','false','empty','string','frozen'])test('active caller '+kind+' cancellation preserves exact reason and tears down ports',()=>isolated({hang:true},`const c=new AbortController(),reason=${kind==='null'?'null':kind==='false'?'false':kind==='empty'?"''":kind==='string'?"'stop core'":"Object.freeze(Error('frozen caller abort'))"},ctx=context(c.signal);setTimeout(()=>c.abort(reason),50);try{let caught=false;await core.extractPdfTextWorkerCore(new Uint8Array([1]),ctx).catch(e=>{caught=true;assert.equal(e,reason)});assert.equal(caught,true)}finally{ctx.dispose()}`))
for(const options of [{importDelay:80},{importBusy:60},{importBusy:60,importReject:true},{factoryBusy:60},{factoryBusy:60,factoryReject:true}])test('elapsed/import/synchronous resolve-reject deadline priority: '+JSON.stringify(options),()=>isolated(options,`const ctx=context(null,10);try{await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),ctx),{name:'TimeoutError'});await new Promise(resolve=>setTimeout(resolve,120))}finally{ctx.dispose()}`))
test('synthetic concurrent calls have distinct documents and the finite document admission cap',()=>isolated({hang:true},`const contexts=Array.from({length:8},()=>context(null,80)),pending=contexts.map(ctx=>core.extractPdfTextWorkerCore(new Uint8Array([1]),ctx).catch(e=>assert.equal(e.name,'TimeoutError'))),extra=context();try{await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),extra),/concurrent document limit/);await Promise.all(pending)}finally{extra.dispose();contexts.forEach(ctx=>ctx.dispose())}`))
test('synthetic protocol can read only scoped installed font bytes with recorded hashes',()=>isolated({pages:1,assetSuccess:true,asset:{kind:'standardFontDataUrl',filename:'FoxitFixed.pfb'}},`const ctx=context();try{const r=await core.extractPdfTextWorkerCore(new Uint8Array([1]),ctx),fs=await import('node:fs/promises'),crypto=await import('node:crypto'),content=await fs.readFile(new URL('./node_modules/pdfjs-dist/standard_fonts/FoxitFixed.pfb',import.meta.url));assert.equal(r.text,'Page 1');assert.deepEqual(r.assets,[{kind:'standardFontDataUrl',filename:'FoxitFixed.pfb',bytes:content.length,sha256:crypto.createHash('sha256').update(content).digest('hex')}]);assert.equal(globalThis.assetDelivered,1)}finally{ctx.dispose()}`))
test('synthetic repeated completed binary-asset callback is a protocol failure',()=>isolated({assetSuccess:true,asset:{kind:'standardFontDataUrl',filename:'FoxitFixed.pfb'}},`const ctx=context();try{await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),ctx),/invalid asset callback/)}finally{ctx.dispose()}`))
test('synthetic maxPages narrowing rejects the document before any page requests',()=>isolated({pages:2},`const ctx=context();try{await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),{...ctx,maxPages:1}),/page count/);assert.equal(globalThis.corePages,undefined)}finally{ctx.dispose()}`))
test('synthetic invalid maxPages values cannot start the parser',()=>isolated({},`const ctx=context();try{for(const maxPages of [0,-1,1.5,1001,NaN,Infinity,null,'2',false])await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),{...ctx,maxPages}),/maxPages/);assert.equal(globalThis.coreStarted,undefined)}finally{ctx.dispose()}`))
for(const [pages,maxPages]of [[1,1],[2,3],[1000,1000]])test('synthetic maxPages accepts complete ordered page text at '+pages+'/'+maxPages,()=>isolated({pages},`const ctx=context();try{const r=await core.extractPdfTextWorkerCore(new Uint8Array([1]),{...ctx,maxPages:${maxPages}});assert.equal(r.pageTexts.length,${pages});assert.equal(r.pageTexts[0],'Page 1');assert.equal(r.pageTexts[${pages-1}],'Page ${pages}');assert.equal(globalThis.corePages,${pages});assert.equal(r.pages.length,${pages})}finally{ctx.dispose()}`))
test('genuine maxPages one-page minimum and four-page narrowing preserve captured page text',async()=>{
 const core=await import(adapter)
 for(const [label,maxPages]of [['fullerton-006',1],['fullerton-010',4]]){const d=fixture.documents.find(d=>d.label===label),ctx=context();try{const r=await core.extractPdfTextWorkerCore(Buffer.from(d.bodyBase64,'base64'),{...ctx,maxPages});assert.deepEqual(r.pageTexts.map(sha),d.expected.pages.map(p=>p.textSHA256));assert.equal(r.textBytes,d.expected.textBytes)}finally{ctx.dispose()}}
 const d=fixture.documents.find(d=>d.label==='fullerton-010'),ctx=context();try{await assert.rejects(core.extractPdfTextWorkerCore(Buffer.from(d.bodyBase64,'base64'),{...ctx,maxPages:3}),/page count/)}finally{ctx.dispose()}
})
test('synthetic default includePageLinks makes no annotation requests',()=>isolated({},`const ctx=context();try{const r=await core.extractPdfTextWorkerCore(new Uint8Array([1]),ctx);assert.equal(Object.hasOwn(r,'pageLinkUrls'),false);assert.equal(globalThis.coreAnnotations,undefined)}finally{ctx.dispose()}`))
test('synthetic includePageLinks preserves only own string URLs and native display intent',()=>isolated({annotations:[{url:'mailto:careers@cloudphysician.net'},{url:'https://example.test/path?x=1'},{id:'non-link'}]},`const ctx=context();try{const r=await core.extractPdfTextWorkerCore(new Uint8Array([1]),{...ctx,includePageLinks:true});assert.deepEqual(r.pageLinkUrls,[['mailto:careers@cloudphysician.net','https://example.test/path?x=1'],['mailto:careers@cloudphysician.net','https://example.test/path?x=1']]);assert.equal(globalThis.coreAnnotations,2)}finally{ctx.dispose()}`))
test('synthetic annotation inherited URLs cannot supply link proof',()=>isolated({annotationInherited:true},`const ctx=context();try{const r=await core.extractPdfTextWorkerCore(new Uint8Array([1]),{...ctx,includePageLinks:true});assert.deepEqual(r.pageLinkUrls,[[],[]])}finally{ctx.dispose()}`))
test('synthetic includePageLinks requires an explicit boolean before starting parser resources',()=>isolated({},`const ctx=context();try{for(const includePageLinks of [null,1,0,'true',{},[]])await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),{...ctx,includePageLinks}),/includePageLinks/);assert.equal(globalThis.coreStarted,undefined)}finally{ctx.dispose()}`))
for(const [label,options,match]of [
 ['malformed-list',{annotationMalformed:true},'annotation list'],['malformed-record',{annotations:[null]},'annotation record'],['non-string-URL',{annotations:[{url:42}]},'annotation URL'],['page-count-limit',{annotationCount:4097},'annotation count limit'],['document-count-limit',{pages:5,annotationCount:4096,annotationUrl:''},'annotation count limit'],['URL-byte-limit',{annotationCount:1,annotationUrl:'x'.repeat(16385)},'annotation URL byte limit'],['aggregate-URL-limit',{annotationCount:65,annotationUrl:'x'.repeat(16384)},'annotation output limit'],['request-failure',{annotationError:true},'annotation failure']
])test('synthetic annotation '+label+' rejects the entire document and closes resources',()=>isolated(options,`const ctx=context();try{await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),{...ctx,includePageLinks:true}),new RegExp(${JSON.stringify(match)}))}finally{ctx.dispose()}`))
test('synthetic stalled annotation request obeys the same caller deadline',()=>isolated({annotationHang:true},`const ctx=context(null,80);try{await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),{...ctx,includePageLinks:true}),{name:'TimeoutError'})}finally{ctx.dispose()}`))
test('restricted actual synthetic PDF retains mailto annotations and a page without annotations',()=>{
 restricted(`import assert from'node:assert/strict';const context=${context.toString()},core=await import(${JSON.stringify(adapter)}),ctx=context();try{const r=await core.extractPdfTextWorkerCore(Buffer.from(${JSON.stringify(linkedPdf().toString('base64'))},'base64'),{...ctx,maxPages:2,includePageLinks:true});assert.deepEqual(r.pageTexts,['Page one','Page two']);assert.deepEqual(r.pageLinkUrls,[['mailto:careers@cloudphysician.net'],[]]);assert.equal(typeof globalThis.DOMMatrix,'undefined');for(const p of ['addons','worker','child'])assert.equal(process.permission.has(p),false)}finally{ctx.dispose()}assert.deepEqual(core.pdfTextWorkerCoreResourceState(),{documents:0,ports:0,listeners:0,pendingOperations:0});`)
})
test('restricted actual synthetic PDF annotation JavaScript is never executed',()=>{
 restricted(`import assert from'node:assert/strict';const context=${context.toString()},core=await import(${JSON.stringify(adapter)}),ctx=context();try{const r=await core.extractPdfTextWorkerCore(Buffer.from(${JSON.stringify(linkedPdf('/S /JavaScript /JS (globalThis.PDF_CODE_EXECUTED=true)').toString('base64'))},'base64'),{...ctx,includePageLinks:true});assert.deepEqual(r.pageLinkUrls,[[],[]]);assert.equal(globalThis.PDF_CODE_EXECUTED,undefined)}finally{ctx.dispose()}assert.deepEqual(core.pdfTextWorkerCoreResourceState(),{documents:0,ports:0,listeners:0,pendingOperations:0});`)
})
test('synthetic includePageTextItems preserves raw blank EOL and spacing without extra item fields',()=>isolated({pages:1,rawItems:[{str:'Job Title',hasEOL:false,fontName:'ignored'},{str:'',hasEOL:true},{str:'  Business Manager  ',hasEOL:false},{str:'',hasEOL:true}]},`const ctx=context();try{const r=await core.extractPdfTextWorkerCore(new Uint8Array([1]),{...ctx,includePageTextItems:true});assert.deepEqual(r.pageTextItems,[[{str:'Job Title',hasEOL:false},{str:'',hasEOL:true},{str:'  Business Manager  ',hasEOL:false},{str:'',hasEOL:true}]]);assert.equal(r.text,'Job Title Business Manager');assert.deepEqual(r.pageTexts,['Job Title Business Manager'])}finally{ctx.dispose()}`))
test('synthetic includePageTextItems defaults to no raw item retention',()=>isolated({},`const ctx=context();try{const r=await core.extractPdfTextWorkerCore(new Uint8Array([1]),ctx);assert.equal(Object.hasOwn(r,'pageTextItems'),false)}finally{ctx.dispose()}`))
test('synthetic includePageTextItems validates a boolean before parser resources',()=>isolated({},`const ctx=context();try{for(const includePageTextItems of [null,1,0,'true',{},[]])await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),{...ctx,includePageTextItems}),/includePageTextItems/);assert.equal(globalThis.coreStarted,undefined)}finally{ctx.dispose()}`))
test('synthetic raw item aggregate counts blank items across pages before accepting a chunk',()=>isolated({pages:3,items:100000,itemStr:''},`const ctx=context();try{await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),{...ctx,includePageTextItems:true}),/document item limit/)}finally{ctx.dispose()}`))
for(const [label,options,match]of [['page-item-limit',{items:100001,itemStr:''},'item/chunk limit'],['item-byte-limit',{itemSize:1048577},'output limit'],['output-byte-limit',{itemSize:1048576,items:9},'output limit'],['malformed-item',{rawItems:[{str:'blank flag missing'}]},'malformed text item']])test('synthetic retained raw '+label+' remains rejected without partial success',()=>isolated(options,`const ctx=context();try{await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array([1]),{...ctx,includePageTextItems:true}),new RegExp(${JSON.stringify(match)}))}finally{ctx.dispose()}`))
test('restricted actual synthetic separated label and title retain empty EOL text items',()=>{
 restricted(`import assert from'node:assert/strict';const context=${context.toString()},core=await import(${JSON.stringify(adapter)}),ctx=context();try{const r=await core.extractPdfTextWorkerCore(Buffer.from(${JSON.stringify(linkedPdf('/S /URI /URI (mailto:careers@cloudphysician.net)','Job Title) Tj /F1 13 Tf 0 -20 Td (Business Manager').toString('base64'))},'base64'),{...ctx,includePageTextItems:true});assert.ok(Array.isArray(r.pageTextItems));assert.equal(r.pageTextItems.length,2);assert.ok(r.pageTextItems[0].some(i=>i.str===''&&i.hasEOL===true));assert.ok(r.pageTextItems[0].some(i=>i.str==='Job Title'));assert.ok(r.pageTextItems[0].some(i=>i.str==='Business Manager'));assert.ok(r.pageTextItems.flat().every(i=>Object.keys(i).sort().join(',')==='hasEOL,str'));assert.equal(typeof globalThis.DOMMatrix,'undefined')}finally{ctx.dispose()}assert.deepEqual(core.pdfTextWorkerCoreResourceState(),{documents:0,ports:0,listeners:0,pendingOperations:0});`)
})
test('restricted captured raw page items exactly match the installed display reference on all 33 pages',()=>{
 restricted(`import assert from'node:assert/strict';import fs from'node:fs';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';const context=${context.toString()},core=await import(${JSON.stringify(adapter)}),f=JSON.parse(gunzipSync(fs.readFileSync(${JSON.stringify(fileURLToPath(new URL('./fixtures/pdf-text-core-20261111.json.gz',import.meta.url)))})));let network=0;globalThis.fetch=()=>{network++;throw Error('No network')};for(const d of f.documents){const ctx=context();try{const r=await core.extractPdfTextWorkerCore(Buffer.from(d.bodyBase64,'base64'),{...ctx,maxPages:30,includePageTextItems:true});assert.equal(r.pageTextItems.length,d.expected.rawTextItems.length);for(let i=0;i<r.pageTextItems.length;i++){const items=r.pageTextItems[i],want=d.expected.rawTextItems[i];assert.equal(items.length,want.items);assert.equal(createHash('sha256').update(JSON.stringify(items)).digest('hex'),want.sha256);assert.equal(items.filter(i=>i.str===''&&i.hasEOL).length,want.blankEOLItems)}assert.equal(createHash('sha256').update(r.text).digest('hex'),d.expected.textSHA256)}finally{ctx.dispose()}}assert.equal(network,0);assert.equal(typeof globalThis.DOMMatrix,'undefined');for(const p of ['addons','worker','child'])assert.equal(process.permission.has(p),false);assert.deepEqual(core.pdfTextWorkerCoreResourceState(),{documents:0,ports:0,listeners:0,pendingOperations:0});`)
})
test('input type/byte limits reject before native parsing or transport creation',async()=>{
 const core=await import(adapter),ctx=context()
 try{await assert.rejects(core.extractPdfTextWorkerCore(new Uint8Array(core.PDF_TEXT_CORE_LIMITS.inputBytes+1),ctx),/input byte limit/);await assert.rejects(core.extractPdfTextWorkerCore([1,2,3],ctx),/Uint8Array/)}finally{ctx.dispose()}
 assert.deepEqual(core.pdfTextWorkerCoreResourceState(),{documents:0,ports:0,listeners:0,pendingOperations:0})
})

// These integration checks exercise the public helper. Protocol-only doubles
// below are labelled synthetic and never stand in for captured source content.
test('shared helper returns complete genuine PDF text with zero native or OCR imports',()=>{
 restricted(`import assert from'node:assert/strict';import fs from'node:fs';import{registerHooks}from'node:module';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';
 let optional=0,network=0;registerHooks({resolve(s,c,next){if(['pdfjs-dist/legacy/build/pdf.mjs','@napi-rs/canvas','tesseract.js'].includes(s)){optional++;throw Error('Direct text must remain independent of native/OCR modules')}return next(s,c)}});globalThis.fetch=()=>{network++;throw Error('Network disabled')};
 const pdf=await import(${JSON.stringify(pdfHelper)}),f=JSON.parse(gunzipSync(fs.readFileSync(${JSON.stringify(fileURLToPath(new URL('./fixtures/pdf-text-core-20261111.json.gz',import.meta.url)))})));
 for(const d of f.documents){const text=await pdf.extractTextFromPdfBuffer(Buffer.from(d.bodyBase64,'base64'),{timeoutMs:15000});assert.equal(createHash('sha256').update(text).digest('hex'),d.expected.textSHA256);assert.equal(Buffer.byteLength(text),d.expected.textBytes)}
 assert.equal(optional,0);assert.equal(network,0);assert.equal(typeof globalThis.DOMMatrix,'undefined');for(const p of ['addons','worker','child'])assert.equal(process.permission.has(p),false);`)
})
test('shared helper rejects an actual malformed PDF without invoking OCR or accepting partial text',()=>{
 restricted(`import assert from'node:assert/strict';import{registerHooks}from'node:module';let optional=0;registerHooks({resolve(s,c,next){if(['pdfjs-dist/legacy/build/pdf.mjs','@napi-rs/canvas','tesseract.js'].includes(s)){optional++;throw Error('Malformed PDF must not invoke OCR')}return next(s,c)}});const pdf=await import(${JSON.stringify(pdfHelper)});await assert.rejects(pdf.extractTextFromPdfBuffer(new Uint8Array([37,80,68,70]),{timeoutMs:5000}),{name:'InvalidPDFException'});assert.equal(optional,0);`)
})
test('shared helper preserves already cancelled null, false, empty string and frozen error reasons',()=>{
 restricted(`import assert from'node:assert/strict';import{registerHooks}from'node:module';let loads=0;registerHooks({resolve(s,c,next){if(s.endsWith('pdfTextWorkerCore.js')||s==='pdfjs-dist/legacy/build/pdf.mjs'){loads++;throw Error('Cancelled request must not import parsers')}return next(s,c)}});const pdf=await import(${JSON.stringify(pdfHelper)});for(const reason of [null,false,'',Object.freeze(Error('Frozen caller'))]){const c=new AbortController();c.abort(reason);let caught=false;await pdf.extractTextFromPdfBuffer(new Uint8Array(),{signal:c.signal}).catch(e=>{caught=true;assert.equal(e,reason)});assert.equal(caught,true)}assert.equal(loads,0);`)
})
const helperWithSyntheticCore=(source,body,display=null)=>restricted(`import assert from'node:assert/strict';import{registerHooks}from'node:module';registerHooks({resolve(s,c,next){if(s.endsWith('/pdfTextWorkerCore.js')||s==='./pdfTextWorkerCore.js')return{url:${JSON.stringify('data:text/javascript,'+encodeURIComponent(source))},shortCircuit:true};${display===null?"if(s==='pdfjs-dist/legacy/build/pdf.mjs')throw Error('Unexpected native parser import');":`if(s==='pdfjs-dist/legacy/build/pdf.mjs')return{url:${JSON.stringify('data:text/javascript,'+encodeURIComponent(display))},shortCircuit:true};`}return next(s,c)}});const pdf=await import(${JSON.stringify(pdfHelper)});${body}`)
for(const mode of ['delay','busy','busy-reject'])test('shared helper includes synthetic core '+mode+' import in the caller deadline',()=>{
 const pause=mode==='delay'?"await new Promise(r=>setTimeout(r,70));":"const until=performance.now()+70;while(performance.now()<until){};"
 helperWithSyntheticCore(pause+(mode==='busy-reject'?"throw Error('Late core import');":'')+"export const extractPdfTextWorkerCore=async()=>{globalThis.coreStarted=true;return{text:'too late'}};",`await assert.rejects(pdf.extractTextFromPdfBuffer(new Uint8Array(),{timeoutMs:10}),e=>e instanceof pdf.PdfTextExtractionTimeoutError);await new Promise(r=>setTimeout(r,100));assert.equal(globalThis.coreStarted,undefined);`)
})
test('shared helper shares one deadline across synthetic text and lazy native OCR import',()=>{
 helperWithSyntheticCore("export const extractPdfTextWorkerCore=async()=>{await new Promise(r=>setTimeout(r,30));return{text:''}};",`await assert.rejects(pdf.extractTextFromPdfBuffer(new Uint8Array(),{timeoutMs:45}),e=>e instanceof pdf.PdfTextExtractionTimeoutError);await new Promise(r=>setTimeout(r,100));assert.equal(globalThis.nativeStarted,undefined);`,"await new Promise(r=>setTimeout(r,30));export const VerbosityLevel={ERRORS:0};export const getDocument=()=>{globalThis.nativeStarted=true;throw Error('Late native parser')};")
})
for(const rejects of [false,true])test('shared helper enforces elapsed deadline after synthetic synchronous core '+(rejects?'rejection':'resolution'),()=>{
 helperWithSyntheticCore(`export const extractPdfTextWorkerCore=()=>{const until=performance.now()+60;while(performance.now()<until){};${rejects?"throw Error('Late core rejection');":"return Promise.resolve({text:'late text'});"}};`,`await assert.rejects(pdf.extractTextFromPdfBuffer(new Uint8Array(),{timeoutMs:10}),e=>e instanceof pdf.PdfTextExtractionTimeoutError);`)
})
test('shared helper starts its deadline before synchronous input conversion',async()=>{
 const pdf=await import(pdfHelper),value={[Symbol.iterator](){return {next(){const until=performance.now()+30;while(performance.now()<until){/* Controlled synchronous input conversion overrun. */}throw Error('Late conversion')}}}
 }
 await assert.rejects(pdf.extractTextFromPdfBuffer(value,{timeoutMs:5}),e=>e instanceof pdf.PdfTextExtractionTimeoutError)
})
test('shared helper bounds synthetic native cleanup and preserves an active falsy caller reason',()=>{
 helperWithSyntheticCore("export const extractPdfTextWorkerCore=async()=>({text:''});",`const c=new AbortController();setTimeout(()=>c.abort(false),20);const started=performance.now();let caught=false;await pdf.extractTextFromPdfBuffer(new Uint8Array(),{signal:c.signal,timeoutMs:5000}).catch(e=>{caught=true;assert.equal(e,false)});assert.equal(caught,true);assert.ok(performance.now()-started<2500);assert.equal(globalThis.destroyed,1);`,"export const VerbosityLevel={ERRORS:0};export const getDocument=()=>({promise:new Promise(()=>{}),destroy:()=>{globalThis.destroyed=(globalThis.destroyed||0)+1;return new Promise(()=>{})}});")
})
test('shared helper preserves explicit timeoutMs zero while synthetic core work completes',()=>{
 helperWithSyntheticCore("export const extractPdfTextWorkerCore=async()=>{await new Promise(r=>setTimeout(r,60));return{text:'completed without deadline'}};",`assert.equal(await pdf.extractTextFromPdfBuffer(new Uint8Array(),{timeoutMs:0}),'completed without deadline');`)
})
