import { alertIn, anchor, button, copy, element, local, wa } from './shared.js'

export function shareControls(test, portal, onRecord, preview=false) {
  const wrapper = element('div')
  const actions = element('div',null,{class:'actions'})
  const status = element('p',null,{class:'live',role:'status'})
  let url = test.shareUrl
  let caption = 'Beyond the Vote · Advent Challenge 2026\n'+portal
  let filePayload
  const whatsApp = anchor('Share URL to WhatsApp','https://wa.me/',{target:'_blank',rel:'noopener'})
  const copyUrl=button('Copy test URL',async () => alertIn(status,await copy(url)))
  if (test.hosts) url=null
  const update = () => {
    copyUrl.disabled=!url
    whatsApp.hidden=!url
    if (url) whatsApp.href=wa('BTV LAB '+test.id+' — '+test.title+'\n'+url)
  }
  update()
  if (test.hosts) {
    const storageKey = 'btv-lab-control-'+test.id
    const form = element('form')
    const label = element('label','Verified public video URL')
    const input = element('input',null,{type:'url',required:'',placeholder:'https://…'})
    const save = element('button','Use this URL',{type:'submit'})
    label.append(input)
    form.append(label,save)
    wrapper.append(form)
    const setUrl = value => {
      const parsed = new URL(value)
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !test.hosts.includes(parsed.hostname)) {
        throw new Error('Enter an HTTPS public video URL for the specified platform.')
      }
      url = parsed.href
      update()
    }
    const previous = localStorage.getItem(storageKey)
    if (previous) try { setUrl(previous); input.value=previous } catch { localStorage.removeItem(storageKey) }
    form.addEventListener('submit',event => {
      event.preventDefault()
      try {
        setUrl(input.value)
        localStorage.setItem(storageKey,url)
        alertIn(status,'Comparison URL saved on this browser.')
      } catch (error) { alertIn(status,error.message) }
    })
  }
  if (preview) actions.append(anchor('Open test page',local(test.path),{class:'action primary'}))
  actions.append(copyUrl,whatsApp)
  if (test.media) {
    const href = local(test.media.path)
    const filename = test.media.path.split('/').at(-1)
    actions.append(anchor('Download media',href,{download:filename}),anchor('Open direct media',href))
    const finish = button('Share prepared media',async () => {
      try {
        await navigator.share(filePayload)
        alertIn(status,'The system share sheet returned control. Check the target and send manually.')
      } catch (error) {
        alertIn(status,error.name === 'AbortError' ? 'Sharing canceled.' : 'Share failed. Download the file and attach it manually.')
      }
    })
    finish.hidden = true
    const prepare = button('Prepare media share',async () => {
      prepare.disabled=true
      try {
        const response = await fetch(href)
        if (!response.ok) throw new Error('Media fetch failed.')
        const file = new File([await response.blob()],filename,{type:test.media.mime})
        const rich = {files:[file],text:caption,url:portal}
        const only = {files:[file]}
        if (navigator.canShare(rich)) filePayload = rich
        else if (navigator.canShare(only)) filePayload = only
        else throw new Error('This file cannot be shared here. Download it and attach it manually.')
        finish.hidden=false
        finish.focus()
        alertIn(status,filePayload === rich ? 'File ready. Verify the caption in WhatsApp.' : 'File ready. Copy the caption separately.')
      } catch (error) { alertIn(status,error.message) }
      finally { prepare.disabled=false }
    })
    actions.append(prepare,finish,button('Copy caption',async () => alertIn(status,await copy(caption))),
      button('Copy portal URL',async () => alertIn(status,await copy(portal))))
    if (!navigator.share || !navigator.canShare) {
      prepare.disabled = true
      prepare.textContent = 'File share unavailable'
      wrapper.append(element('p','Download the media, copy the caption and attach it from the WhatsApp picker.',{class:'technical'}))
    }
  }
  actions.append(button('Record observation',onRecord))
  const technical = element('details')
  technical.append(element('summary','View technical metadata'),element('pre',JSON.stringify(test,null,2)))
  wrapper.append(actions,status,technical)
  return wrapper
}
