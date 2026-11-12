import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createEyScraper } from './script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const load = name => JSON.parse(gunzipSync(fs.readFileSync(new URL(`../../test/fixtures/${name}.json.gz`,import.meta.url))))
const fixture = load('ey-inventory-contract-20261112')
const country = load('ey-country-details-20261112')
const page = fixture.packets.find(packet=>packet.method==='GET' && packet.requestedUrl.includes('/ey/search/'))
const facet = fixture.packets.find(packet=>packet.method==='POST')
const client = fixture.packets.find(packet=>packet.requestedUrl.includes('/platform/js/'))
const role = country.packets[0]
const rename = load('ey-native-rename-20261112').packets[0]
const listingRow = listing => `<tr class="data-row"><td><a class="jobTitle-link" href="${listing.sourceUrl}">${listing.title}</a></td><td><span class="jobLocation">${listing.location}</span></td></tr>`
// Controlled one-role traversal over retained native HTML/client/facet bytes.
// Original packets and hashes above remain unchanged and independently checked.
const onePage = (rolePacket=role) => {
  let first = true
  return page.body.replace(/<tr class="data-row">[\s\S]*?<\/tr>/g,()=>{
    if (!first) return ''
    first=false
    return listingRow(rolePacket.listing)
  }).replace(/(<span class="paginationLabel"[^>]*>)[\s\S]*?(<\/span>)/g,'$11 to 1 of 1$2')
    .replace(/(<span class="srHelp"[^>]*>)[\s\S]*?(<\/span>)/g,'$1Page 1 of 1$2')
}
const replay = async ({rolePacket=role,alterPage=html=>html,alterRole=html=>html,alterClient=html=>html,facetCounts=[1,1],missingFacet=false,holdClosing=false,collectionBudgetMs}={}) => {
  let facets = 0
  let clients = 0
  let openingReads = 0
  return createEyScraper().run({collectionBudgetMs,fetchText:async (value,options={})=>{
    const url=new URL(value)
    if (url.pathname === '/ey/search/') {
      assert.equal(url.searchParams.get('locale'),'en_GB')
      if (url.searchParams.has('startrow')) return alterPage(onePage(rolePacket).replace(/<tr class="data-row">[\s\S]*?<\/tr>/g,'').replace('1 to 1 of 1','2 to 1 of 1').replace('Page 1 of 1','Page 2 of 1'))
      if (++openingReads > 1 && holdClosing) return new Promise(()=>{})
      return alterPage(onePage(rolePacket))
    }
    if (url.pathname === '/platform/js/j2w/min/options-search.min.js') return alterClient(client.body,++clients)
    if (url.pathname === '/services/jobs/options/facetValues/') {
      assert.equal(options.method,'POST')
      assert.deepEqual(JSON.parse(options.body),{
        page:0,keywords:'',locationsearch:'',sortby:'referencedate',sortdir:'desc',sortfield:'title',recordsperpage:25,startrow:0,
        facetquery:{facet:true,mincount:1,limit:5000,fields:['customfield1','country','city'],sort:'index',showPicklistAllLocales:true},filterquery:{},
      })
      const body=JSON.parse(facet.body)
      body.facets.map.country=missingFacet ? [] : [{translated:'India',name:'IN',count:facetCounts[Math.min(facets++,facetCounts.length-1)]}]
      return JSON.stringify(body)
    }
    assert.equal(value,rolePacket.requestedUrl)
    return alterRole(rolePacket.body)
  }})
}

test('retained EY all-locale/client responses retain their original body hashes and match the native locale census',()=>{
  for (const packet of fixture.packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.hash)
  assert.equal(JSON.parse(facet.requestBody).facetquery.showPicklistAllLocales,true)
  assert.match(page.body,/<html[^>]*\blang="en-GB"/)
  assert.equal(JSON.parse(facet.body).facets.map.country.find(row=>row.name==='IN').count,2879)
})

test('EY completes only a bound all-locale count, native role, terminal and full closing reconciliation',async()=>{
  const jobs=await replay()
  assert.equal(jobs.length,1)
  assert.equal(readInventoryEvidence(jobs).status,'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,1)
  assert.equal(jobs[0].sourceDetailComplete,true)
  assert.equal(jobs[0].requisitionId,'1730203')
  assert.equal(jobs[0].employmentType,null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),false)
})

test('a publisher-supported native canonical rename participates in the complete posting and requisition census',async()=>{
  const jobs=await replay({rolePacket:rename})
  assert.equal(readInventoryEvidence(jobs).status,'complete-inventory')
  assert.equal(jobs[0].jobId,'1447393933')
  assert.equal(jobs[0].requisitionId,'1750259')
})

