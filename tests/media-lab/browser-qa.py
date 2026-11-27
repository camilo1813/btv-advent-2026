"""Browser and HTTP regression QA for the static project-path lab."""
import csv
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "docs"
LAB = WEB / "lab"
REPORT = ROOT / "reports/media-lab"
SHOTS = REPORT / "screenshots"
MANIFEST = json.loads((LAB / "manifest.json").read_text(encoding="utf-8"))
PORTAL = MANIFEST["portal"]
TESTS = MANIFEST["tests"]
SIZES = [(360,640),(390,844),(414,896),(430,932),(768,1024),(1440,900)]
USER_AGENTS = ["BTV Media Lab HTTP QA","WhatsApp/2.22.20.72 A","WhatsApp/2.22.19.78 I","WhatsApp/2.2236.3 N"]
for folder in (REPORT,SHOTS):
    folder.mkdir(parents=True,exist_ok=True)

class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,".avif":"image/avif",".webp":"image/webp"}
    def translate_path(self, path):
        relative = unquote(urlsplit(path).path).removeprefix("/btv-advent-2026/")
        return super().translate_path("/"+relative)
    def log_message(self, *_):
        pass
    def copyfile(self, source, output):
        try:
            super().copyfile(source,output)
        except (ConnectionAbortedError,ConnectionResetError,BrokenPipeError):
            pass

def write(name, data):
    (REPORT/name).write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")

def fetch(url, agent):
    try:
        with urlopen(Request(url,headers={"User-Agent":agent}),timeout=12) as response:
            content=response.read()
            return {"status":response.status,"final_url":response.url,
                    "redirected":response.url!=url,"content_type":response.headers.get("Content-Type"),
                    "content_length":response.headers.get("Content-Length"),"bytes":len(content),
                    "sha256":hashlib.sha256(content).hexdigest()}, content
    except HTTPError as error:
        return {"status":error.code,"final_url":error.url,"redirected":error.url!=url,
                "content_type":error.headers.get("Content-Type"),"content_length":error.headers.get("Content-Length")},b""
    except (URLError,TimeoutError) as error:
        return {"status":None,"error":str(error)},b""

def http_validation(base):
    local={}
    for test in TESTS:
        path=test["path"]
        response,data=fetch(base+path,USER_AGENTS[0])
        response["expected_sha256"]=test["page_sha256"]
        response["hash_matches"]=response.get("sha256")==test["page_sha256"]
        response["metadata_in_first_300kb"]=b'property="og:url"' in data[:300000]
        local[path]=response
    assets=json.loads((LAB/"assets/inventory.json").read_text(encoding="utf-8"))
    for asset in assets.values():
        path=asset["path"]
        response,_=fetch(base+path,USER_AGENTS[0])
        response["hash_matches"]=response.get("sha256")==asset["sha256"]
        response["mime_matches"]=(response.get("content_type") or "").split(";")[0]==asset["mime"]
        local[path]=response
    public={}
    for agent in USER_AGENTS:
        public[agent]={}
        for path in ("","lab/","lab/tests/v1/a01/","lab/assets/posters/a01.jpg"):
            response,data=fetch(PORTAL+path,agent)
            if response.get("status")==200 and path.endswith("/"):
                response["contains_open_graph"]=b'property="og:title"' in data[:300000]
            public[agent][path or "/"]=response
    write("LAB_HTTP_VALIDATION.json",{"local":local,"public_predeployment":public})
    assert all(item["status"]==200 and item["hash_matches"] and item.get("mime_matches",True)
               for item in local.values()), [key for key,item in local.items() if
               item.get("status")!=200 or not item.get("hash_matches") or not item.get("mime_matches",True)]
    return len(local)

