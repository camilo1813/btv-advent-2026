"""Verify the deployed static lab using real HTTPS GETs. Never submits forms."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[2]
LAB=ROOT/"docs/lab"
MANIFEST=json.loads((LAB/"manifest.json").read_text(encoding="utf-8"))
MEDIA=json.loads((LAB/"assets/inventory.json").read_text(encoding="utf-8"))
AGENTS=["BTV Media Lab Verification","WhatsApp/2.22.20.72 A",
        "WhatsApp/2.22.19.78 I","WhatsApp/2.2236.3 N"]

def check(url, mime, digest, agent):
    try:
        with urlopen(Request(url,headers={"User-Agent":agent}),timeout=15) as response:
            data=response.read()
            actual=hashlib.sha256(data).hexdigest()
            content_type=response.headers.get_content_type()
            meta=(b'property="og:title"' in data[:300000]) if mime=="text/html" else None
            return {"url":url,"agent":agent,"http_status":response.status,"final_url":response.url,
                    "redirected":response.url!=url,"content_type":content_type,
                    "content_length":response.headers.get("Content-Length"),"bytes":len(data),
                    "sha256":actual,"open_graph_in_first_300kb":meta,
                    "status":"PASS" if response.status==200 and response.url==url and content_type==mime
                    and (digest is None or digest==actual) else "FAIL"}
    except (HTTPError,URLError,TimeoutError) as error:
        return {"url":url,"agent":agent,"http_status":getattr(error,"code",None),
                "final_url":getattr(error,"url",None),"error":str(error),"status":"FAIL"}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preflight",action="store_true",help="Check production and priority lab URLs before publication.")
    parser.add_argument("--production-sha",help="Expected hash of the public homepage captured before publishing.")
    args=parser.parse_args()
    portal=MANIFEST["portal"]
    base=MANIFEST["base"]
    tests=MANIFEST["tests"] if not args.preflight else [test for test in MANIFEST["tests"] if test["id"] in ("A01","A06","B03","C02")]
    assets=MEDIA.values() if not args.preflight else [MEDIA["posters/a01.jpg"],MEDIA["animations/loop.gif"],MEDIA["videos/diag-5s.mp4"]]
    dashboard_hash=hashlib.sha256((LAB/"index.html").read_bytes()).hexdigest()
    targets=[(portal,"text/html",args.production_sha),(base,"text/html",dashboard_hash)]
    targets.extend((test["url"],"text/html",test["page_sha256"]) for test in tests)
    targets.extend((base+item["path"],item["mime"],item["sha256"]) for item in assets)
    jobs=[(*target,agent) for agent in AGENTS for target in targets]
    with ThreadPoolExecutor(8) as executor:
        results=list(executor.map(lambda job:check(*job),jobs))
    destination=ROOT/"reports/media-lab"/("LAB_PUBLIC_PREFLIGHT.json" if args.preflight else "LAB_PUBLIC_DEPLOYMENT.json")
    destination.write_text(json.dumps({"results":results},indent=2)+"\n",encoding="utf-8")
    passed=sum(row["status"]=="PASS" for row in results)
    print(f"{passed}/{len(results)} HTTP responses matched. See {destination.name}.")
    return int(passed!=len(results) and not args.preflight)

if __name__=="__main__":
    raise SystemExit(main())
