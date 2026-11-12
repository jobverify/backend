import {isDeepStrictEqual} from 'node:util'
import {decodeHTML} from 'entities'
import {readNativeDocument,readNativeAttributeTokens,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {nativeDate} from '../../scraper-support/native-sources/declaredAshby/nativeData.js'
import {NATIVE_INDIA_LOCATION} from '../../scraper-support/utils/greenhouseLocations.js'
import {CORPORATE,FEED,BOARD,API,UUID,need,shape,originalJSON,active,identityAttributes,frontDocument,readFrontNativeHtml} from './currentProgrammeRenderer.js'

const same=isDeepStrictEqual
const apiKeys='id title department team employmentType location secondaryLocations publishedAt isListed isRemote workplaceType address jobUrl applyUrl descriptionHtml descriptionPlain'.split(' ')
const briefKeys='id title teamId locationId locationName workplaceType employmentType secondaryLocations compensationTierSummary __typename'.split(' ')
const postingKeys='id title departmentName departmentExternalName locationName locationAddress workplaceType employmentType descriptionHtml isListed isConfidential teamNames secondaryLocationNames compensationTierSummary compensationTiers applicationDeadline compensationTierGuideUrl scrapeableCompensationSalarySummary compensationPhilosophyHtml applicationLimitCalloutHtml shouldAskForTextingConsent shouldAskForWhatsAppConsent candidateTextingPrivacyPolicyUrl candidateTextingTermsAndConditionsUrl legalEntityNameForTextingConsent automatedProcessingLegalNotice __typename'.split(' ')
const ownURL=id=>BOARD+'/'+id
const nonempty=value=>typeof value==='string'&&value.length>0
const layout=value=>value.normalize('NFC').replace(/\s+/gu,' ').trim()
function corporateDeclarationText(node){
  // Recruitment declarations remain material even when hidden. Join inline
  // descendants without inventing spaces, and inspect original text once.
  const text=node.children.map(child=>typeof child==='string'?decodeHTML(child):corporateDeclarationText(child)).join('')
  need(!/\p{Cf}/u.test(text),'corporate-programme','Unreviewed format control in corporate declaration')
  return text
}
function groups(value){
  need(Array.isArray(value),'feed-shape','Complete grouped publication must be an array')
  const groupIDs=new Set(),ids=new Set(),urls=[]
  for(const group of value){
    shape(group,['key','name','jobs'],'feed-shape')
    need(nonempty(group.key)&&nonempty(group.name)&&!groupIDs.has(group.key)&&Array.isArray(group.jobs),'feed-shape','Unknown/duplicate publication group')
    groupIDs.add(group.key)
    for(const job of group.jobs){
      shape(job,['key','link','location','title'],'feed-shape')
      need(UUID.test(job.key)&&!ids.has(job.key)&&job.link===ownURL(job.key)&&nonempty(job.location)&&nonempty(job.title),'feed-shape','Unknown/duplicate publication row')
      ids.add(job.key);urls.push(job.link)
    }
  }
  need(urls.length>=1&&urls.length<=6,'membership','Complete nonempty programme exceeds reviewed role bounds')
  return urls
}
export function readFrontFeed({text,url}={}){
  need(url===FEED&&typeof text==='string'&&Buffer.byteLength(text)<=4194304,'feed-shape','Original exact first-party feed unavailable')
  const originalGroups=originalJSON(text),ownURLs=groups(originalGroups)
  return {originalGroups,ownURLs,originalText:text,url,fullCriteriaPublished:false,typedCountryPublished:false}
}
export function readFrontCorporate({text,url}={}){
  need(url===CORPORATE&&typeof text==='string'&&Buffer.byteLength(text)<=4194304,'corporate-carrier','Original exact corporate publication unavailable')
  const parsed=frontDocument(text),entries=parsed.entries
  identityAttributes(text)
  const carriers=entries.filter(e=>e.node.attrs.id==='__NEXT_DATA__')
  need(carriers.length===1&&active(carriers[0])&&carriers[0].node.tag==='script'
    &&carriers[0].ancestors.map(n=>n.tag).join('/')==='root/html/body','corporate-carrier','Unique genuine corporate data carrier unavailable')
  shape(carriers[0].node.attrs,['id','type'],'corporate-carrier')
  need(carriers[0].node.attrs.type==='application/json','corporate-carrier','Unreviewed corporate data carrier')
  const originalNextData=originalJSON(carriers[0].node.raw)
  shape(originalNextData,['props','page','query','buildId','isFallback','gsp','scriptLoader'],'corporate-carrier')
  shape(originalNextData.props,['pageProps','__N_SSG'],'corporate-carrier')
  shape(originalNextData.props.pageProps,['entry','jobs','global','metadata'],'corporate-carrier')
  need(originalNextData.page==='/jobs'&&same(originalNextData.query,{})&&originalNextData.isFallback===false
    &&originalNextData.gsp===true&&originalNextData.props.__N_SSG===true,'corporate-carrier','Corporate filtered/fallback route changed')
  const originalJobs=originalNextData.props.pageProps.jobs,ownURLs=groups(originalJobs),wanted=new Set(ownURLs)
  const titles=entries.filter(e=>e.node.tag==='title'&&active(e)&&e.ancestors.some(n=>n.tag==='head'))
  const canonicals=entries.filter(e=>e.node.tag==='link'&&e.node.attrs.rel==='canonical')
  need(titles.length===1&&decodeNativeEntities(titles[0].node.raw)==='Jobs at Front | Work happier at Front | Front'
    &&canonicals.length===1&&active(canonicals[0])&&canonicals[0].node.attrs.href===CORPORATE,'corporate-carrier','Corporate document identity changed')
  const anchors=entries.filter(e=>e.node.tag==='a'&&/^https:\/\/jobs\.ashbyhq\.com\//.test(e.node.attrs.href||''))
  need(anchors.length===ownURLs.length&&anchors.every(e=>active(e)&&wanted.has(e.node.attrs.href)
    &&e.ancestors.some(n=>n.tag==='li'))&&new Set(anchors.map(e=>e.node.attrs.href)).size===ownURLs.length,
  'corporate-programme','Ordinary corporate own links differ from the complete model')
  for(const group of originalJobs)for(const job of group.jobs){
    const anchor=anchors.find(e=>e.node.attrs.href===job.link)
    need(layout(parsed.document.text(anchor.node))===layout(job.title+' '+job.location),'corporate-programme','Corporate authored row differs from its data model')
  }
  for(const entry of entries){
    if(!['a','iframe','form','object','embed','input','select'].includes(entry.node.tag))continue
    const attrs=entry.node.attrs,target=attrs.href??attrs.src??attrs.action??'',label=[attrs.title,attrs.name,attrs.id,attrs['aria-label']].filter(Boolean).join(' ')
    if(wanted.has(target))continue
    if(entry.node.tag==='a'&&['/jobs',CORPORATE,'#open-positions'].includes(target))continue
    const authoredLabel=entry.node.tag==='a'?corporateDeclarationText(entry.node):''
    need(!/\p{Cf}/u.test(label)&&!/(?:\b(?:jobs?|careers?|vacanc(?:y|ies)|openings?|hiring|recruit(?:ment|ing))\b|\bopen\s+(?:positions|roles)\b)/iu.test(authoredLabel),
      'corporate-programme','Additional authored corporate recruitment declaration')
    need(!/(?:ashbyhq|greenhouse|lever\.co|workday|careers|vacanc|open[-_/ ]?(?:positions|roles)|job[-_/ ]?(?:board|opening|listing)|\/jobs|country|department)/i.test(target+' '+label),
      'corporate-programme','Additional unreviewed corporate recruitment/filter declaration')
  }
  const checkStrings=value=>{
    if(typeof value==='string'){
      for(const match of value.matchAll(/https:\/\/(?:jobs\.ashbyhq\.com|boards\.greenhouse\.io|jobs\.lever\.co)\/[^\s<>"']+/g))
        need(wanted.has(match[0]),'corporate-programme','Additional corporate data hiring account/route')
    }else if(Array.isArray(value))value.forEach(checkStrings)
    else if(value&&typeof value==='object')Object.values(value).forEach(checkStrings)
  }
  checkStrings(originalNextData)
  return {originalNextData,originalJobs,ownURLs,originalHTML:text,url,publicationFacts:{scope:'Published corporate SSR data and ordinary own links only',
    browserExecutionQualified:false,hook82515Qualified:false,corporateJavaScriptCertified:false,sourceScopeComplete:false}}
}
export function readFrontApi({text,url}={}){
  need(url===API&&typeof text==='string'&&Buffer.byteLength(text)<=4194304,'api-shape','Original exact native API unavailable')
  const originalPayload=originalJSON(text)
  shape(originalPayload,['jobs','apiVersion'],'api-shape')
  need(originalPayload.apiVersion==='1','api-version','Original apiVersion must be string1 without coercion')
  need(Array.isArray(originalPayload.jobs)&&originalPayload.jobs.length>=1&&originalPayload.jobs.length<=6,'membership','Unfiltered native API count outside reviewed bounds')
  const ids=new Set()
  for(const record of originalPayload.jobs){
    shape(record,apiKeys,'api-shape')
    need(UUID.test(record.id)&&!ids.has(record.id)&&record.isListed===true&&record.jobUrl===ownURL(record.id)
      &&record.applyUrl===record.jobUrl+'/application'&&nonempty(record.title),'api-shape','Duplicate/unlisted/mismatched native role')
    ids.add(record.id)
  }
  return {originalPayload,originalText:text,url}
}
const countryLabels=(()=>{
  const names=new Intl.DisplayNames(['en'],{type:'region'}),result=new Set()
  for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
    const code=String.fromCharCode(a,b),name=names.of(code)
    if(name!==code&&name.length>2&&nativeCountryName(name))result.add(name)
  }
  return [...result]
})()
function writtenGeography(value,country,location){
  need(!/\p{Cf}/u.test(value),'geography','Unreviewed authored format control')
  need(!NATIVE_INDIA_LOCATION.test(value),'geography','Published India/city work-country risk')
  need(!/\b(?:work(?:\s+from)?\s+anywhere|anywhere\s+in\s+the\s+world|(?:remote|work|open|eligible)\s+worldwide|worldwide\s+(?:work|remote|eligib|applicant))\b/i.test(value),
    'geography','Published global/unspecified work eligibility')
  need(!/\b(?:work(?:ing)?(?:\s+remotely)?|remote(?:\s+work)?)\s+(?:(?:is\s+)?(?:available|allowed|permitted|possible)\s+)?(?:from\s+|in\s+)?(?:globally|worldwide|anywhere|(?:any|every|all)\s+(?:countr(?:y|ies)|locations?|regions?))\b/iu.test(value),
    'geography','Published unbounded work-country/location scope')
  for(const name of countryLabels){
    if(nativeCountryName(name)===country)continue
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    need(!new RegExp('(?:^|[^\\p{L}])'+escaped+'(?=$|[^\\p{L}])','iu').test(value),'geography','Additional authored work-country unresolved')
  }
  const metadata=[/\bwork\s+(?:country|location)(?:\s*[:=]\s*|\s+(?:is\s+)?)([^\n]+)/gi,
    /\bapplicants?\s+must\s+be\s+(?:based|located)(?:\s+in)?\s+([^\n]+)/gi]
  for(const expression of metadata)for(const match of value.matchAll(expression)){
    const label=match[1].trim().replace(/[.!]$/,'')
    need(label===country||label===location,'geography','Unreviewed explicit work/applicant location condition')
  }
}
function authored(html,plainProjection=false,channel='primary'){
  need(typeof html==='string','authored','Original authored HTML unavailable')
  // Inspect the original and one decoded view only; never strip controls or
  // replace the original HTML/plain fields used by the criteria comparison.
  need(!/\p{Cf}/u.test(html)&&!/\p{Cf}/u.test(decodeHTML(html)),'geography','Unreviewed authored format control')
  for(const match of html.matchAll(/<([a-z][^\s/>]*)\s+([^>]*)>/gi)){
    const seen=new Set()
    for(const [name]of readNativeAttributeTokens(match[2])){need(!seen.has(name),'authored','Duplicate authored attribute');seen.add(name)}
  }
  const doc=readNativeDocument(html),blocks=new Set(['p','ul','li']),tags=new Set(['root','p','ul','li','strong','em','a','br',...(channel==='philosophy'?['u']:[])])
  const walk=node=>{
    need(!node.inert&&!node.nativeTagUnqualified&&tags.has(node.tag),'authored','Unreviewed authored criteria carrier')
    for(const [name,value]of Object.entries(node.attrs)){
      need(name==='style'&&['p','ul'].includes(node.tag)&&value==='min-height:1.5em'
        ||node.tag==='a'&&(name==='href'&&/^https?:\/\//.test(value)||name==='target'&&value==='_blank'
          ||name==='rel'&&value==='noopener noreferrer nofollow'||name==='class'&&value===(channel==='philosophy'?'postings-link':'markdownDomComponents__StyledLink-sc-7cf6024e-2 jjorfL')),
      'authored','Unreviewed authored class/style/attribute')
    }
    if(node.tag==='br')return '\n'
    let text=node.children.map(child=>typeof child==='string'?decodeNativeEntities(child):walk(child)).join('')
    if(plainProjection&&node.tag==='li')text=' - '+text
    if(node.tag==='a'){
      need(typeof node.attrs.href==='string'&&(channel!=='philosophy'||node.attrs.href==='https://front.com/blog/pay-transparency-at-front'),
        'authored','Original/reviewed link target unavailable')
      text+=' '+node.attrs.href
    }
    return (blocks.has(node.tag)?'\n':'')+text+(blocks.has(node.tag)?'\n':'')
  }
  return walk(doc.nodes(n=>n.tag==='root')[0])
}
function boardModel(native,api){
  const board=native.originalAppData.jobBoard
  shape(board,['stealthAccess','teams','jobPostings','__typename'],'membership')
  need(board.__typename==='JobBoard'&&board.stealthAccess===false&&Array.isArray(board.teams)&&Array.isArray(board.jobPostings)
    &&board.jobPostings.length===api.jobs.length,'membership','Incomplete/stealth native board')
  const teams=new Map(),ids=new Set()
  for(const team of board.teams){
    shape(team,['id','name','externalName','parentTeamId','__typename'],'team')
    need(UUID.test(team.id)&&!teams.has(team.id)&&nonempty(team.name)&&team.__typename==='Team'
      &&(team.externalName===null||nonempty(team.externalName))&&(team.parentTeamId===null||UUID.test(team.parentTeamId)),'team','Invalid team forest')
    teams.set(team.id,team)
  }
  for(const team of teams.values()){
    const seen=new Set([team.id]);let parent=team.parentTeamId
    while(parent!==null){need(teams.has(parent)&&!seen.has(parent),'team','Orphan/cyclic native team');seen.add(parent);parent=teams.get(parent).parentTeamId}
  }
  for(const brief of board.jobPostings){
    shape(brief,briefKeys,'membership')
    need(UUID.test(brief.id)&&!ids.has(brief.id)&&teams.has(brief.teamId)&&UUID.test(brief.locationId)
      &&brief.__typename==='JobPostingBriefsWithIdsAndTeamId','membership','Invalid/duplicate native board role');ids.add(brief.id)
  }
  need(api.jobs.every(record=>ids.has(record.id)),'membership','Board/API memberships differ')
  return {board,teams}
}
function geography(posting,record,schema){
  need(Array.isArray(record.secondaryLocations)&&!record.secondaryLocations.length
    &&Array.isArray(posting.secondaryLocationNames)&&!posting.secondaryLocationNames.length,'country','Additional/unknown work-country model')
  shape(record.address,['postalAddress'],'country');shape(record.address.postalAddress,['addressCountry','addressRegion','addressLocality'],'country')
  shape(schema.jobLocation,['@type','address'],'country');shape(schema.jobLocation.address,['@type','addressCountry','addressRegion','addressLocality'],'country')
  const address=record.address.postalAddress,own=schema.jobLocation.address,country=address.addressCountry
  need(['Chile','United States'].includes(country)&&own.addressCountry===country&&schema.jobLocation['@type']==='Place'&&own['@type']==='PostalAddress'
    &&own.addressRegion===address.addressRegion&&own.addressLocality===address.addressLocality&&posting.locationAddress===null,'country','Typed work-country/address disagreement or unknown country')
  need(posting.locationName===record.location,'country','Published location labels disagree')
  if(Object.hasOwn(schema,'applicantLocationRequirements')){
    shape(schema.applicantLocationRequirements,['@type','name'],'country')
    need(schema.applicantLocationRequirements['@type']==='Country'&&schema.applicantLocationRequirements.name===country,'country','Published applicant country disagrees')
  }
  for(const value of [...Object.values(address),record.location,posting.locationName]){
    need(value===null||typeof value==='string','country','Unknown native address component')
    if(typeof value==='string')writtenGeography(value,country,record.location)
  }
  return country
}
function supplements(posting,schema){
  need(Array.isArray(posting.compensationTiers),'salary','Full compensation tiers unavailable')
  for(const name of ['applicationDeadline','compensationTierGuideUrl','applicationLimitCalloutHtml','candidateTextingTermsAndConditionsUrl','automatedProcessingLegalNotice'])
    need(posting[name]===null,'supplements','Unreviewed current notice/deadline field: '+name)
  need(posting.shouldAskForTextingConsent===true&&posting.shouldAskForWhatsAppConsent===false&&posting.legalEntityNameForTextingConsent==='Front Inc.'
    &&posting.candidateTextingPrivacyPolicyUrl==='https://front.com/legal/california-recruiting-privacy-notice','supplements','Unreviewed consent/privacy model')
  if(posting.compensationTierSummary===null){
    need(posting.compensationTiers.length===0&&posting.scrapeableCompensationSalarySummary===null&&posting.compensationPhilosophyHtml===null
      &&!Object.hasOwn(schema,'baseSalary'),'salary','Missing/contradictory compensation channels')
    return
  }
  need(posting.compensationTiers.length===1&&typeof posting.compensationTierSummary==='string'&&typeof posting.compensationPhilosophyHtml==='string','salary','Unreviewed full compensation model')
  const tier=posting.compensationTiers[0],salary=schema.baseSalary
  shape(tier,['id','title','tierSummary','__typename'],'salary')
  need(UUID.test(tier.id)&&(tier.title===null||nonempty(tier.title))&&tier.__typename==='JobPostingCompensationTiers'
    &&tier.tierSummary==='Estimated Base Salary '+posting.compensationTierSummary,'salary','Unreconciled authored compensation tier')
  shape(salary,['@type','currency','value'],'salary');shape(salary.value,['@type','minValue','maxValue','unitText'],'salary')
  const match=/^\$([0-9]+)K – \$([0-9]+)K(?: • Offers Commission)?$/u.exec(posting.compensationTierSummary)
  need(match&&salary['@type']==='MonetaryAmount'&&salary.currency==='USD'&&salary.value['@type']==='QuantitativeValue'&&salary.value.unitText==='YEAR'
    &&Number(match[1])*1000===salary.value.minValue&&Number(match[2])*1000===salary.value.maxValue&&salary.value.minValue>0&&salary.value.maxValue>=salary.value.minValue
    &&posting.scrapeableCompensationSalarySummary===`$${match[1]}K - $${match[2]}K`,'salary','Native salary interval/summary disagreement')
}
function ownRoleModel(native,record){
  const posting=native.originalAppData.posting,schema=native.originalLD
  shape(posting,postingKeys,'own-shape')
  const schemaKeys='@context @type title description directApply identifier datePosted hiringOrganization jobLocation employmentType'.split(' ')
  if(posting.compensationTierSummary!==null)schemaKeys.push('baseSalary')
  if(posting.workplaceType==='Hybrid')schemaKeys.push('jobLocationType','applicantLocationRequirements')
  shape(schema,schemaKeys,'schema-shape')
  need(posting.id===record.id&&native.routeFacts.id===record.id&&posting.__typename==='JobPostingDetails'&&posting.isListed===true&&posting.isConfidential===false,'identity','Own identity/current publication disagreement')
  shape(schema.identifier,['@type','name','value'],'identity');shape(schema.hiringOrganization,['@type','name','sameAs','logo'],'identity')
  need(schema['@context']==='https://schema.org/'&&schema['@type']==='JobPosting'&&schema.directApply===true&&schema.identifier['@type']==='PropertyValue'
    &&schema.identifier.name==='Front'&&schema.identifier.value===record.id&&schema.hiringOrganization['@type']==='Organization'&&schema.hiringOrganization.name==='Front'
    &&schema.hiringOrganization.sameAs==='https://front.com/'&&schema.hiringOrganization.logo===native.originalAppData.organization.theme.logoSquareImageUrl,'identity','Native employer/own schema identity changed')
  need(posting.title===record.title&&schema.title===record.title,'identity','Authored titles disagree')
  need(typeof posting.descriptionHtml==='string'&&posting.descriptionHtml.length>100&&posting.descriptionHtml===record.descriptionHtml&&schema.description===posting.descriptionHtml
    &&typeof record.descriptionPlain==='string'&&record.descriptionPlain.length>100,'criteria','Full own/API/LD criteria disagree')
  const projected=authored(posting.descriptionHtml,true)
  need(layout(projected)===layout(record.descriptionPlain),'criteria','Native HTML/plain material criteria disagree')
  const country=geography(posting,record,schema)
  need(nativeDate(record.publishedAt)&&schema.datePosted===record.publishedAt.slice(0,10),'date','Published native date representations disagree')
  const mode=posting.workplaceType
  need((mode==='Hybrid'&&record.isRemote===true&&schema.jobLocationType==='TELECOMMUTE'||mode===null&&record.isRemote===null)
    &&record.workplaceType===mode,'mode','Unreviewed/conflicting native work-mode model')
  need(posting.employmentType==='FullTime'&&record.employmentType==='FullTime'&&schema.employmentType==='FULL_TIME','employment','Native employment types disagree')
  supplements(posting,schema)
  const written=[authored(posting.descriptionHtml),record.descriptionPlain,posting.title,posting.departmentName,posting.departmentExternalName,
    posting.compensationTierSummary??'',...posting.compensationTiers.flatMap(v=>[v.title??'',v.tierSummary]),
    posting.compensationPhilosophyHtml===null?'':authored(posting.compensationPhilosophyHtml,false,'philosophy'),posting.candidateTextingPrivacyPolicyUrl,...native.headDescriptions]
  for(const value of written)writtenGeography(value,country,record.location)
  need(native.headDescriptions.every(value=>layout(value)===layout(record.descriptionPlain)),'criteria','Published head/plain criteria disagree')
  return {id:record.id,url:record.jobUrl,title:record.title,country,countryQualificationScope:'finite-native-published-work-country',applicantEligibilityQualified:false,
    nativeApplicantRequirementsPublished:Object.hasOwn(schema,'applicantLocationRequirements'),nativeWorkplaceType:mode,sourceRemoteStatusUnresolved:mode===null,
    originalPublicRecord:record,originalNativePosting:posting,originalSchema:schema,originalNativeJSON:native.rawAppData,originalJobPostingJSON:native.rawLD,
    originalOwnHTML:native.originalHTML,originalOwnHTMLSHA256:native.htmlSHA256,originalHeaders:native.originalHeaders,originalHeaderEntries:native.originalHeaderEntries,
    publisherLegalNameRegistryVerified:false,applicationVisited:false,screeningCriteriaAcquired:false,
    headPlainComparison:'HTML-derived native plain comparison; NFC/layout whitespace only; original words, punctuation, numbers, links and all raw fields preserved.'}
}
function roleModel(native,record,brief,teams){
  const result=ownRoleModel(native,record),posting=native.originalAppData.posting
  need(brief.title===record.title,'identity','Authored titles disagree')
  const chain=[];let team=teams.get(brief.teamId)
  while(team){chain.unshift(team);team=team.parentTeamId===null?null:teams.get(team.parentTeamId)}
  need(posting.departmentName===chain[0].name&&posting.departmentExternalName===(chain[0].externalName??chain[0].name)
    &&record.department===chain[0].name&&record.team===chain.at(-1).name&&same(posting.teamNames,chain.map(v=>v.name)),'team','Native hierarchy and department/team disagree')
  need(Array.isArray(brief.secondaryLocations)&&!brief.secondaryLocations.length&&brief.locationName===record.location,'country','Additional/unknown board work-country model')
  need(brief.workplaceType===record.workplaceType,'mode','Unreviewed/conflicting board work-mode model')
  need(brief.employmentType===record.employmentType,'employment','Native board employment type disagrees')
  need(posting.compensationTierSummary===brief.compensationTierSummary,'salary','List/full compensation differs')
  return result
}
export function reconcileFrontProgramme({corporate,feed,board,api,roles}={}){
  need(same(corporate.originalJobs,feed.originalGroups),'corporate-feed','Corporate SSR/first-party feed order or fields disagree')
  const payload=api.originalPayload,model=boardModel(board,payload),ids=new Set(payload.jobs.map(v=>v.id))
  need(Array.isArray(roles)&&roles.length===ids.size&&new Set(roles.map(v=>v.routeFacts.id)).size===ids.size
    &&roles.every(v=>ids.has(v.routeFacts.id))&&corporate.ownURLs.length===ids.size&&corporate.ownURLs.every(url=>payload.jobs.some(v=>v.jobUrl===url)),
  'membership','Not every current native/corporate ID has one own record')
  const allBriefs=corporate.originalJobs.flatMap(group=>group.jobs.map(job=>({...job,department:group.name})))
  for(const record of payload.jobs){const brief=allBriefs.find(v=>v.key===record.id);need(brief&&brief.title===record.title&&brief.location===record.location&&brief.link===record.jobUrl&&brief.department===record.department,
    'corporate-feed','Corporate/native published rows disagree')}
  const nativeRecords=payload.jobs.map(record=>roleModel(roles.find(v=>v.routeFacts.id===record.id),record,model.board.jobPostings.find(v=>v.id===record.id),model.teams))
  return {nativeRecords,nativePayload:payload,qualificationFacts:{allNativePublicationFieldsReconciled:true,countryQualificationScope:'finite-native-published-work-country',
    applicantEligibilityQualified:false,currentTransactionQualified:false,sourceBodiesQualified:false,sourceScopeComplete:false,companyGlobalScopeQualified:false,
    companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,cleanupAfterSerialization:{replaceExisting:false}}}
}

function originalServerComponents(input){
  shape(input,['corporate','feed','api','roles'],'provenance')
  const {corporate,feed,api,roles}=input
  need(corporate&&feed&&api&&Array.isArray(roles),'provenance','Complete original server component provenance unavailable')
  const freshCorporate=readFrontCorporate({text:corporate.originalHTML,url:corporate.url})
  const freshFeed=readFrontFeed({text:feed.originalText,url:feed.url})
  const freshApi=readFrontApi({text:api.originalText,url:api.url})
  const freshRoles=roles.map(role=>{
    need(role&&role.routeFacts,'provenance','Original own route unavailable')
    return readFrontNativeHtml({text:role.originalHTML,url:role.routeFacts.url,headers:role.originalHeaders,headerEntries:role.originalHeaderEntries})
  })
  need(same(corporate,freshCorporate)&&same(feed,freshFeed)&&same(api,freshApi)&&same(roles,freshRoles),
    'provenance','Supplied parsed fields differ from their complete original server entities')
  return {corporate:freshCorporate,feed:freshFeed,api:freshApi,roles:freshRoles}
}
function ownDepartmentPath(posting,record,country){
  const path=posting.teamNames
  need(Array.isArray(path)&&path.length>0&&path.every(nonempty)&&path[0]===posting.departmentName
    &&posting.departmentName===record.department&&posting.departmentExternalName===posting.departmentName&&path.at(-1)===record.team,
    'department','Unreviewed own department/team path or display projection')
  for(const name of path)writtenGeography(name,country,record.location)
}
export function reconcileFrontServerProgramme(input={}){
  const {corporate,feed,api,roles}=originalServerComponents(input),payload=api.originalPayload
  need(same(corporate.originalJobs,feed.originalGroups),'corporate-feed','Corporate SSR/first-party feed order or fields disagree')
  const ids=new Set(payload.jobs.map(record=>record.id))
  need(roles.length===ids.size&&new Set(roles.map(role=>role.routeFacts.id)).size===ids.size
    &&same(roles.map(role=>role.routeFacts.url),corporate.ownURLs)&&roles.every(role=>role.routeFacts.isRole&&ids.has(role.routeFacts.id))
    &&corporate.ownURLs.length===ids.size&&corporate.ownURLs.every(url=>payload.jobs.some(record=>record.jobUrl===url)),
    'membership','Every original publication needs one own record in corporate order')
  const published=corporate.originalJobs.flatMap(group=>group.jobs.map(job=>({...job,department:group.name})))
  const nativeRecords=payload.jobs.map(record=>{
    const listing=published.find(value=>value.key===record.id)
    need(listing&&listing.title===record.title&&listing.location===record.location&&listing.link===record.jobUrl&&listing.department===record.department,
      'corporate-feed','Corporate/native published rows disagree')
    const own=roles.find(role=>role.routeFacts.id===record.id),result=ownRoleModel(own,record)
    ownDepartmentPath(own.originalAppData.posting,record,result.country)
    return {...result,countryQualificationScope:'finite-server-published-work-country',originalNativeModel:own.originalAppData,
      originalNativeOrganization:own.originalAppData.organization,nativeDeclaration:own.declaration,nativeCarrierFacts:own.carrierFacts,nativeSecurityFacts:own.securityFacts,
      sourceBodiesQualified:false,rendererConsumptionQualified:false,boardAcquired:false,fullRenderedCriteriaQualified:false,legalEmployerQualified:false}
  })
  return {nativeRecords,nativePayload:payload,qualificationFacts:{acquiredServerFieldsReconciled:true,countryQualificationScope:'finite-server-published-work-country',
    applicantEligibilityQualified:false,currentTransactionQualified:false,sourceBodiesQualified:false,rendererConsumptionQualified:false,boardAcquired:false,
    fullRenderedCriteriaQualified:false,legalEmployerQualified:false,sourceScopeComplete:false,companyGlobalScopeQualified:false,
    companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,cleanupAfterSerialization:{replaceExisting:false}}}
}
