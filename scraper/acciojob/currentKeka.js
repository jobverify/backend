import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {createVerifiedFirstPartyKekaScraper} from '../../scraper-support/shared/verifiedFirstPartyKeka.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {createCurrentSourceScope,hasLiteralActiveKekaConfiguration,unhandledKekaGeography,finishCurrentKekaInventory} from '../../scraper-support/shared/kekaCurrentSourceScope.js'
const hash=value=>createHash('sha256').update(value).digest('hex')
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const countries=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
const invalidCountry=row=>!Array.isArray(row.jobLocations)||!row.jobLocations.length||row.jobLocations.some(loc=>{const code=loc.countryCode,name=loc.countryName;if(!/^[A-Z]{2}$/.test(code||'')||typeof name!=='string'||['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code))return true;const canonical=countries.of(code);return !canonical||canonical===code||!(canonical.toLowerCase()===name.toLowerCase()||code==='US'&&['usa','united states of america'].includes(name.toLowerCase())||code==='GB'&&name==='UK')})
const conflictingCountry=row=>Array.isArray(row.jobLocations)&&row.jobLocations.some(loc=>{if(!/^[A-Z]{2}$/.test(loc.countryCode||'')||typeof loc.countryName!=='string')return false;const canonical=countries.of(loc.countryCode);return canonical&&canonical!==loc.countryCode&&!['ZZ','XA','XB','UN','EU','EZ','QO'].includes(loc.countryCode)&&canonical.toLowerCase()!==loc.countryName.toLowerCase()&&!(loc.countryCode==='US'&&['usa','united states of america'].includes(loc.countryName.toLowerCase()))&&!(loc.countryCode==='GB'&&loc.countryName==='UK')})
export function canonicalPublicResponseProgram(body){
 const matches=[...body.matchAll(/window\.__CF\$cv\$params=\{r:'([a-f\d]{16})',t:'([A-Za-z0-9+/=]+)'\}/g)]
 if(matches.length!==1)return null
 const[whole,ray,timestamp]=matches[0],decoded=Buffer.from(timestamp,'base64').toString('ascii')
 if(!/^[1-9]\d{9}$/.test(decoded)||Buffer.from(decoded).toString('base64')!==timestamp||body.split(ray).length!==3||body.split('?ray='+ray).length!==2)return null
 return body.replace(whole,"window.__CF$cv$params={r:'REVIEWED_RAY',t:'REVIEWED_TIMESTAMP'}").replace('?ray='+ray,'?ray=REVIEWED_RAY')
}
function delayedLiteral(html,c){
 const doc=readNativeDocument(html),loader=doc.nodes(n=>n.tag==='script'&&n.attrs.id==='perfmatters-delayed-scripts-js')
 if(loader.length!==1||hash(loader[0].raw)!==c.delayedLoaderSha256)return false
 const configs=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='pmdelayedscript'&&!n.attrs.src&&n.raw?.includes('khConfig'))
 if(configs.length!==1)return false
 let program;try{program=parse(configs[0].raw,{ecmaVersion:'latest'})}catch{return false}
 const assignment=program.body.length===1&&program.body[0].type==='ExpressionStatement'&&program.body[0].expression
 if(!assignment||assignment.type!=='AssignmentExpression'||assignment.operator!=='='||assignment.left.type!=='MemberExpression'||assignment.left.computed||assignment.left.object?.name!=='window'||assignment.left.property?.name!=='khConfig'||assignment.right.type!=='ObjectExpression')return false
 const fields={};for(const property of assignment.right.properties){if(property.type!=='Property'||property.computed||property.method||property.shorthand||property.kind!=='init'||property.value.type!=='Literal'||typeof property.value.value!=='string')return false;const key=property.key.name??property.key.value;if(!['identifier','domain','portalName','targetContainer'].includes(key)||Object.hasOwn(fields,key))return false;fields[key]=property.value.value}
 return fields.identifier===c.identifier&&fields.domain===c.root&&(fields.portalName??'default')==='default'&&doc.nodes(n=>n.tag==='script'&&n.attrs.type==='pmdelayedscript'&&n.attrs.src===c.root+'api/embedjobs/js/'+c.identifier&&Object.hasOwn(n.attrs,'defer')).length===1
}
export async function runCurrentKeka(c,baselines,{fetchImpl=fetch,signal,fetchText,fetchPage,maxJobs,maxPages}={}){
 const fail=message=>{throw new Error(c.source+' current native inventory: '+message)}
 if(fetchText||fetchPage)fail('unsupported legacy transport; observed status and final URL fetchImpl is required')
 if(maxJobs!=null||maxPages!=null)fail('inventory caps unsupported for current full inventory')
 const runtimeBaselines=structuredClone(baselines)
 const scope=createCurrentSourceScope({baselines:runtimeBaselines,kekaRootUrl:c.root}),active=c.root+'api/embedjobs/default/active/'+c.identifier,board=c.root+'api/jobs/default/active',renderer=c.root+'api/embedjobs/js/'+c.identifier
 const observeScope=(url,html)=>{
  if(baselines[url]){
   const reviewed=structuredClone(baselines[url])
   for(const rule of c.equivalentInlinePrograms?.[url]||[]){
    const candidates=readNativeDocument(html).nodes(n=>n.tag==='script'&&!n.attrs.src&&!n.attrs.type&&canonicalPublicResponseProgram(n.raw||'')!=null&&hash(canonicalPublicResponseProgram(n.raw))===rule.canonicalSha256)
    const original='inline:javascript:'+rule.originalBodySha256
    if(candidates.length===1&&reviewed.scripts.includes(original))reviewed.scripts=reviewed.scripts.map(value=>value===original?'inline:javascript:'+hash(candidates[0].raw):value).sort()
   }
   runtimeBaselines[url]=reviewed
  }
  // The actual publisher HTML is unchanged; only the comparison admits the
  // exact reviewed program with validated per-response identity literals.
  scope.observe(url,html)
 }
 let actualRendererSha256,rendererUsesCountryNameOnly=false
 const request=async(url,{redirect=false}={})=>{signal?.throwIfAborted();const timeout=AbortSignal.timeout(20000);const r=await fetchImpl(url,{method:'GET',redirect:redirect?'manual':'follow',signal:signal?AbortSignal.any([signal,timeout]):timeout,headers:{Accept:'text/html,application/json,application/javascript','User-Agent':'JobverifyScraper/1.0'}});if(redirect){if(r.status!==302||r.url!==url||r.headers?.get('location')!==c.shellUrl)fail('official careers redirect identity changed');await r.text();return null}if(r.status!==200){const error=Error(c.source+' public HTTP '+r.status);error.status=r.status;error.abortRetries=true;throw error}const expected=c.expectedFinalUrls?.[url]??url;if(r.url!==expected)fail('observed final URL identity changed for '+url);const body=await r.text();signal?.throwIfAborted();timeout.throwIfAborted();if(Object.hasOwn(baselines,url)||url.includes('/careerportal/'))observeScope(url,body);if(url===renderer){scope.observeRenderer(url,body);actualRendererSha256=hash(body);rendererUsesCountryNameOnly=!body.includes('countryCode')&&body.includes('const { countryName } = location;')&&body.includes('group[countryName].push(job);')}return body}
 const binding=async()=>{if(c.mode==='portal-link'){const corporate=readNativeDocument(await request(c.officialUrl));if(!corporate.nodes(n=>n.tag==='a'&&new URL(n.attrs.href||'#',c.officialUrl).href.replace(/\/$/,'')===c.shellUrl.replace(/\/$/,'')).length)fail('missing active corporate careers handoff')}if(c.mode==='delayed'&&!delayedLiteral(await request(c.officialUrl),c))fail('missing actual reviewed delayed configuration bridge');if(c.mode==='redirect'){const home=readNativeDocument(await request(c.officialUrl));if(!home.nodes(n=>n.tag==='a'&&new URL(n.attrs.href||'#',c.officialUrl).href===c.redirectUrl).length)fail('missing active official careers handoff');await request(c.redirectUrl,{redirect:true});const shell=readNativeDocument(await request(c.shellUrl));if(!shell.nodes(n=>n.tag==='script'&&n.raw?.includes(new URL(c.documentUrl).pathname)).length)fail('actual portal document handoff changed')}for(const url of c.additionalPages||[])await request(url)}
 for(const reason of c.scopeLimitations||[])scope.gaps.add(reason)
 await binding()
 const config={source:c.source,companyName:c.companyName,officialUrl:c.mode==='redirect'?c.documentUrl:c.officialUrl,handoffType:c.mode==='portal-link'?'portal-link':'embedded-script',handoffUrl:c.mode==='portal-link'?c.shellUrl:renderer,kekaRootUrl:c.root,identifier:c.identifier,portalName:'default',portalIdentity:c.portalIdentity,...(c.mode==='portal-link'?{portalShellUrl:c.shellUrl}:{})}
 let raw,rawBody,unknown=[],resolvedForeign=[]
 const jobs=await createVerifiedFirstPartyKekaScraper(config).run({signal,fetchImpl:async url=>{const body=await request(url);const configurationPage=url===c.documentUrl||c.mode==='delayed'&&url===c.officialUrl;if(configurationPage){if(!(c.mode==='delayed'?delayedLiteral(body,c):hasLiteralActiveKekaConfiguration(body,{identifier:c.identifier,kekaRootUrl:c.root})))fail('missing active reviewed literal configuration');const doc=readNativeDocument(body);if(doc.nodes(n=>n.tag==='script'&&n.attrs.src===renderer).length!==1)fail('missing literal native renderer handoff')}if(url!==active)return new Response(body,{status:200});rawBody=body;raw=JSON.parse(body);if(!Array.isArray(raw))fail('unexpected inventory envelope');const seen=new Set();for(const row of raw){const id=String(row?.id??'');if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id))||seen.has(id))fail('invalid or duplicate raw role identity');seen.add(id);if(conflictingCountry(row))fail('recognized native country conflict for '+id)}const rule=c.foreignCountryProof;resolvedForeign=raw.filter(row=>{
   if(c.source!=='gameberrylabs'||!rule||String(row.id)!==rule.jobId)return false
   // The renderer's publishedSinceDays value is a display-age counter, not
   // geography. Only this named safe integer may vary in the COUNTRY proof;
   // the original complete row and all opening/closing criteria remain intact.
   const {publishedSinceDays,...stableCountrySignature}=row
   return rule.allowOnlyThisDisplayAgeField==='publishedSinceDays'
    &&Number.isSafeInteger(rule.referencePublishedSinceDays)&&rule.referencePublishedSinceDays>=0
    &&Number.isSafeInteger(publishedSinceDays)&&publishedSinceDays>=0
    &&hash(JSON.stringify(stableCountrySignature))===rule.stableSignatureSha256
    &&actualRendererSha256===rule.rendererSha256&&rendererUsesCountryNameOnly
    &&!unhandledKekaGeography(row).length&&row.jobLocations.length===1
    &&row.jobLocations[0].id===rule.locationId&&row.jobLocations[0].countryCode==='SP'
    &&row.jobLocations[0].countryName==='Spain'&&rule.country==='Spain'
  });unknown=raw.filter(row=>!resolvedForeign.includes(row)&&(unhandledKekaGeography(row).length||invalidCountry(row)));return new Response(JSON.stringify(raw.filter(row=>!unknown.includes(row)&&!resolvedForeign.includes(row))),{status:200})}})
 for(const url of [c.root+'api/embedjobs/grouplinkstatus/'+c.identifier,c.root+'api/organization/grouplinkstatus'])if(JSON.parse(await request(url))?.isGroupLinked!==false)fail('unresolved grouped employer scope')
 if(JSON.stringify(JSON.parse(await request(board)))!==JSON.stringify(raw))fail('board and embedded full inventories disagree')
 for(const native of raw){const id=String(native.id),url=c.root+'jobdetails/'+id,doc=readNativeDocument(await request(url));const identity=doc.nodes(n=>Object.hasOwn(n.attrs,'selectedjobid')).map(n=>n.attrs.selectedjobid),titles=doc.nodes(n=>n.tag==='h1'&&Object.hasOwn(n.attrs,'title')),descriptions=doc.nodes(n=>doc.hasClass(n,'job-description-container'));const nativeDoc=readNativeDocument(native.description),nativeText=clean(nativeDoc.text(nativeDoc.nodes(n=>n.tag==='root')[0]));if(!identity.length||identity.some(value=>value!==id)||titles.length!==1||descriptions.length!==1||clean(doc.text(titles[0]))!==clean(native.title)||!nativeText||clean(doc.text(descriptions[0]))!==nativeText)fail('active native full detail identity or criteria disagree for '+id);const job=jobs.find(j=>j.jobId===id);if(job){job.companyCareerPage=c.officialUrl;job.companyDomain=new URL(c.officialUrl).hostname.replace(/^www\./,'');job.sourceNativePayload=native;job.sourceNativeInventorySha256=hash(rawBody);job.sourceNativeDescriptionSha256=hash(native.description);job.sourceDetailComplete=nativeText.length>=80;if(!job.sourceDetailComplete)job.sourceDetailFailureKind='limited-source-content'}}
 await request(c.officialUrl);await binding()
 if(JSON.stringify(JSON.parse(await request(active)))!==JSON.stringify(raw)||JSON.stringify(JSON.parse(await request(board)))!==JSON.stringify(raw))fail('current full inventory changed during closing reconciliation')
 for(const job of jobs)if(resolvedForeign.length){job.sourceNativeResolvedForeignPayloads=resolvedForeign;job.sourceNativeCountryResolutionProofs=resolvedForeign.map(row=>({jobId:String(row.id),locationId:row.jobLocations[0].id,country:'Spain',originalCountryCode:'SP',originalCountryName:'Spain',rawRecordSha256:hash(JSON.stringify(row)),stableSignatureSha256:c.foreignCountryProof.stableSignatureSha256,allowOnlyThisDisplayAgeField:c.foreignCountryProof.allowOnlyThisDisplayAgeField,referenceRawRecordSha256:c.foreignCountryProof.rawRecordSha256,referencePublishedSinceDays:c.foreignCountryProof.referencePublishedSinceDays,actualPublishedSinceDays:row.publishedSinceDays,rendererSha256:actualRendererSha256,method:'exact-role-stable-country-signature-with-only-safe-integer-display-age-and-reviewed-countryName-only-renderer'}))}
 return finishCurrentKekaInventory(jobs,{raw,unknown,scope,evidence:{surface:active,firstParty:true,pagesFetched:1,verifiedAt:new Date().toISOString(),reason:'official-current-native-configuration-both-group-APIs-full-arrays-exact-active-details-source-scope-renderer-pins-and-closing-reconciliation'}})
}
