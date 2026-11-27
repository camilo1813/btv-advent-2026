# Repository discovery

| Item | Finding |
| --- | --- |
| Original workspace | C:\Users\Sunny\Documents\ChatGPT\BTV_Comic_Advent_2026 |
| Original local Git | Unborn master, no commit, no remote. Existing production and research files are untracked. The existing working directory was preserved. |
| Public Git | https://github.com/camilo1813/btv-advent-2026.git, main at e132937f5aa408d6a994f3232d610ef3b246cda2 |
| Pages source | main branch, /docs. Verified through the authenticated GitHub Pages API. No deployment workflow was present in the public Git tree. |
| Stack | Static HTML, CSS and JavaScript modules. No package manifest, lockfile, frontend framework or existing test runner in the public tree. The .nojekyll file is already present. |
| Production site | /btv-advent-2026/. Advent registration uses the existing #sign-up form and Supabase client modules. The public homepage was reachable and contained the production Open Graph tags. |
| Service worker | No registration or worker in the checked production source. The lab does not register one. |
| Lab | docs/lab publishes at /btv-advent-2026/lab/. No backend, runtime compiler or build dependency on Pages. |
| Toolchain | Node.js 22.23.1, Python 3.10, Pillow 12.2, FFmpeg and FFprobe 9.0, Playwright and available Chromium, Firefox and WebKit. |
| Lottie | lottie-web 5.13.0 light SVG distribution and its MIT notice are checked in. Its JavaScript SHA-256 is 9588432bec30c8ef8200bac4a67d8aaad881047bc2a6c9fa624d90ec96402410. |
| Character discovery | Storm's canonical Blender file and pose candidates were located. The candidate review explicitly reports that no pose is director-approved. Borsche's canonical and production rig files and qualification clips were located. The final recommendation records production viability with remediation. Lazy's tabby working source was located and remains pending licence and rig approval in the approval register. No campaign-approved ready-to-publish derivative was identified for any of the three. |

The public checkout and existing workspace production files match after normalizing the checkout's text line endings. The original workspace production file baselines are in LAB_STATIC_QA.json. The prepublication public homepage independently returned the same SHA-256 as the original workspace homepage.

The baseline screenshots are in the screenshots directory. Browser QA blocked requests to external services while taking them and checked the registration form structure without sending a submission.