test('the EY source deadline retains completed real details and the explicit budget reason during closing',async()=>{
  const jobs=await replay({holdClosing:true,collectionBudgetMs:2000})
  assert.equal(jobs.length,1)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reason,'native-collection-budget-exhausted')
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for (const [name,options,reason] of [
  ['wrong native locale',{alterPage:html=>html.replace(/lang="en-GB"/g,'lang="en-US"')},'ey-native-locale-unverified'],
  ['hidden locale partition',{facetCounts:[0,0]},'ey-native-india-facet-count-unreconciled'],
  ['missing native India facet',{missingFacet:true},'ey-native-india-facet-missing'],
  ['count drift',{facetCounts:[1,2]},'ey-native-india-facet-count-drift'],
  ['changed native options client',{alterClient:body=>body.replace('showPicklistAllLocales','unsupportedLocaleScope')},'ey-native-options-client-unverified'],
  ['closing options client byte drift under an unchanged URL',{alterClient:(body,call)=>call===1?body:body.replace('showPicklistAllLocales','unsupportedLocaleScope')},'ey-native-options-client-unverified'],
  ...['application/json','application/ld+json'].map(type=>[
    `inert ${type} options carrier`,
    {alterPage:html=>html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g,(tag,body)=>body.includes('j2w.search.options =')?`<script type="${type}">${body}</script>`:tag)},
    'ey-native-options-page-unverified',
  ]),
  ...[
    ['commented',code=>`/*${code}*/`],
    ['string',code=>`${JSON.stringify(code)};`],
    ['disabled branch',code=>`if (false) {${code}}`],
    ['uncalled function',code=>`function unusedOptionsCarrier() {${code}}`],
  ].map(([name,wrap])=>[
    `${name} options assignment`,
    {alterPage:html=>html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g,(tag,attributes,code)=>
      code.includes('j2w.search.options =')?`<script${attributes}>${wrap(code)}</script>`:tag)},
    'ey-native-options-page-unverified',
  ]),
  ['additional unsupported options assignment',{
    alterPage:html=>html.replace('</body>', '<script>j2w.search.options = {isOpen:true,facets:["country"],showPicklistAllLocales:false};</script></body>'),
  },'ey-native-options-page-unverified'],
  ['inert external options-client declaration',{
    alterPage:html=>html.replace(/<script\b([^>]*src="\/platform\/js\/j2w\/min\/options-search\.min\.js[^>]+)>/g,
      (tag,attributes)=>`<script${attributes.replace(/type="[^"]+"/,'type="application/json"')}>`),
  },'ey-native-options-client-unverified'],
  ['wrong native role canonical',{alterRole:body=>body.replace(`rel="canonical" href="${role.requestedUrl}"`,'rel="canonical" href="https://careers.ey.com/ey/job/Different/9999999999/"')},'ey-native-role-identity-unreconciled'],
  ['foreign native canonical with matching posting ID',{alterRole:body=>body.replace(`rel="canonical" href="${role.requestedUrl}"`,`rel="canonical" href="${role.requestedUrl.replace('careers.ey.com','outside.example')}"`)},'ey-native-role-identity-unreconciled'],
  ['wrong native application posting ID',{alterRole:body=>body.replaceAll('/apply/1420954633/','/apply/9999999999/')},'ey-native-role-identity-unreconciled'],
  ['conflicting native head and schema titles',{alterRole:body=>body.replace(/<title>[\s\S]*?<\/title>/,'<title>Different role Job Details | EY</title>')},'ey-native-role-identity-unreconciled'],
  ['missing native requisition',{alterRole:body=>body.replace('>1730203','>')},'ey-native-role-identity-unreconciled'],
  ['unbound numeric native field',{alterRole:body=>body.replace('Requisition ID:','Other reference:')},'ey-native-role-identity-unreconciled'],
  ['additional active criteria carrier',{alterRole:body=>body.replace('<span itemprop="jobLocation"','<span itemprop="description">Additional mandatory criteria.</span><span itemprop="jobLocation"')},'ey-native-role-criteria-unreconciled'],
  ['unresolved native country scope',{alterRole:body=>body.replaceAll('content="US"','content="Global"').replace('content="Pune, IN, 411057"','content="Pune, Global, 411057"')},'ey-native-role-country-unreconciled'],
]) test(`EY holds completion and cleanup for ${name}`,async()=>{
  const jobs=await replay(options)
  assert.equal(jobs.length,1)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason,new RegExp(reason))
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
