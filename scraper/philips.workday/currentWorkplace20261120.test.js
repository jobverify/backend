import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {countryMentions} from './currentAuthoredStatements20261120.js'
import {readCurrentRole} from './currentNative20261120.js'

const f=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-workplace-20261120.json.gz',import.meta.url)))),body=Buffer.from(f.response.bodyBase64,'base64'),html=body.toString(),row=()=>structuredClone(f.originalOpeningNativeRow),geo={countries:['India'],originalPlaces:[{country:'India',state:'Tamil Nadu',stateAbbr:'Tamil Nadu'}]}
function edit(change){const d=document(html),s=d.nodes(n=>n.tag==='script'&&!n.attrs.src&&n.raw.includes('phApp.ddo ='))[0],tree=parse(s.raw,{ecmaVersion:'latest'}),a=tree.body.find(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&n.expression.left.object?.name==='phApp'&&n.expression.left.property?.name==='ddo').expression.right,m=JSON.parse(s.raw.slice(a.start,a.end));change(m.jobDetail.data.job);return html.slice(0,s.openEnd)+s.raw.slice(0,a.start)+JSON.stringify(m)+s.raw.slice(a.end)+html.slice(s.closeStart)}

test('Philips new actual workplace regression retains the exact original HTTP body and published row',()=>{assert.equal(body.length,f.response.bytes);assert.equal(createHash('sha256').update(body).digest('hex'),f.response.sha256);assert.equal(f.response.status,200);assert.equal(row().url,f.response.requestedUrl)})
test('Philips actual attached administrative TK annotation cannot invent Tokelau inside an otherwise explicit India address',()=>{const j=readCurrentRole(html,row(),f.observedAt);assert.equal(j.country,'India');assert.equal(j.sourceNativeRecord.multi_location[1].country,'India');assert.match(j.sourceNativeRecord.multi_location[1].address,/Chengalpet\(TK\)/);assert.equal(j.sourceLegalEmployer,null);assert.equal(j.sourceDetailComplete,false)})
test('Philips free-text country abbreviations require standalone word or parenthetical boundaries',()=>{assert.deepEqual(countryMentions('Chengalpet(TK), Tamil Nadu, India',geo),['India']);assert.deepEqual(countryMentions('Chennai TK',geo),['Tokelau']);assert.deepEqual(countryMentions('Chennai, (TK)',geo),['Tokelau']);assert.deepEqual(countryMentions('(TK)',geo),['Tokelau'])})
for(const address of['Chennai, Tamil Nadu, Tokelau','Chennai TK','Chennai, (TK)','Chengalpet(Tokelau), Tamil Nadu, India'])test('Philips explicit foreign whole companion address remains a contradiction '+address,()=>{assert.throws(()=>readCurrentRole(edit(r=>r.multi_location[1].address=address),row(),f.observedAt),/country|workplace/i)})
test('Philips explicit typed TK country retains its country meaning despite attached administrative abbreviation policy',()=>{assert.throws(()=>readCurrentRole(edit(r=>r.country='TK'),row(),f.observedAt),/country|native/i)})
test('Philips full foreign country name cannot hide inside an actual primary state field',()=>{assert.throws(()=>readCurrentRole(edit(r=>r.state='Canada'),row(),f.observedAt),/country|workplace/i)})
