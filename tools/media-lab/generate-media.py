"""Generate the 150-frame master and derived media. Requires Pillow and FFmpeg."""
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageDraw, ImageFont, features

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "docs/lab/assets"
CACHE = ROOT / ".media-lab-cache"
REPORTS = ROOT / "reports/media-lab"
CHARACTERS = json.loads((ASSETS/"characters/characters.json").read_text(encoding="utf-8"))
FF = os.environ.get("FFMPEG", "ffmpeg")
PROBE = os.environ.get("FFPROBE", "ffprobe")
FONT = next((path for path in (
    Path(os.environ.get("BTV_RENDER_FONT", "missing")),
    Path(os.environ.get("WINDIR", "missing")) / "Fonts/arialbd.ttf",
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
) if path.is_file()), None)
BG, GRID, GOLD, LIGHT, PINK = "#261b29", "#332433", "#ffcb8e", "#fff8ee", "#c7829e"

def run(args):
    return subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True).stdout

def compose(size, frame=0, variant="MASTER", clean=False, scene=0):
    width, height = size
    scale = min(width / 540, height / 640)
    image = Image.new("RGB", size, BG)
    draw = ImageDraw.Draw(image)
    def label(x, y, words, font_size, fill=LIGHT, anchor="lm"):
        font = ImageFont.truetype(str(FONT), round(font_size * scale)) if FONT else ImageFont.load_default(size=round(font_size * scale))
        draw.text((width*x, height*y), words, font=font, fill=fill, anchor=anchor)
    for i in range(1, 10):
        draw.line((width*i/10, 0, width*i/10, height), fill=GRID, width=max(1, round(scale)))
        draw.line((0, height*i/10, width, height*i/10), fill=GRID, width=max(1, round(scale)))
    t = frame / 150
    phase = t * math.tau
    x = width * (.5 + .27 * math.sin(phase))
    y = height * (.59 + .071 * math.sin(phase*2))
    radius = 27 * scale
    draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=GOLD)
    label(.1, .16, "BEYOND THE VOTE", 21, GOLD)
    headlines = ["Advent Challenge", "Advent Challenge", "Five quizzes", "Explore & solve", "Three age bands", "Join the challenge"]
    subtitles = ["2026", "2026", "One comic. Five rounds.", "Bible, history & reasoning", "10–15 / 16–21 / 22+", os.environ.get("BTV_LAUNCH_DATE", CHARACTERS["launchDate"])]
    label(.1, .32 + .014*(1-math.cos(phase)), headlines[scene], 40)
    label(.1, .42, subtitles[scene], 35, PINK)
    if clean:
        if scene in (0,1):
            cast = list(CHARACTERS["characters"].values())
            for index, character in enumerate(cast):
                left = .10 + index*.27
                approved = next((asset for asset in character["assets"]
                                 if asset["kind"] in ("still","png-sequence") and asset.get("approval")),None)
                if approved:
                    if approved["kind"]=="png-sequence":
                        frames=approved["frames"]
                        path=frames[int(t*len(frames))%len(frames)]
                    else:
                        path=approved["path"]
                    source=(ASSETS.parent/path).resolve()
                    if not source.is_relative_to(ASSETS/"characters"):
                        raise ValueError("Character assets must be under assets/characters.")
                    with Image.open(source) as render:
                        cutout=render.convert("RGBA")
                    cutout.thumbnail((round(width*.24),round(height*.24)),Image.Resampling.LANCZOS)
                    image.paste(cutout,(round(width*(left+.12))-cutout.width//2,
                               round(height*.69)-cutout.height),cutout)
                else:
                    draw.rounded_rectangle((width*left,height*.65,width*(left+.23),height*.69),
                                           radius=max(1,round(scale*5)),outline=PINK,width=max(1,round(scale)))
                label(left+.01,.73,character["name"].split()[0].upper(),18)
        if scene==3:
            label(.1,.66,"OBSERVATION  /  VISUAL PUZZLES",19)
        if scene==5:
            label(.1,.72,"REGISTER FOR ADVENT UPDATES",19)
        label(.1, .81, "PROMOTIONAL PROTOTYPE", 17, GOLD)
    else:
        label(.1, .72, "STORM   /   BORSCHE   /   LAZY", 19)
        draw.rectangle((width*.1,height*.78,width*.9,height*.79),fill=GRID)
        draw.rectangle((width*.1,height*.78,width*(.1+.8*(frame+1)/150),height*.79),fill=GOLD)
        label(.1,.84,f"F{frame:03d}  •  {frame/30:04.2f}s  •  LOOP",22)
        label(.1,.91,f"DIAGNOSTIC / {variant}",17,GOLD)
    return image

