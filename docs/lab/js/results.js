import { blobDownload, button, element, select } from './shared.js'
import { classifications, contextFields, dimensions, fields, flags, numbers } from './schema.js'
const key = 'btv-media-lab-v1-observations'
const title = key => key.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase())
const contexts = [
  ['distribution_context',['Self chat','Consenting recipient','Private group','Status','Forwarded personal chat','Forwarded group']],
  ['sender_or_recipient',['Sender','Recipient']]
]
export function observations() {
  return JSON.parse(localStorage.getItem(key) || '[]')
}
const save = rows => localStorage.setItem(key,JSON.stringify(rows))
function evidenceDb() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('btv-media-lab-evidence',1)
    request.onupgradeneeded = () => request.result.createObjectStore('evidence')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function localEvidence(id, data) {
  const db = await evidenceDb()
  return new Promise((resolve,reject) => {
    const tx = db.transaction('evidence',data ? 'readwrite' : 'readonly')
    const store = tx.objectStore('evidence')
    const request = data ? store.put(data,id) : store.get(id)
    tx.oncomplete = () => { db.close(); resolve(request.result) }
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
function csvCell(value) {
  return '"'+String(value ?? '').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"'
}
export function toCsv(rows) {
  return [fields.join(','),...rows.map(row=>fields.map(key=>csvCell(row[key])).join(','))].join('\r\n')+'\r\n'
}
export function parseCsv(text) {
  const lines = []
  let row = [], cell = '', quoted = false
  for (let i=0;i<text.length;i++) {
    const char=text[i]
    if (char === '"') {
      if (quoted && text[i+1] === '"') { cell+='"'; i++ }
      else quoted=!quoted
    } else if (!quoted && char===',') { row.push(cell); cell='' }
    else if (!quoted && (char==='\n'||char==='\r')) {
      row.push(cell)
      if (row.some(Boolean)) lines.push(row)
      row=[]; cell=''
      if (char==='\r'&&text[i+1]==='\n') i++
    } else cell+=char
  }
  if (quoted) throw new Error('CSV has an unfinished quoted value.')
  row.push(cell)
  if (row.some(Boolean)) lines.push(row)
  const headings=lines.shift()
  if (!headings?.includes('observation_id')) throw new Error('CSV must contain observation_id.')
  return lines.map(row=>Object.fromEntries(headings.map((key,i)=>[key,row[i] ?? ''])))
}
function normalize(row, tests) {
  const test=tests.find(item=>item.id===row.test_id && item.version===row.test_version)
  if (!test || !/^[a-zA-Z0-9-]{8,80}$/.test(row.observation_id) || !Number.isFinite(Date.parse(row.test_timestamp))) {
    throw new Error('Each observation needs a valid ID, known test version and timestamp.')
  }
  const output=Object.fromEntries(fields.map(key=>[key,row[key]==='' || row[key]==null ? null : row[key]]))
  output.test_category=test.category
  if (output.asset_sha256 && !/^[a-f0-9]{64}$/i.test(output.asset_sha256)) throw new Error('Invalid asset hash.')
  for (const key of flags) {
    if (['true','false'].includes(output[key])) output[key]=output[key]==='true'
    if (output[key]!==null && typeof output[key]!=='boolean') throw new Error('Invalid value for '+title(key))
  }
  for (const key of numbers) {
    if (output[key]===null) continue
    output[key]=Number(output[key])
    if (!Number.isFinite(output[key]) || output[key]<0 || (key==='visual_quality_score'&&output[key]>5)) throw new Error('Invalid '+title(key))
  }
  for (const key of ['result_classification',...dimensions]) {
    if (!classifications.includes(output[key]) && output[key]!==null) throw new Error('Invalid classification.')
  }
  for (const key of [...contextFields,'notes','evidence_filename']) {
    if (output[key]!==null && typeof output[key] !== 'string') throw new Error('Invalid '+title(key))
  }
  return output
}
export function editor(shell, tests, onChange) {
  const form = element('form')
  const info = element('p','Use a separate row for each device, recipient role and context. Include only sanitised evidence.')
  const testPicker = select('Test','test_id',tests.map(test=>[test.id,test.id+' — '+test.title]))
  const grid = element('div',null,{class:'editor-fields'})
  const status = element('p',null,{role:'status',class:'live'})
  const listing = element('ul',null,{class:'results-list'})
  const nullable = [['','Unknown'],['true','Yes'],['false','No']]
  function field(key, attributes = {}) {
    const label=element('label',title(key))
    label.append(element(key==='notes'?'textarea':'input',null,{name:key,...attributes}))
    return label
  }
  for (const key of contextFields) {
    const choices=contexts.find(([name])=>name===key)
    grid.append(choices ? select(title(key),key,[['','Unknown'],...choices[1].map(value=>[value,value])]) : field(key,{maxlength:100}))
  }
  for (const key of flags) grid.append(select(title(key),key,nullable))
  for (const key of numbers) grid.append(field(key,{type:'number',min:0,step:key==='playback_delay_seconds'?'any':1,...(key==='visual_quality_score'?{max:5}:{})}))
  const classificationsWithBlank=[['','Unknown'],...classifications.map(value=>[value,value])]
  for (const key of ['result_classification',...dimensions]) grid.append(select(title(key),key,classificationsWithBlank))
  const evidence = field('evidence',{type:'file',accept:'image/*,video/*'})
  grid.append(field('notes',{maxlength:1500}),evidence)
  const details=element('details')
  details.append(element('summary','Observation fields'),grid)
  form.append(testPicker,details,element('button','Save observation',{type:'submit',class:'primary'}))
  const importPicker=element('input',null,{type:'file',accept:'.json,.csv',hidden:''})
  const actions=element('div',null,{class:'actions'})
  actions.append(button('Export JSON',()=>blobDownload('btv-observations.json',JSON.stringify({version:1,observations:observations()},null,2),'application/json')),
    button('Export CSV',()=>blobDownload('btv-observations.csv',toCsv(observations()),'text/csv')),
    button('Import JSON or CSV',()=>importPicker.click()),importPicker)
  const refresh=()=>{
    const rows=observations()
    listing.replaceChildren(...rows.map(row=>{
      const item=element('li',row.test_id+' · '+(row.device_model || 'Device unspecified')+' · '+(row.result_classification || 'Unclassified'))
      if (row.evidence_filename) {
        item.append(' · '+row.evidence_filename+' ',button('Export local evidence',async ()=>{
          try {
            const evidence=await localEvidence(row.observation_id)
            if (!evidence) throw new Error('Evidence file is held on the original browser.')
            blobDownload(row.evidence_filename,evidence,evidence.type)
          } catch (error) { status.textContent=error.message }
        }))
      }
      return item
    }))
    onChange?.(rows)
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault()
    const data=Object.fromEntries(new FormData(form))
    const test=tests.find(item=>item.id===data.test_id)
    const id=crypto.randomUUID()
    try {
      const file=data.evidence?.size ? data.evidence : null
      if (file && !/^(image|video)\//.test(file.type)) throw new Error('Choose an image or video evidence file.')
      const row=normalize({...data,observation_id:id,test_version:test.version,
        asset_sha256:test.media?.sha256 ?? test.preview?.sha256,test_timestamp:new Date().toISOString(),
        evidence_filename:file?.name},tests)
      if (file) await localEvidence(id,file)
      save([...observations(),row])
      form.reset()
      testPicker.querySelector('select').value=test.id
      status.textContent='Observation saved on this browser.'
      refresh()
    } catch (error) { status.textContent=error.message }
  })
  importPicker.addEventListener('change',async ()=>{
    try {
      const file=importPicker.files[0]
      if (!file) return
      const text=await file.text()
      const parsed=file.name.toLowerCase().endsWith('.csv') ? parseCsv(text) : JSON.parse(text).observations
      if (!Array.isArray(parsed)) throw new Error('Expected an observations export.')
      const merged=new Map(observations().map(row=>[row.observation_id,row]))
      let added=0
      for (const item of parsed) {
        const row=normalize(item,tests)
        if (!merged.has(row.observation_id)) { merged.set(row.observation_id,row); added++ }
      }
      save([...merged.values()])
      status.textContent='Imported '+added+' new observations.'
      refresh()
    } catch (error) { status.textContent='Import failed. '+error.message }
    finally { importPicker.value='' }
  })
  shell.replaceChildren(element('h2','Record observations'),info,form,actions,status,listing)
  refresh()
  return id=>{
    testPicker.querySelector('select').value=id
    details.open=true
    shell.scrollIntoView({block:'start'})
    testPicker.querySelector('select').focus({preventScroll:true})
  }
}
