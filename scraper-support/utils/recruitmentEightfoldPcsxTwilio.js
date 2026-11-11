import { createHash } from 'node:crypto'
import { decodeHTML,encodeHTML } from 'entities'
import { readNativeDocument,readNativeAttributeTokens,extractActiveDescription } from './activeNativeHtml.js'
import { readVisibleNativeDocument } from './visibleNativeHtml.js'
import { nativeCountryName,nativeLocationCountryName } from '../shared/nativeJobPosting.js'
import { parseEightfoldJson,readEightfoldDataCarrier,eightfoldDocument } from './recruitmentEightfoldData.js'

// Current corporate declaration, renderer-bound data and complete native own
// roles were captured opening/closing on 2026-11-11. This is Twilio's contract;
// it does not authorize a parent/sub-brand account or another PCSx profile.
const profile=Object.freeze({source:'twilio',domain:'twilio.com',employer:'Twilio',origin:'https://jobs.twilio.com',
  officialURL:'https://www.twilio.com/en-us/careers',boardURL:'https://jobs.twilio.com/careers',
  entryPath:'/gen/js/pcsxPwa.6c903be3a68c07ae.js',entrySHA256:'c99cb7da4f4a8e6eef449602e15fea1c01ef90b31b4925947bd8ab54d0f1c111',
  roleRendererPath:'/gen/js/12480.612f8bee165df945.js',roleRendererSHA256:'48ab46e9fdd729f1117dc855913b9eff925eff8996519686eb31ed25d89eb385',
  configsSHA256:'b429a7eca36fe6127afb9a37f956eac9efae96cf3e2afd720ca7689aafb8d703',
  brandingSHA256:'227cfc0837296130243574d4123419a989465ab7f5dfa7826ee66430d4efb1d4',
  supplementalSHA256:'76a3143512974ea140128a653653ac62fd0f3f19ec3076725d81184dc3de1c10',
  additionalPublishedLocationSHA256:'f6a47c20228b65510c48015a668da317163c72d8b6e33d6e283129a2e4febc8d',pageSize:10})
const need=(value,message)=>{if(!value)throw new Error('Twilio native PCSx '+message)}
const sha=value=>createHash('sha256').update(value).digest('hex')
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)
const same=(a,b)=>stable(a)===stable(b),text=value=>typeof value==='string'&&value.trim().length>0
const norm=value=>String(value).normalize('NFC').replace(/\s+/gu,' ').trim()
const keys=(value,allowed,label)=>need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key)),'unreviewed '+label+' fields')
const body=page=>{need(page&&(typeof page.html==='string'||typeof page.text==='string'),'native response text unavailable');need(page.html==null||page.text==null||page.html===page.text,'ambiguous native text');return page.html??page.text}
const response=(page,url)=>{need(page?.status===200&&page.url===url,'native response identity/status changed');return body(page)}
const active=({node,ancestors})=>!node.inert&&!node.nativeTagUnqualified&&!ancestors.some(node=>node.inert||['svg','math','template','object','noscript'].includes(node.tag))
const envelope=value=>{keys(value,['status','error','data','metadata'],'native envelope');keys(value.error,['message','body'],'native error');need(value.status===200&&value.error.message===''&&value.error.body===''&&value.metadata===null,'native upstream error/fallback/metadata changed');return value}