def master_frame(frame):
    compose((2160,3840), frame).save(CACHE / f"frame_{frame:05}.png", compress_level=1)

def relative(path):
    return path.relative_to(ROOT).as_posix()

inventory = {}
encoders = ""
encoder_version = ""

def save(name, data, command, **details):
    path = ASSETS / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    record(name, command, **details)

def record(name, command, **details):
    path = ASSETS / name
    data = path.read_bytes()
    ext = path.suffix.lower()
    mime = {".jpg":"image/jpeg",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".gif":"image/gif",".avif":"image/avif",".mp4":"video/mp4",".webm":"video/webm",".json":"application/json"}[ext]
    inventory[name] = dict(path="assets/"+name, format=ext[1:], mime=mime,
                           bytes=len(data), sha256=hashlib.sha256(data).hexdigest(),
                           command=command, status="PASS", **details)

def image_asset(name, size, variant, kind, target=None):
    path = ASSETS / name
    path.parent.mkdir(parents=True, exist_ok=True)
    source = compose(size, variant=variant)
    settings = {"quality": 86} if kind in ("JPEG","WEBP","AVIF") else {}
    source.save(path, kind, **settings)
    if target:
        # Legal JPEG APP15 padding holds the artwork and compression constant.
        data = path.read_bytes()
        padding = b""
        while target - len(data) - len(padding) >= 4:
            length = min(65537, target - len(data) - len(padding))
            padding += b"\xff\xef" + (length-2).to_bytes(2,"big") + bytes(length-4)
        path.write_bytes(data[:2]+padding+data[2:])
    with Image.open(path) as actual:
        actual.load()
        assert actual.format == kind and actual.size == size
    record(name, f"Pillow compose {size} {variant}; save {kind} {settings}; target={target}",
           width=size[0], height=size[1], frames=1, encoder="Pillow "+Image.__version__)

