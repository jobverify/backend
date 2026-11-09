import{parse}from'acorn'
import{readNativeDocument}from'../../scraper-support/utils/activeNativeHtml.js'
import{readVisibleNativeDocument}from'../../scraper-support/utils/visibleNativeHtml.js'
import{PROFILE,SEARCH,KEYWORD,need,one,norm,sha,pageDocument,account,nativeLiteral,fields,visibleWithin,parseNativeJSON}from'./nativeContract.js'
const CLIENT='https://tbcdn.talentbrew.com/js/client/search.js',CLIENT_SHA256=PROFILE.clientHashes[CLIENT],POST=SEARCH+'/resultspost',absolute=(v,b)=>new URL(v,b).href
const walk=(n,visit)=>{if(!n||typeof n!=='object')return;visit(n);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(c=>walk(c,visit));else if(v&&typeof v==='object')walk(v,visit)}
const dataset=node=>Object.fromEntries(Object.entries(node.attrs).filter(([n])=>n.startsWith('data-')).map(([n,v])=>{const k=n.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());if(v==='true')v=true;else if(v==='false')v=false;else if(v==='null')v=null;else if(v&&String(Number(v))===v)v=Number(v);else if(/^[\[{]/.test(v)){try{v=JSON.parse(v)}catch{}}return[k,v]}))
export function deriveIkeaSearchMapping(html, client) {
  need(sha(client) === CLIENT_SHA256, 'current search client changed; static contract review required')
  const document = readNativeDocument(html)
  need(!document.nodes(node => node.tag === 'base').length, 'unreviewed search document base')
  need(document.nodes(node => node.tag === 'script' && node.attrs.src && absolute(node.attrs.src, SEARCH) === CLIENT).length === 1,
    'current search client is not actively declared')
  for (const [name,value] of [['site-tenant-id','22908'],['site-organization-id','22908'],['site-id','58510']]) need(one(document.nodes(n=>n.tag==='meta'&&n.attrs.name===name),name).attrs.content===value,'IKEA account changed')
  const results = one(document.nodes(node => node.attrs.id === 'search-results'), 'native results envelope')
  const filters = one(document.nodes(node => node.attrs.id === 'search-filters'), 'native filters envelope')
  const facet = one(document.nodes(node => node.tag === 'input' && node.attrs['data-facet-type'] === '2'
    && node.attrs['data-display'] === 'India'), 'native India country facet')
  need(facet.attrs['data-id'] === '1269750', 'native India country identity changed')
  const total = Number(facet.attrs['data-count']), pageSize = Number(results.attrs['data-records-per-page'])
  need(Number.isSafeInteger(total) && total >= 0 && total <= 200 && Number.isSafeInteger(pageSize) && pageSize > 0 && pageSize <= 100,
    'native country inventory exceeds its reviewed bounds')
  need(absolute(results.attrs['data-ajax-post-url'], SEARCH) === POST
    && absolute(results.attrs['data-ajax-url'], SEARCH) === SEARCH + '/results', 'native listing endpoint changed')
  need(!document.nodes(node => document.hasClass(node, 'filter-checkbox') && Object.hasOwn(node.attrs, 'checked')).length,
    'unreviewed initial static or selected filters')

  const program = parse(client, { ecmaVersion: 'latest' }), declarations = new Map(), mappings = []
  walk(program, node => {
    if (node.type === 'VariableDeclarator' && ['SearchResultTypes', 'defaultValues'].includes(node.id?.name)) {
      need(!declarations.has(node.id.name), 'duplicate native client defaults'); declarations.set(node.id.name, node.init)
    }
    if (node.type === 'AssignmentExpression' && node.operator === '=' && node.left?.name === 'searchOptions'
      && node.right.type === 'ObjectExpression' && node.right.properties.some(property => property.key?.name === 'ActiveFacetID')) mappings.push(node.right)
  })
  const constants = {}
  const literal = node => {
    if (node?.type === 'Literal' && !node.regex) return node.value
    if (node?.type === 'ArrayExpression') return node.elements.map(literal)
    if (node?.type === 'MemberExpression' && !node.computed && node.object?.name === 'SearchResultTypes') return constants.SearchResultTypes[node.property.name]
    need(node?.type === 'ObjectExpression', 'nonliteral native default')
    const value = {}
    for (const property of node.properties) {
      need(property.type === 'Property' && !property.computed && property.kind === 'init' && !property.method, 'nonliteral native default property')
      const name = property.key.name ?? property.key.value
      need(!['__proto__', 'constructor', 'prototype'].includes(name) && !Object.hasOwn(value, name), 'invalid native default property')
      value[name] = literal(property.value)
    }
    return value
  }
  constants.SearchResultTypes = literal(declarations.get('SearchResultTypes'))
  const defaults = literal(declarations.get('defaultValues'))
  const objects = { query: dataset(results), filterQuery: dataset(filters) }
  const selected = [{ ID: Number(facet.attrs['data-id']), FacetType: 2, Count: total, Display: 'India', IsApplied: true,
    FieldName: facet.attrs['data-field-name'] }]
  const expression = node => {
    if (node.type === 'Literal') return node.value
    if (node.type === 'ConditionalExpression') {
      const guard = node.test
      need(guard.type === 'BinaryExpression' && guard.operator === '!=' && guard.left.type === 'UnaryExpression'
        && guard.left.operator === 'typeof' && guard.left.argument.name === 'filterQuery' && guard.right.value === 'undefined',
      'unsupported native conditional mapping')
      return expression(node.consequent)
    }
    if (node.type === 'MemberExpression' && !node.computed && Object.hasOwn(objects, node.object?.name)) return objects[node.object.name][node.property.name]
    need(node.type === 'CallExpression', 'unsupported native DOM mapping')
    if (node.callee.type === 'Identifier') {
      const method = node.callee.name
      if (method === 'facetFilters') return selected
      if (method === 'staticFacets') return null
      if (method === 'appliedKeywordFilters') {
        need(Array.isArray(objects.query.refinedKeywords) && objects.query.refinedKeywords.length === 0, 'unreviewed initial keywords')
        return []
      }
      need(['intOrDefault', 'stringOrDefault', 'floatOrDefault'].includes(method), 'unsupported native conversion')
      const object = objects[node.arguments[0]?.name], property = node.arguments[1]?.value
      need(object && typeof property === 'string', 'invalid native conversion fields')
      const value = object[property], fallback = defaults[property[0].toUpperCase() + property.slice(1)]
      if (method === 'intOrDefault') return value === undefined || Number.isNaN(parseInt(value)) ? fallback : parseInt(value)
      if (method === 'floatOrDefault') return value === undefined || Number.isNaN(parseFloat(value)) ? fallback : parseFloat(value).toFixed(5)
      return value === undefined || value.length <= 0 ? fallback : value.toString()
    }
    need(node.callee.type === 'MemberExpression' && node.callee.property.name === 'attr'
      && node.callee.object.type === 'CallExpression' && node.callee.object.callee.name === '$', 'unsupported native attribute mapping')
    const selector = node.callee.object.arguments[0]
    need(selector.type === 'MemberExpression' && selector.object.name === 'ids' && selector.property.name === 'filterPanel'
      && node.arguments[0].type === 'Literal', 'unexpected native attribute carrier')
    return filters.attrs[node.arguments[0].value]
  }
  const options = {}
  for (const property of one(mappings, 'native DOM mapping').properties) {
    need(property.type === 'Property' && !property.computed && property.kind === 'init', 'unexpected native mapping property')
    options[property.key.name] = expression(property.value)
  }
  options.TotalContentPages = Math.ceil(options.TotalContentResults / options.RecordsPerPage)
  const criteria = Object.fromEntries(Object.entries(options).filter(([name]) => !['TotalPages', 'TotalResults', 'StaticFacets'].includes(name)))
  criteria.ActiveFacetID = selected[0].ID
  criteria.FacetFilters = selected
  criteria.CurrentPage = 1
  const model = JSON.parse(JSON.stringify(criteria))
  need(model.Keywords === 'India' && model.Location === '' && model.RecordsPerPage === pageSize, 'unreviewed native initial search')
  return { total, pageSize, pages: Math.ceil(total / pageSize), model, clientSHA256: CLIENT_SHA256 }
}

export function requestFor(profile,page){need(Number.isSafeInteger(page)&&page>=1&&page<=profile.pages,'page bounds');const criteria={...profile.model,CurrentPage:page,IsPagination:page===1?'False':'True'},parts=[];const add=(k,v)=>parts.push(encodeURIComponent(k)+'='+encodeURIComponent(v==null?'':String(v)));const build=(key,value)=>{if(Array.isArray(value))value.forEach((v,i)=>build(key+'['+i+']',v));else if(value&&typeof value==='object')for(const k of Object.keys(value))build(key+'.'+k,value[k]);else if(value!==null&&value!==undefined)add(key,value)};for(const key of Object.keys(criteria))build(key,criteria[key]);const query=parts.join('&').replace(/%20/g,'+');need(query.length<=4096,'current client would require its declared POST branch');return{url:SEARCH+'/results?'+query,method:'GET',headers:{Accept:'application/json','Content-Type':'application/json; charset=utf-8'},criteria,queryBytes:query.length}}

export function declaredSearchClients(page){const d=pageDocument(page,KEYWORD);account(d);const urls=Object.keys(PROFILE.clientHashes).filter(u=>!u.endsWith('/job-details.js'));for(const url of urls){const n=one(d.nodes(n=>n.tag==='script'&&n.attrs.src&&new URL(n.attrs.src,KEYWORD).href===url),'declared search client '+url);need(Object.keys(n.attrs).every(k=>k==='src'),'unreviewed native search client activation')}return urls}
export function deriveIkeaSearchProfile(page,clients){const d=pageDocument(page,KEYWORD);account(d);for(const url of declaredSearchClients(page))need(typeof clients[url]==='string'&&sha(clients[url])===PROFILE.clientHashes[url],'unreviewed current native program '+url);const profile=deriveIkeaSearchMapping(page.html,clients[CLIENT]),model=nativeLiteral(d,8);fields(model,PROFILE.fieldSets.searchEnvelope,'search model');need(model.Keywords==='India'&&model.OrganizationIds==='22908'&&model.CurrentPage===1&&model.TotalJobResults===Number(one(d.nodes(n=>n.attrs.id==='search-results'),'results').attrs['data-total-results']),'native keyword/account initial model mismatch');need(profile.total>0&&profile.pages<=16&&profile.model.Keywords==='India'&&profile.model.OrganizationIds==='22908'&&profile.model.Location===''&&profile.model.RefinedKeywords.length===0,'unreviewed search scope');return{...profile,scope:'keywordIndia+typedcountryIndia-only',initialModel:model,rawHTML:page.html,bodySHA256:sha(page.html)}}
export function readIkeaSelectedPage(page,profile,currentPage){need(page?.status===200&&typeof page.html==='string'&&/^application\/json\b/i.test(page.contentType||''),'native selected JSON response changed');let payload;try{payload=parseNativeJSON(page.html,'selected JSON')}catch{need(false,'invalid native selected JSON')};fields(payload,['results','filters','hasJobs','hasContent'],'selected JSON envelope');need(payload&&typeof payload.results==='string'&&typeof payload.filters==='string'&&payload.hasJobs===true&&payload.hasContent===false,'native selected envelope unavailable');const d=readNativeDocument(payload.results),v=readVisibleNativeDocument(payload.results,{strict:true}),filter=readNativeDocument(payload.filters),envelope=one(d.nodes(n=>n.attrs.id==='search-results'),'selected results envelope');for(const[k,expected]of[['data-total-results',profile.total],['data-total-job-results',profile.total],['data-total-pages',profile.pages],['data-current-page',currentPage],['data-records-per-page',profile.pageSize],['data-active-facet-id',1269750],['data-organization-ids',22908]])need(envelope.attrs[k]===String(expected),'selected native pagination/scope changed '+k);need(envelope.attrs['data-keywords']==='India'&&envelope.attrs['data-location']===''&&envelope.attrs['data-refined-keywords']==='[]','selected keyword/location changed');const applied=filter.nodes(n=>n.tag==='input'&&Object.hasOwn(n.attrs,'checked'));need(applied.length===1&&applied[0].attrs['data-id']==='1269750'&&applied[0].attrs['data-facet-type']==='2'&&applied[0].attrs['data-display']==='India'&&Number(applied[0].attrs['data-count'])===profile.total,'selected typed country changed');const model=nativeLiteral(d,8);fields(model,PROFILE.fieldSets.searchEnvelope,'selected search model');need(model.CurrentPage===currentPage&&model.TotalResults===profile.total&&model.TotalJobResults===profile.total&&model.TotalPages===profile.pages&&model.OrganizationIds==='22908'&&model.Keywords==='India','selected literal native total/context changed');const cards=d.nodes(n=>n.tag==='li'&&d.hasClass(n,'job-list__item')),visible=v.nodes(n=>n.tag==='li'&&v.hasClass(n,'job-list__item'));const expected=Math.min(profile.pageSize,profile.total-(currentPage-1)*profile.pageSize);need(cards.length===expected&&visible.length===expected&&model.Jobs.length===expected&&model.JobModels.length===expected,'selected page length/visibility changed');const rows=cards.map((card,i)=>{const links=d.nodes(n=>n.tag==='a'&&n.attrs['data-job-id'],card),Job=model.Jobs[i],JobModel=model.JobModels[i];need(links.length===2&&links[0].attrs.href===links[1].attrs.href&&links[0].attrs['data-job-id']===links[1].attrs['data-job-id'],'native role link pair disagrees');const id=links[0].attrs['data-job-id'],url=new URL(links[0].attrs.href,SEARCH);need(/^\d+$/.test(id)&&url.origin==='https://jobs.ikea.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/en\/job\/[^/]+\/[^/]+\/24107\/\d+$/.test(url.pathname)&&url.pathname.split('/').at(-1)===id&&String(Job.ID)===id&&String(JobModel.Id)===id,'native role publication identity changed');const title=norm(d.text(one(d.nodes(n=>n.tag==='span'&&d.hasClass(n,'job-list__title'),card),'native listing title')));need(title===norm(Job.Title)&&title===norm(JobModel.Title)&&norm(v.text(one(visibleWithin(visible[i],n=>n.tag==='span'&&v.hasClass(n,'job-list__title')),'visible native title')))===title,'native listing title hidden or conflicting');fields(Job,PROFILE.fieldSets.Job,'listed native Job');fields(JobModel,PROFILE.fieldSets.JobModel,'listed native JobModel');need(Job.TenantID===22908&&JobModel.TenantId===22908&&Job.OrganizationID===24107&&JobModel.OrganizationId===24107&&Job.CompanyName==='Ingka External'&&JobModel.CompanyName==='Ingka External','native listed employer/channel changed');return{id,url:url.href,title,Job,JobModel,rawText:d.text(card)}});need(new Set(rows.map(r=>r.id)).size===rows.length,'duplicate native publication row');return{url:page.url,page:currentPage,rows,model,results:payload.results,filters:payload.filters,rawJSON:page.html,bodySHA256:sha(page.html)}}
