import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const lab = join(root, 'docs/lab')
const portal = 'https://camilo1813.github.io/btv-advent-2026/'
const base = portal + 'lab/'
const inventory = JSON.parse(readFileSync(join(lab, 'assets/inventory.json')))
const control = 'posters/a01.jpg'
const diag = 'videos/diag-5s.mp4'
const gif = 'animations/loop.gif'
const vp9 = 'videos/diag-vp9.webm'
const audio = 'videos/diag-audio.mp4'
const categories = {
  A:'Preview image formats', B:'Video metadata', C:'Native WhatsApp media',
  D:'Browser playback', E:'Distribution', F:'Comparison controls', X:'Extended parameters'
}
const cases = []
function add(id, title, asset, expected, options = {}) {
  const path = 'tests/v1/' + id.toLowerCase() + '/'
  cases.push({ id, title, asset, expected, path, url: base + path, version: 'v1',
    category: id[0], ...options, manual: 'PENDING' })
}
const images = [
  ['Landscape JPEG control',control],['Portrait JPEG','posters/a02.jpg'],
  ['Square JPEG','posters/a03.jpg'],['PNG','posters/a04.png'],
  ['Static WebP','posters/a05.webp'],['Animated GIF',gif],
  ['Animated WebP','animations/loop.webp'],['APNG','animations/loop.png'],
  ['Static SVG','animations/static.svg'],['Animated SVG with CSS','animations/css.svg'],
  ['Animated SVG with SMIL','animations/smil.svg'],['Static AVIF','posters/a12.avif'],
  ['Animated AVIF','animations/loop.avif'],['Kinetic typography GIF','animations/kinetic.gif'],
  ['Multiple Open Graph images',control]
]
images.forEach(([title,asset],i) => {
  const hypothesis = i === 14 ? 'The client may select the first image, a later image, or no image.'
    : [5,6,7,9,10,12,13].includes(i) ? 'The client may display motion, freeze a frame, or omit the thumbnail. Watch the time marker.'
    : 'The client may show the declared static thumbnail. Record its crop and size.'
  add('A'+String(i+1).padStart(2,'0'),title,asset,hypothesis,
    { poster: asset, ...(i === 14 ? { secondPoster:'posters/a02.jpg' } : {}),
      ...(i === 12 && !inventory[asset] ? { blocked:'Animated AVIF requires an encoder that outputs an AV1 image sequence and independent frame verification.' } : {}) })
})
const videoCases = [
  ['Open Graph MP4','basic',diag], ['Open Graph secure MP4','secure',diag],
  ['JPEG poster and MP4','poster',diag], ['Open Graph WebM','basic',vp9],
  ['Open Graph video content type','type',diag], ['Twitter Player Card','twitter',diag],
  ['Schema.org VideoObject','schema',diag], ['oEmbed discovery','oembed',diag],
  ['Direct MP4 URL','direct',diag], ['Direct GIF URL','direct',gif]
]
videoCases.forEach(([title,metadata,asset],i) => add('B'+String(i+1).padStart(2,'0'),title,asset,
  metadata === 'direct' ? 'Paste the direct file URL. Observe whether WhatsApp renders a preview or opens the file after a tap.'
    : 'Metadata may affect the preview, play affordance or destination on tap. Observe each independently.',
  { metadata, poster: ['basic','secure','type','direct'].includes(metadata) ? null : control }))
