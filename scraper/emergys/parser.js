import {document,norm} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {requireNative,oneNative,nativeDate,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {decodeHTML} from 'entities'
export const BOARD='https://www.emergys.com/careers/'
export const ensure=(ok,message)=>requireNative(ok,'Emergys: '+message)
export function validateURL(value){const u=new URL(value);ensure(u.href===value&&u.origin==='https://www.emergys.com'&&!u.search&&!u.hash&&!u.username&&!u.password,'Unapproved public read URL');ensure(u.pathname==='/careers/'||/^\/careers\/page\/[2-9]\d?\/$/.test(u.pathname)||/^\/careers\/[a-z0-9-]+\/$/.test(u.pathname)&&!/^\/careers\/(?:apply|application|login|consent|upload|submit)\b/.test(u.pathname),'Unapproved job or application path');return u}
function docOf(html){const d=document(html);ensure(!d.nodes(n=>n.tag==='base').length,'Unexpected base URL');return d}
export function parseListing(html,url=BOARD){
 const u=validateURL(url),pageNumber=url===BOARD?1:Number(/^\/careers\/page\/(\d+)\/$/.exec(u.pathname)?.[1]);ensure(Number.isInteger(pageNumber)&&pageNumber>=1&&pageNumber<=10,'Unqualified listing URL');const d=docOf(html),main=oneNative(d.nodes(n=>n.tag==='main'),'careers main region')
 ensure(d.nodes(n=>/^h[1-6]$/.test(n.tag)&&d.text(n)==='New Openings',main).length===1,'Missing native openings heading')
 const container=oneNative(d.nodes(n=>n.tag==='div'&&d.hasClass(n,'job-p-listing'),main),'native openings grid'),grid=oneNative(d.nodes(n=>n.tag==='ul'&&n.attrs['data-pages'],container),'native grid page declaration')
 const lastPage=Number(grid.attrs['data-pages']);ensure(Number.isSafeInteger(lastPage)&&lastPage>=pageNumber&&lastPage<=10,'Invalid native page bound')
 // Hidden fallback navigation supplies read-only pagination configuration;
 // it is never treated as visible job content or executed client code.
 const all=[];const walk=n=>{if(typeof n!=='string'){all.push(n);n.children?.forEach(walk)}};walk(container)
 const navs=all.filter(n=>n.tag==='div'&&d.hasClass(n,'pagination'))
 let nextURL=null
 if(lastPage>1){const nav=oneNative(navs,'native fallback pagination'),p=document(d.inner(nav)),current=oneNative(p.nodes(n=>n.tag==='span'&&p.hasClass(n,'current')),'native current page');ensure(p.text(current)===String(pageNumber),'Native current page mismatch');const links=p.nodes(n=>n.tag==='a'&&n.attrs.rel==='next');if(pageNumber<lastPage){const link=oneNative(links,'native next page');nextURL=link.attrs.href;ensure(nextURL===BOARD+'page/'+(pageNumber+1)+'/','Native next-page identity changed')}else ensure(links.length===0,'Unexpected continuation after declared last page')}
 const continuation=d.nodes(n=>['a','button'].includes(n.tag)&&(n.attrs.rel==='next'||/^(?:next|load more|show more)\b/i.test(d.text(n)))&&!d.hasClass(n,'fusion-load-more-button'),main)
 ensure(!continuation.length,'Unreviewed native pagination')
 const links=d.nodes(n=>n.tag==='a'&&/^https:\/\/www\.emergys\.com\/careers\/[a-z0-9-]+\/$/.test(n.attrs.href??''),grid)
 ensure(links.length>0&&links.length<=60,'Empty/unverified or oversized public role inventory')
 const seen=new Set(),records=links.map(n=>{validateURL(n.attrs.href);const id=new URL(n.attrs.href).pathname.split('/').filter(Boolean).at(-1),title=d.text(n);ensure(title&&!seen.has(id),'Missing/duplicate public role identity');seen.add(id);return{id,title,url:n.attrs.href,rawListingHTML:d.outer(n)}})
 return{records,errors:[],observedRows:records.length,pageNumber,reportedTotal:null,lastPage,nextURL,terminationKnown:pageNumber===lastPage}
}
export const pageFingerprint=page=>JSON.stringify(page.records.map(r=>[r.id,r.title,r.url]))
function publication(value,clock){ensure(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|\+00:00)$/.test(value),'Missing/invalid native UTC publication');const date=nativeDate(value.replace(/\+00:00$/,'Z'),{required:true});ensure(Date.parse(date.iso)<=Date.parse(clock),'Future native publication');return{raw:value,iso:date.iso,precision:date.precision}}
function visibleRoleContent(html,source,content){
 const pathTo=(node,target)=>{
  if(node===target)return[]
  for(let index=0;index<node.children.length;index++)if(typeof node.children[index]!=='string'){
   const path=pathTo(node.children[index],target);if(path)return[index,...path]
  }
  return null
 }
 const path=pathTo(source.root,content);ensure(path,'Authored role content is outside the native document')
 const visible=readVisibleNativeDocument(html,{strict:true})
 let original=source.root,qualified=oneNative(visible.nodes(n=>n.tag==='root'),'visible native role document')
 const sameShape=()=>qualified&&qualified.tag===original.tag&&JSON.stringify(qualified.attrs)===JSON.stringify(original.attrs)&&qualified.children.length===original.children.length
 for(const index of path){ensure(sameShape(),'Native/visible role content binding changed');original=original.children[index];qualified=qualified.children[index]}
 ensure(sameShape()&&!qualified.inert,'Authored role content is not visible or uniquely bound')
 return qualified
}
function visibleParagraphs(node){
 if(node.inert)return[]
 return[...(node.tag==='p'?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(visibleParagraphs)]
}
function paragraphLines(node){
 const text=n=>typeof n==='string'?decodeHTML(n).replace(/\s+/g,' '):n.inert||n.tag==='script'?'':n.tag==='br'?'\n':n.children.map(text).join('')
 return text(node).split(/\n+/).map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean)
}
export function parseDetail(html,row,clock){
 validateURL(row.url);const d=docOf(html)
 const canonical=oneNative(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'public role canonical');ensure(canonical.attrs.href===row.url,'Canonical role identity changed')
 const title=d.text(oneNative(d.nodes(n=>n.tag==='h1'),'public role title'));ensure(norm(title)===norm(row.title),'Listing/detail role title conflict')
 const graph=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').flatMap(n=>{let v;try{v=JSON.parse(n.raw)}catch{ensure(false,'Malformed native schema')};return v['@graph']??[v]})
 const org=oneNative(graph.filter(s=>s['@type']==='Organization'&&s['@id']==='https://www.emergys.com/#organization'),'native publisher organization');ensure(org.name==='Emergys'&&org.url==='https://www.emergys.com/','Native publisher identity changed')
 const article=oneNative(graph.filter(s=>s['@type']==='Article'&&s['@id']===row.url+'#article'&&s.mainEntityOfPage?.['@id']===row.url),'role article identity')
 const web=oneNative(graph.filter(s=>s['@type']==='WebPage'&&s['@id']===row.url&&s.url===row.url),'role WebPage identity')
 ensure(norm(article.headline)===norm(title)&&article.publisher?.['@id']===org['@id'],'Native article title/publisher conflict')
 const date=publication(article.datePublished,clock);ensure(web.datePublished===article.datePublished,'Native role-page publication clocks disagree')
 const main=oneNative(d.nodes(n=>n.tag==='main'),'role main region'),blocks=d.nodes(n=>n.tag==='div'&&d.hasClass(n,'fusion-text'),main)
 const content=oneNative(blocks.filter(n=>d.text(n).length>300),'complete authored role content')
 ensure(!d.nodes(n=>n.tag==='form',content).length&&!/Apply for this position|Upload Resume/i.test(d.text(content)),'Application form inside native role content')
 const locationLine=oneNative(visibleParagraphs(visibleRoleContent(html,d,content)).flatMap(paragraphLines).filter(line=>/^Location\s*:/i.test(line)),'job-specific location line')
 const location=locationLine.replace(/^Location\s*:/i,'').trim();ensure(location,'Missing authored job workplace')
 const country=nativeLocationCountryName(location)||(/,\s*USA$/i.test(location)?'United States':null)
 const fact={id:row.id,title,sourceURL:row.url,location,country,descriptionHTML:d.inner(content),nativeListingRecord:row,
  nativePublication:{field:'Article.datePublished',raw:date.raw,iso:date.iso,precision:date.precision,isExplicitJobPostingDate:false,meaning:'Original publication of the exact public role page;not first-ever requisition publication',corroboratedBy:'WebPage.datePublished'},
  nativeArticle:article,nativeWebPage:web,nativePublisher:org,nativeEditDate:article.dateModified??null,firstEverPublication:null,legalEmployer:null,nativeApplicationURL:null,applicationVisited:false}
 if(country!=='India')return{...fact,excluded:true,exclusionReason:country?'native-explicit-non-India-country':'native-country-unknown'}
 return fact
}
