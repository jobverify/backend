import assert from 'node:assert/strict'
import test from 'node:test'
import PDFDocument from 'pdfkit'
import {readDescriptionPDF,nativePDFRoleIdentity} from '../scraper/fullertonindia/nativeDetails.js'
import {pdfTextWorkerCoreResourceState} from '../scraper-support/shared/pdfTextWorkerCore.js'

// Generated PDF documents below are labelled controls, never employer captures.
const paragraph='Controlled responsibilities require designing services, validating records and reviewing production systems. '
const pdf=async pages=>{
  const chunks=[],document=new PDFDocument({autoFirstPage:false})
  const result=new Promise((resolve,reject)=>{document.on('data',chunk=>chunks.push(chunk));document.on('end',()=>resolve(Buffer.concat(chunks)));document.on('error',reject)})
  for(const text of pages){document.addPage();if(text)document.fontSize(10).text(text)}
  document.end();return result
}
test('generated native PDF control preserves every page and rejects a contradictory later role title',async()=>{
  const bytes=await pdf(['Job Title Manager, Data Engineering\n'+paragraph.repeat(3),'Job Title Business Manager\n'+paragraph.repeat(3)])
  const result=await readDescriptionPDF(bytes)
  assert.equal(result.pages.length,2)
  assert.match(result.pages[1],/Job Title Business Manager/)
  assert.equal(nativePDFRoleIdentity(result,{Position_Name:'Manager, Data Engineering'}).complete,false)
  assert.equal(pdfTextWorkerCoreResourceState().documents,0)
})
for(const tail of ['', 'short'])test('generated native PDF cannot hide an unreadable later page: '+JSON.stringify(tail),async()=>{
  await assert.rejects(readDescriptionPDF(await pdf(['Job Title Manager, Data Engineering\n'+paragraph.repeat(3),tail])),/page has no complete extractable text/)
  assert.equal(pdfTextWorkerCoreResourceState().documents,0)
})
test('generated native PDF retains the existing thirty-page source ceiling',async()=>{
  await assert.rejects(readDescriptionPDF(await pdf(Array(31).fill(paragraph))),error=>error.code==='PDF_TEXT_CORE_LIMIT')
  assert.equal(pdfTextWorkerCoreResourceState().documents,0)
})
test('a malformed native PDF cannot turn into partial success or an OCR fallback',async()=>{
  await assert.rejects(readDescriptionPDF(Buffer.from('%PDF-1.7\n'+'This is a malformed controlled document. '.repeat(10))))
  assert.equal(pdfTextWorkerCoreResourceState().documents,0)
})
for(const reason of [null,false,0,'',Object.freeze(Error('Frozen source cancellation'))])test('native PDF source preserves exact caller cancellation '+String(reason),async()=>{
  const caller=new AbortController();caller.abort(reason)
  await assert.rejects(readDescriptionPDF(Buffer.alloc(0),{signal:caller.signal}),value=>Object.is(value,reason))
  assert.equal(pdfTextWorkerCoreResourceState().documents,0)
})