const native = [
  ['Three-second MP4','videos/diag-3s.mp4','Compare attachment playback and cropping.'],
  ['Five-second MP4 GIF conversion',diag,'Record whether GIF conversion is offered.'],
  ['Six-second MP4','videos/diag-6s.mp4','Compare GIF conversion eligibility with C02.'],
  ['Ten-second MP4','videos/diag-10s.mp4','Compare inline and full-screen playback.'],
  ['Fifteen-second MP4','videos/diag-15s.mp4','Compare inline and full-screen playback.'],
  ['Thirty-second MP4','videos/diag-30s.mp4','Check whether duration, framing and quality are preserved.'],
  ['Standalone GIF',gif,'Observe how the native picker imports and sends the original GIF.'],
  ['Animated WebP sticker candidate','stickers/sticker.webp','Check whether the ordinary picker accepts this as a sticker, image or file.'],
  ['Silent MP4 and URL caption',diag,'Check whether the portal URL remains visible and clickable.'],
  ['Audio MP4 and URL caption',audio,'Compare audio, caption preservation and URL clickability with C09.']
]
native.forEach(([title,asset,expected],i) => add('C'+String(i+1).padStart(2,'0'),title,asset,expected,{ poster:control }))
const players = [
  ['Muted autoplay','mp4',diag], ['Audio autoplay requested','mp4',audio],
  ['Muted looping autoplay','mp4',diag], ['CSS motion','css','animations/css.svg'],
  ['SVG motion','svg','animations/smil.svg'], ['Canvas motion','canvas',null],
  ['WebGL motion','webgl',null], ['Lottie animation','lottie','animations/diagnostic-lottie.json'],
  ['Interactive story','story',null], ['Character promotion','characters','videos/promo-15s.mp4']
]
players.forEach(([title,player,asset],i) => add('D'+String(i+1).padStart(2,'0'),title,asset,
  i < 3 ? 'Open the page and record the initial play result, controls and timeline events.'
    : 'Open the player and observe motion, controls and substrate-specific fallbacks.',
  { player, ...(i === 7 && !inventory[asset] ? { blocked:'A locally verified Lottie runtime and fixture are required.' } : {}), poster:control }))
const distribution = [
  ['Ordinary link preview',control,'Paste the page URL into the composer and time preview generation.'],
  ['Media attachment and caption',diag,'Attach locally and check that the portal URL survives sending.'],
  ['WhatsApp text sharing',null,'Open the WhatsApp picker with a prefilled text payload and send manually.'],
  ['Native file share',diag,'Prepare a file, open the system share sheet and inspect what the target accepts.'],
  ['Forwarding and Status',diag,'Compare an original chat share with a forward, direct Status upload and URL-only Status.']
]
distribution.forEach(([title,asset,expected],i) => add('E0'+(i+1),title,asset,expected,{ poster:control }))
for (const [index, platform, hosts] of [
  [1,'YouTube Shorts',['youtube.com','www.youtube.com','youtu.be']],
  [2,'Instagram Reel',['instagram.com','www.instagram.com']],
  [3,'Facebook video',['facebook.com','www.facebook.com','fb.watch']]
]) add('F0'+index,platform+' control',null,'Supply a verified public video URL and use it as a positive comparison.',{ hosts, poster:control })
add('F04','Combined metadata',diag,'Compare combined tags with the isolated B cases.',{ metadata:'combined', poster:control })
add('F05','Transparent character compositing','characters/alpha-diagnostic.webm','Compare the diagnostic alpha video and RGBA still over the checkerboard while approved character renders are pending.',{ player:'characters',poster:control })
function extend(group, entries, parent, variable, options = {}) {
  entries.forEach(([suffix,title,asset],i) => add('X'+group+(i+1),title,asset,
    'Compare against '+parent+' and record the effect of changing '+variable+'.',
    { parent_test_id: parent, independent_variable: variable, variant:suffix, ...options }))
}
extend('D',[1,3,5,6,7,10,15,30].map(value => [value,value+' seconds','videos/diag-'+value+'s.mp4']),'C02','duration',{poster:control})
extend('F',[10,12,15,24,30,60].map(value => [value,value+' FPS',value===30 ? diag : 'videos/fps-'+value+'.mp4']),'C02','frame rate',{poster:control})
extend('R',[360,540,720,1080,2160].map(value => [value,value+' × '+value*16/9,value===720 ? diag : 'videos/width-'+value+'.mp4']),'C02','resolution',{poster:control})
extend('S',images.slice(0,3).map(([title,asset]) => [title,title,asset]).concat([
  ['4:5','4:5 JPEG','posters/shape-4x5.jpg'],['16:9','16:9 JPEG','posters/shape-16x9.jpg']
]),'A01','preview aspect ratio')
extend('B',[50,100,250,500,590,610,1000].map(value => [value,'JPEG approximately '+value+' KB','posters/size-'+value+'.jpg']),'A01','JPEG bytes')
extend('L',[['infinite','Infinite looping GIF',gif],['finite','Finite looping GIF','animations/finite.gif'],
  ['absent','GIF without loop metadata','animations/once.gif']],'A06','loop metadata')