def animated(name, frame_paths, kind, loop=0):
    path = ASSETS / name
    path.parent.mkdir(parents=True, exist_ok=True)
    size = (540,960) if "sticker" not in name else (512,512)
    frames = []
    for source in frame_paths:
        with Image.open(source) as image:
            if size == (512,512):
                image.thumbnail(size)
                plate = Image.new("RGBA",size)
                plate.paste(image,((512-image.width)//2,0))
                frames.append(plate)
            else:
                frames.append(image.resize(size, Image.Resampling.LANCZOS))
    cadence = [40]*len(frames) if kind == "WEBP" else [round((i+1)*200/3/10)*10-round(i*200/3/10)*10 for i in range(len(frames))]
    if kind in ("WEBP","AVIF"):
        cadence = [round((i+1)*200/3)-round(i*200/3) for i in range(len(frames))]
    if kind in ("GIF","PNG"):
        palette = frames[0].quantize(colors=64 if kind=="GIF" else 24)
        frames = [image.quantize(palette=palette,dither=Image.Dither.NONE) for image in frames]
    options = dict(save_all=True, append_images=frames[1:], duration=cadence)
    if loop is not None:
        options["loop"] = loop
    if kind == "WEBP":
        options.update(quality=65, method=4)
    if kind == "AVIF":
        options.update(quality=54, speed=8, max_threads=4)
    frames[0].save(path, kind, **options)
    with Image.open(path) as actual:
        count = actual.n_frames
        assert actual.format == kind and actual.size == size and count > 1
        actual_cadence = []
        for i in range(count):
            actual.seek(i)
            actual.load()
            actual_cadence.append(actual.info.get("duration",0))
        actual_loop = actual.info.get("loop")
    record(name, f"Pillow {kind} from master frames at 15fps; loop={loop}", width=size[0],
           height=size[1], duration=(sum(actual_cadence) or sum(cadence))/1000, frames=count, fps=15,
           loop=actual_loop, encoder="Pillow "+Image.__version__)

def svg_asset(name, mode):
    style = '<style>@keyframes orbit{0%,100%{transform:translateX(0)}50%{transform:translateX(145px)}} .marker{animation:orbit 5s infinite ease-in-out}@media(prefers-reduced-motion:reduce){.marker{animation:none}}</style>' if mode == "CSS" else ""
    motion = '<animate attributeName="cx" values="145;290;145" dur="5s" repeatCount="indefinite"/>' if mode == "SMIL" else ""
    counter = ""
    if mode in ("CSS","SMIL"):
        for second in range(5):
            if mode == "CSS":
                start = second * 20
                end = start + 19.99
                style += f'<style>@keyframes clock{second}{{0%,100%{{opacity:{int(second==0)}}}{start}% , {end}%{{opacity:1}}'+(f'{start-.01}%{{opacity:0}}' if start else '')+(f'{end+.01}%{{opacity:0}}' if second<4 else '')+f'}}.s{second}{{animation:clock{second} 5s infinite steps(1,end)}}@media(prefers-reduced-motion:reduce){{.s{second}{{animation:none;opacity:{int(second==0)}}}}}</style>'
                counter += f'<text x="54" y="810" class="s{second}" opacity="{int(second==0)}">F{second*30:03} · {second}.00s · LOOP</text>'
            else:
                values = ";".join(str(int(i % 5 == second)) for i in range(6))
                counter += f'<text x="54" y="810" opacity="{int(second==0)}"><animate attributeName="opacity" values="{values}" calcMode="discrete" keyTimes="0;.2;.4;.6;.8;1" dur="5s" repeatCount="indefinite"/>F{second*30:03} · {second}.00s · LOOP</text>'
    else:
        counter = '<text x="54" y="810">F000 · 0.00s · LOOP</text>'
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960" viewBox="0 0 540 960">{style}
    <defs><pattern id="grid" width="54" height="96" patternUnits="userSpaceOnUse"><path d="M0 96V0H54" fill="none" stroke="{GRID}"/></pattern></defs>
    <rect width="540" height="960" fill="{BG}"/><rect width="540" height="960" fill="url(#grid)"/>
    <g font-family="sans-serif" font-weight="bold" font-size="22" fill="{LIGHT}">
    <text x="54" y="153" fill="{GOLD}">BEYOND THE VOTE</text><text x="54" y="307" font-size="40">Advent Challenge</text>
    <text x="54" y="403" fill="{PINK}" font-size="35">2026</text>
    <circle class="marker" cx="145" cy="566" r="27" fill="{GOLD}">{motion}</circle>
    <text x="54" y="691">STORM / BORSCHE / LAZY</text>{counter}
    <text x="54" y="874" fill="{GOLD}">DIAGNOSTIC / {mode}</text></g></svg>"""
    import xml.etree.ElementTree as xml
    xml.fromstring(svg)
    save(name,svg.encode(),"Python SVG composition",width=540,height=960,
         duration=5 if motion or style else None, loop="infinite" if motion or style else None, encoder="Python")

def encode(name, input_args, output_args):
    path = ASSETS / name
    path.parent.mkdir(parents=True, exist_ok=True)
    args = [FF,"-hide_banner","-loglevel","error","-y","-filter_threads","2",*input_args,*output_args,relative(path)]
    run(args)
    result = json.loads(run([PROBE,"-v","error","-count_frames","-show_streams","-show_format","-of","json",relative(path)]))
    video = next(s for s in result["streams"] if s["codec_type"] == "video")
    audio = next((s["codec_name"] for s in result["streams"] if s["codec_type"] == "audio"),None)
    data = path.read_bytes()
    assert (data[4:8] == b"ftyp" and data.index(b"moov") < data.index(b"mdat")) if name.endswith(".mp4") else data.startswith(b"\x1a\x45\xdf\xa3")
    assert int(video["nb_read_frames"]) > 0
    record(name,subprocess.list2cmdline(args),width=video["width"],height=video["height"],
           duration=float(result["format"]["duration"]),frames=int(video["nb_read_frames"]),
           fps=video["avg_frame_rate"],video_codec=video["codec_name"],audio_codec=audio,encoder=encoder_version)

def promotional_media():
    h264 = ["-c:v","libx264","-threads","3","-preset","fast","-crf","23","-pix_fmt","yuv420p","-movflags","+faststart"]
    for seconds, width in ((3,540),(5,720),(15,1080),(30,1080)):
        for i in range(seconds*15):
            phase = (i*150//(seconds*15)) if seconds <= 5 else (i*2)%150
            scene = 0 if seconds <= 5 else min(5,i*6//(seconds*15))
            compose((width,width*16//9),phase,clean=True,scene=scene).save(CACHE/f"promo_{i:05d}.png",compress_level=1)
        encode(f"videos/promo-{seconds}s.mp4",["-framerate","15","-i",relative(CACHE/"promo_%05d.png")],
               ["-frames:v",str(seconds*15),*h264,"-an"])

def additions():
    with Image.open(CACHE/"frame_00000.png") as source:
        path=ASSETS/"posters/first-frame.jpg"
        source.resize((540,960),Image.Resampling.LANCZOS).save(path,"JPEG",quality=86)
    with Image.open(path) as actual:
        actual.load()
        assert actual.format=="JPEG" and actual.size==(540,960)
    record("posters/first-frame.jpg","Pillow Lanczos from lossless master frame 0; save JPEG quality=86",
           width=540,height=960,frames=1,encoder="Pillow "+Image.__version__)
    path=ASSETS/"posters/different.jpg"
    compose((540,960),0,"DIFFERENT POSTER",scene=2).save(path,"JPEG",quality=86)
    with Image.open(path) as image:
        image.load()
        assert image.format=="JPEG" and image.size==(540,960)
    record("posters/different.jpg","Pillow alternate scene; save JPEG quality=86",
           width=540,height=960,frames=1,encoder="Pillow "+Image.__version__)
    if features.check("avif"):
        animated("animations/loop.avif",[CACHE/f"frame_{frame:05}.png" for frame in range(0,150,2)],"AVIF")
    animated("animations/loop.png",[CACHE/f"frame_{frame:05}.png" for frame in range(0,150,2)],"PNG")
    if "videos/width-2160.mp4" not in inventory:
        encode("videos/width-2160.mp4",["-framerate","30","-i",relative(CACHE/"frame_%05d.png")],
               ["-c:v","libx264","-threads","3","-preset","fast","-crf","23","-pix_fmt","yuv420p","-movflags","+faststart","-an"])
    points = []
    for frame in range(150):
        phase=frame/150*math.tau
        points.append({"t":frame,"s":[540*(.5+.27*math.sin(phase)),960*(.59+.071*math.sin(phase*2)),0],"h":1})
    identity = {"a":{"a":0,"k":[0,0,0]},"s":{"a":0,"k":[100,100,100]},"o":{"a":0,"k":100},"r":{"a":0,"k":0}}
    composition = {"v":"5.13.0","fr":30,"ip":0,"op":150,"w":540,"h":960,"nm":"BTV diagnostic","ddd":0,"assets":[],
                   "layers":[
        {"ty":4,"ind":1,"nm":"Moving diagnostic marker","ip":0,"op":150,"st":0,
         "ks":dict(identity,p={"a":1,"k":points}),
         "shapes":[{"ty":"el","p":{"a":0,"k":[0,0]},"s":{"a":0,"k":[54,54]}},
                   {"ty":"fl","c":{"a":0,"k":[1,.796,.557,1]},"o":{"a":0,"k":100},"r":1}]},
        {"ty":1,"ind":2,"nm":"Plum background","ip":0,"op":150,"st":0,"sw":540,"sh":960,"sc":BG,
         "ks":dict(identity,p={"a":0,"k":[0,0,0]})}]}
    save("animations/diagnostic-lottie.json",json.dumps(composition,separators=(",",":")).encode(),
         "Python Lottie shape composition sampled at frame/150",width=540,height=960,
         duration=5,frames=150,fps=30,loop="player-controlled",encoder="Python JSON")
    plate = CACHE / "alpha.png"
    alpha = Image.new("RGBA",(540,960))
    draw = ImageDraw.Draw(alpha)
    draw.rounded_rectangle((70,315,470,610),radius=65,fill=(38,27,41,225))
    draw.ellipse((213,399,327,513),fill=(255,203,142,164))
    draw.text((270,567),"ALPHA DIAGNOSTIC",font=ImageFont.truetype(str(FONT),27) if FONT else ImageFont.load_default(size=27),
              fill=LIGHT,anchor="mm")
    alpha.save(plate)
    with Image.open(plate) as decoded:
        decoded.load()
        assert decoded.getchannel("A").getextrema()==(0,255)
    save("characters/alpha-diagnostic.png",plate.read_bytes(),"Pillow RGBA diagnostic plate",
         width=540,height=960,frames=1,encoder="Pillow "+Image.__version__)
    if "characters/alpha-diagnostic.webm" not in inventory:
        name="characters/alpha-diagnostic.webm"
        encode(name,["-loop","1","-framerate","15","-i",relative(plate)],["-t","3","-c:v","libvpx-vp9","-threads","3",
               "-pix_fmt","yuva420p","-b:v","0","-crf","34","-an"])
        pixels = subprocess.run([FF,"-v","error","-c:v","libvpx-vp9","-i",relative(ASSETS/name),"-frames:v","1",
                  "-vf","alphaextract","-pix_fmt","gray","-f","rawvideo","-"],cwd=ROOT,check=True,capture_output=True).stdout
        assert min(pixels)<10 and max(pixels)>240

def write_inventory():
    ordered = dict(sorted(inventory.items()))
    (ASSETS/"inventory.json").write_text(json.dumps(ordered,indent=2)+"\n",encoding="utf-8",newline="\n")
    columns = ["name","path","format","mime","width","height","aspect_ratio","duration","frames","fps","video_codec","audio_codec","loop","bytes","sha256","encoder","command","status"]
    with (REPORTS/"LAB_MEDIA_INVENTORY.csv").open("w",newline="",encoding="utf-8") as output:
        writer = csv.DictWriter(output,fieldnames=columns)
        writer.writeheader()
        for name,row in ordered.items():
            divisor = math.gcd(row["width"],row["height"])
            writer.writerow(dict(name=name,aspect_ratio=f'{row["width"]//divisor}:{row["height"]//divisor}',**row))
    print(f"Validated {len(ordered)} assets, {sum(row['bytes'] for row in ordered.values()):,} bytes")

def main():
    global encoder_version
    for folder in (CACHE, REPORTS):
        folder.mkdir(parents=True,exist_ok=True)
    encoder_version = run([FF,"-version"]).splitlines()[0]
    available = run([FF,"-hide_banner","-encoders"])
    for encoder in ("libx264","aac","libvpx-vp9"):
        if encoder not in available:
            raise RuntimeError(f"Missing required encoder {encoder}")
    with ThreadPoolExecutor(4) as workers:
        list(workers.map(master_frame,range(150)))
    images = [("a01.jpg",(1200,630),"JPEG"),("a02.jpg",(540,960),"JPEG"),
              ("a03.jpg",(720,720),"JPEG"),("a04.png",(540,960),"PNG"),
              ("a05.webp",(540,960),"WEBP"),("a12.avif",(540,960),"AVIF"),
              ("shape-4x5.jpg",(720,900),"JPEG"),("shape-16x9.jpg",(1200,675),"JPEG")]
    for filename,size,kind in images:
        if kind != "AVIF" or features.check("avif"):
            variant = "A01" if filename == "a01.jpg" else "PREVIEW CONTROL"
            image_asset("posters/"+filename,size,variant,kind)
    for kb in (50,100,250,500,590,610,1000):
        image_asset(f"posters/size-{kb}.jpg",(1200,630),"A01","JPEG",kb*1000)
    for name,mode in (("static","STATIC"),("css","CSS"),("smil","SMIL")):
        svg_asset("animations/"+name+".svg",mode)
    frames = [CACHE / f"frame_{frame:05}.png" for frame in range(0,150,2)]
    for name,kind,loop in (("loop.gif","GIF",0),("loop.webp","WEBP",0),
                           ("finite.gif","GIF",2),("once.gif","GIF",None),
                           ("sticker.webp","WEBP",0),("kinetic.gif","GIF",0)):
        inputs = frames
        if name == "kinetic.gif":
            inputs = []
            for number in range(0,150,2):
                picture = compose((540,960),number,"A14")
                ImageDraw.Draw(picture).text((100+int(40*math.sin(number*math.tau/150)),445),"ADVENT",fill=GOLD,font=ImageFont.truetype(str(FONT),50) if FONT else ImageFont.load_default(size=50))
                frame_path = CACHE / f"kinetic_{number:05}.png"
                picture.save(frame_path)
                inputs.append(frame_path)
        animated("stickers/"+name if name=="sticker.webp" else "animations/"+name,inputs,kind,loop)
    # Scale once from the lossless master and reuse the lossless delivery source.
    master = ["-framerate","30","-i",relative(CACHE/"frame_%05d.png")]
    work = CACHE / "delivery.mkv"
    run([FF,"-v","error","-y","-filter_threads","2",*master,"-vf","scale=1080:1920:flags=lanczos",
         "-c:v","ffv1","-threads","3",relative(work)])
    h264 = ["-c:v","libx264","-threads","3","-preset","fast","-crf","23","-pix_fmt","yuv420p","-movflags","+faststart"]
    def delivery(name, seconds=5, width=720, fps=30, audio=False, source=work):
        inputs = ["-stream_loop","-1","-i",relative(source)]
        sound = []
        if audio:
            inputs += ["-f","lavfi","-i","sine=frequency=523:sample_rate=48000"]
            sound = ["-c:a","aac","-af","volume=0.12"]
        encode(f"videos/{name}.mp4",inputs,["-t",str(seconds),"-vf",
               f"fps={fps},scale={width}:{width*16//9}:flags=lanczos",*h264,*(sound if audio else ["-an"])])
    with ThreadPoolExecutor(3) as workers:
        jobs = [workers.submit(delivery,f"diag-{seconds}s",seconds) for seconds in (1,3,5,6,7,10,15,30)]
        jobs += [workers.submit(delivery,f"fps-{fps}",fps=fps) for fps in (10,12,15,24,60)]
        jobs += [workers.submit(delivery,f"width-{width}",width=width,source=work) for width in (360,540,1080)]
        jobs.append(workers.submit(delivery,"diag-audio",audio=True))
        jobs.append(workers.submit(encode,"videos/diag-vp9.webm",["-i",relative(work)],
                   ["-vf","scale=720:1280","-c:v","libvpx-vp9","-threads","4","-row-mt","1",
                    "-deadline","good","-cpu-used","5","-crf","34","-b:v","0","-an"]))
        for job in jobs:
            job.result()
    promotional_media()
    additions()
    write_inventory()

if __name__ == "__main__":
    if "--supplement" in sys.argv:
        inventory.update(json.loads((ASSETS/"inventory.json").read_text(encoding="utf-8")))
        encoder_version = run([FF,"-version"]).splitlines()[0]
        if "--promos" in sys.argv:
            promotional_media()
        additions()
        write_inventory()
    else:
        main()