def run():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(Handler,directory=WEB))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    portal=f"http://127.0.0.1:{server.server_port}/btv-advent-2026/"
    lab=portal+"lab/"
    results=[]
    def report(name, operation):
        try:
            detail=operation()
            results.append({"name":name,"status":"PASS","detail":detail})
        except Exception as error:
            results.append({"name":name,"status":"FAIL","detail":str(error)})
    report("Local HTTP status, bytes, MIME and SHA-256",lambda:http_validation(lab))
    with sync_playwright() as playwright:
        engines={}
        for name in ("chromium","firefox","webkit"):
            try:
                engines[name]=getattr(playwright,name).launch()
            except Exception as error:
                if name=="chromium":
                    try:
                        engines[name]=playwright.chromium.launch(channel="chrome")
                        continue
                    except Exception:
                        pass
                results.append({"name":name+" browser launch","status":"BLOCKED","detail":str(error)})
        for name,browser in engines.items():
            context=browser.new_context(viewport={"width":390,"height":844},reduced_motion="reduce",accept_downloads=True)
            page=context.new_page()
            faults=[]
            page.on("pageerror",lambda error:faults.append(str(error)))
            def layout():
                for width,height in SIZES:
                    page.set_viewport_size({"width":width,"height":height})
                    page.goto(lab,wait_until="domcontentloaded")
                    page.locator(".card").last.wait_for()
                    assert page.locator(".card").count()==len(TESTS)
                    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"),width
                assert not faults,faults
                return {"viewports":SIZES,"cases":len(TESTS),"version":browser.version}
            report(name+" dashboard and six viewport widths",layout)
            def loaded_media():
                page.goto(lab+"tests/v1/d01/")
                page.wait_for_function("document.querySelector('video')?.readyState >= 1",timeout=12000)
                return page.locator('video').evaluate("""video=>({
                    source:video.currentSrc.split('/').at(-1), width:video.videoWidth,
                    height:video.videoHeight, duration:video.duration
                })""")
            report(name+" video metadata and decode load",loaded_media)
            context.close()
        if "chromium" in engines:
            browser=engines["chromium"]
            context=browser.new_context(viewport={"width":390,"height":844},reduced_motion="reduce",accept_downloads=True)
            page=context.new_page()
            def baseline():
                page.route("**/*",lambda route:route.continue_() if
                           route.request.url.startswith((portal,PORTAL)) else route.abort())
                for width,height in (SIZES[1],SIZES[-1]):
                    page.set_viewport_size({"width":width,"height":height})
                    page.goto(PORTAL,wait_until="domcontentloaded",timeout=25000)
                    assert page.locator('meta[property="og:title"]').count()==1
                    assert page.locator('#signup-form').count()==1
                    page.screenshot(path=SHOTS/f"production-live-{width}.png",full_page=True)
                    page.goto(portal,wait_until="domcontentloaded")
                    assert page.locator('#signup-form').count()==1
                    assert page.locator('meta[property="og:url"]').get_attribute('content')==PORTAL
                    page.screenshot(path=SHOTS/f"production-workspace-{width}.png",full_page=True)
                page.unroute_all()
                return "Live and workspace screenshots at 390 and 1440 CSS pixels. Registration form presence checked."
            report("Production baseline and registration form smoke check",baseline)
            page.unroute_all()
            page.set_viewport_size({"width":390,"height":844})
            def dashboard():
                page.goto(lab)
                page.locator(".card").first.wait_for()
                page.screenshot(path=SHOTS/"dashboard.png")
                for category in MANIFEST["categories"]:
                    page.locator('[name=category]').select_option(category)
                    assert page.locator(".card").count()==sum(test["category"]==category for test in TESTS)
                    page.locator(".card").first.screenshot(path=SHOTS/f"category-{category.lower()}.png")
                page.locator('[name=category]').select_option('')
                page.locator('[name=search]').fill('A06')
                card=page.locator('.card[data-id=A06]')
                assert card.count()==1 and page.locator(".card").count()==1
                card.locator('summary').click()
                assert card.locator('pre').is_visible()
                card.screenshot(path=SHOTS/"technical-metadata.png")
                share=card.get_by_role('link',name='Share URL to WhatsApp')
                assert share.get_attribute('href').startswith('https://wa.me/?text=')
                assert card.get_by_role('button',name='File share unavailable').is_disabled()
                with page.expect_download() as download:
                    card.get_by_role('link',name='Download media').click()
                assert download.value.suggested_filename=='loop.gif'
                card.get_by_role('button',name='Record observation').click()
                assert page.locator('#observations [name=test_id]').input_value()=='A06'
                page.locator('[name=device_model]').fill('QA Android fixture')
                page.locator('[name=preview_present]').select_option('true')
                page.locator('[name=preview_animation_observed]').select_option('false')
                page.locator('[name=result_classification]').select_option('PASS_WITH_LIMITATIONS')
                page.locator('[name=notes]').fill('Local automated fixture only')
                page.locator('#observations').screenshot(path=SHOTS/"results-editor.png")
                page.get_by_role('button',name='Save observation').click()
                page.get_by_text('Observation saved on this browser.').wait_for()
                with page.expect_download() as download:
                    page.get_by_role('button',name='Export JSON').click()
                exported=Path(download.value.path()).read_bytes()
                row=json.loads(exported)["observations"][0]
                assert row["preview_present"] is True and row["preview_animation_observed"] is False and row["audio_present"] is None
                page.evaluate("localStorage.clear()")
                page.reload()
                page.locator('#observations input[accept=".json,.csv"]').set_input_files(
                    {"name":"qa.json","mimeType":"application/json","buffer":exported})
                page.get_by_text('Imported 1 new observations.').wait_for()
                with page.expect_download() as download:
                    page.get_by_role('button',name='Export CSV').click()
                csv_data=Path(download.value.path()).read_bytes()
                assert next(csv.DictReader(csv_data.decode().splitlines()))["test_id"]=="A06"
                page.evaluate("localStorage.clear()")
                page.reload()
                page.locator('#observations input[accept=".json,.csv"]').set_input_files(
                    {"name":"qa.csv","mimeType":"text/csv","buffer":csv_data})
                page.get_by_text('Imported 1 new observations.').wait_for()
                page.keyboard.press('Tab')
                assert page.evaluate("document.activeElement !== document.body")
                return "Filter, technical view, download, observation, JSON and CSV import/export, WhatsApp text URL and unsupported file share."
            report("Chromium dashboard interactions and observation round trip",dashboard)
            def story():
                page.goto(lab+"players/story/")
                page.get_by_text('Scene 1 of 6',exact=False).wait_for()
                page.screenshot(path=SHOTS/"story.png",full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                page.locator('.story').press('ArrowRight')
                page.get_by_text('Scene 2 of 6',exact=False).wait_for()
                for _ in range(4):
                    page.get_by_role('button',name='Next',exact=True).click()
                assert page.get_by_role('link',name='Register for Advent updates').get_attribute('href')==PORTAL+"#sign-up"
                page.get_by_role('button',name='Replay').click()
                page.get_by_role('button',name='Pause').click()
                page.get_by_text('Scene 1 of 6',exact=False).wait_for()
                return "Keyboard, next, replay, pause, registration CTA and reduced-motion startup."
            report("Chromium interactive story",story)
            def players():
                for case in ("d04","d05","d06","d07","d08","f05"):
                    page.goto(lab+"tests/v1/"+case+"/")
                    page.get_by_role('button',name='Record observation').wait_for()
                    if case=="d08":
                        page.locator('.stage svg').wait_for(timeout=10000)
                        page.get_by_role('button',name='Play',exact=True).click()
                        page.wait_for_function("document.querySelector('.motion-overlay output').textContent !== '0.00 s · F000'")
                    if case=="f05":
                        page.get_by_role('heading',name='Character compositing',exact=True).wait_for()
                        page.get_by_role('button',name='Use still fallback').click()
                        assert page.get_by_role('img',name='Alpha diagnostic plate').is_visible()
                return "CSS, SVG, Canvas, WebGL or explicit fallback, Lottie SVG renderer and character page."
            report("Chromium motion player fixtures",players)
            context.close()
            context=browser.new_context(viewport={"width":390,"height":844})
            page=context.new_page()
            def video():
                page.goto(lab+"tests/v1/d03/")
                page.get_by_text('AUTOPLAY SUCCEEDED',exact=True).wait_for(timeout=12000)
                page.locator('.player-page p[role=status]').filter(has_text='LOOP OBSERVED').wait_for(timeout=12000)
                page.get_by_role('button',name='Pause',exact=True).click()
                assert page.locator('video').evaluate('video=>video.paused')
                page.get_by_role('button',name='Replay').click()
                page.get_by_text('PLAYING',exact=True).wait_for()
                page.screenshot(path=SHOTS/"diagnostic-player.png",full_page=True,animations="disabled")
                with browser.new_context(viewport={"width":390,"height":844}) as fresh:
                    unmuted=fresh.new_page()
                    unmuted.goto(lab+"tests/v1/d02/")
                    unmuted.get_by_text('AUTOPLAY BLOCKED',exact=False).wait_for(timeout=12000)
                    assert unmuted.locator('video').evaluate('video=>!video.muted')
                return "Muted autoplay, time-wrap detection, pause/replay and blocked unmuted attempt in fresh page."
            report("Chromium video autoplay and loop diagnostics",video)
            def file_share():
                page.add_init_script("""Object.defineProperty(navigator,'canShare',{value:payload=>payload.files.length===1});
                    Object.defineProperty(navigator,'share',{value:payload=>{
                    window.fixtureShare={active:navigator.userActivation.isActive,name:payload.files[0].name};
                    return Promise.reject(new DOMException('Canceled','AbortError'))}});""")
                page.goto(lab+"tests/v1/e04/")
                page.get_by_role('button',name='Prepare media share').click()
                page.get_by_role('button',name='Share prepared media').click()
                page.get_by_text('Sharing canceled.').wait_for()
                assert page.evaluate("window.fixtureShare.active && window.fixtureShare.name === 'diag-5s.mp4'")
                return "Stub validates file preparation before click, activation and distinct cancellation handling."
            report("Chromium native file-share API contract",file_share)
            context.close()
        for browser in engines.values():
            browser.close()
    write("LAB_AUTOMATED_QA.json",{"generated_at_unix":time.time(),"results":results,
                                  "whatsapp_device_tests":"NOT_TESTED"})
    for row in results:
        print(row["status"],row["name"],row["detail"] if row["status"]!="PASS" else "")
    server.shutdown()
    return int(any(row["status"]=="FAIL" for row in results))

if __name__=="__main__":
    raise SystemExit(run())