extend('A',[['silent','Silent MP4',diag],['tone','MP4 with AAC tone',audio]],'C09','audio',{poster:control})
extend('P',[['static','Static control poster',diag],['first','First-frame poster',diag],
  ['different','Different artwork poster',diag]],'B03','poster artwork',{metadata:'poster',poster:control})
cases.at(-2).poster = 'posters/first-frame.jpg'
cases.at(-1).poster = 'posters/different.jpg'
extend('C',[['h264','H.264 MP4',diag],['vp9','VP9 WebM',vp9]],'C02','codec and container',{poster:control})
extend('T',[['autoplay','Autoplay on opening',diag],['tap','Tap-triggered playback',diag]],'D01','play trigger',{player:'mp4',poster:control})
cases.at(-1).tapOnly = true
for (const test of cases) {
  if (['XS','XB','XL'].includes(test.id.slice(0,2))) test.poster = test.asset
  test.media = inventory[test.asset] || null
  test.preview = inventory[test.poster] || null
  if (test.asset && !test.media) test.blocked ||= 'Verified media unavailable for this build.'
  test.automated = test.blocked ? 'BLOCKED' : test.media ? 'MEDIA VALIDATED' : 'STATIC ROUTE'
  test.previewLimits = test.preview ? (test.preview.bytes >= 600000 || test.preview.width < 300 ||
    test.preview.width / test.preview.height > 4 ? 'OUTSIDE_BASELINE_LIMITS' : 'WITHIN_BASELINE_LIMITS') : 'NO_DECLARED_IMAGE'
  test.shareUrl = test.metadata === 'direct' && test.media ? base + test.media.path : test.url
}
const esc = value => String(value).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
const meta = (key,value,attribute='property') => '<meta '+attribute+'="'+esc(key)+'" content="'+esc(value)+'">'
const link = (rel,href,rest='') => '<link rel="'+rel+'" href="'+esc(href)+'" '+rest+'>'
function html(title, prefix, content, head = '', module = '') {
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+esc(title)+'</title>'+meta('robots','noindex,follow','name')+head+
    link('stylesheet',prefix+'css/lab.css')+'</head><body><a class="skip" href="#main">Skip to content</a>'+
    '<header class="mast"><a href="'+prefix+'">Beyond the Vote <span>MEDIA LAB</span></a><nav><a href="'+prefix+'docs/manual-testing.html">Phone tests</a> <a href="'+prefix+'players/story/">Story</a></nav></header>'+
    '<main id="main">'+content+'</main><footer><a href="'+portal+'">Advent Challenge 2026</a></footer>'+
    (module ? '<script type="module" src="'+prefix+'js/'+module+'"></script>' : '')+'</body></html>\n'
}
function imageTags(image) {
  return ['og:image','og:image:width','og:image:height','og:image:type','og:image:alt'].map((key,i) =>
    meta(key,[base+image.path,image.width,image.height,image.mime,'Beyond the Vote Advent Challenge diagnostic artwork'][i])).join('')
}
function write(file, contents) {
  mkdirSync(dirname(file),{recursive:true})
  writeFileSync(file,contents)
}
const oembed = base+'assets/oembed-v1.json'
const embed = base+'players/mp4/'
write(join(lab,'assets/oembed-v1.json'), JSON.stringify({version:'1.0',type:'video',title:'BTV Media Lab',
  provider_name:'Beyond the Vote',provider_url:portal,width:405,height:720,
  html:'<iframe src="'+embed+'" width="405" height="720" title="BTV video"></iframe>'},null,2))
