import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {corporateContract,nativePageContract,FRAME_URL} from './nativeContract.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261128.json.gz',import.meta.url))))
const reviewed=JSON.parse(readFileSync(new URL('./reviewedSurfaces.json',import.meta.url),'utf8'))
const change=(body,before,after)=>{assert.ok(body.includes(before),'mutation must alter genuine current HTML');assert.notEqual(before,after);return body.replace(before,after)}
const html=capture.corporate.body
const sha256=body=>createHash('sha256').update(body).digest('hex')

test('current Byteridge exact stylesheet declarations retain the visible official native handoff and inline-client scope hold',()=>{
 assert.equal(capture.corporate.sha256,'374988b2ba64dec6164191e525ae0ddf67284d87774196ce2401134a59af6662')
 assert.equal(sha256(html),capture.corporate.sha256)
 const contract=corporateContract(html)
 assert.deepEqual(contract.frames,[FRAME_URL])
 assert.deepEqual(contract.reasons,['unreviewed-corporate-inline-client'])
 assert.equal(contract.styles.stylesheets.length,38)
 assert.equal(contract.styles.inlineStyleSHA256.length,10)
})

test('current Byteridge complete stylesheet capture agrees with exact review evidence and unchanged prior CSS bodies',()=>{
 assert.equal(capture.styles.length,38)
 const previous=reviewed.corporateStyleVersions.find(p=>p.reviewedAt==='2026-11-20')
 const current=reviewed.corporateStyleVersions.find(p=>p.reviewedAt==='2026-11-28')
 assert.ok(current,'the current declaration requires its own finite reviewed profile')
 assert.deepEqual(current.inlineStyleSHA256,previous.inlineStyleSHA256)
 assert.deepEqual(current.stylesheets.map(u=>new URL(u).pathname),previous.stylesheets.map(u=>new URL(u).pathname))
 const priorByPath=new Map(previous.stylesheetEvidence.map(p=>[new URL(p.requestedURL).pathname,p]))
 const expected=new Map(current.stylesheetEvidence.map(p=>[p.requestedURL,p]))
 let equalBodies=0
 for(const packet of capture.styles){
  assert.equal(packet.status,200)
  assert.equal(packet.requestedUrl,packet.url)
  const evidence=expected.get(packet.url)
  assert.ok(evidence,'each of the 38 complete stylesheet bodies requires exact evidence')
  assert.equal(evidence.sha256,sha256(packet.body))
  assert.equal(evidence.bytes,Buffer.byteLength(packet.body))
  const prior=priorByPath.get(new URL(packet.url).pathname)
  if(prior){assert.equal(packet.sha256,prior.sha256);equalBodies++}
 }
 assert.equal(equalBodies,35)
})

for(const [name,before,after,error] of [
 ['unreviewed cache revision','custom-frontend.min.css?ver=1795789140','custom-frontend.min.css?ver=9999999999',/unreviewed corporate stylesheet/],
 ['different stylesheet origin','https://byteridge.com/wp-content/uploads/elementor/css/custom-frontend.min.css','https://other.invalid/wp-content/uploads/elementor/css/custom-frontend.min.css',/unreviewed corporate stylesheet/],
 ['additional hiding style','</head>','<style>#dynamic-iframe{display:none}</style></head>',/unreviewed corporate stylesheet/],
 ['hidden iframe','<iframe id="dynamic-iframe"','<iframe hidden id="dynamic-iframe"',/missing visible official careers iframe/],
 ['hidden ancestor','class="elementor-widget-container">\n\t\t\t\t\t<iframe id="dynamic-iframe"','hidden class="elementor-widget-container">\n\t\t\t\t\t<iframe id="dynamic-iframe"',/missing visible official careers iframe/],
 ['inline CSS opacity','scrolling="no" style="overflow: auto;"','scrolling="no" style="overflow:auto;opacity:0"',/missing visible official careers iframe/],
 ['replaced native handoff','src="https://byteridge.com/wp-content/career/index.html"','src="https://other.invalid/wp-content/career/index.html"',/missing visible official careers iframe/],
 ['official canonical','rel="canonical" href="https://byteridge.com/careers/"','rel="canonical" href="https://other.invalid/careers/"',/official canonical changed/],
 ['official employer','"name":"Byteridge"','"name":"Other Employer"',/official employer identity changed/],
])test('current Byteridge rejects '+name,()=>{
 assert.throws(()=>corporateContract(change(html,before,after)),error)
})

test('current Byteridge keeps extra hiring paths and frames outside company scope',()=>{
 const additional=corporateContract(change(html,'</body>','<a href="https://other.invalid/jobs">Other jobs</a><iframe src="https://other.invalid/careers"></iframe></body>'))
 assert.ok(additional.reasons.includes('unreviewed-corporate-inline-client'))
 assert.ok(additional.reasons.includes('additional-unreviewed-frame'))
 assert.ok(additional.reasons.includes('additional-unreviewed-hiring-path'))
})

test('current Byteridge corporate CSS review cannot qualify the independently changed native public program',()=>{
 const page=capture.nativeRole.body,doc=readNativeDocument(page)
 const schema=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').map(node=>JSON.parse(node.raw))
 assert.equal(schema.length,1)
 assert.equal(schema[0].hiringOrganization.name,'Byteridge Software Private Limited')
 assert.ok(page.includes('runtime-main.5580c07b07167ec174dd.js'),'the current captured native runtime is genuinely different')
 assert.throws(()=>nativePageContract(page,{JobTitle:schema[0].title}),/native public client version\/execution drift/)
})

test('current Byteridge additional corporate executable keeps an explicit company-scope hold',()=>{
 const contract=corporateContract(change(html,'</body>','<script src="https://other.invalid/careers.js"></script></body>'))
 assert.ok(contract.reasons.includes('unreviewed-corporate-inline-client'))
 assert.ok(contract.reasons.includes('additional-unreviewed-corporate-client'))
})
