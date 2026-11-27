# BTV Media Lab V1 compatibility report

## Implementation

The lab has 55 core experiments, 43 parameter variants, 98 individually addressable HTML test routes, and nine player routes. The static build validates 54 media files. The lab publishes approximately 10.4 MB against a 50 MB target. The 150 lossless master frames at 2160 × 3840 and the FFV1 intermediate stay in the local render cache. The 4K case uses a compressed delivery file.

| Asset | Bytes | Result |
| --- | ---: | --- |
| Five-second H.264 control | 86,470 | Within 2 MB target |
| Thirty-second H.264 control | 487,157 | Within 8 MB target |
| 540 × 960 diagnostic GIF | 504,117 | Within 1 MB lightweight and 600 KB preview targets |
| APNG | 568,000 | Within preview target after indexed palette encoding |
| Animated WebP | 419,612 | Within preview target |
| Animated AVIF | 68,918 | 75 frames decoded; within preview target |
| 610 KB and 1 MB JPEG variants | 610,000 and 1,000,000 | Deliberate outside-baseline size controls |

Both AVIF cases were encoded and independently decoded. Optional VP8, HEVC, delivery AV1 video and MOV/ProRes were omitted from V1. The sticker experiment uses a 512 × 512 WebP candidate and leaves picker acceptance and actual sticker behaviour to the phone test.

## Browser and public HTTP

All 13 automated groups passed. Chromium, Firefox and WebKit rendered the dashboard at 360 × 640, 390 × 844, 414 × 896, 430 × 932, 768 × 1024 and 1440 × 900. Each loaded the diagnostic video metadata. Chromium also verified muted autoplay, blocking of a fresh unmuted play attempt, timeline wrap, pause/replay, the story CTA, local observation round trips, Lottie rendering and the native share API contract with a stub. Native share target selection and caption preservation remain device tests. WebGL has a Canvas fallback. The WebGL fixture check permits either surface and records no GPU guarantee.

The homepage returned HTTP 200 with the original homepage SHA-256 for all four preflight user agents. The unpublished lab targets returned 404. Browser screenshots include live and local baseline captures at mobile and desktop sizes. Automated registration coverage checks form structure and the existing registration CTA. A live submission, Supabase write and authentication round trip were excluded from this run.

## Ordinary WhatsApp

All 98 cases are pending manual observation. The first phone session tests whether A01 generates a preview, how composition changes with A02, and whether A06 and A07 move in the composer and sent message. B03 tests whether video metadata affects the play affordance or tap destination. C02 and C03 compare GIF conversion availability around the duration boundary. C07, C09 and E05 test standalone GIF attachment, caption URL handling and forwarding/Status.

Test F01–F03 with operator-supplied, verified public video URLs. Each URL is stored on the testing browser. Real phone screenshots are needed to verify composition safe zones, caption behaviour and application controls.

## Character delivery

Storm and Borsche have canonical sources and technical review material. Lazy has a named Blender candidate under art, licence and rig review. The current media package contains no approved campaign character cutouts or performances. P01–P04 are labelled prototypes at 540, 720 and 1080 pixels wide. P05 is the interactive story with a registration CTA and three labelled import slots. F05 uses a separate synthetic alpha plate and still fallback to test compositing now.

Provide an approved, provenance-marked transparent PNG still or PNG sequence for each character to enable rebuilding the promotional MP4s with approved artwork. The browser player can additionally load approved sprites, animated WebP, alpha video and opaque MP4 clips. Full character performance and real-device safe-zone verification remain open.
