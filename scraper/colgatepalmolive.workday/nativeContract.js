import {readNativeDocument,decodeNativeHtml} from './nativeHtml.js'
export const CORPORATE='https://www.colgatepalmolive.co.in/',ORIGIN='https://jobs.colgate.com',SEARCH=ORIGIN+'/search/',API=ORIGIN+'/services/recruiting/v1/jobs'
export const check=(condition,message)=>{if(!condition)throw Error('Colgate public native contract: '+message)}
const norm=s=>String(s??'').replace(/\s+/g,' ').trim()
// Ignore JavaScript comments without damaging quoted URLs or configuration
// strings. Commented-out bootstrap data cannot establish current native identity.
function withoutComments(text){
 let out=''
 for(let i=0;i<text.length;i++){
  const c=text[i]
  // The observed bootstrap uses plain quoted literals only. Template literals
  // (including interpolations) are a changed executable contract; their text
  // must never be mistaken for current declarations or native company fields.
  check(c!=='`','Native bootstrap template expression requires qualification')
  if(c==='"'||c==="'"){const start=i;for(i++;i<text.length;i++){if(text[i]==='\\')i++;else if(text[i]===c)break}check(i<text.length,'Truncated native bootstrap string');out+=text.slice(start,i+1)}
  else if(c==='/'&&text[i+1]==='/'){while(i<text.length&&!/[\r\n]/.test(text[i]))i++;out+='\n'}
  else if(c==='/'&&text[i+1]==='*'){const end=text.indexOf('*/',i+2);check(end>=0,'Truncated native bootstrap comment');out+=' ';i=end+1}
  else out+=c
 }
 return out
}
const activeScripts=d=>d.nodes(n=>n.tag==='script'&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')&&['','text/javascript','application/javascript','module'].includes(n.attrs.type??'')).map(n=>withoutComments(n.raw??''))
// Recognize only statement starts outside all blocks/expressions. This is a
// conservative reader of the observed bootstrap, never a JavaScript evaluator.
function statementStarts(text){
 const starts=new Set();let curly=0,round=0,square=0,boundary=0
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(c==='"'||c==="'"){for(i++;i<text.length;i++){if(text[i]==='\\')i++;else if(text[i]===c)break}continue}
  if(curly===0&&round===0&&square===0&&text.slice(boundary,i).trim()===''&&!/\s/.test(c))starts.add(i)
  if(c==='{')curly++;else if(c==='}')curly--;else if(c==='(')round++;else if(c===')')round--;else if(c==='[')square++;else if(c===']')square--
  check(curly>=0&&round>=0&&square>=0,'Unsupported native bootstrap lexical shape')
  if(curly===0&&round===0&&square===0&&(c===';'||c==='}'))boundary=i+1
 }
 return starts
}
const topLevelMatches=(script,regex)=>{const starts=statementStarts(script);return[...script.matchAll(regex)].filter(m=>starts.has(m.index))}
function nativeObject(script,start){let depth=0;for(let i=start;i<script.length;i++){const c=script[i];if(c==='"'||c==="'"){for(i++;i<script.length;i++){if(script[i]==='\\')i++;else if(script[i]===c)break}}else if(c==='{')depth++;else if(c==='}'&&--depth===0)return script.slice(start,i+1)}throw Error('Colgate public native contract: Truncated native object')}
function directProperty(object,wanted){
 const keys=new Set();let i=1,found
 const space=()=>{while(/\s/.test(object[i]??'')&&i<object.length)i++}
 const quoted=()=>{const start=i,q=object[i++];for(;i<object.length;i++){if(object[i]==='\\')i++;else if(object[i]===q){i++;return object.slice(start,i)}}throw Error('Colgate public native contract: Truncated property string')}
 while(i<object.length-1){
  space();if(object[i]===','){i++;continue}if(object[i]==='}')break
  let key
  if(object[i]==='"'||object[i]==="'"){const literal=quoted();check(!literal.includes('\\'),'Escaped native property names unsupported');key=literal.slice(1,-1)}
  else{const m=object.slice(i).match(/^[A-Za-z_$][\w$]*/);check(m,'Native property shape changed');key=m[0];i+=key.length}
  check(!keys.has(key),'Duplicate native object property');keys.add(key);space();check(object[i++]===':','Native property initializer unavailable');space();const start=i;let curly=0,round=0,square=0
  for(;i<object.length;i++){
   const c=object[i];if(c==='"'||c==="'"){quoted();i--;continue}
   if(curly===0&&round===0&&square===0&&(c===','||c==='}'))break
   if(c==='{')curly++;else if(c==='}')curly--;else if(c==='(')round++;else if(c===')')round--;else if(c==='[')square++;else if(c===']')square--
   check(curly>=0&&round>=0&&square>=0,'Native property expression malformed')
  }
  check(i>start,'Native property value missing');if(key===wanted)found=object.slice(start,i).trim()
 }
 return found
}
export function verifyCorporate(body){const d=readNativeDocument(body);check(d.nodes(n=>n.tag==='title').some(n=>/Colgate-Palmolive/.test(n.raw)),'Corporate title missing');const canonical=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical');check(canonical.length===1&&canonical[0].attrs.href===CORPORATE,'Corporate canonical missing or conflicting');check(d.nodes(n=>n.tag==='a'&&n.attrs.href===ORIGIN+'/').length>0,'Active corporate native careers handoff missing')}
export function verifySearch(body){
 const d=readNativeDocument(body),scripts=activeScripts(d)
 const initializers=scripts.flatMap(s=>topLevelMatches(s,/\bj2w\.init\s*\(\s*\{/g).map(m=>nativeObject(s,m.index+m[0].length-1)))
 const styles=scripts.flatMap(s=>topLevelMatches(s,/\bif\s*\(\s*typeof\s+resultStyles\s*===\s*'undefined'\s*\)\s*\{\s*var\s+resultStyles\s*=\s*\{/g).map(m=>nativeObject(s,m.index+m[0].length-1)))
 check(initializers.length===1&&styles.length===1,'Current top-level native initialization unavailable')
 const sso=directProperty(initializers[0],'ssoCompanyId'),company=directProperty(styles[0],'companyId')
 check(/^(['"])colgate\1$/.test(sso??'')&&/^(['"])colgate\1$/.test(company??''),'Native company token must be a matching direct literal property')
 check(scripts.some(s=>topLevelMatches(s,/\bvar\s+unifyBuildVersion\s*=\s*"RMK\/j2w-all-multibranch-CI\/b2605\.31"/g).length===1&&s.includes('xweb/rmk-jobs-search')&&s.includes('https://performancemanager4.successfactors.com/verp/vmod_3')&&s.includes('asset-manifest-entrypoints.json?tag=')),'Current advertised widget version/shape changed')
 check(scripts.some(s=>s.includes('fieldId:"filter1"')&&s.includes('label:"Country"')),'Current native country facet unavailable')
 const srcs=d.nodes(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'nomodule')).map(n=>n.attrs.src)
 check(srcs.includes('/platform/js/widgets/reactWidgetLoader.js')&&srcs.includes('https://performancemanager4.successfactors.com/verp/vmod_3/ui/widget-loader/resources/widget-loader.js'),'Advertised active widget loaders missing')
 const nonce=scripts.flatMap(s=>topLevelMatches(s,/\bvar\s+CSRFToken\s*=\s*(["'])([^"']+)\1\s*;/g).map(m=>m[2]));check(nonce.length===1&&nonce[0].length>=16&&nonce[0].length<=128,'Public anonymous nonce unavailable');return nonce[0]
}
export function checkEnvelope(d){check(d&&typeof d==='object'&&!Array.isArray(d),'Malformed native response');for(const[k,v]of Object.entries(d)){const key=k.toLowerCase().replace(/[_\s-]/g,'');if(['error','errors','errorcode','errormessage','exception','fault'].includes(key))check(false,'Explicit native error');if(key==='success')check(v===true,'Native failure flag');if(['status','statuscode','httpstatus'].includes(key))check(v===200,'Native error status');if(['meta','metadata','result','response'].includes(key)&&v!=null)checkEnvelope(v)}}
export function nativeDate(value,now,publication=false){check(typeof value==='string'&&/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(value),'Native date shape unavailable');const[m,d,y]=value.split('/').map(Number),date=new Date(Date.UTC(2000+y,m-1,d));check(date.getUTCFullYear()===2000+y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d,'Native invalid calendar');check(!publication||date.getTime()<=Date.parse(now),'Native future publication');return date.toISOString()}
const REVIEWED_WORKSITES=['Sanand, GJ, IND, ','Baddi, HP, IND, ','Goa, GA, IND, ','Sricity, AP, IND, ']
const REVIEWED_COORDINATES={'Sanand, GJ, IND, ':'22.9919637,72.3772986','Baddi, HP, IND, ':'30.9578258,76.7913558','Goa, GA, IND, ':'15.2993265,74.123996','Sricity, AP, IND, ':'13.4936889,79.9975916'}
const REVIEWED_FIELDS=['jobLocationShort','supportedLocales','unifiedUrlTitle','businessUnit_obj','unifiedStandardStart','currency','id','unifiedStandardTitle','filter5','jobLocationShortWithCoordinates','urlTitle']
const POOL_NOTICE="Please note- This is for active pooling for positions across various locations in India like Goa, Himachal Pradesh, Andhra Pradesh and Ahmedabad. If your profile matches an open role, you'll get an invitation link and must apply again to be considered"
function reviewWorksites(row){
 check(row.id==='177064'&&row.unifiedStandardTitle==='Team Lead- Operations','Unreviewed multiple-office identity')
 check(Object.keys(row).length===REVIEWED_FIELDS.length&&Object.keys(row).every(k=>REVIEWED_FIELDS.includes(k)),'Unreviewed multiple-office row shape')
 check(JSON.stringify(row.jobLocationShort)===JSON.stringify(REVIEWED_WORKSITES),'Unreviewed multiple-office country/city set')
 check(Array.isArray(row.jobLocationShortWithCoordinates)&&row.jobLocationShortWithCoordinates.length===4,'Multiple-office coordinate coverage missing')
 const seen=new Set()
 for(const office of row.jobLocationShortWithCoordinates){check(office&&typeof office==='object'&&Object.keys(office).length===2&&Object.keys(office).every(k=>['value','key'].includes(k)),'Unreviewed multiple-office coordinate shape');check(Object.hasOwn(REVIEWED_COORDINATES,office.value)&&office.key===REVIEWED_COORDINATES[office.value]&&!seen.has(office.value),'Multiple-office coordinates conflict');seen.add(office.value)}
 check(JSON.stringify(row.businessUnit_obj)==='["Supply Chain/Manufacturing"]'&&JSON.stringify(row.currency)==='["INR"]'&&JSON.stringify(row.supportedLocales)==='["en_US"]'&&row.unifiedUrlTitle==='Team-Lead-Operations'&&row.urlTitle===row.unifiedUrlTitle,'Unreviewed multiple-office native context')
}
function currentLocationCarriers(row){
 for(const [key,value]of Object.entries(row))if(/country|address|location/i.test(key)&&!['jobLocationShort','jobLocationShortWithCoordinates'].includes(key))check(value==null||value===''||Array.isArray(value)&&value.length===0,'Unreviewed native country/address/location carrier')
 for(const office of row.jobLocationShortWithCoordinates??[])check(office&&typeof office==='object'&&Object.keys(office).every(k=>['value','key'].includes(k)),'Unreviewed native coordinate carrier')
}
export function validateRow(row,now,{allowReviewedWorksiteGap=false}={}){
 checkEnvelope(row);check(typeof row.id==='string'&&/^[1-9]\d{3,8}$/.test(row.id),'Native requisition identity malformed');check(typeof row.unifiedStandardTitle==='string'&&row.unifiedStandardTitle.trim()&&!/[<>\u0000-\u001f]/.test(row.unifiedStandardTitle),'Native title malformed')
 check(Array.isArray(row.filter5)&&row.filter5.length===1&&row.filter5[0]==='Colgate-Palmolive','Native company brand mismatch')
 check(Array.isArray(row.supportedLocales)&&row.supportedLocales.includes('en_US'),'Native locale unavailable')
 const reviewedGap=allowReviewedWorksiteGap&&row.id==='177064'&&Array.isArray(row.jobLocationShort)&&row.jobLocationShort.length>1
 if(allowReviewedWorksiteGap)currentLocationCarriers(row)
 if(reviewedGap)reviewWorksites(row)
 else{
 check(Array.isArray(row.jobLocationShort)&&row.jobLocationShort.length===1&&typeof row.jobLocationShort[0]==='string','Native location scope missing')
 const location=row.jobLocationShort[0].split(',').map(s=>s.trim());check(location.length===4&&location[0]==='Mumbai'&&location[1]==='MH'&&location[2]==='IND'&&location[3]==='','Native location outside verified Mumbai/Maharashtra/India scope')
 check(Array.isArray(row.jobLocationShortWithCoordinates)&&row.jobLocationShortWithCoordinates.length===1&&row.jobLocationShortWithCoordinates[0].value===row.jobLocationShort[0],'Native location fields conflict')
 }
 const slug=row.unifiedUrlTitle;check(typeof slug==='string'&&slug.length>0&&/^(?:[A-Za-z0-9_%.,()-]|&amp;)+$/.test(slug)&&!/%(?:2f|5c|3f|23)/i.test(slug)&&row.urlTitle===slug,'Native URL title mismatch')
 return{...row,sourceURL:ORIGIN+'/job/'+slug+'/'+row.id+'-en_US',postedAt:nativeDate(row.unifiedStandardStart,now,true),closingDate:row.unifiedStandardEnd==null?null:nativeDate(row.unifiedStandardEnd,now),...(reviewedGap?{nativeWorksiteReview:'finite-four-office-record-requires-own-detail-hold'}:{})}
}
export function parsePage(d,page,now,expectedTotal,options){checkEnvelope(d);check(Number.isSafeInteger(d.totalJobs)&&d.totalJobs>=0&&d.totalJobs<=500,'Native total invalid or exceeds bound');check(expectedTotal==null||d.totalJobs===expectedTotal,'Native total drift');check(Array.isArray(d.jobSearchResult)&&d.jobSearchResult.length===Math.min(10,Math.max(0,d.totalJobs-page*10)),'Native page size/range mismatch');return{total:d.totalJobs,rows:d.jobSearchResult.map(j=>{check(j&&typeof j==='object'&&!Array.isArray(j),'Native row envelope malformed');return validateRow(j.response,now,options)})}}
const serialize=n=>typeof n==='string'?n:n.inert||['script','style'].includes(n.tag)?'':`<${n.tag}>${n.children.map(serialize).join('')}</${n.tag}>`
export function parseDetail(body,row,now,{allowReviewedWorksiteGap=false}={}){
 const reviewedGap=allowReviewedWorksiteGap&&row.nativeWorksiteReview==='finite-four-office-record-requires-own-detail-hold'
 if(reviewedGap){const original={...row};for(const key of ['sourceURL','postedAt','closingDate','nativeWorksiteReview'])delete original[key];check(JSON.stringify(validateRow(original,now,{allowReviewedWorksiteGap:true}))===JSON.stringify(row),'Reviewed worksite detail row proof changed')}
 const d=readNativeDocument(body),canonicals=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical');check(canonicals.length===1&&canonicals[0].attrs.href===decodeNativeHtml(row.sourceURL)+'/','Native canonical identity mismatch')
 const titles=d.nodes(n=>n.attrs.itemprop==='title');check(titles.length===1&&d.text(titles[0])===row.unifiedStandardTitle,'Native detail title mismatch')
 const sections=d.nodes(n=>n.attrs.itemprop==='description');check(sections.length===3,'Native full description sections unavailable')
 const text=sections.map(n=>d.text(n));check((reviewedGap?/^(?:No Relocation Assistance Offered|Relocation Assistance Offered Within Country) Job Number #177064 - Ahmedabad, Gujarat, India Who We Are /.test(text[0]):text[0].includes('Job Number #'+row.id+' - Mumbai, Maharashtra, India'))&&text[0].includes('Colgate-Palmolive Company'),'Native detail requisition/country/company context mismatch')
 const main=text[1],meaningful=main.split(/(?<=[.!?])\s+/).filter(s=>!/^(?:please\s+)?(?:(?:click\s+(?:the\s+)?)?apply\s+now|submit\s+(?:your\s+)?application)\b/i.test(s)&&!/^.{0,25}job description\b.*\b(?:unavailable|not available|available soon|coming soon|attached)\b/i.test(s)).join(' ').replace(/\b(?:job description|apply now|sample|placeholder|read more|coming soon)\b/gi,'').replace(/[^\p{L}\p{N}]/gu,'')
 check(!/\b(?:(?:this|the) (?:job|position|role|vacancy) (?:is (?:no longer available|closed)|has been (?:closed|filled))|no longer accepting applications)\b/i.test(text.join(' ')),'Native role explicitly closed');check(meaningful.length>=100,'Native substantive role description missing; company boilerplate cannot replace it')
 if(reviewedGap)check(main.startsWith(POOL_NOTICE),'Reviewed pooling-signal provenance changed')
 const labels=d.nodes(n=>(n.attrs.class||'').split(/\s+/).includes('joblayouttoken')).map(n=>d.text(n)),starts=labels.filter(s=>s.startsWith('Posting Start Date:')).map(s=>norm(s.slice('Posting Start Date:'.length)));check(starts.length===1&&starts[0]===row.unifiedStandardStart,'Native detail publication mismatch')
 const ends=labels.filter(s=>s.startsWith('Posting End Date:')).map(s=>norm(s.slice('Posting End Date:'.length)));check(row.closingDate?ends.length===1&&ends[0]===row.unifiedStandardEnd:ends.length===0,'Native detail closing date mismatch')
 const applyPath='/talentcommunity/apply/'+row.id+'/?locale=en_US',applies=d.nodes(n=>n.tag==='a'&&/^Apply now$/i.test(d.text(n)));check(applies.length>0&&applies.every(n=>n.attrs.href===applyPath),'Native active application identity mismatch')
 const sourceDescription=sections.map(n=>n.children.map(serialize).join('')).join('\n'),jobDescription=text.join('\n\n')
 return{source:'colgatepalmolive',company:'Colgate-Palmolive',jobId:row.id,requisitionId:row.id,title:row.unifiedStandardTitle,sourceUrl:row.sourceURL,link:row.sourceURL,applyUrl:ORIGIN+applyPath,location:reviewedGap?null:'Mumbai, Maharashtra, India',locations:reviewedGap?[]:['Mumbai, Maharashtra, India'],city:reviewedGap?null:'Mumbai',state:reviewedGap?null:'Maharashtra',country:'India',postedAt:row.postedAt,closingDate:row.closingDate,sourceClosingDateIsExact:false,sourceDescription,jobDescription,nativeCompanyBrand:row.filter5[0],nativeLegalEmployer:null,nativeRawLocations:row.jobLocationShort,nativePostedDate:row.unifiedStandardStart,nativeClosingDate:row.unifiedStandardEnd??null,sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,sourceCompanyCoverageComplete:false,sourceGlobalJobCount:null,sourceIndiaJobCount:null,scrapedAt:now,...(reviewedGap?{nativeRecordKind:'hiring-signal',sourceWorksiteStatus:'held',nativeDetailLocation:'Ahmedabad, Gujarat, India'}:{})}
}
