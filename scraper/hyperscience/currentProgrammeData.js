import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js';
import {hasSourceDescription} from '../../src/utils/jobSourceContent.js';
import {readHyperscienceFormContract} from './currentFormContract.js';
import {C0,C1,A,H,UUID,sha,need,exactFields,ownArray,plainSnapshot,shape,readRawPacket,rawJSON,
  documentEntries,originalText,layout,authoredCharacters,authoredProjection,readNativePacket} from './currentProgrammeRenderer.js';

const API_FIELDS=['id','title','department','team','employmentType','location','secondaryLocations','publishedAt','isListed','isRemote','workplaceType','address','jobUrl','applyUrl','descriptionHtml','descriptionPlain'];
const POSTING_FIELDS=['id','title','departmentName','departmentExternalName','locationName','locationAddress','workplaceType','employmentType','descriptionHtml','isListed','isConfidential','teamNames','secondaryLocationNames','compensationTierSummary','compensationTiers','applicationDeadline','compensationTierGuideUrl','scrapeableCompensationSalarySummary','compensationPhilosophyHtml','applicationLimitCalloutHtml','shouldAskForTextingConsent','shouldAskForWhatsAppConsent','candidateTextingPrivacyPolicyUrl','candidateTextingTermsAndConditionsUrl','legalEntityNameForTextingConsent','automatedProcessingLegalNotice','__typename'];
const LD_FIELDS=['@context','@type','title','description','directApply','identifier','datePosted','hiringOrganization','jobLocation','employmentType','jobLocationType','applicantLocationRequirements'];
const PUBLISHER_PROFILES={"WebSite":"5bbcb7bb5548a2c61db7292a06f77955dda682ebfd46238bb3c85977e41c4b72","Organization":"865c9a2bed6a179a425a50a1f6b58cd62ab1dc9a9f1dfba668f86a592a4a2e89"};
// Closed reviewed complete authored families; inventory IDs, order and N remain dynamic.
const REVIEWED_CONTENT_FAMILY=[{"title":"Technical Deployment Lead","department":"Sales","team":"Sales Engineering","projectionSHA256":"a1845362077bbd3c6b0fd422d520bfc5e4dec3e53eba57490376434b3e35c094","projectionBytes":6447,"address":{"addressRegion":"Utah","addressCountry":"United States","addressLocality":"Park City"},"displayLocation":"[Remote] US","workplaceType":"Remote"},{"title":"Sr Technical Program Manager, Data","department":"Product","team":"Product","projectionSHA256":"21cc1c7da4696c5e00900e389025275938d72285128a573a6d8478873d1ca5d1","projectionBytes":8526,"address":{"addressRegion":"Utah","addressCountry":"United States","addressLocality":"Park City"},"displayLocation":"[Remote] US","workplaceType":"Remote"},{"title":"Lead Technical Product Manager (Platform)","department":"Product","team":"Product Management","projectionSHA256":"7b73a18c9158de5068aae9c6d30221643babd86e5de75b93f4a3eea23b560534","projectionBytes":7464,"address":{"addressRegion":"Sofia City Province","addressCountry":"Bulgaria","addressLocality":"Sofia"},"displayLocation":"[Hybrid] Sofia, Bulgaria","workplaceType":"Hybrid"},{"title":"Senior Software Engineer (Backend) ","department":"Engineering","team":"Software- Backend","projectionSHA256":"1f7bd31113688758d887313747f6faf03a4582fbf7ccf8258e69ecc04c42f9ce","projectionBytes":7618,"address":{"addressRegion":"Sofia City Province","addressCountry":"Bulgaria","addressLocality":"Sofia"},"displayLocation":"[Hybrid] Sofia, Bulgaria","workplaceType":"Hybrid"}];
const CORPORATE_C1_PROFILE={"prefixBytes":42299,"prefixSHA256":"eac8810d48a96c2c842d93724f2886efbe1a47991386abac1678c3518e60ac0d","suffixBytes":36340,"suffixSHA256":"f59503a8ed558832ea514809e7d2b8a237e7ee54f01289db998b3ec274ded2de","whitespaceUnits":["\n                                                            ","\n                                                ","\n                                            "]};
const CORPORATE_CARD_TEMPLATE="<a href=\"https://jobs.ashbyhq.com/hyperscience/[BOUND_hrefUUID]\" target=\"_blank\" class=\"job-opening\" id=\"[BOUND_idUUID]\" data-title=\"Open position - [BOUND_titleAttribute]\" data-track-ga=\"true\">\n                            <p class=\"location\">[BOUND_locationText]</p>\n                            <div class=\"separator\"></div>\n                            <div class=\"main-content\">\n                                <h3 class=\"title\">[BOUND_titleText]</h3>\n                                                                    <p class=\"location-details\">\n                                        <span class=\"department-team\">[BOUND_departmentTeamText]</span> / <span class=\"commitment\">[BOUND_employmentText]</span>                                    </p>\n                                                            </div>\n                            <p class=\"apply-text\">Apply for this Job -></p>\n                        </a>";
const isActive=entry=>!entry.node.inert&&!entry.node.nativeTagUnqualified&&!entry.ancestors.some(n=>n.inert||n.nativeTagUnqualified||['svg','math','template','noscript','object'].includes(n.tag));
const hiring=/\b(?:careers?|jobs?|vacanc(?:y|ies)|openings?|open\s+positions?|hiring|apply|talent\s+community|join\s+(?:our|the)\s+team|load\s+more)\b/i;
const ATS=/ashbyhq|greenhouse|lever\.co|workdayjobs|smartrecruiters|icims|recruit|\/careers?\/|\/jobs?\/|\/vacanc/i;