for (const test of cases) {
  const title = 'BTV Lab '+test.id+' — '+test.title
  const description = 'Advent 2026 media compatibility test.'
  const directType = ['type','combined'].includes(test.metadata)
  let head = link('canonical',test.url)+meta('og:title',title)+meta('og:description',description)+
    meta('og:type',directType?'video.other':'website')+meta('og:url',test.url)
  if (test.preview) head += imageTags(test.preview)
  if (test.secondPoster && inventory[test.secondPoster]) head += imageTags(inventory[test.secondPoster])
  if (['basic','secure','poster','type','combined'].includes(test.metadata) && test.media) {
    const url = base+test.media.path
    head += meta('og:video',url)+meta('og:video:type',test.media.mime)+
      meta('og:video:width',test.media.width)+meta('og:video:height',test.media.height)
    if (['secure','combined'].includes(test.metadata)) head += meta('og:video:url',url)+meta('og:video:secure_url',url)
  }
  if (['twitter','combined'].includes(test.metadata)) for (const [key,value] of Object.entries({
    card:'player',title,description,player:embed,'player:width':405,'player:height':720,
    image:base+inventory[control].path
  })) head += meta('twitter:'+key,value,'name')
  if (['schema','combined'].includes(test.metadata) && test.media) head += '<script type="application/ld+json">'+
    JSON.stringify({'@context':'https://schema.org','@type':'VideoObject',name:title,description,
      thumbnailUrl:base+inventory[control].path,contentUrl:base+test.media.path,embedUrl:embed,
      duration:'PT'+Math.round(test.media.duration)+'S'})+'</script>'
  if (['oembed','combined'].includes(test.metadata)) head += link('alternate',oembed,'type="application/json+oembed"')
  const content = '<section class="hero compact"><p class="eyebrow">'+test.id+' / '+esc(categories[test.category])+
    '</p><h1>'+esc(test.title)+'</h1><p>'+esc(test.expected)+'</p><p>WhatsApp observation pending</p></section>'+
    '<section id="case" data-id="'+test.id+'" class="panel">Loading test controls…</section>'
  const markup = html(title,'../../../',content,head,'case.js')
  test.page_sha256 = createHash('sha256').update(markup).digest('hex')
  write(join(lab,test.path,'index.html'),markup)
}
const dashboard = '<section class="hero"><p class="eyebrow">ADVENT CHALLENGE 2026</p><h1>WhatsApp Rich Media Compatibility Lab</h1>'+
  '<p>Compare previews, attachments and mobile playback. Record what you observe on each device.</p><div id="counts" class="counts"></div></section>'+
  '<section class="panel"><h2>Find a test</h2><form id="filters" class="filters"></form><p id="match-count" aria-live="polite"></p></section>'+
  '<section id="cards" class="cards" aria-label="Test cases"></section><section id="observations" class="panel"></section>'
write(join(lab,'index.html'),html('WhatsApp Rich Media Compatibility Lab','./',dashboard,link('canonical',base),'dashboard.js'))
for (const player of ['mp4','gif','css','svg','canvas','webgl','lottie','story','characters']) {
  write(join(lab,'players',player,'index.html'),html('BTV Media Lab — '+player,'../../',
    '<section class="panel player-page" id="player" data-kind="'+player+'"><p>Loading player…</p></section>','','player.js'))
}
write(join(lab,'manifest.json'),JSON.stringify({ version:'v1', master:'BTV_MEDIA_DIAGNOSTIC_MASTER_V1',
  generatedDate:new Date().toISOString().slice(0,10), deployedDate:null,
  portal, base, categories, core_count:cases.filter(test=>test.category!=='X').length, tests:cases },null,2)+'\n')
const reportDir = join(root,'reports/media-lab')
const csv = value => '"'+String(value ?? '').replaceAll('"','""')+'"'
const fields = ['id','version','category','title','path','url','shareUrl','parent_test_id','independent_variable','asset','previewLimits','blocked','automated','manual','page_sha256']
write(join(reportDir,'LAB_TEST_MATRIX.csv'),fields.join(',')+'\n'+cases.map(test=>fields.map(field=>csv(test[field])).join(',')).join('\n')+'\n')
console.log('Generated '+cases.length+' experiment pages and nine player routes')
