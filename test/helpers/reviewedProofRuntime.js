import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {gunzipSync} from 'node:zlib'

const backend=fileURLToPath(new URL('../..',import.meta.url))
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')

export function readReviewedSnapshot(url,expectedHash) {
 const bytes=gunzipSync(fs.readFileSync(url));assert.equal(sha(bytes),expectedHash)
 return bytes
}

// Historical positive proofs are meaningful only against their exact reviewed
// source. Restore attested bytes in an isolated tree; keep the live checkout and
// immutable evidence unchanged. Unmodified directories can share dependencies.
export function createReviewedProofRuntime(fixture,{prefix='reviewed-proof-',extraFiles=new Map()}={}) {
 assert.match(prefix,/^[a-z0-9-]+-$/i)
 const temporary=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(temporary,prefix)),links=[],overrides=new Map(extraFiles)
 for(const receipt of fixture.httpEvidence.receipts.filter(r=>r.sourcePath)) {
  const relative=receipt.sourcePath,bytes=fixture.files.get(receipt.file)
  assert.ok(relative&&!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..'))
  assert.ok(Buffer.isBuffer(bytes));assert.equal(sha(bytes),receipt.sha256)
  overrides.set(relative,bytes)
 }
 const expanded=relative=>['scripts','scraper-support/providers',...overrides.keys()].some(file=>file===relative||file.startsWith(relative+'/'))
 function copy(directory,relative='') {
  const destination=path.join(root,relative);fs.mkdirSync(destination,{recursive:true})
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
   if(entry.name.startsWith('.env'))continue
   if(!relative&&!['package.json','node_modules','src','scripts','scraper','scraper-support'].includes(entry.name))continue
   const name=relative?relative+'/'+entry.name:entry.name,source=path.join(directory,entry.name),target=path.join(root,name)
   if(relative==='scraper'&&![...overrides.keys()].some(file=>file.startsWith(name+'/')))continue
   if(['scraper-support/tests','scraper-support/providers/providerExtensions'].includes(relative)&&!overrides.has(name))continue
   if(entry.isDirectory()) {
    if(expanded(name))copy(source,name)
    else {fs.symlinkSync(source,target,'junction');links.push(target)}
   } else fs.writeFileSync(target,overrides.get(name)??fs.readFileSync(source))
  }
 }
 function cleanup() {
  assert.equal(path.dirname(root),temporary);assert.ok(path.basename(root).startsWith(prefix))
  // Unlink junctions before recursive deletion so no shared tree is traversed.
  for(const link of links.reverse())fs.unlinkSync(link)
  fs.rmSync(root,{recursive:true})
 }
 try {
  copy(backend)
  for(const [relative,bytes]of overrides) {
   assert.ok(relative&&!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..'))
   const destination=path.join(root,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes)
  }
  // Catalog discovery stays on the live full catalog; the tiny replay tree
  // needs only the selected scraper, not thousands of unrelated source links.
  if(!overrides.has('scraper-support/providers/index.js'))fs.writeFileSync(path.join(root,'scraper-support/providers/index.js'),'export * from '+JSON.stringify(pathToFileURL(path.join(backend,'scraper-support/providers/index.js')).href)+';')
  // The freezer only needs the shared evidence loader. Forwarding it avoids
  // loading every unrelated partial-proof scraper into this selected replay.
  if(!overrides.has('scripts/partialPublishingGapEvidence.js'))fs.writeFileSync(path.join(root,'scripts/partialPublishingGapEvidence.js'),'export * from '+JSON.stringify(pathToFileURL(path.join(backend,'scripts/partialPublishingGapEvidence.js')).href)+';')
 } catch(error) {cleanup();throw error}
 return {root,url:relative=>pathToFileURL(path.join(root,relative)),cleanup}
}
