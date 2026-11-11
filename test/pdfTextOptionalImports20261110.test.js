import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import test from 'node:test'
const backend=fileURLToPath(new URL('../',import.meta.url)),pdfText=new URL('../scraper-support/shared/pdfText.js',import.meta.url).href,experience=new URL('../scraper-support/utils/publicExperienceEnrichment.js',import.meta.url).href,thence=new URL('../scraper/thence/script.js',import.meta.url).href
// A locally generated valid blank PDF exercises real zero-text detection. It
// carries no source provenance and is used only for the native OCR limitation.
const zeroTextPdf=(()=>{
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 1 /Kids [3 0 R] >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>'],offsets=[0]
 let value='%PDF-1.4\n';for(let i=0;i<objects.length;i++){offsets.push(value.length);value+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`}
 const start=value.length;value+=`xref\n0 4\n0000000000 65535 f \n`;for(const n of offsets.slice(1))value+=`${String(n).padStart(10,'0')} 00000 n \n`;value+=`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`
 return Buffer.from(value).toString('base64')
})()
// Existing display/OCR lifecycle tests deliberately enter the zero-text branch;
// genuine direct-text extraction and core protocol controls live in the new suite.
const syntheticCore="export const extractPdfTextWorkerCore=async()=>({text:''});"
const resolveSyntheticCore=`if(specifier==='./pdfTextWorkerCore.js')return{url:${JSON.stringify('data:text/javascript,'+encodeURIComponent(syntheticCore))},shortCircuit:true};`
const restricted=script=>{
 const result=spawnSync(process.execPath,['--permission','--allow-fs-read='+backend,'--input-type=module','--eval',script],{cwd:backend,encoding:'utf8',timeout:20000,windowsHide:true})
 assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr||result.stdout);return result
}
test('restricted HTML helper/source imports and synchronous timeout API need no optional PDF native addons',()=>{
 restricted(`
  import assert from 'node:assert/strict';import {registerHooks} from 'node:module';const optional=[];
  registerHooks({resolve(specifier,context,next){if(['pdfjs-dist/legacy/build/pdf.mjs','@napi-rs/canvas','tesseract.js'].includes(specifier)){optional.push(specifier);throw Error('HTML import must not initialize optional PDF/OCR dependencies')}return next(specifier,context)}});
  assert.equal(process.permission.has('addons'),false);
  const pdf=await import(${JSON.stringify(pdfText)});
  assert.equal(pdf.resolvePdfTextExtractionTimeoutMs('17'),17);
  assert.equal(pdf.resolvePdfTextExtractionTimeoutMs('-1',23),23);
  assert.equal(pdf.resolvePdfTextExtractionTimeoutMs('0'),0);
  const helper=await import(${JSON.stringify(experience)}),source=await import(${JSON.stringify(thence)});
  assert.equal(typeof source.run,'function');
  const result=helper.inferExperienceFromPublicPageHtml({title:'Cloud Engineer',company:'Example',applyUrl:'https://example.test/role'},'<h1>Cloud Engineer</h1><h2>Required Experience</h2><p>5 years</p>');
  assert.equal(result.experienceRequired,'5 years');
  assert.deepEqual(optional,[]);
  assert.equal(process.permission.has('addons'),false);
 `)
})
test('actual restricted synthetic zero-text PDF preserves the exact cached native OCR failure and later HTML imports',()=>{
 restricted(`
  import assert from 'node:assert/strict';
  const pdf=await import(${JSON.stringify(pdfText)});let actual,again;
  try{await pdf.extractTextFromPdfBuffer(Buffer.from(${JSON.stringify(zeroTextPdf)},'base64'),{timeoutMs:5000})}catch(error){actual=error}
  try{await import('pdfjs-dist/legacy/build/pdf.mjs')}catch(error){again=error}
  assert.ok(actual instanceof ReferenceError);assert.equal(actual.message,'DOMMatrix is not defined');assert.equal(actual,again);
  await import(${JSON.stringify(experience)});await import(${JSON.stringify(thence)});
  assert.equal(process.permission.has('addons'),false);assert.equal(process.permission.has('worker'),false);assert.equal(process.permission.has('child'),false);
 `)
})
test('already cancelled PDF request preserves the caller reason without resolving optional parser',()=>{
 restricted(`
  import assert from 'node:assert/strict';import {registerHooks} from 'node:module';let loads=0;
  registerHooks({resolve(specifier,context,next){if(specifier==='pdfjs-dist/legacy/build/pdf.mjs'){loads++;throw Error('Unexpected optional parser load')}return next(specifier,context)}});
  const pdf=await import(${JSON.stringify(pdfText)}),controller=new AbortController(),reason=Error('caller cancelled PDF');controller.abort(reason);
  await assert.rejects(pdf.extractTextFromPdfBuffer(new Uint8Array(),{signal:controller.signal}),error=>error===reason);assert.equal(loads,0);
 `)
})
for(const cancel of [false,true])test((cancel?'caller cancellation':'extraction deadline')+' covers optional parser loading and prevents late parsing',()=>{
 const moduleSource="await new Promise(resolve=>setTimeout(resolve,60));export const VerbosityLevel={ERRORS:0};export const getDocument=()=>{globalThis.parserStarted=true;throw Error('Late parser must not start')};"
 restricted(`
  import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
  registerHooks({resolve(specifier,context,next){${resolveSyntheticCore}if(specifier==='pdfjs-dist/legacy/build/pdf.mjs')return{url:${JSON.stringify('data:text/javascript,'+encodeURIComponent(moduleSource))},shortCircuit:true};return next(specifier,context)}});
  const pdf=await import(${JSON.stringify(pdfText)}),controller=new AbortController(),reason=Error('cancel while importing');
  ${cancel?'setTimeout(()=>controller.abort(reason),5);':''}
  await assert.rejects(pdf.extractTextFromPdfBuffer(new Uint8Array(),{signal:controller.signal,timeoutMs:${cancel?1000:5}}),error=>${cancel?'error===reason':'error instanceof pdf.PdfTextExtractionTimeoutError'});
  await new Promise(resolve=>setTimeout(resolve,90));assert.equal(globalThis.parserStarted,undefined);
 `)
})
for(const cancel of [false,true])test((cancel?'caller cancellation':'extraction deadline')+' destroys a started PDF task exactly once',()=>{
 const moduleSource="export const VerbosityLevel={ERRORS:0};export const getDocument=()=>({promise:new Promise(()=>{}),destroy:async()=>{globalThis.taskDestroyed=(globalThis.taskDestroyed||0)+1}});"
 restricted(`
  import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
  registerHooks({resolve(specifier,context,next){${resolveSyntheticCore}if(specifier==='pdfjs-dist/legacy/build/pdf.mjs')return{url:${JSON.stringify('data:text/javascript,'+encodeURIComponent(moduleSource))},shortCircuit:true};return next(specifier,context)}});
  const pdf=await import(${JSON.stringify(pdfText)}),controller=new AbortController(),reason=Error('cancel running PDF');
  ${cancel?'setTimeout(()=>controller.abort(reason),10);':''}
  await assert.rejects(pdf.extractTextFromPdfBuffer(new Uint8Array(),{signal:controller.signal,timeoutMs:${cancel?1000:10}}),error=>${cancel?'error===reason':'error instanceof pdf.PdfTextExtractionTimeoutError'});
  assert.equal(globalThis.taskDestroyed,1);
 `)
})
test('elapsed deadline rejects synchronous optional module initialization before parser starts',()=>{
 const moduleSource="const until=performance.now()+35;while(performance.now()<until){/* Simulate synchronous module evaluation. */}export const VerbosityLevel={ERRORS:0};export const getDocument=()=>{globalThis.parserStarted=true;throw Error('Late parser must not start')};"
 restricted(`
  import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
  registerHooks({resolve(specifier,context,next){${resolveSyntheticCore}if(specifier==='pdfjs-dist/legacy/build/pdf.mjs')return{url:${JSON.stringify('data:text/javascript,'+encodeURIComponent(moduleSource))},shortCircuit:true};return next(specifier,context)}});
  const pdf=await import(${JSON.stringify(pdfText)});
  await assert.rejects(pdf.extractTextFromPdfBuffer(new Uint8Array(),{timeoutMs:5}),error=>error instanceof pdf.PdfTextExtractionTimeoutError);assert.equal(globalThis.parserStarted,undefined);
 `)
})
const emptyPdfModule="export const VerbosityLevel={ERRORS:0};export const getDocument=()=>{const id=globalThis.docs=(globalThis.docs||0)+1;return{promise:Promise.resolve({numPages:5,getPage:async page=>({getTextContent:async()=>({items:[]}),getViewport:({scale})=>{(globalThis.rendered||=[]).push({id,page,scale});return{width:20.1,height:40.1}},render:()=>({promise:Promise.resolve()})})}),destroy:async()=>{globalThis.destroyed=(globalThis.destroyed||0)+1}}};"
const workerModule="export const createWorker=async()=>{globalThis.createdWorkers=(globalThis.createdWorkers||0)+1;return{recognize:async()=>({data:{text:'Current OCR text'}})}};"
const canvasModule="export const createCanvas=(width,height)=>{(globalThis.canvases||=[]).push({width,height});return{getContext:()=>({}),toBuffer:()=>new Uint8Array([1])}};"
const withOptionalMocks=(pdfModule,ocrModule,renderModule,body)=>`
 import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
 const replacements=new Map(${JSON.stringify([['pdfjs-dist/legacy/build/pdf.mjs',pdfModule],['tesseract.js',ocrModule],['@napi-rs/canvas',renderModule]])});
 registerHooks({resolve(specifier,context,next){${resolveSyntheticCore}if(replacements.has(specifier))return{url:'data:text/javascript,'+encodeURIComponent(replacements.get(specifier)),shortCircuit:true};return next(specifier,context)}});
 const pdf=await import(${JSON.stringify(pdfText)});${body}
`
test('OCR keeps two shared workers, two rendered pages per PDF and the existing render scale',()=>{
 restricted(withOptionalMocks(emptyPdfModule,workerModule,canvasModule,`
  const results=await Promise.all([pdf.extractTextFromPdfBuffer(new Uint8Array(),{timeoutMs:5000}),pdf.extractTextFromPdfBuffer(new Uint8Array(),{timeoutMs:5000})]);
  assert.deepEqual(results,Array(2).fill('Current OCR text'+String.fromCharCode(10,10)+'Current OCR text'));
  assert.equal(globalThis.createdWorkers,2);assert.equal(globalThis.destroyed,2);assert.equal(globalThis.rendered.length,4);
  for(const id of [1,2])assert.deepEqual(globalThis.rendered.filter(p=>p.id===id).map(p=>p.page),[1,2]);
  assert.ok(globalThis.rendered.every(p=>p.scale===2));assert.ok(globalThis.canvases.every(c=>c.width===21&&c.height===41));
 `))
})
for(const delayed of ['worker','canvas'])test('deadline prevents late '+delayed+' setup after optional OCR import completes',()=>{
 const pause="await new Promise(resolve=>setTimeout(resolve,100));"
 restricted(withOptionalMocks(emptyPdfModule,(delayed==='worker'?pause:'')+workerModule,(delayed==='canvas'?pause:'')+canvasModule,`
  await import('pdfjs-dist/legacy/build/pdf.mjs');
  await assert.rejects(pdf.extractTextFromPdfBuffer(new Uint8Array(),{timeoutMs:25}),error=>error instanceof pdf.PdfTextExtractionTimeoutError);
  await new Promise(resolve=>setTimeout(resolve,130));assert.equal(globalThis.destroyed,1);
  ${delayed==='worker'?'assert.equal(globalThis.createdWorkers,undefined);':'assert.equal(globalThis.createdWorkers,2);'}
  assert.equal(globalThis.canvases,undefined);
 `))
})
for(const failing of ['pdf','worker','canvas'])test('elapsed deadline takes priority over late synchronous '+failing+' import rejection',()=>{
 const lateFailure="const until=performance.now()+60;while(performance.now()<until){/* Simulate a late failing optional module. */}throw Error('late module failure');"
 restricted(withOptionalMocks(failing==='pdf'?lateFailure:emptyPdfModule,failing==='worker'?lateFailure:workerModule,failing==='canvas'?lateFailure:canvasModule,`
  await assert.rejects(pdf.extractTextFromPdfBuffer(new Uint8Array(),{timeoutMs:25}),error=>error instanceof pdf.PdfTextExtractionTimeoutError);
 `))
})