function pageContext(page,url){
  const source=response(page,url),parsed=eightfoldDocument(source)
  need(!parsed.entries.some(({node})=>node.tag==='base'),'unreviewed native base URL')
  const scripts=parsed.entries.filter(({node})=>node.tag==='script'&&/pcsxPwa\./.test(node.attrs.src||''))
  need(scripts.length===1&&active(scripts[0]),'active current renderer unavailable')
  const renderer=scripts[0].node
  need(!Object.hasOwn(renderer.attrs,'nomodule')&&/^(?:|text\/javascript|application\/javascript)$/i.test(renderer.attrs.type||'')
    &&new URL(renderer.attrs.src,url).href===profile.origin+profile.entryPath,'unreviewed renderer identity/mode')
  for(const match of parsed.normalized.matchAll(/<script\b([^>]*)>/gi)){
    const attrs=readNativeAttributeTokens(match[1]);if(!attrs.some(([key,value])=>key==='src'&&/pcsxPwa\./.test(value)))continue
    need(new Set(attrs.map(([key])=>key)).size===attrs.length,'duplicate native renderer attributes')
  }
  const pcsx=readEightfoldDataCarrier(source,{id:'pcsx-data',mountId:'pcsx'}),branding=readEightfoldDataCarrier(source,{id:'branding-data'})
  keys(pcsx.value,['domain','configs','onboardingData','ipGeolocation','ipGeolocationLatLong','themeBuilderUser','instanceBannerData'],'native model')
  need(pcsx.value.domain===profile.domain&&branding.value.domain===profile.domain,'native account changed')
  need(pcsx.value.themeBuilderUser===null&&same(pcsx.value.onboardingData,{}),'public native mode changed')
  need(sha(stable(pcsx.value.configs))===profile.configsSHA256&&sha(stable(branding.value))===profile.brandingSHA256,'current native configuration/branding changed')
  // The exact reviewed client condition is `0!==this.pcsxConfig.overrides.length&&`.
  // Its current Twilio value is empty. No unused override endpoint is guessed.
  need(same(pcsx.value.configs.pcsxConfig.overrides,[]),'unreviewed native override branch')
  return{entryURL:profile.origin+profile.entryPath,rendererAttributes:renderer.attrs,pcsxSnapshot:stable(pcsx.value),brandingSnapshot:stable(branding.value),
    carrierProvenance:{pcsx:pcsx.decodedJsonSHA256,branding:branding.decodedJsonSHA256}}
}
export const declaredEightfoldPcsxTwilioRecruitment=(page,config={})=>{
  if(config.source!==profile.source||page?.url!==profile.boardURL)return null
  return{kind:'eightfold-pcsx-twilio',source:profile.source,domain:profile.domain,origin:profile.origin,boardURL:profile.boardURL,
    officialURL:profile.officialURL,employerName:profile.employer,roleRendererURL:profile.origin+profile.roleRendererPath,...pageContext(page,profile.boardURL)}
}
const handoff=page=>{
  const source=response(page,profile.officialURL),doc=readVisibleNativeDocument(source,{strict:true})
  need(!readNativeDocument(source).nodes(node=>node.tag==='base').length,'unreviewed corporate base URL')
  const links=doc.nodes(node=>node.tag==='a'&&node.attrs.href===profile.boardURL).map(node=>({href:node.attrs.href,label:doc.text(node)}))
  need(links.length===1&&links[0].label==='See all open positions','current corporate handoff unavailable')
  return stable(links)
}
const roleURL=row=>{need(Number.isSafeInteger(row?.id)&&row.id>0&&row.positionUrl==='/careers/job/'+row.id,'native role URL/identity changed');return profile.origin+row.positionUrl}
function countries(row){
  need(Array.isArray(row.locations)&&row.locations.length>0&&row.locations.every(text)&&Array.isArray(row.standardizedLocations)
    &&row.standardizedLocations.length===row.locations.length&&row.standardizedLocations.every(text),'native country/location unavailable')
  const pairs=row.locations.map((label,index)=>{
    // This exact current publisher label contains the written country India;
    // no remote city/state suffix or guessed country-code label is expanded.
    const name=label==='Remote - India'?'India':nativeLocationCountryName(label),code=nativeCountryName(row.standardizedLocations[index].split(',').at(-1).trim())
    need(!name||!code||name===code,'native country name/code contradiction');return{label,standardized:row.standardizedLocations[index],country:name&&code?name:null}
  })
  need(new Set(pairs.map(pair=>stable(pair))).size===pairs.length,'duplicate native country/location')
  if(row.location!=null)need(text(row.location)&&row.locations.some(label=>norm(label)===norm(row.location)),'native primary country/location contradiction')
  return pairs
}
const listingKeys=['id','displayJobId','name','locations','standardizedLocations','postedTs','solrScore','stars','department','creationTs','isHot','workLocationOption','locationFlexibility','atsJobId','positionUrl','efcustomTextDepartmentObject']
const listingDataKeys=['positions','filterDef','count','sortBy','appliedFilters','debug','savedSearchMetadata','resultsMetaData']
function listing(value,start,total){
  keys(value.data,listingDataKeys,'native page');const data=value.data
  need(Number.isSafeInteger(data.count)&&data.count>=0&&(total==null||data.count===total)&&Array.isArray(data.positions)
    &&data.positions.length===Math.min(profile.pageSize,Math.max(0,data.count-start)),'native page offset/count/bounds changed')
  const ids=new Set(),rows=data.positions.map(row=>{keys(row,listingKeys,'native listing role');const url=roleURL(row);need(!ids.has(row.id)&&text(row.name)&&text(row.displayJobId),'native listing duplicate/missing identity');ids.add(row.id);return{row,url,countries:countries(row)}})
  return{value,data,rows,start,snapshot:stable(value)}
}
const blocks=new Set(['root','div','p','h1','h2','h3','h4','h5','h6','ul','ol','li','table','tr','td','th','section','article','br','hr'])
const criteria=(source,markers=false)=>{
  const doc=readNativeDocument(source),root=doc.nodes(node=>node.tag==='root')[0]
  // No current Twilio own-role proof uses an ordered list. Holding a new
  // presentation is safer than silently substituting an unordered marker.
  if(markers)need(!doc.nodes(node=>node.tag==='ol').length,'unreviewed ordered native criteria presentation')
  const flow=(node,parent=null)=>{
    if(typeof node==='string'){const value=decodeHTML(node);if(markers)need(!value.includes('\\'),'unreviewed authored criteria backslash');return value}
    if(node.inert||['script','style','title'].includes(node.tag))return ''
    if(markers&&node.tag==='li')need(parent==='ul','unreviewed native list hierarchy')
    const value=(markers&&node.tag==='li'?'* ':'')+node.children.map(child=>flow(child,node.tag)).join('')
    return blocks.has(node.tag)?' '+value+' ':value
  };return norm(flow(root))
}
const detailKeys=['id','displayJobId','name','locations','standardizedLocations','postedTs','stars','department','creationTs','jobDescription','location','isHot','workLocationOption','locationFlexibility','atsJobId','positionUrl','publicUrl','efcustomTextPostDate','efcustomTextDepartmentObject','jdHighlight','positionExtraDetails','positionUserActions']
function detail(value,selected){
  const role=value.data;keys(role,detailKeys,'native full role');need(roleURL(role)===selected.url&&role.publicUrl===selected.url,'native full role identity/public URL changed')
  for(const field of ['id','name','displayJobId','locations','standardizedLocations','postedTs','creationTs','department','atsJobId','workLocationOption','locationFlexibility','efcustomTextDepartmentObject'])need(same(role[field],selected.row[field]),'native listing/full role identity fields changed: '+field)
  const scope=countries(role);need(scope.every(pair=>pair.country==='India'),'native mixed-country projection scope unresolved')
  // The reviewed current typed remote-local and country-only address model is
  // preserved in full. It is not converted into a projected work arrangement.
  need(scope.every(pair=>pair.label==='Remote - India'&&pair.standardized==='IN')&&role.workLocationOption==='remote_local'&&role.locationFlexibility===null,'unreviewed native country/location/mode contract')
  keys(role.positionUserActions,['isSaved','applyAction'],'native role action');keys(role.positionUserActions.applyAction,['status'],'native apply action')
  need(role.positionUserActions.isSaved===false&&role.positionUserActions.applyAction.status==='allowed','native current application availability changed')
  need(same(role.jdHighlight,[])&&sha(stable(role.positionExtraDetails))===profile.supplementalSHA256,'unreviewed supplemental native criteria')
  need(Array.isArray(role.efcustomTextPostDate)&&role.efcustomTextPostDate.length===1&&/^\d{4}-\d{2}-\d{2}$/.test(role.efcustomTextPostDate[0]),'unreviewed native raw date field')
  need(text(role.jobDescription)&&extractActiveDescription(role.jobDescription)&&criteria(role.jobDescription).length>=100,'native complete criteria unavailable')
  return{value:role,scope,snapshot:stable(value)}
}
function country(value,label){
  if(typeof value!=='string'){keys(value,['@type','name'],label+' country');need(value['@type']==='Country',label+' country type unavailable');value=value.name}
  const name=nativeCountryName(value);need(name==='India',label+' country contradiction');return name
}
function published(page,selected,native,descriptor){
  const context=pageContext(page,selected.url);need(context.pcsxSnapshot===descriptor.pcsxSnapshot&&context.brandingSnapshot===descriptor.brandingSnapshot,'own role/current board carrier changed')
  const doc=eightfoldDocument(body(page)),posts=doc.entries.filter(entry=>entry.node.tag==='script'&&entry.node.attrs.type==='application/ld+json'
    &&active(entry)&&!Object.hasOwn(entry.node.attrs,'src')).map(({node})=>parseEightfoldJson(node.raw)).filter(value=>value?.['@type']==='JobPosting')
  need(posts.length===1,'current own published role unavailable');const post=posts[0]
  keys(post,['@context','@type','applicantLocationRequirements','datePosted','description','employmentType','hiringOrganization','inLanguage','jobLocation','jobLocationType','title','url','validThrough'],'published role criteria')
  keys(post.hiringOrganization,['@type','logo','name','sameAs'],'published employer')
  need(post.hiringOrganization['@type']==='Organization'&&post.hiringOrganization.name===profile.employer&&post.hiringOrganization.sameAs===profile.domain,'published employer/account contradiction')
  need(post.title===native.value.name&&post.url===selected.url,'published role/title identity changed')
  need(post.jobLocationType==='TELECOMMUTE','published/native location mode contradiction')
  const locations=Array.isArray(post.jobLocation)?post.jobLocation:[post.jobLocation]
  need(locations.length===1||locations.length===2,'unreviewed published country address scope')
  for(let index=0;index<locations.length;index++){
    const location=locations[index];keys(location,['@type','address'],'published country location');keys(location.address,['@type','addressCountry','addressLocality','addressRegion'],'published country address')
    country(location.address.addressCountry,'published')
    need(location['@type']==='Place'&&location.address['@type']==='PostalAddress','unreviewed published address type')
    if(index===0)need(location.address.addressLocality===''&&location.address.addressRegion==='','unreviewed country-only published address')
    else need(sha(stable(location))===profile.additionalPublishedLocationSHA256,'unreviewed additional published address')
  }
  need(Array.isArray(post.applicantLocationRequirements)&&post.applicantLocationRequirements.length===native.scope.length,'published applicant country scope changed')
  for(const requirement of post.applicantLocationRequirements)country(requirement,'published applicant')
  // Current schema description is serialized plain text, including literal
  // <Karnataka, ...> state restrictions. Parsing it as HTML loses the entire
  // authored tail. Compare every character after NFC/whitespace only; native
  // structural markers still come solely from the reviewed native HTML DOM.
  need(text(post.description)&&criteria(native.value.jobDescription,true)===norm(post.description),'complete native/published criteria differ')
  return{value:post,snapshot:stable(post),contextSnapshot:stable(context),additionalLocations:locations.slice(1)}
}
function benefits(role,descriptor){
  const config=parseEightfoldJson(descriptor.pcsxSnapshot).configs.pcsxConfig.positionDetailsConfig
  const tabs=config.tabsDisplayConfig.filter(tab=>tab.id==='company');need(tabs.length===1&&tabs[0].label==='Company and benefits'&&tabs[0].sections.includes('perks'),'native company tab changed')
  need(same(role.positionExtraDetails.perks,config.sectionsConfig.perks.items)&&same(role.positionExtraDetails.blogs,config.sectionsConfig.blogs.items)
    &&same(role.positionExtraDetails.videos.map(item=>item.url),config.sectionsConfig.videos.items),'native supplemental company/configuration differ')
  return{label:tabs[0].label,items:structuredClone(role.positionExtraDetails.perks),html:'<section><h2>'+encodeHTML(tabs[0].label)+'</h2>'+role.positionExtraDetails.perks.map(perk=>'<section><h3>'+encodeHTML(perk.title)+'</h3><div>'+perk.description+'</div></section>').join('')+'</section>'}
}

