import {isDeepStrictEqual} from 'node:util'
import {createHash} from 'node:crypto'
import {parseNativeJSON} from '../aecom.workday/nativeJSON.js'
import {document,all,one,cls,norm,flow,snapshot} from './currentHtml.js'
import {need,failure} from './currentErrors.js'
import {OUTSIDE_CRITERIA_TEMPLATE} from './currentTemplateContract.js'
export {need,failure,isFailure} from './currentErrors.js'
export const HOME='https://anandengg.in/',CAREERS=HOME+'open-positions/',BRAND='Anand Engineering'
export const sha=v=>createHash('sha256').update(v).digest('hex')
export const json=v=>{try{return parseNativeJSON(v)}catch(e){throw failure('JSON: '+e.message)}}
export function schema(doc){
 const models=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&!n.attrs.src).flatMap(n=>{const m=json(n.raw||'');need(m&&typeof m==='object'&&!Array.isArray(m),'unreviewed native schema shape');return m['@graph']||[m]})
 need(models.every(m=>m&&typeof m==='object'&&!Array.isArray(m)),'invalid schema graph');return models
}
export function publisher(doc){const org=one(schema(doc).filter(m=>m['@type']==='Organization'),'own publisher Organization');need(org.name===BRAND&&org.url===HOME&&org['@id']===HOME+'#organization','native publisher identity differs');return org}
export function readHome(html){const doc=document(html),org=publisher(doc),handoffs=doc.nodes(n=>n.tag==='a'&&n.attrs.href&&new URL(n.attrs.href,HOME).href===CAREERS).map(snapshot);need(handoffs.length>0,'current own careers handoff missing');return{organization:org,handoffs}}
export function roleURL(value){let url;try{url=new URL(value)}catch{throw failure('invalid published role URL')};need(url.origin===HOME.slice(0,-1)&&/^\/job-opening\/[a-z0-9-]+\/$/.test(url.pathname)&&!url.username&&!url.password&&!url.search&&!url.hash,'unreviewed native role URL');return url.href}
export function readListing(html,url,page,org){
 const doc=document(html);need(isDeepStrictEqual(publisher(doc),org),'listing publisher differs');const canonical=one(doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase()==='canonical'),'listing canonical');need(canonical.attrs.href===CAREERS,'listing canonical differs')
 const anchor=one(doc.nodes(n=>n.tag==='div'&&cls(n,'e-load-more-anchor')),'native continuation'),maxPage=Number(anchor.attrs['data-max-page']);need(Number(anchor.attrs['data-page'])===page&&Number.isSafeInteger(maxPage)&&maxPage>=page&&maxPage<=20,'native pagination counters differ')
 const nodes=doc.nodes(n=>n.tag==='div'&&n.attrs['data-elementor-type']==='loop-item'&&cls(n,'job-opening'));need(nodes.length>0&&nodes.length<=20,'missing or excessive current cards')
 const cards=nodes.map(n=>{const ids=[...(n.attrs.class||'').matchAll(/(?:^|\s)post-(\d+)(?=\s|$)/g)],statuses=(n.attrs.class||'').split(/\s+/).filter(v=>v.startsWith('status-')),head=one(doc.nodes(c=>c.tag==='h1',n),'card heading'),links=[...new Set(doc.nodes(c=>c.tag==='a'&&c.attrs.href&&c.attrs.href.startsWith(HOME+'job-opening/'),n).map(c=>roleURL(c.attrs.href)))];need(ids.length===1&&links.length===1&&statuses.length===1&&statuses[0]==='status-publish','native card publishing identity/status differs');return{postID:ids[0][1],title:norm(flow(head)),url:links[0],listingTree:snapshot(n),listingText:norm(flow(n))}})
 const next=page<maxPage?anchor.attrs['data-next-page']:null;if(page<maxPage)need(next===CAREERS+(page+1)+'/','nonterminal continuation missing or left exact declared channel');return{url,page,maxPage,anchor:{...anchor.attrs},cards,nextURL:next}
}
export function readRoleDeclaration(html,card,org){
 const doc=document(html),models=schema(doc),own=publisher(doc);need(isDeepStrictEqual(own,org),'role publisher differs');need(!models.some(m=>m['@type']==='JobPosting'),'new structured hiring fields require qualification')
 const canonical=one(doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase()==='canonical'),'role canonical');need(canonical.attrs.href===card.url,'own canonical differs')
 const webpage=one(models.filter(m=>m['@type']==='WebPage'),'own structured page');need(webpage.url===card.url&&webpage['@id']===card.url,'structured page identity differs from own canonical')
 const title=one(doc.nodes(n=>n.tag==='h1'),'native role heading');need(norm(flow(title))===card.title,'card and native role heading differ')
 const root=one(doc.nodes(n=>n.attrs['data-elementor-type']==='single-post'),'native single-post role'),rootIDs=[...(root.attrs.class||'').matchAll(/(?:^|\s)post-(\d+)(?=\s|$)/g)];need(rootIDs.length===1&&rootIDs[0][1]===card.postID&&cls(root,'job-opening')&&cls(root,'status-publish'),'native role post identity/status differs')
 const body=one(doc.nodes(n=>n.tag==='body'),'native body');need(cls(body,'postid-'+card.postID),'native document post ID differs')
 const region=one(doc.nodes(n=>n.attrs['data-id']==='2615a90',root),'complete authored job-facts column');need(doc.nodes(n=>n.tag==='form',region).length===0,'application form entered criteria scope');need(doc.nodes(n=>n.tag==='h3'&&norm(flow(n))==='Job Description',region).length===1,'whole job-description section missing')
 const forms=doc.nodes(n=>n.tag==='form',root);need(forms.length===1&&forms[0].attrs.name==='Career Form','current application declaration differs')
 const outside=node=>{if(typeof node==='string')return node;if(node.attrs['data-id']==='2615a90')return{nativeCriteriaColumn:true};if(node.tag==='form')return{unvisitedApplicationForm:true};const attrs={...node.attrs};if(attrs.class)attrs.class=attrs.class.replace('post-'+card.postID,'post-<current>');return{tag:node.tag,attrs,children:(node.raw===undefined?node.children:node.raw?[node.raw]:[]).map(outside)}}
 need(isDeepStrictEqual(outside(root),OUTSIDE_CRITERIA_TEMPLATE),'unreviewed native template outside complete criteria column')
 const link=one(doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase()==='alternate'&&n.attrs.type==='application/json'),'declared own native JSON'),jsonURL=link.attrs.href;need(jsonURL===HOME+'wp-json/wp/v2/job-opening/'+card.postID,'native CMS counterpart differs')
 return{doc,root,region,models,jsonURL,canonicalURL:canonical.attrs.href,titleTree:snapshot(title),publisher:own}
}
