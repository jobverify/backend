import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {need,one,all,norm,scalarFields} from './currentFacts20261120.js'
import {HOME,LISTING,BOARD,COMPANY,safeURL,publisherRoot,publisherFacts,carrier,constraints,sameEmployer,extraFacts} from './currentConstraints20261121.js'

const brand=value=>typeof value==='string'&&/\bCheckout\.com\b/i.test(value)
function careerTitle(value){const text=norm(value),named=/\b(?:careers?|jobs?|positions?|roles?|opportunities)\s+(?:at|with|for)\s+(.+)$/i.exec(text);if(named&&!/^Checkout\.com\b/i.test(named[1]))return false;if(brand(text))return true;if(/\b(?:at|for)\s+\S/i.test(text))return false;return /^(?:(?:our|all|current|open|explore|view|discover|find)\s+)*(?:careers?(?:\s+opportunities)?|jobs?(?:\s+(?:openings|opportunities))?|positions|openings|opportunities|open roles)(?:[!.])?$/i.test(text)||/^work\s+alongside\s+.+\s+people[!.]?$/i.test(text)||/^(?:join our team|work with us)[!.]?$/i.test(text)}
function identity(value,url,{root=false,social=false}={}){
 need(typeof value==='string'&&value.trim()===value,'current publisher URI malformed');const u=new URL(value,url);need(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search,'current publisher URI protocol/authority differs')
 if(['checkout.com','www.checkout.com'].includes(u.hostname)){need(!root||u.pathname==='/','current publisher owned root differs');return}
 need(social&&(['www.linkedin.com','linkedin.com','twitter.com','www.facebook.com','www.glassdoor.co.uk','www.instagram.com'].includes(u.hostname)&&/checkout/i.test(u.pathname)||u.hostname==='www.youtube.com'&&/^\/channel\/[A-Za-z\d_-]+\/?$/.test(u.pathname)),'current publisher identity is foreign')
}
export function currentPublisher(html,url,at,{own=true}={}){
 const d=document(html),nodes=all(d.root,()=>true),head=/<head\b[^>]*>/i.exec(html),end=head?html.toLowerCase().indexOf('</head>',head.index):-1;need(head&&end>head.index,'current actual HEAD absent');need(!nodes.some(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')),'current publisher base/refresh requires review')
 const p={d,nodes,originalPublisherModels:[]},titles=activeHead(html).titles;need(titles.length<2&&(!own||titles.length===1),'current HEAD title missing/ambiguous');if(titles.length){need(careerTitle(titles[0]),'current HEAD names an unqualified publisher');carrier(p,one(nodes.filter(n=>n.tag==='title'&&n.start>=head.index&&n.start<end),'actual HEAD-owned title'),at,{allowed:[HOME,LISTING,BOARD]})}
 const canonicals=nodes.filter(n=>n.tag==='link'&&String(n.attrs.rel??'').toLowerCase().split(/\s+/).includes('canonical'));if(own||canonicals.length){const node=one(canonicals,'current canonical');need(safeURL(node.attrs.href,url).href===url,'current canonical URI differs');carrier(p,node,at,{allowed:[HOME,LISTING,BOARD]})}
 for(const node of nodes.filter(n=>n.tag==='meta'&&['og:title','og:site_name','og:url','twitter:title'].includes(n.attrs.property??n.attrs.name))){const name=node.attrs.property??node.attrs.name;if(name==='og:site_name')need(node.attrs.content===COMPANY,'current OG publisher differs');else if(name==='og:url')need(safeURL(node.attrs.content,url).href===url,'current OG URI differs');else need(careerTitle(node.attrs.content),'current social HEAD names an unqualified publisher');carrier(p,node,at,{allowed:[HOME,LISTING,BOARD]})}
 let visited=0,qualifiedPages=0
 function structured(value,inherited,depth=0){
  need(depth<=32&&++visited<=20000,'finite publisher structured scope exceeded');if(Array.isArray(value)){value.forEach(v=>structured(v,inherited,depth+1));return}if(!value||typeof value!=='object')return
  const context=Object.hasOwn(value,'@context')?value['@context']:inherited,types=(Array.isArray(value['@type'])?value['@type']:[value['@type']]).map(v=>String(v??'').replace(/^https?:\/\/schema\.org\//,''))
  need(!types.includes('JobPosting'),'additional publisher vacancy model is unqualified')
  if(types.some(t=>['WebPage','AboutPage','WebSite','Organization'].includes(t))){
   need(/^https?:\/\/schema\.org\/?$/.test(context??''),'current publisher structured context differs');publisherFacts(value,at,[HOME,LISTING,BOARD])
   if(types.includes('Organization')){need(value.name===COMPANY,'current structured organization differs');if(value.url!=null)publisherRoot(value.url);if(value['@id']!=null)identity(value['@id'],url,{root:true});if(value.sameAs!=null){const values=Array.isArray(value.sameAs)?value.sameAs:[value.sameAs];need(values.length>0&&values.length<=16,'current publisher identity count differs');values.forEach(v=>identity(v,url,{root:true,social:true}))}}
   else if(types.includes('WebSite')){need(value.name===COMPANY,'current structured website differs');if(value.url!=null)publisherRoot(value.url)}
   else{need(value.name==null||careerTitle(value.name),'current structured career page names another employer');if(value.url!=null)need(safeURL(value.url,url).href===url,'current structured page URI differs');constraints(scalarFields(value),[],{employer:COMPANY,observedAt:at,countryAlternatives:[]});extraFacts(value,at,[],[HOME,LISTING,BOARD]);if(value.publisher!=null)sameEmployer(value.publisher);if(value.about!=null)sameEmployer(Object.fromEntries(Object.entries(value.about).filter(([name])=>!['sameAs','@id'].includes(name))));if(value.url!=null&&safeURL(value.url,url).href===url&&value.about?.name===COMPANY&&value.about?.url){publisherRoot(value.about.url);if(value.publisher?.url)publisherRoot(value.publisher.url);qualifiedPages++}}
   if(value['@id']!=null&&!types.includes('Organization'))identity(value['@id'],url)
   p.originalPublisherModels.push(structuredClone(value))
  }
  for(const[name,child]of Object.entries(value))if(name!=='@context'&&child&&typeof child==='object')structured(child,context,depth+1)
 }
 for(const script of nodes.filter(n=>n.tag==='script'&&!n.attrs.src&&String(n.attrs.type??'').trim().toLowerCase()==='application/ld+json')){structured(readLiteralModel(script.raw??'').value);carrier(p,script,at,{allowed:[HOME,LISTING,BOARD]})}
 if(own){need(qualifiedPages>0,'current own career WebPage/about organization authority absent');const headings=nodes.filter(n=>n.tag==='h1');need(headings.length>0&&headings.length<=8,'current own heading absent');for(const heading of headings){const text=norm(d.text(heading));need(text&&!/\b(?:careers?|jobs?|positions|employer)\b/i.test(text)||careerTitle(text),'current own heading names an unqualified publisher');carrier(p,heading,at,{allowed:[HOME,LISTING,BOARD]})}}
 return{...p,url,authority:{publisher:COMPANY,home:HOME,listing:LISTING,legalEmployer:null,originalPublisherModels:p.originalPublisherModels}}
}
export function currentCareerHandoff(html,at){const p=currentPublisher(html,HOME,at),links=p.nodes.filter(n=>n.tag==='a'&&['/jobs',LISTING].includes(n.attrs.href));need(links.length>0&&links.length<=64,'current own literal jobs handoff absent');for(const link of links){need(safeURL(link.attrs.href,HOME).href===LISTING,'current own literal jobs URI differs');const label=norm(p.d.text(link))||norm(link.attrs['aria-label']);need(/\b(?:opportunities|positions|roles|jobs)\b/i.test(label),'current own jobs handoff has no career meaning');carrier(p,link,at,{allowed:[LISTING]})}return{...p,listingURL:LISTING,originalHandoffs:links.map(n=>({attributes:structuredClone(n.attrs),text:p.d.text(n)}))}}
