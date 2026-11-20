import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readCurrentListing,readCurrentRole} from './currentNative20261120.js'
const f=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-first-legal-scope-20261120.json.gz',import.meta.url)))),at=f.observedAt,text=p=>Buffer.from(p.bodyBase64,'base64').toString(),board=f.responses.find(p=>p.requestedUrl.includes('/en/search-jobs/')),rows=readCurrentListing(text(board),board.requestedUrl).rows,roles=f.responses.filter(p=>p.requestedUrl.includes('/en/job/')).map(p=>{const d=document(text(p)),m=readLiteralModel(d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0].raw,{rawControls:true}).value;return{p,m,row:rows.find(r=>r.url===p.requestedUrl)}})
test('PANW genuine exact own display brand is a valid current India partial with legal entity explicitly unknown',()=>{const {p,row}=roles.find(r=>r.m.hiringOrganization.name==='Palo Alto Networks'),j=readCurrentRole(text(p),row,at);assert.equal(j.nativeEmployerDisplayName,'Palo Alto Networks');assert.equal(j.sourceLegalEmployer,null);assert.equal(j.country,'India');assert.equal(j.sourceDetailComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)})
test('PANW current exact native India legal entity keeps its own original entity independently of the bare brand',()=>{const {p,row}=roles.find(r=>r.m.hiringOrganization.name==='Palo Alto Networks (India) Technologies Private Limited'),j=readCurrentRole(text(p),row,at);assert.equal(j.sourceLegalEmployer,'Palo Alto Networks (India) Technologies Private Limited');assert.equal(j.country,'India')})
test('PANW own publisher plus authored same-JR application never relabels a current CyberArk employer',()=>{const {p,row}=roles.find(r=>r.m.hiringOrganization.name==='CyberArk Software (India) Private Limited');assert.throws(()=>readCurrentRole(text(p),row,at),/employer|source scope/i)})
