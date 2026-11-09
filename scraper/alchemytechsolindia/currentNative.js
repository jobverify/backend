import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const CAREERS='https://alchemytechsol.com/career/',AJAX='https://alchemytechsol.com/jm-ajax/get_listings/'
const USER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const check=(ok,message)=>{if(!ok)throw Error('Alchemy native: '+message)}
const descendants=(node,predicate)=>!node||typeof node==='string'||node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.flatMap(child=>descendants(child,predicate))]
const only=(values,label)=>{check(values.length===1,'careers contract expected one '+label);return values[0]}
const readBoard=html=>{
 const document=readNativeDocument(html)
 check(activeHead(html).titles.includes('Career - Alchemy Techsol'),'official careers employer identity changed')
 const canonical=only(document.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'canonical URL')
 check(canonical.attrs.href===CAREERS,'official careers canonical identity changed')
 check(document.nodes(node=>node.tag==='h1'&&document.text(node)==='Current Openings').length===1,'current native board heading missing')
 const wrapper=only(document.nodes(node=>node.tag==='div'&&document.hasClass(node,'job_listings')),'native Job Manager board')
 check(wrapper.attrs['data-show_filters']==='true'&&wrapper.attrs['data-show_pagination']==='false'
  &&wrapper.attrs['data-orderby']==='featured'&&wrapper.attrs['data-order']==='DESC'&&wrapper.attrs['data-featured_first']==='false','native filters or pagination contract changed')
 check(['data-location','data-keywords','data-categories','data-featured','data-filled','data-remote_position','data-author','data-post_status','data-job_types']
  .every(key=>!wrapper.attrs[key]),'native board contains an unqualified restricted filter')
 const inputs=descendants(wrapper,node=>node.tag==='input'),search=name=>only(inputs.filter(node=>node.attrs.name===name),name)
 check(!search('search_keywords').attrs.value&&!search('search_location').attrs.value,'native search filter is active')
 check(!Object.hasOwn(search('remote_position').attrs,'checked'),'native remote-only filter is active')
 const types=inputs.filter(node=>node.attrs.name==='filter_job_type[]'&&node.attrs.type==='checkbox')
 check(types.length>0&&types.length<=100&&types.every(node=>node.attrs.value&&Object.hasOwn(node.attrs,'checked'))
  &&new Set(types.map(node=>node.attrs.value)).size===types.length,'native job-type filters are not all selected')
 const hidden=inputs.filter(node=>node.attrs.name==='filter_job_type[]'&&node.attrs.type==='hidden')
 check(hidden.length===1&&!hidden[0].attrs.value,'native hidden job-type filter changed')
 check(!descendants(wrapper,node=>node.tag==='select').length,'additional unqualified native category filters')
 const perPage=Number(wrapper.attrs['data-per_page'])
 check(Number.isSafeInteger(perPage)&&perPage>0&&perPage<=100&&/^[1-9]\d*$/.test(wrapper.attrs['data-post_id']||''),'native page size or board identity invalid')
 const extra=only(document.nodes(node=>node.tag==='script'&&node.attrs.id==='wp-job-manager-ajax-filters-js-extra'),'native Ajax configuration')
 const raw=extra.raw?.match(/var job_manager_ajax_filters\s*=\s*(\{[^\n]+\});/),config=raw?JSON.parse(raw[1]):null
 check(config?.ajax_url==='/jm-ajax/%%endpoint%%/'&&config.lang===null,'native public Ajax endpoint identity changed')
 const client=only(document.nodes(node=>node.tag==='script'&&node.attrs.id==='wp-job-manager-ajax-filters-js'),'native public filters client')
 check(/^https:\/\/alchemytechsol\.com\/wp-content\/plugins\/wp-job-manager\/assets\/dist\/js\/ajax-filters\.js\?ver=[a-z0-9]+$/.test(client.attrs.src||''),'native public filters client identity changed')
 const roleLinks=document.nodes(node=>node.tag==='a'&&/^https:\/\/alchemytechsol\.com\/job\//.test(node.attrs.href||''))
 return{postId:wrapper.attrs['data-post_id'],perPage,types:types.map(node=>node.attrs.value),client:client.attrs.src,additionalNativeRoleLinks:roleLinks.map(node=>node.attrs.href)}
}
const request=board=>{
 const form=new URLSearchParams({search_keywords:'',search_location:''})
 for(const type of [...board.types,''])form.append('filter_job_type[]',type)
 const body=new URLSearchParams({lang:'',search_keywords:'',search_location:'',per_page:String(board.perPage),orderby:'featured',featured_first:'false',order:'DESC',page:'1',remote_position:'',show_pagination:'false',form_data:form.toString()})
 for(const type of [...board.types,''])body.append('filter_job_type[]',type)
 return{method:'POST',headers:{'User-Agent':USER_AGENT,Accept:'application/json,text/plain,*/*','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest',Referer:CAREERS},body:body.toString()}
}
const listing=payload=>{
 const document=readNativeDocument(payload?.html||''),positive=document.nodes(node=>node.tag==='li'&&document.hasClass(node,'job_listing'))
 const empty=document.nodes(node=>node.tag==='li'&&document.hasClass(node,'no_job_listings_found'))
 check(typeof payload?.found_jobs==='boolean'&&Number.isSafeInteger(payload.max_num_pages)&&payload.max_num_pages>=0&&payload.max_num_pages<=100&&typeof payload.html==='string','dynamic listings feed shape changed')
 if(payload.found_jobs===false){check(payload.max_num_pages===0&&positive.length===0&&empty.length===1&&document.text(empty[0])==='There are no listings matching your search.'
  &&document.text(document.nodes(node=>node.tag==='root')[0])===document.text(empty[0]),'dynamic listings feed empty state is missing or contradictory')
  return{empty:true,maxPages:0,nativeFirstPageCount:0,html:payload.html}}
 check(payload.max_num_pages>=1&&positive.length>0&&empty.length===0,'dynamic listings feed positive state is inconsistent')
 return{empty:false,maxPages:payload.max_num_pages,nativeFirstPageCount:positive.length,html:payload.html}
}
export async function runDeclaredAlchemy(options={}){
 const timeout=Number.isSafeInteger(options.timeoutMs)&&options.timeoutMs>0?options.timeoutMs:90000
 const signal=AbortSignal.any([AbortSignal.timeout(timeout),...(options.signal?[options.signal]:[])])
 const wait=value=>new Promise((resolve,reject)=>{let done=false;const finish=(fn,result)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);fn(result)},abort=()=>finish(reject,signal.reason);signal.addEventListener('abort',abort,{once:true});Promise.resolve(value).then(value=>finish(resolve,value),error=>finish(reject,error));if(signal.aborted)abort()})
 let requests=0
 const read=async(url,requestOptions,json=false)=>{
  signal.throwIfAborted();requests++
  const value=await wait(Promise.resolve().then(async()=>{
   const override=json?options.fetchJson:options.fetchText;if(override)return override(url,{...requestOptions,signal})
   const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(25000)]),response=await fetch(url,{...requestOptions,signal:requestSignal,redirect:'manual',headers:requestOptions?.headers||{'User-Agent':USER_AGENT,Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}})
   check(response.status===200&&(!response.url||response.url===url),'HTTP status or native response identity changed at '+url)
   const text=await response.text();requestSignal.throwIfAborted();check(Buffer.byteLength(text)<=2000000,'native response exceeds public page budget');return json?JSON.parse(text):text
  }));signal.throwIfAborted();return value
 }
 const openingBoard=readBoard(await read(CAREERS)),opening=listing(await read(AJAX,request(openingBoard),true))
 const closing=listing(await read(AJAX,request(openingBoard),true)),closingBoard=readBoard(await read(CAREERS))
 const stable=JSON.stringify(openingBoard)===JSON.stringify(closingBoard)&&opening.empty&&closing.empty
 const complete=stable&&!openingBoard.additionalNativeRoleLinks.length
 const failures=complete?[]:[{stage:'native-inventory',message:!opening.empty||!closing.empty?'Positive public listing requires full same-ID native details and independent country qualification; no fabricated city/country/requisition/description output.':'Native board or declared role links changed during closing reconciliation.'}]
 const audit={source:'alchemytechsolindia',observedListingCount:complete?0:null,observedIndiaListingCount:complete?0:null,candidateDetails:opening.nativeFirstPageCount,
  extractedDetailJobs:0,opening,closing,openingBoard,closingBoard,closingInventoryMatches:stable,listingPaginationComplete:complete,
  sourceScopeComplete:complete,sourceDeclaredBoardScopeComplete:complete,sourceCompanyWideScopeComplete:false,failures,jobs:[]}
 const jobs=attachInventoryEvidence([],{firstParty:true,surface:CAREERS,status:complete?'verified-empty':'coverage-gap',listingComplete:complete,pagesFetched:requests,
  reportedTotal:complete?0:null,indiaFacetCount:complete?0:null,verifiedAt:new Date(options.now?options.now():Date.now()).toISOString(),
  reason:complete?'Current declared first-party Job Manager board; no native search/category/remote restriction, all published native job types selected; two exact native found_jobs=false/max_num_pages=0/visible-empty responses and closing employer/filter model reconcile; company-wide channels remain unknown'
   :'Current native board requires further qualification: '+failures.map(failure=>failure.message).join('; ')})
 if(options.onAudit)await wait(Promise.resolve().then(()=>options.onAudit(audit)))
 signal.throwIfAborted();return jobs
}
