# BTV WhatsApp Rich Media Compatibility Lab

## Rebuild and verify

From the workspace root, use Node.js 22 and Python 3.10 or newer with Pillow 12.2 and Playwright. FFmpeg and FFprobe must be on PATH or supplied via FFMPEG and FFPROBE. The renderer uses Arial Bold on Windows or DejaVu Sans Bold on Linux. Set BTV_RENDER_FONT for an explicit local font, and BTV_LAUNCH_DATE to change the video title date. Update the character manifest's launch date for the story.

~~~powershell
python tools/media-lab/generate-media.py
node tools/media-lab/generate-pages.mjs
node tools/media-lab/export-template.mjs
node tools/media-lab/validate.mjs
python tests/media-lab/browser-qa.py
~~~

The 2160 × 3840 frame sequence and FFV1 delivery intermediate stay in .media-lab-cache/. The checks validate the generated page and media hashes, MIME types, actual media decoding and source paths. As needed, install the three Playwright browser engines with python -m playwright install chromium firefox webkit. The Lottie runtime is vendored with its upstream MIT licence.

For a local operator session, run the following. The static local server maps the directory differently from GitHub Pages. Automated QA additionally exercises the production project prefix.

~~~powershell
python -m http.server 8080 --directory docs
~~~

Open http://localhost:8080/lab/. Use the case pages for media downloads and the local observation editor. Share and copy actions use the intended public URLs.

## Evidence

- LAB_TEST_MATRIX.csv lists generated cases with their unique canonical URLs, experimental parents, and page hashes.
- LAB_MEDIA_INVENTORY.csv records generation recipes, codec and dimension information, SHA-256 and media size.
- LAB_STATIC_QA.json records metadata, signatures, baselines and performance targets.
- LAB_AUTOMATED_QA.json and LAB_HTTP_VALIDATION.json record browser smoke tests and local/public HTTP.
- LAB_DEVICE_RESULTS_TEMPLATE.csv provides nullable observation fields.
- LAB_COMPATIBILITY_REPORT.md records the current interpretation and limitations.
- LAB_DEPLOYMENT_REPORT.md covers authorization, public verification, and rollback.
