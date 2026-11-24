import test from 'node:test'
import assert from 'node:assert/strict'
import './currentReceiverBoundaries20261121.test.js'
import {fixture,body,HOME,LISTING,PROXY,BOARD,FEED} from './currentConfiguredProjection20261121.test.js'
import {currentBoard,currentProxy,currentFeed} from './currentCollection20261121.js'
import {currentPublisher,currentCareerHandoff} from './currentPublisher20261121.js'
import {currentNativeModel} from './currentModel20261120.js'
import {pure} from './currentConstraints20261121.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'

const at=fixture.capturedAt,original=url=>body(fixture.responses.find(row=>row.url===url)),board=currentBoard(original(BOARD),at),proxy=currentProxy(original(PROXY),at),rawFeed=JSON.parse(original(FEED))
const change=(value,edit)=>{const before=JSON.stringify(value),next=structuredClone(value);edit(next);assert.notEqual(JSON.stringify(next),before,'actual original model mutation applied');return next}
const feed=edit=>()=>currentFeed(JSON.stringify(change(rawFeed,model=>edit(model.jobs[0],model))),board,proxy,at)
const hold=read=>assert.throws(()=>pure(read),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')
const replace=(text,old,value)=>{assert.equal(text.split(old).length,2,'actual unique source scope');return text.replace(old,()=>value)}
function own(edit,url=LISTING){const html=original(url),scripts=[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].filter(match=>{try{return JSON.parse(match[1])['@type']==='WebPage'}catch{return false}});assert.equal(scripts.length,1);return replace(html,scripts[0][1],JSON.stringify(change(JSON.parse(scripts[0][1]),edit)))}

for(const[name,edit]of[
 ['role workLocationCountry India',r=>r.workLocationCountry='India'],
 ['role typed country alias India',r=>r.country={name:'India','@type':'Country'}],
 ['primary address-wrapper country India',r=>r.address.country='India'],
 ['primary address-wrapper employer contradiction',r=>r.address.hiringOrganization={name:'Other Employer'}],
 ['additional empty typed workLocation',r=>r.workLocation={'@type':'Place'}],
 ['additional workLocations India',r=>r.workLocations=[{address:{addressCountry:'India'}}]],
 ['publisher string contradiction',r=>r.publisher='Other Employer'],
 ['publisher organization contradiction',r=>r.publisher={name:'Other Employer','@type':'Organization'}],
 ['publisherName contradiction',r=>r.publisherName='Other Employer'],
 ['allApply foreign alias',r=>r.allApply=['https://other.invalid/apply']],
 ['applicationUrls foreign alias',r=>r.applicationUrls=['https://other.invalid/apply']],
 ['applyUrls foreign alias',r=>r.applyUrls=['https://other.invalid/apply']],
 ['future firstPublishedAt alias',r=>r.firstPublishedAt='2100-01-01T00:00:00Z'],
 ['future postedAt alias',r=>r.postedAt='2100-01-01T00:00:00Z'],
 ['expired closingAt alias',r=>r.closingAt='2000-01-01T00:00:00Z'],
 ['hidden raw native criteria',r=>r.descriptionHtml+='<div hidden>Applicants based in India may apply.</div>'],
 ['malformed actual criteria JSONLD',r=>r.descriptionHtml+='<script type="application/ld+json">{</script>'],
 ['same-role WebPage country',r=>r.descriptionHtml+='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:r.jobUrl,country:'India'})+'</script>'],
 ['same-role WebPage publisher',r=>r.descriptionHtml+='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:r.jobUrl,publisher:{'@type':'Organization',name:'Other Employer'}})+'</script>']
])test('Configured data holds '+name,()=>hold(feed(edit)))

for(const tag of['section','article','div','p','root'])for(const[label,value]of[['Country','India'],['Employer','Other Employer'],['Posting status','withdrawn'],['Application URL','https://other.invalid/apply'],['Location','Bengaluru, India']])test('Configured data holds semantic '+tag+' '+label,()=>hold(feed(r=>{const pair='<p>'+label+'</p><p>'+value+'</p>';r.descriptionHtml=tag==='root'?pair:'<'+tag+'>'+pair+'</'+tag+'>'})))

for(const[name,edit]of[
 ['own WebPage typed country',r=>r.country={'@type':'Country',name:'India'}],
 ['own WebPage workLocation',r=>r.workLocation={'@type':'Place',address:{addressCountry:'India'}}],
 ['own WebPage unknown workplace',r=>r.workLocation={'@type':'Place'}],
 ['own WebPage publisher contradiction',r=>r.publisher={'@type':'Organization',name:'Other Employer',url:'https://other.invalid/'}],
 ['own about organization identity contradiction',r=>r.about['@id']='https://other.invalid/#organization'],
 ['own named page contradiction',r=>r.name='Careers at Other Employer'],
 ['own page explicitly withdrawn',r=>r.isPublished=false]
])test('Configured data holds '+name,()=>hold(()=>currentPublisher(own(edit),LISTING,at)))

test('Configured data holds a foreign title even with an own-brand suffix',()=>hold(()=>currentPublisher(replace(original(LISTING),'<title>Work alongside amazing people</title>','<title>Careers at Other Employer | Checkout.com</title>'),LISTING,at)))
test('Configured data preserves flexible branded current head wording',()=>{const p=currentPublisher(replace(original(LISTING),'<title>Work alongside amazing people</title>','<title>Explore careers at Checkout.com</title>'),LISTING,at);assert.equal(p.authority.publisher,'Checkout.com')})
test('Configured data preserves own organization office metadata without deriving workplace country',()=>{const p=currentPublisher(own(r=>r.about.address={'@type':'PostalAddress',addressCountry:'India'}),LISTING,at);assert.equal(p.authority.legalEmployer,null)})
test('Configured data preserves original generic head title and explicit careers handoff',()=>{assert.equal(currentPublisher(original(LISTING),LISTING,at).authority.publisher,'Checkout.com');assert.equal(currentCareerHandoff(original(HOME),at).listingURL,LISTING)})
test('Configured data preserves optional missing native criteria as missing original values',()=>{const result=feed(r=>{delete r.descriptionHtml;delete r.descriptionPlain})();const row=result.rows.find(row=>row.id===rawFeed.jobs[0].id);assert.equal(row.criteria.html,null);assert.equal(row.criteria.plain,null);assert.equal(row.countryInferred,false)})
test('Configured data preserves coherent allApply aliases and typed current issuer',()=>{const result=feed(r=>{r.allApply=[r.applyUrl];r.applicationUrls=[r.applyUrl];r.publisher={'@type':'Organization',name:'Checkout.com',url:'https://www.checkout.com/'}})();assert.equal(result.rows.length,rawFeed.jobs.filter(row=>row.isListed).length)})

const originalBoard=original(BOARD),model=currentNativeModel(document(originalBoard))
const replaceBoard=code=>replace(originalBoard,model.originalAssignment,model.originalAssignment+';'+code)
for(const[name,code]of[
 ['unqualified state assignment','__appData={};'],
 ['classic state variable','var __appData={};'],
 ['classic state function','function __appData(){}'],
 ['state destructuring','({state:__appData}={state:{}});'],
 ['state for-of target','for(__appData of [{}]){}'],
 ['bound state mutation','Object.assign.bind(Object,window)({__appData:{}});'],
 ['spread state replacement','Object.assign(...[window,{__appData:{}}]);'],
 ['nested apply spread state replacement','Reflect.apply(Object.assign,Object,[window,{__appData:{}}]);']
])test('Configured data holds canonical '+name,()=>hold(()=>currentBoard(replaceBoard(code),at)))

test('Configured data preserves canonical unrelated sparse spread',()=>assert.equal(currentBoard(replaceBoard('Math.max(...[,1]);'),at).rows.length,board.rows.length))
test('Configured data preserves canonical unrelated sparse apply',()=>assert.equal(currentBoard(replaceBoard('Math.max.apply(null,[,1]);'),at).rows.length,board.rows.length))
export{feed,hold,own,original,replace,board,proxy,rawFeed,replaceBoard}
