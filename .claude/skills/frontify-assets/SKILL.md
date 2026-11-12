---
name: frontify-assets
description: Download every asset of a Frontify document or portal hub (images, video, audio, attachments, gated downloads, fonts, logo), build and verify the manifest, keep images under the Edge Delivery 20 MB limit, and repair images missing in Document Authoring. Use when re-downloading assets, verifying checksums, adding assets for new pages, when a preview fails with AEM_BACKEND_DOC_IMAGE_TOO_BIG, or when published pages show missing images.
---

# Frontify assets and manifest (documents and portal hubs)

**Parameters (generic):** `frontify.config.json` (`host`, `projectId`, `resizeTargetBytes`), or for a hub the data dir `migration-work/frontify-portal-<id>/` and `HUB_FONT_PROJECTS` (the `project_id=` values in the portal stylesheet's `@font-face` rules). Run from the repo root. Hard rules in AGENTS.md apply: stop on `/auth`, 401, 403 or 405; never run downloads next to a capture.

## Download
**Document:** `node tools/frontify-export/assets.mjs migration-work/frontify/raw migration-work/frontify/assets`.
- Collects from page JSON: `assets.*[]` with `file_origin_url` (signed S3 originals, valid about 6 days from the export, so export again if older); `asset_data.download_url` (hub download endpoint for video, image-grid and annotation images); attachments `/api/attachment/download/<token>`; file-type icons; the theme logo; fonts (only the `@font-face` sources declared for `projectId`, plus brand-essentials font files).
- Resumable. It runs 6 requests in parallel, so run it alone.

**Hub:** `HUB_FONT_PROJECTS=<ids> node tools/frontify-export/assets-hub.mjs <dir>/raw <dir>/assets`.
- Cell originals come via `settings.image.image` (the `cdn-assets-eu` S3 proxy), else the `file_url` CDN copy.
- The logo comes from `/api/portal/{portal}/theme-asset/cover` and keeps its real file name.
- Fonts: only the declared sources of the given projects (portal 162: `1516,1650`).
- Sequential, paced by `EXPORT_PAUSE_MS`.

## Verify against the source
- S3 originals (document): `VERIFY_HOSTS=s3 node tools/frontify-export/verify-assets.mjs <raw> <assets>` checks the ETag against the MD5 (multipart `-N` by trying part sizes; failing that, download again and compare SHA-256).
- Hub-host endpoints (`/api/screen/download`, attachments, fonts) and the `cdn-assets-eu` proxy send no ETag or size and ignore Range: `VERIFY_HOSTS=hub VERIFY_CONCURRENCY=1 VERIFY_PAUSE_MS=1200 …`, or download a second time and compare SHA-256.
- Both: `python3 -I tools/frontify-export/check_signatures.py <assets>` checks each file's signature against its extension.

## Derived files (document)
- `python3 -I tools/frontify-export/build_asset_kits.py migration-work/frontify` builds the Asset Kit zips.
- PNG previews of PDF/AI images are CDN renditions (`generic_url` + `width=2400&format=png`), stored as `preview-<id>`.

## Size limit (both)
`python3 -I tools/frontify-export/resize_for_eds.py <outDir> <published paths>`: same format and name, ≤ 18 MB. Resampled PNGs can compress worse than the original, so the script re-estimates the width from each measured size. `build-sources.mjs` publishes `resized/` copies instead of the originals.

## Local paths and Document Authoring
- Local pages reference `/assets/<key>/<url-safe name>` (spaces → `-`, other symbols → `_`). The source pages builders (`build-sources.mjs`, `build-hub-sources.mjs`) copy them into `content/assets/`.
- The platform's upload copies these images into DA per-page folders (`<folder>/.<page>/<name>-<hash>.<ext>`). Never write `content.da.live` URLs into local pages: that made every image publish as `about:error` while the log reported success (2026-11-11).
- Only when the user asks in the current message:
  - Replace one image (e.g. resized): find it by order with `python3 -I tools/frontify-export/da_image_map.py`, upload with `curl -X POST -F "data=@<file>;type=image/png" https://admin.da.live/source/<org>/<repo>/<path>`, read it back and compare SHA-256, then preview.
  - DA pages reference images that are missing (e.g. after a hand upload of HTML): `python3 -I tools/frontify-export/da_fill_missing_images.py <org> <repo> <plan.json> <page> [<page>…]` lists each referenced path and its local file; upload those files to exactly those paths, then preview and publish. `upload-to-da.mjs` is for media only; HTML uploaded with `/assets/` paths doesn't resolve in DA.

## After downloading (hard rule: never store signed URLs or tokens)
- `python3 -I tools/frontify-export/strip_signed_urls.py <dir>/raw [<dir>/discovery]` cuts S3 pre-signed query strings (`X-Amz-*`) and asset `token` values from the stored JSON. Re-export if a file has to be downloaded again. (Applied to the portal 161/162 exports on 2026-11-11; the document 396 export from 2026-11-10 still holds signed URLs, now expired.)

## Checks
- The manifest has a `file` for every entry, `sha256` matches on disk, and `failures.json` is empty.
- The report states how many were checksum-verified, size-only, re-download-compared or signature-only. Never call signature-only files "verified".
- `/api/font-file/{id}` ignores `format=` and returns the same file. Request only the declared (id, format) pairs; extra guesses add load and get 405s.
