import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readPublishedPdf} from '../scraper/cdot/pdfDocument.js'
import {bindNativeDeploymentCountry} from '../scraper/cdot/nativeCountry.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/cdot-native-quality.json.gz',import.meta.url))))
const packet=fixture.packets[1],pdf=await readPublishedPdf(Buffer.from(packet.bodyBase64,'base64'))
const original={pages:pdf.pages.slice(0,7).map(p=>({...p,text:p.text.replace(/\s+/g,' ').trim()})),sha256:pdf.sha256,role:{title:'Young Professional – Product Engineering & Sustenance',workplace:'Delhi'}}
const edited=edit=>{const input=structuredClone(original);edit(input);return bindNativeDeploymentCountry(input)}
test('C-DOT country binding resolves the original selected-candidate deployment reference with inspectable native pages',()=>{
 const result=bindNativeDeploymentCountry(original)
 assert.equal(result.country,'India');assert.equal(result.proof.literalRoleCountry,false);assert.equal(result.proof.contextualBinding,true)
 assert.deepEqual(result.proof.deploymentPages,[7]);assert.equal(result.proof.issuerPage,1);assert.equal(result.proof.documentSHA256,packet.bodySHA256)
 assert.equal(result.proof.exactCampusEstablished,false);assert.equal(result.proof.contactAddressUsed,false)
})
test('C-DOT government identity and native Delhi without the deployment clause never establish role country',()=>{
 const result=edited(v=>{v.pages[6].text=v.pages[6].text.replace('throughout the country.','as required.')})
 assert.equal(result.country,null);assert.equal(result.proof,null)
})
test('C-DOT changed or multiple role workplaces cannot inherit the reviewed national deployment binding',()=>{
 for(const workplace of ['London','Delhi / Paris','Remote'])assert.equal(edited(v=>{v.role.workplace=workplace}).country,null)
})
test('C-DOT overseas alternatives and a changed national antecedent leave the whole native role partial',()=>{
 for(const extra of ['Overseas assignments may be required.','Country: France.','For this advertisement the country means Nepal.'])
  assert.equal(edited(v=>{v.pages[6].text+=' '+extra}).country,null,extra)
})
test('C-DOT an exception excluding this role from the national General Terms defeats country qualification',()=>{
 for(const extra of ['These General Terms do not apply to this post.','This post is excluded from clause 2.','These terms apply only to Scientist posts.'])
  assert.equal(edited(v=>{v.pages[6].text+=' '+extra}).country,null,extra)
})
test('C-DOT an added deployment exception inside the applicable clause cannot be silently dropped',()=>{
 const result=edited(v=>{v.pages[6].text=v.pages[6].text.replace('throughout the country.','throughout the country. Different arrangements may be agreed.')})
 assert.equal(result.country,null)
})
test('C-DOT foreign government referents and missing primary-language precedence require explicit review',()=>{
 assert.equal(edited(v=>{v.pages[0].text+=' Government of Nepal.'}).country,null)
 assert.equal(edited(v=>{v.pages[4].text=v.pages[4].text.replace('English version will prevail','each version has equal authority')}).country,null)
})
test('C-DOT country proof depends on native scope rather than a frozen PDF body or unrelated criterion text',()=>{
 const result=edited(v=>{v.pages[1].text=v.pages[1].text.replace('Minimum Percentage 70%','Minimum Percentage 80%');v.sha256='a'.repeat(64)})
 assert.equal(result.country,'India');assert.equal(result.proof.documentSHA256,'a'.repeat(64))
})
test('C-DOT a foreign duty station cannot qualify through an unchanged national deployment clause',()=>{
 for(const extra of ['11. This post is based in France.','11. Duty station: Paris, France.'])
  assert.equal(edited(v=>{v.pages[6].text=v.pages[6].text.replace('**End of Document**',extra+' **End of Document**')}).country,null,extra)
 assert.equal(edited(v=>{v.pages[0].text+=' This post is based in France.'}).country,null)
})
test('C-DOT inapplicable General Terms with matching observations cannot qualify the role country',()=>{
 const extra='11. These General Terms are inapplicable to this post.'
 assert.equal(edited(v=>{v.pages[6].text=v.pages[6].text.replace('**End of Document**',extra+' **End of Document**')}).country,null)
})
