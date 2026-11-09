import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
export const HOME='https://imtf.com/'
export const CAREERS='https://imtf.com/about-us/careers/'
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const roleCode=url=>typeof url==='string'?/^https:\/\/apply\.workable\.com\/imtf\/j\/([A-Z0-9]{6,32})\/?$/.exec(url)?.[1]??null:null
export const markdownCode=url=>typeof url==='string'?/^https:\/\/apply\.workable\.com\/imtf\/jobs\/view\/([A-Z0-9]{6,32})\.md$/.exec(url)?.[1]??null:null
const fail=message=>{throw Object.assign(new Error(message),{code:'IMTF_SOURCE_SHAPE'})}
const decode=s=>s.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|nbsp|ndash|mdash);/gi,(m,k)=>{if(k[0]!=='#')return {amp:'&',quot:'"',apos:"'",nbsp:'\u00a0',ndash:'–',mdash:'—'}[k]??m;const n=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):m})
const plain=s=>decode(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim()
const classes=n=>(n.attrs.class??'').split(/\s+/)
const descendant=(n,parent)=>{for(let p=n.parent;p;p=p.parent)if(p===parent)return true;return false}
const VOID=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '))
// Bounded company-specific raw-slice reader, never script/browser execution.
// Ambiguous attributes cannot establish provenance, identity or alternate URLs.
export function readHTML(source){if(typeof source!=='string'||Buffer.byteLength(source)>2*1024*1024)fail('Invalid bounded HTML input');const nodes=[],issues=[],stack=[];let at=0;while(at<source.length){if(nodes.length>100000)fail('HTML node limit');const start=source.indexOf('<',at);if(start<0)break;if(source.startsWith('<!--',start)){const end=source.indexOf('-->',start+4);if(end<0){issues.push({message:'Unclosed source comment',rawHTML:source.slice(start)});break}at=end+3;continue}if(/^<!|^<\?/.test(source.slice(start,start+2))){const end=source.indexOf('>',start+2);if(end<0)break;at=end+1;continue}const closing=/^<\/\s*([a-z][\w:-]*)\s*>/i.exec(source.slice(start));if(closing){const tag=closing[1].toLowerCase();for(let i=stack.length-1;i>=0;i--)if(stack[i].tag===tag){for(const n of stack.slice(i))n.end=start+closing[0].length;stack.length=i;break}at=start+closing[0].length;continue}const m=/^<([a-z][\w:-]*)\b/i.exec(source.slice(start));if(!m){at=start+1;continue}let end=start+m[0].length,q=null;for(;end<source.length;end++){const c=source[end];if(q){if(c===q)q=null}else if(c==='"'||c==="'")q=c;else if(c==='>')break}if(end===source.length){issues.push({message:'Unterminated source tag',rawHTML:source.slice(start)});break}const tag=m[1].toLowerCase(),rawStart=source.slice(start,end+1),attrs={},duplicates=new Set(),attributes=rawStart.slice(m[0].length,-1).replace(/\/\s*$/,''),re=/\s*([^\s=/'"<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'"<>`]+)))?/g;let a,last=0;while((a=re.exec(attributes))){if(attributes.slice(last,a.index).trim())issues.push({message:'Malformed source attributes',rawHTML:rawStart});const key=a[1].toLowerCase();if(Object.hasOwn(attrs,key))duplicates.add(key);attrs[key]=decode(a[2]??a[3]??a[4]??'');last=re.lastIndex}if(attributes.slice(last).trim())issues.push({message:'Malformed source attributes',rawHTML:rawStart});for(const key of duplicates)delete attrs[key];const parent=stack.at(-1)??null,foreign=tag==='svg'||tag==='math'||parent?.foreign&&!['foreignobject','desc','title','mtext'].includes(parent.tag),selfClosing=/\/\s*>$/.test(rawStart),node={tag,attrs,start,openEnd:end+1,end:end+1,parent,foreign,ambiguous:duplicates.size>0};nodes.push(node);if(duplicates.size)issues.push({message:'Duplicate source attributes',rawHTML:rawStart});if(selfClosing&&!VOID.has(tag)&&!foreign)issues.push({message:'Unsupported self-closing nonvoid HTML',rawHTML:rawStart});if(['script','style','template','noscript'].includes(tag)){const stop=new RegExp('</'+tag+'\\s*>','ig');stop.lastIndex=end+1;const match=stop.exec(source);node.end=match?stop.lastIndex:source.length;if(!match)issues.push({message:'Incomplete ignored source subtree',rawHTML:source.slice(start)});at=node.end;continue}if(!VOID.has(tag)&&!(foreign&&selfClosing)){if(stack.length>=256)fail('HTML depth limit');stack.push(node)}at=end+1}for(const n of stack)n.end=source.length;return {source,nodes,issues}}
const raw=(doc,n)=>doc.source.slice(n.start,n.end)
const one=(values,label)=>{if(values.length!==1)fail('Missing/ambiguous '+label);return values[0]}
// These declarations cannot establish vacancy identity or provenance. They can
// prevent an absence claim: inert/lazy markup may activate another inventory.
function unreviewedHiringSurfaces(document,label,accounted){
  const failures=[],budget={bytes:0,documents:0}
  const hiring=/(?:^|[.\/ _-])(?:jobs?|careers?|recruit(?:ment|ing|er)?|vacancies|openings?|positions)(?:[.\/ _?\-]|$)/i
  const hiringPath=/(?:^|\/)(?:jobs?|careers?|recruit(?:ment|ing|er)?|vacancies|openings?|positions?)(?:\/|$)/i
  const ats=/(?:^|\.)(?:workable\.com|lever\.co|greenhouse\.io|ashbyhq\.com|smartrecruiters\.com|recruitee\.com|teamtailor\.com|bamboohr\.com)$/i
  const target=(value,hint)=>{
    let url;try{url=new URL(decodeHTML(value).replace(/\\\//g,'/'),label==='home'?HOME:CAREERS)}catch{return false}
    if(!['http:','https:'].includes(url.protocol))return false
    if(url.origin==='https://imtf.com'&&['/','/about-us/careers/'].includes(url.pathname))return false
    if(/\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?|ttf|otf)$/i.test(url.pathname))return false
    return ats.test(url.hostname)||hiringPath.test(url.pathname)||hiring.test(url.hostname+url.pathname+' '+hint)
  }
  const inspect=(doc,depth=0,context=label)=>{
    budget.bytes+=Buffer.byteLength(doc.source);budget.documents++
    if(depth>6||budget.documents>64||budget.bytes>4*1024*1024){failures.push({message:'Unreviewed nested corporate markup',document:context});return}
    for(const issue of depth?doc.issues:[])failures.push({...issue,document:context})
    for(const node of doc.nodes){
      const source=raw(doc,node),hint=node.tag==='a'?plain(source):node.attrs.title??'',declared=[]
      if(!accounted.has(node)){
        if(node.tag==='a')declared.push(node.attrs.href)
        if(['iframe','embed','script'].includes(node.tag))declared.push(node.attrs.src,node.attrs['data-src'])
        if(node.tag==='object')declared.push(node.attrs.data)
        if(node.tag==='form')declared.push(node.attrs.action)
        for(const [key,value]of Object.entries(node.attrs)){
          if(key==='srcdoc')continue
          if(/^data-.*(?:url|href|src|job|career|recruit|vacan|opening|position)/i.test(key))declared.push(value)
          for(const match of value.replace(/\\\//g,'/').matchAll(/(?:https?:)?\/\/[^\s"'<>]+/gi))declared.push(match[0])
        }
      }
      if(declared.some(value=>typeof value==='string'&&target(value,hint)))failures.push({message:'Unreviewed corporate hiring carrier',document:context,rawHTML:source})
      if(['template','noscript','script'].includes(node.tag)){
        const inner=doc.source.slice(node.openEnd,node.end).replace(new RegExp('</'+node.tag+'\\s*>$','i'),'')
        if(node.tag==='script'){
          for(const match of inner.replace(/\\\//g,'/').matchAll(/(?:https?:)?\/\/[^\s"'<>]+/gi))if(target(match[0],''))failures.push({message:'Unreviewed corporate hiring declaration',document:context,rawHTML:source})
        }else inspect(readHTML(inner),depth+1,context+'/'+node.tag)
      }
      if(typeof node.attrs.srcdoc==='string')inspect(readHTML(decodeHTML(node.attrs.srcdoc)),depth+1,context+'/srcdoc')
    }
  }
  inspect(document)
  return failures
}
export function parseHome(homeHTML){
 const document=readHTML(homeHTML),homeCareersHrefs=document.nodes.filter(n=>n.tag==='a'&&!n.ambiguous&&n.attrs.href===CAREERS).map(n=>n.attrs.href)
 const provenance=homeCareersHrefs.length>0&&!document.nodes.some(n=>n.tag==='base')
 const failures=document.issues.map(i=>({...i,document:'home'}))
 if(!provenance)failures.push({message:'Official home-to-careers provenance missing or ambiguous'})
 failures.push(...unreviewedHiringSurfaces(document,'home',new Set()))
 return {document,provenance,homeCareersHrefs,failures}
}
export function parseListing(homeHTML,careersHTML){const qualification=parseHome(homeHTML),careers=readHTML(careersHTML),candidates=[],failures=[...qualification.failures,...careers.issues.map(i=>({...i,document:'careers'}))];const {homeCareersHrefs}=qualification,provenance=qualification.provenance&&!careers.nodes.some(n=>n.tag==='base');if(qualification.provenance&&!provenance)failures.push({message:'Official home-to-careers provenance missing or ambiguous'});const rows=careers.nodes.filter(n=>n.tag==='div'&&classes(n).includes('imtf-careers-position')),accounted=new Set(),codes=new Set();for(const row of rows){const rawHTML=raw(careers,row);try{const anchors=careers.nodes.filter(n=>n.tag==='a'&&descendant(n,row)&&classes(n).includes('imtf-careers-position-1')),a=one(anchors,'official role anchor');accounted.add(a);if(a.ambiguous||!roleCode(a.attrs.href))fail('Unsafe/ambiguous advertised role href');const spans=careers.nodes.filter(n=>n.tag==='span'&&descendant(n,a)),title=plain(raw(careers,one(spans,'role title')));if(!title)fail('Empty role title');const fields=careers.nodes.filter(n=>n.tag==='div'&&descendant(n,row)&&classes(n).includes('imtf-careers-position-2')).map(n=>plain(raw(careers,n)));if(fields.length!==4||fields.some(v=>!v))fail('Missing/ambiguous role placement fields');const shortcode=roleCode(a.attrs.href);if(codes.has(shortcode))fail('Duplicate advertised role shortcode');codes.add(shortcode);candidates.push({title,url:a.attrs.href,shortcode,workplaceRaw:fields[0],locationRaw:fields[1],departmentRaw:fields[2],employmentRaw:fields[3],relativeAgeRaw:plain(raw(careers,a)).match(/Posted .+$/)?.[0]??null,rawHTML,rawHTMLSHA256:sha(rawHTML)})}catch(error){failures.push({message:error.message,rawHTML,rawHTMLSHA256:sha(rawHTML)})}}for(const n of careers.nodes)if(n.tag==='a'&&!accounted.has(n)&&(roleCode(n.attrs.href)||classes(n).includes('imtf-careers-position-1')))failures.push({message:'Unaccounted official role anchor',rawHTML:raw(careers,n)});failures.push(...unreviewedHiringSurfaces(careers,'careers',accounted));if(!rows.length)failures.push({message:'No native role rows; no verified empty contract'});return {provenance,homeCareersHrefs,candidates,observedListingCount:rows.length,failures,rawDocuments:{homeHTML,careersHTML}}}
export function parseRoleHTML(html,candidate){const doc=readHTML(html);if(doc.issues.length)fail(doc.issues[0].message);if(doc.nodes.some(n=>n.tag==='base'))fail('Unexpected role base URL');const meta=name=>one(doc.nodes.filter(n=>n.tag==='meta'&&n.attrs.name===name),'native '+name).attrs.content;const numericJobId=meta('job'),accountId=meta('account');if(!/^[1-9]\d{0,31}$/.test(numericJobId??'')||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(accountId??'')||meta('subdomain')!=='imtf')fail('Invalid native job/account identity');const canonical=one(doc.nodes.filter(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical')),'canonical role URL').attrs.href;if(roleCode(canonical)!==candidate.shortcode)fail('Role canonical identity mismatch');const alternate=one(doc.nodes.filter(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('alternate')&&(n.attrs.type??'').toLowerCase()==='text/markdown'),'advertised Markdown alternate').attrs.href;if(markdownCode(alternate)!==candidate.shortcode)fail('Markdown alternate tenant/role mismatch');return {nativeNumericJobId:numericJobId,nativeAccountId:accountId,nativePublicURLShortcode:candidate.shortcode,canonicalURL:canonical,markdownURL:alternate,rawRoleHTML:html,rawRoleHTMLSHA256:sha(html)}}
const normalized=s=>s.toLowerCase().replace(/[\s-]+/g,'')
// Recognize explicit country labels only; never infer a country from cities or
// regions. Unrecognized final listing tokens can remain absent/ambiguous.
const countryKey=value=>value.trim().replace(/\s+/g,' ').toLowerCase()
const countryNames=new Map(),displayNames=new Intl.DisplayNames(['en'],{type:'region'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=displayNames.of(code);if(name!==code&&code!=='ZZ')countryNames.set(countryKey(name),name)}
// The captured same-country spellings name one Swiss city; keep both raw labels.
const sameCity=(listed,native,country)=>listed===native||country==='Switzerland'&&((listed==='Zurich'&&native==='Z\u00fcrich')||(listed==='Z\u00fcrich'&&native==='Zurich'))
export function parseMarkdown(markdown,candidate,identity){if(typeof markdown!=='string'||Buffer.byteLength(markdown)>2*1024*1024||markdown.includes('\uFFFD'))fail('Invalid Markdown body');const header=/^# ([^\n]+)\n\n> IMTF · ([^\n]+) · ([^\n]+) · Posted (\d{4}-\d{2}-\d{2})\n\n/.exec(markdown);if(!header||header[1]!==candidate.title||normalized(header[3])!==normalized(candidate.employmentRaw))fail('Markdown title/employment/header mismatch');const placement=/^(.+),\s*([^,()]+)\s+\(([^()]+)\)$/.exec(header[2]);if(!placement)fail('Missing explicit Markdown location/country/workplace');const workplace=one([...markdown.matchAll(/^\*\*Workplace:\*\* ([^\n]+)$/gm)],'Markdown workplace')[1],department=one([...markdown.matchAll(/^\*\*Department:\*\* ([^\n]+)$/gm)],'Markdown department')[1];if(normalized(workplace)!==normalized(placement[3])||normalized(workplace)!==normalized(candidate.workplaceRaw)||department!==candidate.departmentRaw)fail('Markdown/listing workplace or department mismatch');const countryRaw=placement[2].trim(),cityRaw=placement[1].trim(),country=countryNames.get(countryKey(countryRaw))??null,listingCountry=countryNames.get(countryKey(candidate.locationRaw.split(',').at(-1)));if(!sameCity(candidate.locationRaw.split(',')[0].trim(),cityRaw,country)||listingCountry&&listingCountry!==country)fail('Conflicting listing/detail placement');const [year,month,day]=header[4].split('-').map(Number),leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];if(month<1||month>12||day<1||day>days[month-1])fail('Invalid native publication day');const headings=[...markdown.matchAll(/^#{1,2} (.+)$/gm)];if(headings.length!==5||headings[0][1]!==candidate.title||headings.slice(1).map(h=>h[1]).join('|')!=='Description|Requirements|Benefits|Apply')fail('Unsupported/missing Markdown sections');const sections={};for(let i=1;i<4;i++){const text=markdown.slice(headings[i].index,headings[i+1].index);if(text.replace(/^##[^\n]+\n/,'').trim().length<40)fail('Missing full employer section');sections[headings[i][1]]=text}const applySection=markdown.slice(headings[4].index),applications=[...applySection.matchAll(/\[Apply at IMTF\]\(([^)]+)\)/g)];const applicationURL=one(applications,'native Apply link')[1];if(applicationURL!==`https://apply.workable.com/imtf/j/${candidate.shortcode}/apply`||!/^## Apply\n\n\[Apply at IMTF\]\([^)]+\)\n\n---\nPowered by \[Workable\]\(https:\/\/www\.workable\.com\)\n\s*$/.test(applySection))fail('Unsafe/unsupported Markdown application footer');const sourceDescriptionMarkdown=markdown.slice(headings[1].index,headings[4].index);return {...identity,title:candidate.title,listing:candidate,sourceURL:candidate.url,nativeApplicationURL:applicationURL,applicationVisited:false,nativeFullMarkdown:markdown,nativeFullMarkdownSHA256:sha(markdown),sourceDescriptionMarkdown,sourceDescriptionMarkdownSHA256:sha(sourceDescriptionMarkdown),nativeDescriptionSections:sections,nativeLocationRaw:header[2],nativeCityRaw:cityRaw,nativeCountryRaw:countryRaw,country,nativeCountryCode:null,workplaceRaw:workplace,departmentRaw:department,employmentRaw:header[3],nativePublicationRaw:header[4],publicationPrecision:'day',publicationTimezone:null,firstEverPublication:null,nativeRequisitionId:null,nativeClosingDate:null,explicitLifecycleStatus:null,nativeLegalEmployer:null}}
