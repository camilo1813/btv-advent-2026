# Deployment and rollback

The lab is prepared as an isolated feature commit based on public main at e132937f5aa408d6a994f3232d610ef3b246cda2. The review checkout is .media-lab-cache/publishing-checkout in the workspace. Its feature branch is feature/btv-whatsapp-media-lab-v1. Publication requires operator authorization. The preflight report captures the public homepage and priority routes before publication.

The existing GitHub Pages source is main:/docs. A push of the feature branch alone opens a review path. It leaves the public lab unavailable until that branch is merged into main and the existing Pages deployment completes.

## Authorized publication

Run these from the original workspace after reviewing the feature commit and explicitly authorizing publication.

~~~powershell
git -C .media-lab-cache/publishing-checkout fetch origin main
git -C .media-lab-cache/publishing-checkout diff --stat origin/main...HEAD
git -C .media-lab-cache/publishing-checkout push -u origin feature/btv-whatsapp-media-lab-v1
gh pr create --repo camilo1813/btv-advent-2026 --base main --head feature/btv-whatsapp-media-lab-v1 --title "Add BTV WhatsApp rich media compatibility lab V1" --body "Add the isolated static compatibility lab under docs/lab."
~~~

Review the PR diff. Merge it through the repository's normal review process. Record the actual merge commit and Pages deployment date in the release evidence. After Pages completes, run the verifier from the original workspace.

~~~powershell
python tools/media-lab/verify-deployment.py --production-sha c9e2ceaac372b57fa69631f732d13155fe9b60ee629e069c7766bab2ec2c53fa
~~~

The verifier sends real HTTPS GETs for the homepage, dashboard, all 98 case pages and all inventoried media, using an ordinary agent and the three documented WhatsApp example agents. It checks status, final URL, MIME and expected bytes. If production has an intentional intervening change, capture a fresh public homepage baseline before merging and use that SHA-256.

Priority postpublication routes are [lab](https://camilo1813.github.io/btv-advent-2026/lab/), [A01](https://camilo1813.github.io/btv-advent-2026/lab/tests/v1/a01/), [A06](https://camilo1813.github.io/btv-advent-2026/lab/tests/v1/a06/), [B03](https://camilo1813.github.io/btv-advent-2026/lab/tests/v1/b03/) and [C02](https://camilo1813.github.io/btv-advent-2026/lab/tests/v1/c02/).

## Rollback

Before merging, close the review PR to stop publication. After merging, revert the lab PR through GitHub's Revert action when offered and merge the revert PR. For a single squash or fast-forward commit, run git revert against the verified lab commit on a fresh branch from current main, review the revert diff, then submit it to main through the normal PR process. For a merge commit use git revert -m 1 against the verified merge commit from the same fresh branch. Check that the homepage still returns 200 with its baseline Open Graph metadata and registration form. Check that the lab route is no longer served.