function corporateGrammar(packet,kind,jobs){
  if(kind==='C0'){
    need(packet.bytes.length===159204&&sha(packet.bytes)==='f1c70d6cd4078b90567df24a9ec08113a3b37edbfc24b427c416e459fc59b510','corporate-programme','Unknown complete corporate entry publication');
    return {profile:'complete-original-C0-entity',bodyBytes:packet.bytes.length,bodySHA256:sha(packet.bytes),rawEntityRetained:true};
  }
  const profile=CORPORATE_C1_PROFILE;
  need(packet.bytes.length>=profile.prefixBytes+profile.suffixBytes,'corporate-programme','Incomplete original corporate positions context');
  need(sha(packet.bytes.subarray(0,profile.prefixBytes))===profile.prefixSHA256&&sha(packet.bytes.subarray(packet.bytes.length-profile.suffixBytes))===profile.suffixSHA256,'corporate-programme','Unknown complete corporate positions surrounding publication');
  const content=packet.bytes.subarray(profile.prefixBytes,packet.bytes.length-profile.suffixBytes).toString('utf8');
  const productions=jobs.map(job=>{
    const values={hrefUUID:job.id,idUUID:job.id,titleAttribute:job.title,locationText:job.location,titleText:job.title,departmentTeamText:job.department+' - '+job.team,employmentText:job.employmentType};
    for(const value of Object.values(values)){
      need(typeof value==='string'&&value.length>0&&!/[<>&"'`]/.test(value),'corporate-programme','Unreviewed raw card scalar/attribute grammar');authoredCharacters(value);
    }
    const raw=CORPORATE_CARD_TEMPLATE.replace(/\[BOUND_([A-Za-z]+)\]/g,(_token,name)=>values[name]);
    return {id:job.id,raw};
  });
  const cards=[],separators=[],seen=new Set();let at=0;
  while(at<content.length){
    const separator=profile.whitespaceUnits.find(raw=>content.startsWith(raw,at));
    if(separator){separators.push({startCharacter:at,endCharacter:at+separator.length,raw:separator});at+=separator.length;continue;}
    const matching=productions.filter(card=>content.startsWith(card.raw,at));
    need(matching.length===1,'corporate-programme','Unreviewed text/carrier/card bytes inside the complete declared list');
    const card=matching[0];need(!seen.has(card.id),'membership','Repeated whole corporate vacancy production');seen.add(card.id);
    cards.push({id:card.id,startCharacter:at,endCharacter:at+card.raw.length,raw:card.raw,bodyBytes:Buffer.byteLength(card.raw),bodySHA256:sha(card.raw)});at+=card.raw.length;
  }
  need(cards.length===jobs.length&&jobs.every(job=>seen.has(job.id)),'membership','Whole original corporate/native card set differs');
  return {profile:'complete-original-C1-context-and-typed-cards',prefixBytes:profile.prefixBytes,prefixSHA256:profile.prefixSHA256,
    suffixBytes:profile.suffixBytes,suffixSHA256:profile.suffixSHA256,cardTemplateSHA256:sha(CORPORATE_CARD_TEMPLATE),cards,separators,rawEntityRetained:true};
}

function readCorporate(record,kind,jobs){
  const packet=readRawPacket(record,kind==='C0'?C0:C1,kind),parsed=documentEntries(packet.text),items=parsed.entries;
  const visible=readVisibleNativeDocument(packet.text,{strict:true});
  const canonical=items.filter(e=>e.node.tag==='link'&&e.node.attrs.rel==='canonical');
  need(canonical.length===1&&isActive(canonical[0])&&canonical[0].node.attrs.href===(kind==='C0'?C0:C1),'corporate','Unique original corporate canonical required');
  const title=items.filter(e=>e.node.tag==='title');
  need(title.length===1&&isActive(title[0])&&title[0].node.raw===(kind==='C0'?'Careers at Hyperscience - Remote, Inclusive, Flexible':'Open Positions - Jobs at Hyperscience'),'corporate','Corporate title/identity changed');
  const schemas=items.filter(e=>e.node.tag==='script'&&e.node.attrs.type==='application/ld+json');
  need(schemas.length===1&&isActive(schemas[0]),'corporate','Unique active corporate publisher schema required');
  const schema=rawJSON(schemas[0].node.raw),graph=schema['@graph'];
  shape(schema,['@context','@graph'],'corporate');need(schema['@context']==='https://schema.org'&&Array.isArray(graph),'corporate','Unknown corporate publisher envelope');
  need(graph.length===(kind==='C0'?4:5)&&graph.every(g=>['WebPage','BreadcrumbList','WebSite','Organization','ImageObject'].includes(g['@type'])),'corporate-programme','Unknown declared corporate schema/programme');
  for(const type of ['WebSite','Organization']){const rows=graph.filter(g=>g['@type']===type);need(rows.length===1&&sha(JSON.stringify(rows[0]))===PUBLISHER_PROFILES[type],'corporate','Full original publisher metadata changed');}
  const anchors=items.filter(e=>e.node.tag==='a'),declarations=[],ownURLs=[],cards=[];let intakeCount=0,entryCount=0;
  const visibleAnchors=visible.nodes(n=>n.tag==='a');
  for(const entry of anchors){
    const node=entry.node,attrs=node.attrs,label=originalText(node),href=attrs.href??'';
    const relevant=ATS.test(href)||hiring.test(label+' '+Object.values(attrs).join(' '));
    if(!relevant)continue;
    for(const value of [href,label,...Object.values(attrs)])authoredCharacters(value);
    let url;try{url=new URL(href,kind==='C0'?C0:C1).href;}catch{need(false,'corporate-programme','Malformed recruitment declaration');}
    declarations.push({attributes:{...attrs},label,literalHref:href,resolvedURL:url,ancestorTags:entry.ancestors.map(n=>n.tag),active:isActive(entry)});
    const own=/^https:\/\/jobs\.ashbyhq\.com\/hyperscience\/([a-f0-9-]{36})$/.exec(href);
    if(url===C0||url===C1){
      need(isActive(entry)&&visibleAnchors.some(a=>a.attrs.href===href&&layout(originalText(a))===layout(label)),'corporate','Current career handoff hidden/inert');
      if(kind==='C0'&&url===C1)entryCount++;continue;
    }
    if(kind==='C1'&&href===H){need(isActive(entry)&&layout(label)==='Join the Talent Community'&&visibleAnchors.some(a=>a.attrs.href===H),'corporate-programme','Original separately advertised intake changed');intakeCount++;continue;}
    need(kind==='C1'&&own&&UUID.test(own[1])&&isActive(entry)&&visibleAnchors.some(a=>a.attrs.href===href),'corporate-programme','Additional/hidden/unbound recruiting programme');
    shape(attrs,['href','target','class','id','data-title','data-track-ga'],'corporate-programme');
    need(attrs.class==='job-opening'&&attrs.id===own[1]&&attrs.target==='_blank'&&attrs['data-track-ga']==='true','corporate-programme','Unknown original vacancy card');
    const job=jobs.find(j=>j.id===own[1]);need(job,'membership','Corporate advert not in full native programme');
    const descendants=items.filter(e=>e.ancestors.includes(node));
    const find=(tag,cls)=>descendants.filter(e=>e.node.tag===tag&&e.node.attrs.class===cls);
    const get=(tag,cls)=>{const rows=find(tag,cls);need(rows.length===1&&isActive(rows[0]),'corporate-programme','Unknown vacancy card fields');shape(rows[0].node.attrs,['class'],'corporate-programme');return originalText(rows[0].node);};
    need(descendants.length===8&&descendants.every(e=>isActive(e)&&['p','div','h3','span'].includes(e.node.tag)),'corporate-programme','Unknown extra authored vacancy card criterion');
    need(attrs['data-title']==='Open position - '+job.title&&get('h3','title')===job.title&&get('p','location')===job.location
      &&get('span','department-team')===job.department+' - '+job.team&&get('span','commitment')===job.employmentType
      &&get('p','apply-text')==='Apply for this Job ->','corporate-programme','Corporate/native authored vacancy metadata disagrees');
    const expected=layout(job.location+' '+job.title+' '+job.department+' - '+job.team+' / '+job.employmentType+' Apply for this Job ->');
    need(layout(label)===expected,'corporate-programme','Unknown whole vacancy card text');
    ownURLs.push(href);cards.push({id:own[1],url:href,attributes:{...attrs},originalDescendantText:label});
  }
  need(kind==='C0'?entryCount===2:ownURLs.length===jobs.length&&new Set(ownURLs).size===jobs.length&&intakeCount===1,'membership','Current whole corporate/native programme membership incomplete');
  need(!items.some(e=>['form','select','input','textarea'].includes(e.node.tag)),'corporate-programme','New unpublished filter/input/programme control');
  for(const entry of items.filter(e=>['iframe','object','embed'].includes(e.node.tag)))need(!ATS.test(Object.values(entry.node.attrs).join(' ')),'corporate-programme','Additional embedded hiring programme');
  // Raw-text/inert contexts cannot grant a declaration; an explicit new hiring
  // link within them is still a contradiction, not silently ignored.
  for(const entry of items.filter(e=>e.node.tag==='noscript'))need(!/<a\b[\s\S]*(?:ashbyhq|careers|jobs|hiring|openings)/i.test(entry.node.raw??''),'corporate-programme','Additional inert recruiting declaration');
  const rawGrammar=corporateGrammar(packet,kind,jobs);
  return {packet,schema,originalTitle:title[0].node.raw,declarations,ownURLs,cards,rawGrammar,publisherBrand:'Hyperscience',legalRegistryQualified:false};
}

function geography(text){
  authoredCharacters(text);
  need(!/\b(?:India|Indian|Bengaluru|Bangalore|Karnataka|Hyderabad|Chennai|Mumbai|Pune|Gurugram|Noida|New Delhi)\b/i.test(text),'geography','Possible India work/applicant geography');
  need(!/\bwork\s+(?:country|location)\s*:/i.test(text),'geography','New explicit work metadata is unreviewed');
  need(!/\b(?:applicants?|candidates?|employees?|you|team members?)\s+(?:may|can|must|are\s+eligible\s+to)\s+(?:work|apply|reside|be based)[^.!?]{0,120}\b(?:any\s+(?:country|location)|globally|worldwide|anywhere)\b/i.test(text)
    &&!/\b(?:remote\s+)?work\s+(?:is\s+available|may\s+be\s+performed|from)[^.!?]{0,120}\b(?:any\s+(?:country|location)|globally|worldwide|anywhere)\b/i.test(text)
    &&!/\b(?:position|role|job|employee|you)\s+(?:is|are|must be)\s+(?:based|located|resident)\s+(?:in|at)\s+/i.test(text),'geography','Unknown authored work/applicant geography');
}

function workCountry(api,native,ld,family){
  shape(api.address,['postalAddress'],'country');const address=api.address.postalAddress;
  shape(address,['addressRegion','addressCountry','addressLocality'],'country');
  need(['United States','Bulgaria'].includes(address.addressCountry)&&[address.addressLocality,address.addressRegion].every(v=>typeof v==='string'&&v.length>0),'country','Explicit reviewed primary native country required');
  shape(ld.jobLocation,['@type','address'],'country');shape(ld.jobLocation.address,['@type','addressLocality','addressRegion','addressCountry'],'country');
  need(ld.jobLocation['@type']==='Place'&&ld.jobLocation.address['@type']==='PostalAddress','country','Unknown own published location');
  for(const key of ['addressCountry','addressLocality','addressRegion'])need(ld.jobLocation.address[key]===address[key],'country','Published work address representations disagree');
  shape(ld.applicantLocationRequirements,['@type','name'],'country');
  need(ld.applicantLocationRequirements['@type']==='Country'&&ld.applicantLocationRequirements.name===address.addressCountry,'country','Published applicant country unknown/contradictory');
  need(native.locationAddress===null&&Array.isArray(api.secondaryLocations)&&api.secondaryLocations.length===0&&Array.isArray(native.secondaryLocationNames)&&native.secondaryLocationNames.length===0,'country','Unreviewed additional/native-address country scope');
  for(const value of Object.values(address))authoredCharacters(value);
  need(Object.entries(family.address).every(([key,value])=>address[key]===value)&&api.location===family.displayLocation&&api.workplaceType===family.workplaceType,'country','Full published address/display/mode is outside its reviewed complete content family');
  const expected=address.addressCountry==='United States'?'[Remote] US':'[Hybrid] Sofia, Bulgaria';
  need(api.location===expected&&native.locationName===api.location,'country','Explicit primary native label contradicts reviewed typed country');
  return address.addressCountry;
}

function salary(native,ld){
  const summary=native.compensationTierSummary,tiers=native.compensationTiers;
  need(Array.isArray(tiers),'salary','Complete native compensation tiers required');
  if(summary===null){need(tiers.length===0&&native.scrapeableCompensationSalarySummary===null&&native.compensationPhilosophyHtml===null&&!Object.hasOwn(ld,'baseSalary'),'salary','Explicit null salary and actual absence changed');return null;}
  need(typeof summary==='string'&&tiers.length===1,'salary','Unknown full compensation model');
  authoredCharacters(summary);
  const match=/^(\$|€)([0-9]+(?:\.[0-9])?)K – (\$|€)([0-9]+(?:\.[0-9])?)K( • Offers Equity)( • Offers Commission)?$/.exec(summary);
  need(match&&match[1]===match[3],'salary','Unknown source-specific decimalK/currency/punctuation');
  const amount=value=>{const parts=value.split('.');return Number(parts[0])*1000+Number(parts[1]??0)*100;};
  const minValue=amount(match[2]),maxValue=amount(match[4]),currency=match[1]==='$'?'USD':'EUR';
  need(Number.isSafeInteger(minValue)&&Number.isSafeInteger(maxValue)&&minValue>0&&maxValue>=minValue&&maxValue<=1000000000,'salary','Unreviewed numeric salary range');
  need(native.scrapeableCompensationSalarySummary===match[1]+match[2]+'K - '+match[3]+match[4]+'K','salary','Plain/native salary original differs');
  const tier=tiers[0];shape(tier,['id','title','tierSummary','__typename'],'salary');
  need(UUID.test(tier.id)&&tier.title===null&&tier.__typename==='JobPostingCompensationTiers'&&['','Estimated Base ','Base Salary '].some(prefix=>tier.tierSummary===prefix+summary),'salary','Full original tier criterion differs');
  shape(ld.baseSalary,['@type','currency','value'],'salary');shape(ld.baseSalary.value,['@type','minValue','maxValue','unitText'],'salary');
  need(ld.baseSalary['@type']==='MonetaryAmount'&&ld.baseSalary.currency===currency&&ld.baseSalary.value['@type']==='QuantitativeValue'&&ld.baseSalary.value.minValue===minValue&&ld.baseSalary.value.maxValue===maxValue&&ld.baseSalary.value.unitText==='YEAR','salary','LD/native exact salary differs');
  need(typeof native.compensationPhilosophyHtml==='string','supplement','Full compensation philosophy missing');
  authoredProjection(native.compensationPhilosophyHtml,{philosophy:true});
  need(sha(native.compensationPhilosophyHtml)==='f3bdb85bff4244dc133007eb6c0170a6dacb090313ad5ce0d679c0fe0b062cdf','supplement','New compensation philosophy requires review');
  return {currency,minValue,maxValue,summary,tiers:plainSnapshot(tiers),scrapeableSummary:native.scrapeableCompensationSalarySummary,philosophyHtml:native.compensationPhilosophyHtml,
    scope:'Full native published annual base range plus exact original equity/commission and philosophy; no pay eligibility inference'};
}

function roleFacts(own,api){
  const native=own.originalAppData.posting,ld=own.originalLD;
  shape(native,POSTING_FIELDS,'native-model');
  need(native.__typename==='JobPostingDetails'&&native.isListed===true&&native.isConfidential===false,'native-model','Native role availability changed');
  shape(ld,[...LD_FIELDS,...(Object.hasOwn(ld,'baseSalary')?['baseSalary']:[])],'own-schema');
  need(ld['@context']==='https://schema.org/'&&ld['@type']==='JobPosting'&&ld.directApply===false&&native.id===api.id&&native.title===api.title&&ld.title===api.title,'own-schema','Own full role identity/schema mismatch');
  shape(ld.identifier,['@type','name','value'],'own-schema');need(ld.identifier['@type']==='PropertyValue'&&ld.identifier.name==='Hyperscience'&&ld.identifier.value===api.id,'own-schema','Own native posting identifier differs');
  shape(ld.hiringOrganization,['@type','name','sameAs','logo'],'own-schema');
  need(ld.hiringOrganization['@type']==='Organization'&&ld.hiringOrganization.name==='Hyperscience'&&ld.hiringOrganization.sameAs==='https://www.hyperscience.ai/'&&ld.hiringOrganization.logo===own.originalAppData.organization.theme.logoSquareImageUrl,'own-schema','Published employer/brand mismatch');
  need(native.descriptionHtml===api.descriptionHtml&&ld.description===api.descriptionHtml&&hasSourceDescription({sourceDescription:api.descriptionHtml}),'criteria','Complete original own/API/LD primary criterion differs');
  const projection=authoredProjection(api.descriptionHtml);
  authoredCharacters(api.descriptionPlain);need(projection.comparisonText===layout(api.descriptionPlain),'projection','Original primary HTML/plain source layout differs');
  need(own.headDescriptions.every(text=>layout(text)===layout(api.descriptionPlain)),'native-head','Full published own head description differs');
  for(const text of [api.title,api.location,api.descriptionPlain,projection.comparisonText])geography(text);
  const contentFamily={title:api.title,department:api.department,team:api.team,projectionSHA256:sha(projection.comparisonText),projectionBytes:Buffer.byteLength(projection.comparisonText)};
  const family=REVIEWED_CONTENT_FAMILY.find(profile=>Object.keys(contentFamily).every(key=>profile[key]===contentFamily[key]));
  need(family,'criteria-family','Novel complete authored content or role labels require independent review');
  need(!/(?:base|annual|salary|compensation)[^.!?]{0,80}[$€][0-9]/i.test(projection.comparisonText),'salary','New primary authored salary clause requires review');
  const country=workCountry(api,native,ld,family);
  need(['Remote','Hybrid'].includes(api.workplaceType)&&native.workplaceType===api.workplaceType&&api.isRemote===true&&ld.jobLocationType==='TELECOMMUTE'
    &&api.workplaceType===(country==='United States'?'Remote':'Hybrid'),'mode','Published mode representations unknown/contradictory');
  need(api.employmentType==='FullTime'&&native.employmentType==='FullTime'&&ld.employmentType==='FULL_TIME'&&native.applicationDeadline===null,'employment-date','Employment/deadline disagreement');
  need(typeof api.publishedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+00:00$/.test(api.publishedAt)
    &&Number.isFinite(Date.parse(api.publishedAt))&&new Date(api.publishedAt).toISOString()===api.publishedAt.replace('+00:00','Z')&&ld.datePosted===api.publishedAt.slice(0,10),'employment-date','Original offset/date-only published fields disagree');
  need(native.departmentName===api.department&&native.departmentExternalName===api.department&&Array.isArray(native.teamNames)&&[1,2].includes(native.teamNames.length)
    &&native.teamNames[0]===api.department&&native.teamNames.at(-1)===api.team,'department','Direct native department/team path differs');
  for(const key of ['compensationTierGuideUrl','applicationLimitCalloutHtml','candidateTextingPrivacyPolicyUrl','candidateTextingTermsAndConditionsUrl','automatedProcessingLegalNotice'])need(native[key]===null,'supplement','Unknown supplemental condition/notice');
  need(native.shouldAskForTextingConsent===false&&native.shouldAskForWhatsAppConsent===false&&native.legalEntityNameForTextingConsent==='Hyper Labs, Inc. dba Hyperscience','supplement','Unreviewed consent/legal-label fields');
  const compensation=salary(native,ld);
  const sourceDescription=api.descriptionHtml+(compensation?'<h2>Published compensation</h2><p>'+compensation.summary+'</p>'+compensation.tiers.map(t=>'<p>'+t.tierSummary+'</p>').join('')+'<h2>Compensation philosophy</h2>'+compensation.philosophyHtml:'');
  return {id:api.id,title:api.title,country,workplaceType:native.workplaceType,employmentType:native.employmentType,
    applicantCountry:plainSnapshot(ld.applicantLocationRequirements),applicantEligibilityQualified:false,
    reviewedContentFamily:contentFamily,reviewedAddressFamily:{...family.address},sourceDescription,originalAPI:api,originalNativeModel:own.originalAppData,originalLD:ld,originalHead:own.head,
    originalHTML:own.packet.text,originalRawAppData:own.rawAppData,originalRawLD:own.rawLD,originalHeadResources:own.links,
    compensation,rawDates:{publishedAt:api.publishedAt,datePosted:ld.datePosted,applicationDeadline:native.applicationDeadline},
    publishedCountryScope:'finite-server-published-work-country',nativeAddressKnownNull:true,legalEmployerQualified:false,
    sourceBodiesQualified:false,rendererConsumptionQualified:false,UIOrApplicationEquivalent:false,
    nativeDeclaration:own.declaration,nativeSecurity:own.securityFacts};
}

/** Reparse complete raw source publications. This pure result is not a fresh
 * programme/closing, even when its historical component model facts qualify. */
export function reconcileHyperscienceServerProgramme(options){
  const value=exactFields(options,['entry','positions','api','roles','intakeShell','intakeClient','intakeOpening','intakeClosing']);
  const api=readRawPacket(value.api,A,'A'),payload=rawJSON(api.bytes);
  shape(payload,['jobs','apiVersion'],'api');need(payload.apiVersion==='1'&&Array.isArray(payload.jobs),'api','Exact native envelope/string1 required');
  need(payload.jobs.length>=1&&payload.jobs.length<=6&&new Set(payload.jobs.map(j=>j?.id)).size===payload.jobs.length,'membership','Whole1..6 native vacancies required without subset');
  for(const record of payload.jobs){
    shape(record,API_FIELDS,'api');need(UUID.test(record.id)&&record.isListed===true&&typeof record.title==='string'&&record.title.length>0,'api','Native row identity/listing unavailable');
    need(record.jobUrl==='https://jobs.ashbyhq.com/hyperscience/'+record.id&&record.applyUrl===record.jobUrl+'/application','api','Exact current own/apply URLs required');
  }
  const corporate=readCorporate(value.entry,'C0',payload.jobs),positions=readCorporate(value.positions,'C1',payload.jobs),roles=ownArray(value.roles);
  need(roles.length===payload.jobs.length,'membership','Every original native publication needs an own record');
  const own=roles.map(row=>readNativePacket(row));
  need(new Set(own.map(row=>row.route.id)).size===payload.jobs.length&&payload.jobs.every((row,i)=>own[i].route.id===row.id)
    &&payload.jobs.every(row=>positions.ownURLs.includes(row.jobUrl)),'membership','Complete own/API/corporate membership or native order differs');
  const nativeRecords=payload.jobs.map((row,i)=>roleFacts(own[i],row));
  const intake=readHyperscienceFormContract({shell:value.intakeShell,client:value.intakeClient,opening:value.intakeOpening,closing:value.intakeClosing});
  const allMetadata=[api,corporate.packet,positions.packet,...own.map(row=>row.packet)].every(row=>row.completeTransportMetadataQualified)&&intake.completeTransportMetadataQualified;
  return {source:'hyperscience',nativePayload:plainSnapshot(payload),nativeRecords,intake,reportedTotal:null,
    sourceObservationEvidence:{source:'hyperscience',recordKind:'mixed',observedRecordCount:nativeRecords.length+1,observedVacancyCount:nativeRecords.length,
      sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null},
    rawPackets:{entry:corporate.packet.original,positions:positions.packet.original,api:api.original,roles:own.map(row=>row.packet.original)},
    originalCorporate:{entryPublisherSchema:corporate.schema,positionsPublisherSchema:positions.schema,entryDeclarations:corporate.declarations,positionsDeclarations:positions.declarations,independentCorporateOrder:positions.ownURLs,entryRawGrammar:corporate.rawGrammar,positionsRawGrammar:positions.rawGrammar},
    qualificationFacts:{serverPublicationBodyFactsQualified:true,completeTransportMetadataQualified:allMetadata,currentTransactionQualified:false,
      countryQualificationScope:'finite-server-published-work-country',publishedApplicantFieldQualified:true,applicantEligibilityQualified:false,
      sourceScopeComplete:false,companyGlobalScopeQualified:false,companyGlobalTotal:null,companyIndiaTotal:null,
      legalEmployerQualified:false,rendererConsumptionQualified:false,UIOrApplicationEquivalent:false,sideEffectFreeInitializationQualified:false,
      sourceTimeSemanticsQualified:false,lifecycleCleanupAllowed:false,allChannelsClosed:false,allWholeBodiesEqual:intake.comparison.rawEntityEqual?null:false,
      QrawEntityEqual:intake.comparison.rawEntityEqual,QserverDefinitionCriteriaEqual:intake.comparison.serverDefinitionCriteriaEqual},
    protocolLimits:{nativeRequests:'14+2N',maximumN:6,maximumNativeRequests:26,defaultSourceTimeoutMs:90000,maximumSourceTimeoutMs:120000,
      perCompleteRequestMs:20000,ordinaryBytes:4194304,manifestBytes:1048576,selectedEntryBytes:6291456,aggregateDecodedBytes:25165824,
      closingReservesAndFinalAbortQualified:false,legacyPublicRequestCount:null},
    limits:['Pure body/model/definition facts only; no complete fresh programme/zero or source recovery.',
      'Every ordinary raw closing/current-client/security interval, cancellation/observer/prior-envelope bridge remains a later controller obligation.',
      'Actual published work/applicant country and Remote/Hybrid fields are retained; broader eligibility/legal/global/UI/application/cleanup remains unknown.']};
}
