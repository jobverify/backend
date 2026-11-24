import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {createWonksknowScraper} from './script.js';
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js';
import {HOME,originalPacket,originalText,replay,firstRoleURL,selectedFragment} from './fixtures/currentReplay20261121.js';
let originalFetch;
before(()=>{originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Programme-context tests prohibit live network');};});
after(()=>{globalThis.fetch=originalFetch;});
const expectedRoles=originalPacket.phases[0].roles.length;
function changeFooter(record,html,change){
 if(record.requestedUrl!==HOME)return html;
 const p=document(html),candidates=p.nodes(node=>node.tag==='p'&&/\bare divisions of WONKSKNOW LLC\b/.test(p.text(node)));assert.equal(candidates.length,1);
 const node=candidates[0],raw=p.outer(node),replacement=change(raw);assert.notEqual(replacement,raw);
 return html.slice(0,node.start)+replacement+html.slice(node.end);
}
function changeDescription(record,html,change){
 if(record.requestedUrl!==firstRoleURL)return html;
 const {parsed,owner}=selectedFragment(html,record.url),parts=owner.children.filter(node=>typeof node!=='string'),at=parts.findIndex(node=>parsed.text(node)==='JOB DESCRIPTION');assert(at>=0);
 const next=parts.findIndex((node,index)=>index>at&&parsed.text(node)==='JOB REQUIREMENT'),raw=parts.slice(at+1,next<0?undefined:next).map(parsed.outer).join('');assert(raw);assert.equal(html.split(raw).length,2);
 const replacement=change(raw);assert.notEqual(replacement,raw);return html.replace(raw,replacement);
}
function heldOnlyProgramme(out){assert.equal(out.error,null);assert.equal(out.readCount,originalPacket.responses.length);assert.equal(out.jobs.length,expectedRoles-1);assert(!out.jobs.some(job=>job.sourceUrl===firstRoleURL));assert.equal(out.audit.held.length,1);assert(out.jobs.every(job=>job.nativeEmployer==='Wonksknow'));}
test('actual paired own division and selected programme declaration retain raw relationship with nativeEmployer null',async()=>{
 const out=await replay(createWonksknowScraper);assert.equal(out.error,null);assert.equal(out.jobs.length,expectedRoles);
 const job=out.jobs.find(job=>job.sourceUrl===firstRoleURL);assert(job);assert.equal(job.nativeEmployer,null);assert.equal(job.sourceEmployerRelationshipUnresolved,true);assert.equal(job.legalEmployer,null);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.company,'Wonksknow');assert.equal(job.sourceNativePublisher,'Wonksknow');assert(out.jobs.filter(other=>other!==job).every(other=>other.nativeEmployer==='Wonksknow'&&other.sourceEmployerRelationshipUnresolved===false));
 assert.equal(job.sourceProgrammeRelationships.length,2);assert.deepEqual(job.sourceProgrammeRelationships.map(item=>item.phase),['opening','closing']);
 for(const phase of job.sourceProgrammeRelationships){assert.equal(phase.programmes.length,1);const programme=phase.programmes[0];assert.equal(programme.rawSubject,'YoungWonks');assert.equal(programme.relationship,'own-declared-division-selected-programme');assert.match(programme.originalDivisionDeclaration.text,/YoungWonks.*are divisions of WONKSKNOW LLC/);assert.match(programme.originalDivisionDeclaration.rawHTML,/<p\b/);assert.match(programme.selectedProgrammeClassification,/YoungWonks is a leading computer science program/);assert(phase.recruitingAssertions.some(item=>item.rawSubject==='YoungWonks'));}
 assert.equal(job.country,'India');assert.equal(job.nativeCountry,null);assert.equal(job.sourceCountryEvidence.inferredFromEmployerName,false);
});
test('missing own division declarations cannot be supplied by caller options and hold only programme role',async()=>{
 const out=await replay(createWonksknowScraper,{mutate:(record,html)=>changeFooter(record,html,()=>''),options:{programmeRelationships:[{name:'YoungWonks',publisher:'WONKSKNOW LLC'}],declaredProgrammes:['YoungWonks']}});heldOnlyProgramme(out);
});
test('inert actual own footer division declarations cannot qualify the selected programme',async()=>{
 const out=await replay(createWonksknowScraper,{mutate:(record,html)=>changeFooter(record,html,raw=>raw.replace('<p','<p hidden'))});heldOnlyProgramme(out);
});
test('division evidence in opening only cannot qualify the closing programme observation',async()=>{
 const out=await replay(createWonksknowScraper,{mutate:(record,html)=>record.phase==='closing'?changeFooter(record,html,()=>''):html});heldOnlyProgramme(out);
});
test('own footer division name fragments cannot qualify a different exact recruiting subject',async()=>{
 const out=await replay(createWonksknowScraper,{mutate:(record,html)=>changeFooter(record,html,raw=>raw.replace('YoungWonks','YoungWonks Academy'))});heldOnlyProgramme(out);
});
test('declared division without selected explicit programme classification remains employer unresolved and held',async()=>{
 const out=await replay(createWonksknowScraper,{mutate:(record,html)=>changeDescription(record,html,raw=>{assert(raw.includes('leading computer science program'));return raw.replace('leading computer science program','computer science education service');})});heldOnlyProgramme(out);
});
test('unknown foreign recruiting subject cannot borrow own client prose or actual programme context',async()=>{
 const out=await replay(createWonksknowScraper,{mutate:(record,html)=>changeDescription(record,html,raw=>'<p>Other Academy is looking for its own employee. Wonksknow provides recruiting tools for our clients.</p>'+raw)});heldOnlyProgramme(out);
});
