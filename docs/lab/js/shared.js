export const lab = new URL('../', import.meta.url)
export const local = path => new URL(path, lab).href
export const manifest = fetch(local('manifest.json')).then(response => {
  if (!response.ok) throw new Error('Test manifest unavailable')
  return response.json()
})
export function element(tag, text, attributes = {}) {
  const item = document.createElement(tag)
  if (text != null) item.textContent = text
  for (const [name, value] of Object.entries(attributes)) item.setAttribute(name, value)
  return item
}
export const anchor = (text, href, attributes={}) => element('a',text,{href,class:'action',...attributes})
export function button(text, action) {
  const item = element('button',text,{type:'button'})
  item.addEventListener('click',action)
  return item
}
export const wa = text => 'https://wa.me/?text='+encodeURIComponent(text)
export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    return 'Copied.'
  } catch {
    const field = element('textarea',text,{'aria-label':'Copy this text manually'})
    return field
  }
}
export function alertIn(container, value) {
  container.replaceChildren(value)
  if (value instanceof HTMLTextAreaElement) {
    value.focus()
    value.select()
  }
}
export function select(label, name, choices) {
  const wrapper = element('label',label)
  const input = element('select',null,{name})
  for (const [value,text] of choices) input.append(element('option',text,{value}))
  wrapper.append(input)
  return wrapper
}
export function blobDownload(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content],{type}))
  const download = anchor(filename,url,{download:filename})
  download.click()
  setTimeout(() => URL.revokeObjectURL(url),2000)
}
export function describe(media) {
  return media ? [media.mime,media.width+' × '+media.height,
    media.duration == null ? null : media.duration.toFixed(2)+' s',
    new Intl.NumberFormat().format(media.bytes)+' bytes'].filter(Boolean).join(' · ') : 'Browser or operator control'
}
