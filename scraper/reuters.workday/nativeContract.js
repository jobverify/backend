import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readNativeDocument,extractActiveDescription,activeHead,readNativeAttributeTokens,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'

export const PROFILE=JSON.parse(fs.readFileSync(new URL('./nativeProfile20261107.json',import.meta.url)))
export const SOURCE='reuters',sha=value=>createHash('sha256').update(value).digest('hex')
export const failure=message=>Object.assign(Error('[reuters] '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',lifecycleCleanupAllowed:false})
export const need=(condition,message)=>{if(!condition)throw failure(message)}
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)
const nonempty=v=>v!=null&&v!==''&&(!Array.isArray(v)||v.length>0)
export const same=(a,b)=>{try{assert.deepEqual(a,b);return true}catch{return false}}
function fields(value,allowed,label){need(object(value)&&Object.keys(value).every(k=>allowed.includes(k)),label+' contains unknown fields')}
function text(v,label){need(typeof v==='string'&&v.trim()===v&&v.length>0,label+' missing or malformed');return v}
export const parseJSON=page=>{try{readLiteralModel(page.html);return JSON.parse(page.html)}catch(cause){throw Object.assign(failure('invalid or duplicate native JSON'),{cause,nativeDuplicateKeys:cause.duplicateKeys??[]})}}
const exactLinks=(doc,label,url,count=null)=>{const links=doc.nodes(n=>n.tag==='a'&&doc.text(n)===label);need(links.length>0&&(count==null||links.length===count)&&links.every(n=>n.attrs.href===url),'current '+label+' routing declaration changed');return links.map(n=>({text:doc.text(n),href:n.attrs.href,attrs:n.attrs}))}
const reviewedOpacity=doc=>{const styles=[];const visit=n=>{if(typeof n==='string')return;if(n.tag==='style'){styles.push({raw:n.raw||'',attrs:n.attrs});return}if(n.inert)return;for(const child of n.children||[])visit(child)};visit(doc.nodes(n=>n.tag==='root')[0]);return styles.filter(s=>s.raw.includes(PROFILE.agencyInitialBodyOpacityRule)).length===1&&styles.some(s=>sha(s.raw)===PROFILE.agencyInitialEnclosingStyleSHA256&&Object.keys(s.attrs).length===0)}
export function readAuthority(page,kind){
 const d=readNativeDocument(page.html),titles=activeHead(page.html).titles;need(titles.length===1,'ambiguous corporate document title')
 let routes
 if(kind==='corporate-home'){need(page.url===PROFILE.corporateHomeFinal&&/Thomson Reuters/.test(titles[0]),'configured corporate owner changed');routes=exactLinks(d,'Reuters News & Media',PROFILE.agencyHome)}
 else if(kind==='agency-home'){need(page.url===PROFILE.agencyHome&&/Reuters/.test(titles[0]),'Reuters agency owner changed');need(reviewedOpacity(d),'reviewed agency initial opacity declaration changed');routes=exactLinks(d,'Careers',PROFILE.agencyCareers,2)}
 else if(kind==='agency-careers'){need(page.url===PROFILE.agencyCareers&&titles[0]==='Careers'&&d.nodes(n=>n.tag==='h1'&&d.text(n)==='Careers').length===1,'Reuters agency careers context changed');need(reviewedOpacity(d),'reviewed agency initial opacity declaration changed');need(d.nodes(n=>n.tag==='p'&&d.text(n)==='Deepen your reporting skills, broaden your global perspective, and work alongside Reuters journalists.').length===1,'Reuters-owned careers context changed');routes=exactLinks(d,'Discover vacancies',PROFILE.corporateCareers,1)}
 else {need(kind==='corporate-careers'&&page.url===PROFILE.corporateCareers&&/Careers.*Thomson Reuters/.test(titles[0]),'configured corporate careers changed');const visible=readVisibleNativeDocument(page.html,{strict:true});routes=exactLinks(visible,'View open roles',PROFILE.board,1)}
 return{kind,url:page.url,title:titles[0],routes,bodySHA256:sha(page.html),rawHTML:page.html,semanticRoutingOnly:kind!=='corporate-careers',agencyBrowserVisibilityCertified:false,roleOrApplicationQualification:false}
}
export function readBoard(page){
 need(page.url===PROFILE.board,'native board account URL changed')
 const cohorts=[{version:PROFILE.version,bootstrap:PROFILE.bootstrap,client:PROFILE.client,current:false},{...PROFILE.currentNative20261115,current:true}],matches=cohorts.filter(c=>page.html.startsWith(c.bootstrap.prefix)&&page.html.endsWith(c.bootstrap.suffix))
 need(matches.length===1,'native bootstrap executable/markup/profile changed')
 const cohort=matches[0],{prefix,suffix}=cohort.bootstrap,token=page.html.slice(prefix.length,page.html.length-suffix.length)
 // This one public literal is never decoded or supplied to a request. Every
 // executable/markup byte outside it remains exact for the selected cohort.
 const tokenValid=cohort.current?token.length===cohort.bootstrap.tokenCharacters&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(token):/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(token)
 need(tokenValid,'native exact bootstrap data slot changed')
 return{tenant:PROFILE.tenant,site:PROFILE.site,cohort:cohort.version,clientURL:cohort.client.url,clientContract:cohort.client,rawHTML:page.html,bodySHA256:sha(page.html),publicTokenGUID:cohort.current?null:token,publicTokenCharacters:token.length,tokenUsedForRequests:false,programExecuted:false,metadataOnly:true,renderedOperationQualified:false}
}
export function readClient(page,board=null){
 const version=board?.cohort??PROFILE.version,cohort=version===PROFILE.version?PROFILE:version===PROFILE.currentNative20261115.version?PROFILE.currentNative20261115:null
 need(cohort&&page.url===cohort.client.finalURL&&sha(page.html)===cohort.client.SHA256,'current complete native client URL/hash changed')
 return{cohort:version,requestedURL:cohort.client.url,finalURL:page.url,bodySHA256:sha(page.html),programExecuted:false,metadataOnly:true,renderedOperationQualified:false,cspExecutionQualified:false,applicationAcceptanceVerified:false,filterSemantics:'Literal public native facet identities and complete server JSON models; full declared client bytes pinned without execution or a rendered/application behavior claim.'}
}
const findFacet=(value,expected)=>{const hits=[];const visit=nodes=>{for(const n of nodes||[]){if(n?.facetParameter===expected.facetParameter)hits.push(n);for(const child of n?.values||[])if(child?.facetParameter)visit([child])}};visit(value.facets);need(hits.length===1,'missing/duplicate published '+expected.facetParameter+' facet');const values=hits[0].values.filter(v=>v?.id===expected.id||v?.descriptor===expected.descriptor);need(values.length===1&&values[0].id===expected.id&&values[0].descriptor===expected.descriptor&&Number.isSafeInteger(values[0].count)&&values[0].count>=0,'published facet identity/count changed');return{facetParameter:expected.facetParameter,...values[0]}}
function categoryValues(model){const categories=model.facets.filter(f=>f.facetParameter===PROFILE.news.facetParameter);need(categories.length===1,'native category facet missing/duplicate');const category=categories[0];fields(category,['facetParameter','descriptor','values'],'native category facet');need(category.descriptor==='Job Category'&&Array.isArray(category.values),'native category facet descriptor changed');const ids=new Set;for(const [index,value]of category.values.entries()){fields(value,['id','descriptor','count'],'native category facet value');text(value.descriptor,'category descriptor');need(/^[a-f0-9]{32}$/.test(value.id||'')&&!ids.has(value.id)&&Number.isSafeInteger(value.count)&&value.count>=0,'native category facet duplicate/malformed tuple');ids.add(value.id);need(!index||category.values[index-1].count>=value.count,'native category facet count ordering changed')}return category}
function countryValues(model){const facets=model.facets.filter(f=>f.facetParameter===PROFILE.country.facetParameter);need(facets.length===1,'native country facet missing/duplicate');const facet=facets[0];fields(facet,['facetParameter','descriptor','values'],'native country facet');need(facet.descriptor==='Location Country'&&Array.isArray(facet.values),'native country facet descriptor changed');const ids=new Set;for(const [index,value]of facet.values.entries()){fields(value,['id','descriptor','count'],'native country facet leaf');text(value.descriptor,'native country facet descriptor');need(/^[a-f0-9]{32}$/.test(value.id||'')&&!ids.has(value.id)&&Number.isSafeInteger(value.count)&&value.count>=0,'native country facet duplicate/malformed tuple');ids.add(value.id);need(!index||facet.values[index-1].count>=value.count,'native country facet count ordering changed')}return facet}
export function listingComparisonModel(model){const copy=structuredClone(model);for(const facet of [categoryValues(copy),countryValues(copy)])facet.values.sort((a,b)=>b.count-a.count||(a.id<b.id?-1:a.id>b.id?1:0));return copy}
export function readListing(page,{selected=false,offset=0}={}){
 const model=parseJSON(page);fields(model,['total','jobPostings','facets','userAuthenticated'],'listing envelope');need(Number.isSafeInteger(model.total)&&model.total>=0&&Array.isArray(model.jobPostings)&&model.jobPostings.length<=20&&Array.isArray(model.facets)&&model.userAuthenticated===false,'native listing count/status malformed')
 const seen=new Set;for(const row of model.jobPostings){fields(row,PROFILE.fieldSets.row,'listing row');text(row.title,'listing title');need(typeof row.externalPath==='string'&&/^\/job\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+_JREQ\d+(?:-\d+)?$/.test(row.externalPath)&&!seen.has(row.externalPath),'invalid/duplicate native posting identity');seen.add(row.externalPath);need(Array.isArray(row.bulletFields)&&(selected?row.bulletFields.length===3:[2,3].includes(row.bulletFields.length))&&row.bulletFields.every(v=>typeof v==='string'&&v.trim())&&/^JREQ\d+$/.test(row.bulletFields.at(-1))&&new RegExp('_'+row.bulletFields.at(-1)+'(?:-\\d+)?$').test(row.externalPath),'native listing requisition fields conflict');text(row.postedOn,'listing posting label');need(typeof row.remoteType==='string','native listing workplace type missing')}
 categoryValues(model);countryValues(model);const country=findFacet(model,PROFILE.country),news=findFacet(model,PROFILE.news);if(selected&&offset===0)need(model.total===country.count&&model.total===news.count,'selected facet/total contradiction');return{model,rows:model.jobPostings,total:model.total,country,news,offset,selected,rawBody:page.html,bodySHA256:sha(page.html)}
}
export const requestBody=(offset=0,selected=true)=>JSON.stringify({appliedFacets:selected?{[PROFILE.country.facetParameter]:[PROFILE.country.id],[PROFILE.news.facetParameter]:[PROFILE.news.id]}:{},limit:20,offset,searchText:''})
function calendar(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v?v:null}
function closingText(v){if(typeof v!=='string')return null;const m=v.match(/^End Date: (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})$/);if(!m)return null;return calendar(m[3]+'-'+String(['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(m[1])+1).padStart(2,'0')+'-'+m[2].padStart(2,'0'))}
function country(v,alpha){fields(v,['id','descriptor',...(alpha?['alpha2Code']:[])],'typed native country');need(v.id===PROFILE.country.id&&v.descriptor==='India'&&(!alpha||v.alpha2Code==='IN'),'native India country identity conflict')}
// Subjects select complete blocks for review; no sentence is interpreted as a
// country, employer or date. Unknown wording on these subjects is not evidence.
const authoritySubjects=[
 ['geography',/\b(?:locat\w*|based?|workplaces?|worksites?|offices?|onsite|on-site|hybrid|remote|relocat\w*|geograph\w*|countr(?:y|ies)|cit(?:y|ies)|territor\w*|states?|residen\w*|domicil\w*|headquarter\w*|newsrooms?|destinations?|abroad|overseas|duty[- ]+station|assigned[- ]+to|stationed)\b/i],
 ['employment',/\b(?:employ(?:ers?|ment|ed|ees?|ing)|legal|entit(?:y|ies)|hiring|hires?|recruit\w*|payroll|contract\w*|corporations?|compan(?:y|ies)|full[- ]time|part[- ]time|permanent|temporary|citizenship|visa|sponsor\w*|eligib\w*|work(?:ing)?[- ]+for)\b/i],
 ['application',/(?<![\p{L}\p{N}_])(?:applications?|apply|applying|submi\w*|accept\w*|received?|receipts?|r[ée]sum[ée]s?|cv|filled|unfilled|closed|withdraw\w*|unavailable|vacanc\w*|cancel\w*|paused?)(?![\p{L}\p{N}_])/iu],
 ['deadline',/\b(?:deadlines?|cut[- ]?offs?|due|until|before|expires?|expir\w*|clos(?:e|ed|es|ing|ure)|end date|last date)\b/i],
]
const continuingParagraphs=['Applications are not closed.','We are still accepting applications for this role.','This position is not filled.','This position remains unfilled.']
const blockTree=node=>typeof node==='string'?node:{tag:node.tag,attrs:{...node.attrs},children:node.children.map(blockTree)}
const inlineText=node=>typeof node==='string'?decodeNativeEntities(node):node.children.map(inlineText).join('')
const hasAuthoritySubject=(pattern,value)=>pattern.test(value.normalize('NFC'))
const authorityIdentity=info=>({id:info.id,jobReqId:info.jobReqId,externalUrl:info.externalUrl,jobPostingSiteId:info.jobPostingSiteId})
export const criteriaAuthorityContext=model=>({hiringOrganization:structuredClone(model.hiringOrganization),posting:Object.fromEntries(['title','location','country','jobRequisitionLocation','additionalLocations','locationData','multiLocation','timeType','remoteType','startDate','endDate','jobPostingEndDateAsText','posted','canApply','questionnaireId','secondaryQuestionnaireId','includeResumeParsing'].filter(key=>Object.hasOwn(model.jobPostingInfo,key)).map(key=>[key,structuredClone(model.jobPostingInfo[key])]))})
export function projectCriteriaAuthorityBlocks(html){
 const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0],blocks=[],continuing=[]
 const add=(node,context)=>{
  const text=doc.text(node),joined=inlineText(node).replace(/\s+/g,' ').trim();if(!text&&!joined)return
  const tree=blockTree(node),subjects=authoritySubjects.filter(([,pattern])=>hasAuthoritySubject(pattern,text)||hasAuthoritySubject(pattern,joined)).map(([subject])=>subject)
  if(!subjects.length)return
  const block={context,tree,text,joined,subjects}
  // "Before applying" can describe a qualification prerequisite without
  // asserting a deadline. Keep its full text, and exempt only education-only
  // blocks with no other authority subject, date/time token, or linked terms.
  const education=subjects.every(subject=>['application','deadline'].includes(subject))&&/\b(?:education|degree|diploma|certificat(?:e|es|ion)|qualifications?|licen[cs]e)\b/i.test(joined)&&/\bbefore applying\b/i.test(joined)&&!/[\d:]|\b(?:by|today|tomorrow|yesterday|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|noon|midnight)\b/i.test(joined)&&!authoritySubjects.some(([,pattern])=>hasAuthoritySubject(pattern,joined.replace(/\bbefore applying\b/gi,'')))
  const presentation=node=>typeof node==='string'||['root','p','span','b','u','br'].includes(node.tag)&&node.children.every(presentation)
  if(education&&presentation(node))return
  if(context.length===0&&continuingParagraphs.some(value=>same(tree,{tag:'p',attrs:{},children:[value]})))continuing.push(block)
  else blocks.push(block)
 }
 const children=(nodes,context)=>{
  let inline=[];const flush=()=>{if(inline.length)add({tag:'root',attrs:{},children:inline},context);inline=[]}
  for(const node of nodes){
   if(typeof node!=='string'&&['p','li','h1','h2','h3','h4','ul'].includes(node.tag)){
    flush();if(node.tag==='ul')children(node.children,[...context,{tag:node.tag,attrs:{...node.attrs}}]);else add(node,context)
   }else inline.push(node)
  }
  flush()
 }
 children(root.children,[]);return{blocks,continuingAvailabilityBlocks:continuing}
}
function reconcileAuthorityBlocks(model,projection){
 // Saved identities document genuine reference provenance only. Admission
 // depends on complete native context + complete blocks; current identities
 // are independently reconciled against their actual listing and own routes.
 const identity=authorityIdentity(model.jobPostingInfo),nativeContext=criteriaAuthorityContext(model),allReferences=PROFILE.criteriaAuthorityBlocks20261116?.reviewed??[],references=allReferences.filter(reference=>same(reference.nativeContext,nativeContext))
 // The authority-free fallback is only for genuinely new native context. A
 // known identity cannot erase its reviewed blocks by also changing context.
 const reviewed=references.some(reference=>same(reference.blocks,projection.blocks))||references.length===0&&projection.blocks.length===0&&!allReferences.some(reference=>same(reference.identity,identity))
 const unreviewedSubjects=reviewed?[]:authoritySubjects.map(([subject])=>subject).filter(subject=>!references.some(reference=>same(reference.blocks.filter(block=>block.subjects.includes(subject)),projection.blocks.filter(block=>block.subjects.includes(subject)))))
 return{identity,nativeContext,reviewed,unreviewedSubjects,...projection}
}
function criteria(html){
 need(typeof html==='string','native full criteria malformed');const d=readNativeDocument(html),root=d.nodes(n=>n.tag==='root')[0],all=[];const visit=n=>{if(typeof n==='string')return;all.push(n);for(const c of n.children||[])visit(c)};visit(root)
 need(!all.some(n=>n.inert||Object.hasOwn(n.attrs,'hidden')||Object.hasOwn(n.attrs,'inert')||n.attrs['aria-hidden']==='true'||['script','style','template','iframe','object','noscript'].includes(n.tag)||Object.keys(n.attrs).some(k=>/^on/i.test(k))),'hidden or unreviewed criteria program/mandatory carrier')
 for(const match of html.matchAll(/<[a-z][a-z0-9]*\b((?:[^<>"']|"[^"]*"|'[^']*')*)>/gi)){const names=new Set;for(const [name]of readNativeAttributeTokens(match[1])){need(!names.has(name),'duplicate criteria authority/attribute');names.add(name)}}
 for(const n of all){need(['root','p','b','br','ul','li','span','u','a','h1','h2','h3','h4'].includes(n.tag),'unreviewed native criteria authority/mandatory carrier');const allowed=n.tag==='a'?['href','target']:['p','span'].includes(n.tag)?['style']:[];need(Object.keys(n.attrs).every(k=>allowed.includes(k)),'unreviewed criteria authority/country attribute');if(n.attrs.style!==undefined)need((n.tag==='p'?['text-align:left !important','text-align:inherit','text-align:left','color:!important']:['color:#0000ff','color:#000000','font-size:inherit','color:#242424']).includes(n.attrs.style),'unreviewed native criteria style carrier');if(n.tag==='a')need(['https://www.thomsonreuters.com/en/careers/our-commitment-to-candidates','https://www.thomsonreuters.com/en/careers/protect-yourself-from-fraudulent-job-postings','https://www.thomsonreuters.com/en'].includes(n.attrs.href)&&n.attrs.target==='_blank','unreviewed criteria link authority')}
 const value=extractActiveDescription(html),v=readVisibleNativeDocument(html,{strict:true}),visibleRoot=v.nodes(n=>n.tag==='root')[0];need((value||'')===v.text(visibleRoot),'hidden or omitted native mandatory criteria')
 const paragraphs=d.nodes(n=>['p','li','h1','h2','h3','h4'].includes(n.tag)).map(n=>({tag:n.tag,text:d.text(n)})),end=paragraphs.findIndex(p=>/what[’']?s in it for you|^About (?:Us|Thomson Reuters|Reuters)$/i.test(p.text)),authored=paragraphs.slice(0,end<0?paragraphs.length:end)
 const binding=authored.filter(p=>!p.text.includes('Thomson Reuters')&&(/\bReuters is (?:seeking|looking for)\b/.test(p.text)||/\b(?:at Reuters|Reuters(?:'|’) (?:standards|fast-paced news file)|Reuters story|Reuters journalism|Reuters news stories)\b/i.test(p.text)))
 const conflictingBrand=authored.filter(p=>/\bThis (?:job|position|role|requisition|vacancy) is (?:for|at|with) [^.!?]{1,160}, not Reuters\b/i.test(p.text))
 const closed=paragraphs.some(p=>/^(?:this (?:job|position|role|requisition) (?:is|has been) (?:(?:filled|closed|withdrawn|cancelled|on hold|paused)(?: and is no longer available)?|no longer available|no longer accepting applications)|hiring for this (?:job|position|role) is paused|applications are (?:closed|no longer accepted)|recruitment is closed|we are no longer accepting applications for this (?:job|position|role))[.!]?$/i.test(p.text))
 return{text:value||'',HTML:html,brandParagraphs:binding,conflictingBrandParagraphs:conflictingBrand,ownClosedNotice:closed,authoredParagraphs:authored,authorityBlocks:projectCriteriaAuthorityBlocks(html)}
}
export function readRole(page,row,now){
 const model=parseJSON(page);fields(model,PROFILE.fieldSets.envelope,'native role envelope');need(model.userAuthenticated===false&&Array.isArray(model.similarJobs),'native role public status changed');const i=model.jobPostingInfo;fields(i,PROFILE.fieldSets.info,'own native posting');need(i.title===row.title&&/^[a-f0-9]{32}$/.test(i.id||'')&&i.jobReqId===row.bulletFields[2]&&i.jobPostingSiteId===PROFILE.site,'native title/account/requisition identity changed');const expectedURL=PROFILE.boardCanonical+row.externalPath;need(i.externalUrl===expectedURL&&i.jobPostingId===row.externalPath.split('/').at(-1),'native canonical/apply account/identity changed');need(page.url===PROFILE.nativePrefix+row.externalPath,'native detail URL changed');need(i.postedOn===row.postedOn&&i.remoteType===row.remoteType,'native list/detail lifecycle/workplace labels conflict');need(typeof i.posted==='boolean'&&typeof i.canApply==='boolean','native active/application status malformed');country(i.country,false);fields(i.jobRequisitionLocation,['descriptor','country'],'native requisition workplace');country(i.jobRequisitionLocation.country,true);text(i.location,'native worksite');need(i.location===i.jobRequisitionLocation.descriptor&&i.location.startsWith('India, '),'native primary/requisition worksite conflict');need(typeof i.timeType==='string'&&i.timeType.trim(),'native employment type missing');fields(model.hiringOrganization,['name','url'],'native legal employer');need(typeof model.hiringOrganization.name==='string'&&model.hiringOrganization.url==='','unreviewed native employer/authority URL');const full=criteria(i.jobDescription),issues=[]
 if(!full.brandParagraphs.length)issues.push('role-owned-Reuters-publication-brand-unproven')
 if(full.conflictingBrandParagraphs.length)issues.push('role-owned-publication-brand-conflict')
 if(!model.hiringOrganization.name.trim())issues.push('native-legal-employer-missing');else if(model.hiringOrganization.name!==PROFILE.eligibleRawLegalEmployer)issues.push('native-legal-employer-not-reviewed-for-Reuters-role')
 if(full.text.length<150)issues.push('native-full-criteria-unavailable')
 need(i.additionalLocations==null||Array.isArray(i.additionalLocations)&&i.additionalLocations.every(v=>typeof v==='string'&&v.trim()),'unreviewed structured native secondary worksite/country carrier')
 need(!nonempty(i.locationData),'unreviewed structured native secondary worksite/country carrier')
 if(nonempty(i.multiLocation)||nonempty(i.additionalLocations))issues.push('native-secondary-worksite-country-unresolved')
 if(!i.posted||!i.canApply||full.ownClosedNotice)issues.push('native-own-role-closed-or-unavailable')
 if(i.timeLeftToApply==='Applications are closed')issues.push('native-own-role-closed-or-unavailable');else if(typeof i.timeLeftToApply!=='string'||!/^([1-9]\d*) days? left to apply$/.test(i.timeLeftToApply))issues.push('native-application-window-label-unresolved')
 const posted=calendar(i.startDate),closing=calendar(i.endDate),display=closingText(i.jobPostingEndDateAsText),today=calendar(now.slice(0,10));need(today,'invalid source observation clock')
 if(!posted||!closing||closing!==display||posted>today||closing<posted)issues.push('native-publication-calendar-conflict')
 if(closing&&closing<today)issues.push('native-role-expired')
 const authorityBlocks=reconcileAuthorityBlocks(model,full.authorityBlocks)
 if(!authorityBlocks.reviewed)issues.push('native-criteria-authority-block-unreviewed')
 if(authorityBlocks.unreviewedSubjects.includes('geography'))issues.push('native-criteria-workplace-declaration-unreconciled')
 if(authorityBlocks.unreviewedSubjects.includes('employment'))issues.push('native-criteria-employer-declaration-conflict')
 if(authorityBlocks.unreviewedSubjects.some(subject=>['application','deadline'].includes(subject)))issues.push('native-criteria-closing-date-conflict')
 return{id:i.jobReqId,nativeId:i.id,title:i.title,url:i.externalUrl,applyURL:i.externalUrl,criteriaHTML:full.HTML,criteriaText:full.text,criteriaAuthorityBlocks:authorityBlocks,postingDate:posted,closingDate:closing,rawNativeEmployer:model.hiringOrganization,nativeLegalEmployer:model.hiringOrganization.name||null,nativePublicationBrand:full.brandParagraphs.length&&!full.conflictingBrandParagraphs.length?'Reuters':null,brandEvidence:{method:'reviewed-role-owned-authored-criteria-before-benefits-or-company-overview',paragraphs:full.brandParagraphs,conflictingParagraphs:full.conflictingBrandParagraphs,legalEmployerAlias:false},workplaces:[{location:i.location,country:'India',city:null,state:null,nativeCountry:i.country,nativeRequisitionLocation:i.jobRequisitionLocation}],issues,complete:issues.length===0,listing:row,nativeModel:model,rawBody:page.html,bodySHA256:sha(page.html),sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false,applicationAcceptanceVerified:false}
}