export const readEightfoldPcsxTwilioRecruitment=async(descriptor,{
  readPage,readRenderer,readNativeJson,permit,matchingEmployer,addJob,recordRead,inventoryRead,unresolved,
  maxPages=8,maxDetails=20,remainingRequests,officialBinding,recheckOfficialBinding,now,
})=>{
  need(descriptor?.kind==='eightfold-pcsx-twilio'&&descriptor.source===profile.source&&descriptor.domain===profile.domain&&descriptor.origin===profile.origin
    &&descriptor.boardURL===profile.boardURL&&descriptor.officialURL===profile.officialURL&&descriptor.entryURL===profile.origin+profile.entryPath
    &&descriptor.roleRendererURL===profile.origin+profile.roleRendererPath,'unreviewed source/account descriptor')
  need(Number.isSafeInteger(maxPages)&&maxPages>0&&maxPages<=80&&Number.isSafeInteger(maxDetails)&&maxDetails>0&&maxDetails<=80&&typeof remainingRequests==='function','invalid native request/page/detail budget')
  need(matchingEmployer(profile.employer),'native employer lacks original-source binding')
  need(officialBinding?.officialURL===profile.officialURL&&officialBinding.declaredURL===profile.boardURL,'current corporate binding unavailable')
  const openedHandoff=handoff(officialBinding.page),rawJson=new WeakMap()
  const remaining=()=>{const value=remainingRequests();need(Number.isSafeInteger(value)&&value>=0,'invalid remaining request budget');return value}
  const read=async(callback,url,init={})=>{need(remaining()>0,'native budget exhausted before closing');need(permit(url)!==false,'native public endpoint not permitted');return callback(url,init)}
  const renderer=async(url,hash,init={})=>need(sha(response(await read(readRenderer,url,init),url))===hash,'current reviewed renderer changed')
  const json=async(url,init={})=>{const value=await read(readNativeJson,url,init);need(value?.status===200&&value.url===url&&typeof value.text==='string','native JSON response identity/status changed');const parsed=envelope(parseEightfoldJson(value.text));rawJson.set(parsed,value.text);return parsed}
  const search=start=>profile.origin+'/api/pcsx/search?domain='+profile.domain+'&query=&location=India&start='+start+'&'
  const observed=new Set()
  const observe=item=>{if(observed.has(item.row.id))return;observed.add(item.row.id);recordRead({...structuredClone(item.row),url:item.url},descriptor)
    if(item.countries.some(pair=>!pair.country))unresolved('native-twilio-country-scope-unresolved')
    if(item.countries.some(pair=>pair.country==='India')&&item.countries.some(pair=>pair.country!=='India'))unresolved('native-twilio-mixed-country-projection-unqualified')}
  const account=(page,phase)=>{inventoryRead({kind:'eightfold-pcsx-twilio',surface:search(page.start),phase,start:page.start,reportedTotal:page.data.count,observedRecordCount:page.rows.length,
    selectedPages:1,nativeRowUnit:'position',sourceScopeComplete:false,listingComplete:false,lifecycleCleanupAllowed:false});page.rows.forEach(observe)}
  if(remaining()<3){unresolved('native-twilio-opening-budget-unavailable');return}
  await renderer(descriptor.entryURL,profile.entrySHA256);await renderer(descriptor.roleRendererURL,profile.roleRendererSHA256)
  const pages=[listing(await json(search(0)),0)];account(pages[0],'opening')
  const total=pages[0].data.count,plannedPages=Math.min(maxPages,Math.max(1,Math.ceil(total/profile.pageSize)))
  unresolved('native-twilio-partial-native-query-source-scope-unverified-cleanup-forbidden')
  if(!total){unresolved('native-twilio-empty-country-query-is-not-verified-zero');return}
  if(plannedPages<Math.ceil(total/profile.pageSize))unresolved('native-twilio-partial-pagination-page-bound')
  for(let index=1;index<plannedPages;index++){
    // Reserve every accumulated closing listing plus four authority/renderer
    // reads. A truncated opening inventory stays an observation, never zero.
    if(remaining()<pages.length+6){unresolved('native-twilio-pagination-closing-reserve');break}
    const page=listing(await json(search(index*profile.pageSize)),index*profile.pageSize,total)
    const seen=new Set(pages.flatMap(page=>page.rows.map(item=>item.row.id)))
    need(page.rows.every(item=>!seen.has(item.row.id)),'duplicate native page identity/ignored offset')
    pages.push(page);account(page,'opening')
  }
  const rows=pages.flatMap(page=>page.rows),candidates=rows.filter(item=>item.countries.every(pair=>pair.country==='India'))
  const closingFixed=pages.length+4,selectedCount=Math.min(candidates.length,maxDetails,Math.max(0,Math.floor((remaining()-closingFixed)/4)))
  if(selectedCount<candidates.length)unresolved('native-twilio-detail-budget-closing-reserve')
  if(!selectedCount)return
  const openedRoles=[]
  for(const selected of candidates.slice(0,selectedCount)){
    const detailURL=profile.origin+'/api/pcsx/position_details?position_id='+selected.row.id+'&domain='+profile.domain+'&hl=en'
    const current=detail(await json(detailURL),selected),post=published(await read(readPage,selected.url),selected,current,descriptor)
    openedRoles.push({selected,detailURL,current,post})
  }
  const staged=[]
  for(const{selected,detailURL,current,post}of openedRoles){
    const closed=detail(await json(detailURL,{cache:'no-store'}),selected),closedPost=published(await read(readPage,selected.url,{cache:'no-store'}),selected,closed,descriptor)
    need(current.snapshot===closed.snapshot&&post.snapshot===closedPost.snapshot&&post.contextSnapshot===closedPost.contextSnapshot,'closing own role/full criteria/current availability changed')
    const company=benefits(current.value,descriptor)
    staged.push({id:String(current.value.id),title:current.value.name,url:selected.url,description:current.value.jobDescription+'\n'+company.html,
      employer:{name:profile.employer},legalEmployer:null,country:'India',location:current.value.locations.join('; '),posted:null,closing:null,sourcePublicationDateUnavailable:true,
      remoteStatus:null,sourceRemoteStatusUnresolved:true,employmentType:post.value.employmentType??null,
      employerBinding:{method:'current-native-eightfold-pcsx-published-employer',field:'JobPosting.hiringOrganization',declaredEmployer:profile.employer,legalEntityUnknown:true,surface:selected.url},
      record:{originalNativeRole:structuredClone(current.value),originalPublishedRole:structuredClone(post.value),originalNativeListingRow:structuredClone(selected.row),
        originalNativeOverrideConfiguration:[],nativeOverrideEvidence:{clientCondition:'0!==this.pcsxConfig.overrides.length&&',currentOverridesEmpty:true,noOverrideRequestDeclared:true},
        nativeCriteriaRepresentations:{primary:{field:'jobDescription',fullPublishedSchemaAgreement:true,exactHTMLPreservedAsPrefix:true},
          company:{field:'positionExtraDetails.perks',label:company.label,items:company.items,rendererSection:'company/perks'},
          linkedCompanyResources:'Original native videos/blogs retained separately; no complete linked-media or whole-company criteria claim.'},
        nativeCountries:structuredClone(current.scope),firstEverPublication:null,originalDateEvidence:{nativePostedTs:current.value.postedTs,nativeCreationTs:current.value.creationTs,
          nativeCustomPostDateLiteral:structuredClone(current.value.efcustomTextPostDate),publishedDatePostedLiteral:post.value.datePosted??null,nativePlatformValidityLiteral:post.value.validThrough??null,
          publicationProjection:'unknown-native-posted-semantics-or-disagreeing-authored-dates',exactClosingDate:null},
        nativeLocationRepresentations:{publicNativeSummaryLocation:current.value.location,originalNativeLocations:structuredClone(current.value.locations),
          originalStandardizedLocations:structuredClone(current.value.standardizedLocations),additionalOwnSchemaLocations:structuredClone(post.additionalLocations),
          additionalAddressRelationshipToRemoteEligibility:'unqualified',allLocationRepresentationsIdentical:false,allIndiaEligibilityVerified:false,
          authoredLocationRestrictionsPreservedInFullPrimary:true},
        originalWorkModeEvidence:{nativeLocation:current.value.location,nativeWorkLocationOption:current.value.workLocationOption,nativeLocationFlexibility:current.value.locationFlexibility,
          publishedJobLocationType:post.value.jobLocationType,projection:null},sourceScopeComplete:false,lifecycleCleanupAllowed:false,
        nativeListingEvidence:{reportedTotal:total,observedRecordCount:rows.length,selectedPageCount:pages.length,listingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false},
        nativeRendererEvidence:{entryURL:descriptor.entryURL,entrySHA256:profile.entrySHA256,roleRendererURL:descriptor.roleRendererURL,roleRendererSHA256:profile.roleRendererSHA256,
          originalCarrierProvenance:structuredClone(descriptor.carrierProvenance),observedAt:now??null},
        nativeClosingContext:{everySelectedRoleRechecked:true,everySelectedListingPageRechecked:false,currentPublisherHandoffRechecked:false,nativeBoardRechecked:false,renderersRechecked:false,companyScopeComplete:false}}})
  }
  const closedPages=[]
  for(const opened of pages){
    const page=listing(await json(search(opened.start),{cache:'no-store'}),opened.start,total)
    const ids=new Set(closedPages.flatMap(page=>page.rows.map(item=>item.row.id)));need(page.rows.every(item=>!ids.has(item.row.id)),'duplicate closing native page identity')
    const withoutPositions=page=>({...page.value,data:{...page.data,positions:[]}})
    need(same(withoutPositions(opened),withoutPositions(page)),'closing native page envelope/filter/count changed')
    closedPages.push(page);account(page,'closing')
  }
  const closedRows=closedPages.flatMap(page=>page.rows)
  for(const{selected}of openedRoles){const found=closedRows.find(item=>item.row.id===selected.row.id);need(found&&same(found.row,selected.row),'closing selected native listing role/fields changed')}
  const openingIDs=rows.map(item=>item.row.id),closingIDs=closedRows.map(item=>item.row.id)
  const drift={addedIDs:closingIDs.filter(id=>!openingIDs.includes(id)),removedIDs:openingIDs.filter(id=>!closingIDs.includes(id)),
    changedIDs:rows.filter(item=>{const closed=closedRows.find(value=>value.row.id===item.row.id);return closed&&!same(item.row,closed.row)}).map(item=>item.row.id),
    orderChanged:!same(openingIDs,closingIDs),selectedRolesUnchanged:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
  const inventoryDrift=drift.addedIDs.length||drift.removedIDs.length||drift.changedIDs.length||drift.orderChanged?drift:null
  if(inventoryDrift)unresolved('native-twilio-unselected-inventory-drift-positive-partial-scope-cleanup-forbidden')
  const closedBoard=declaredEightfoldPcsxTwilioRecruitment(await read(readPage,profile.boardURL,{cache:'no-store'}),{source:profile.source})
  need(same(closedBoard,descriptor),'closing current native board/carrier changed')
  need(remaining()>0&&permit(profile.officialURL)!==false,'closing corporate budget/permit unavailable')
  const corporate=typeof recheckOfficialBinding==='function'?await recheckOfficialBinding(officialBinding):await read(readPage,profile.officialURL,{cache:'no-store'})
  need(handoff(corporate)===openedHandoff,'closing current corporate handoff changed')
  await renderer(descriptor.entryURL,profile.entrySHA256,{cache:'no-store'});await renderer(descriptor.roleRendererURL,profile.roleRendererSHA256,{cache:'no-store'})
  for(const job of staged){
    Object.assign(job.record.nativeListingEvidence,{originalOpeningPages:pages.map(page=>({url:search(page.start),start:page.start,rawJSON:rawJson.get(page.value)})),
      originalClosingPages:closedPages.map(page=>({url:search(page.start),start:page.start,rawJSON:rawJson.get(page.value)})),unselectedInventoryDrift:structuredClone(inventoryDrift)})
    job.record.originalNativeClosingListingRow=structuredClone(closedRows.find(item=>String(item.row.id)===job.id).row)
    Object.assign(job.record.nativeClosingContext,{everySelectedListingPageRechecked:true,currentPublisherHandoffRechecked:true,nativeBoardRechecked:true,renderersRechecked:true})
    addJob(job)
  }
}
