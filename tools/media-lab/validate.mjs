import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../',import.meta.url))
const lab = join(root,'docs/lab')
const report = join(root,'reports/media-lab')
const json = path => JSON.parse(readFileSync(path,'utf8'))
const hash = data => createHash('sha256').update(data).digest('hex')
const manifest = json(join(lab,'manifest.json'))
const inventory = json(join(lab,'assets/inventory.json'))
const paths = new Set()
const canonical = new Set()
const escaped = value => value.replaceAll('&','&amp;').replaceAll('"','&quot;')
const absolute = value => value.startsWith(manifest.base) && new URL(value).protocol === 'https:'
const assets = new Map(Object.values(inventory).map(asset=>[new URL(asset.path,manifest.base).href,asset]))

function validateAssets() {
  const signatures = {
    jpg:data=>data.subarray(0,3).equals(Buffer.from([255,216,255])),
    png:data=>data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
    gif:data=>/^GIF8[79]a$/.test(data.toString('ascii',0,6)),
    webp:data=>data.toString('ascii',0,4)==='RIFF' && data.toString('ascii',8,12)==='WEBP',
    avif:data=>data.toString('ascii',4,12).match(/^ftypavi[fs]$/),
    mp4:data=>data.toString('ascii',4,8)==='ftyp' && data.indexOf('moov')<data.indexOf('mdat'),
    webm:data=>data.subarray(0,4).equals(Buffer.from([26,69,223,163])),
    svg:data=>data.toString().startsWith('<svg'),
    json:data=>JSON.parse(data).fr===30
  }
  for (const asset of Object.values(inventory)) {
    const data=readFileSync(join(lab,asset.path))
    assert.equal(asset.bytes,data.length,asset.path)
    assert.equal(asset.sha256,hash(data),asset.path)
    assert.ok(signatures[asset.format](data),asset.path+' signature')
    if (asset.path==='assets/animations/loop.png') assert.ok(data.includes('acTL'))
    if (asset.path==='assets/animations/loop.avif') assert.equal(data.toString('ascii',8,12),'avis')
  }
}
function validateTagAssets(head,tag) {
  const pattern=new RegExp('<meta property="'+tag+'" content="([^"]+)">','g')
  const matches=[...head.matchAll(pattern)]
  for (const found of matches) {
    const url=found[1]
    assert.ok(absolute(url),url)
    const asset=assets.get(url)
    assert.ok(asset,url)
    const end=head.indexOf('<meta property="'+tag+'"',found.index+found[0].length)
    const context=head.slice(found.index,end===-1 ? undefined : end)
    for (const field of ['width','height','type']) {
      assert.ok(context.includes('<meta property="'+tag+':'+field+'" content="'+(field==='type'?asset.mime:asset[field])+'">'),url)
    }
  }
  return matches.length
}
function validatePages() {
  const core=manifest.tests.filter(test=>!test.parent_test_id)
  assert.equal(core.length,55)
  assert.equal(manifest.core_count,core.length)
  for (const test of manifest.tests) {
    const bytes=readFileSync(join(lab,test.path,'index.html'))
    const page=bytes.toString('utf8')
    assert.equal(hash(bytes),test.page_sha256,test.id)
    assert.ok(!paths.has(test.path) && !canonical.has(test.url),test.id)
    paths.add(test.path)
    canonical.add(test.url)
    assert.ok(absolute(test.url) && !new URL(test.url).search && !new URL(test.url).hash)
    if (test.parent_test_id) {
      assert.ok(core.some(parent=>parent.id===test.parent_test_id),test.id)
      assert.ok(test.independent_variable,test.id)
    }
    assert.equal(test.manual,'PENDING')
    assert.ok(test.preview || ['basic','secure','type','direct'].includes(test.metadata) || test.blocked,test.id)
    const end=page.indexOf('</head>')
    assert.ok(end>0 && Buffer.byteLength(page.slice(0,end))<300000,test.id)
    const head=page.slice(0,end)
    assert.ok(head.includes('rel="canonical" href="'+escaped(test.url)+'"'))
    assert.ok(head.includes('property="og:url" content="'+escaped(test.url)+'"'))
    assert.match(head,/<meta property="og:title" content="[^"]+">/)
    assert.match(head,/<meta property="og:description" content="[^"]+">/)
    assert.equal(validateTagAssets(head,'og:image'),test.preview ? (test.secondPoster ? 2 : 1) : 0)
    validateTagAssets(head,'og:video')
    if (test.preview && test.previewLimits==='WITHIN_BASELINE_LIMITS') {
      assert.ok(test.preview.bytes<600000 && test.preview.width>=300 && test.preview.width/test.preview.height<=4,test.id)
    }
  }
}
function files(directory) {
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const file = join(directory,entry.name)
    return entry.isDirectory() ? files(file) : [file]
  })
}
function checkSourceFiles() {
  const source = files(lab).filter(path=>/\.(html|js|json|css)$/.test(path) && !path.endsWith('lottie_light.min.js'))
  for (const file of source) {
    const data=readFileSync(file,'utf8')
    assert.ok(!/(?:sb_secret_|github_pat_|ghp_)[A-Za-z0-9_]{16,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(data),file)
    if (!file.endsWith('.html')) continue
    const relative=/<(?:script|img|link|a)\b[^>]*?\b(?:src|href)="([^"]+)"/g
    for (const [,url] of data.matchAll(relative)) {
      if (url.startsWith('#') || /^https:/.test(url)) continue
      const destination = resolve(file,'..',url.split(/[?#]/)[0])
      assert.ok(existsSync(destination),file+' -> '+url)
    }
  }
  return source.length
}
const productionHashes = {
  'index.html':'c9e2ceaac372b57fa69631f732d13155fe9b60ee629e069c7766bab2ec2c53fa',
  'styles.css':'a9a3fe29f878d22a3e09801f54e614266007f6644d9c20a414f65a51cf91fa49',
  'supabase.js':'1887f46c17ae7bda819bc415ebdb69c17b538ba82ff318f04635b78250362db8',
  'config.js':'a587618025181917f7d428c81693cf45c7fa2861a3c0a0cc04e6304545070933',
  'engagement.js':'ae2357e85597c9e9f4664f235d567dd09b8472c5db25e7bb635d4835381e824d',
  'launch.js':'e19c41128c8a82f974833763adc6a998813fc5eb45a66198fad29bd1ccbba32a',
  'share-card.png':'b4a0287fc7402f9823d88d6dbd001e39594366c69d82951914cda447171594cd'
}
for (const [file,baseline] of Object.entries(productionHashes)) {
  const bytes=readFileSync(join(root,'docs',file))
  const normalized=file.endsWith('.png') ? bytes : Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n'))
  assert.ok([hash(bytes),hash(normalized)].includes(baseline),file+' differs from workspace baseline')
}
validateAssets()
validatePages()
const sourceFiles = checkSourceFiles()
const publishedBytes=files(lab).reduce((sum,path)=>sum+readFileSync(path).length,0)
const totalAssetBytes=Object.values(inventory).reduce((sum,asset)=>sum+asset.bytes,0)
assert.ok(publishedBytes<50_000_000)
assert.ok(inventory['videos/diag-30s.mp4'].bytes<8_000_000)
assert.ok(inventory['videos/diag-5s.mp4'].bytes<2_000_000)
assert.ok(inventory['animations/loop.gif'].bytes<1_000_000)
const reportData={status:'PASS',core:manifest.core_count,pages:paths.size,validated_assets:assets.size,sourceFiles,
  publishedBytes,totalAssetBytes,blocked:manifest.tests.filter(test=>test.blocked).map(test=>[test.id,test.blocked]),
  outsideBaseline:manifest.tests.filter(test=>test.previewLimits==='OUTSIDE_BASELINE_LIMITS').map(test=>[test.id,test.preview.bytes]),
  productionWorkspaceBaseline:productionHashes}
writeFileSync(join(report,'LAB_STATIC_QA.json'),JSON.stringify(reportData,null,2)+'\n')
console.log(JSON.stringify(reportData,null,2))
