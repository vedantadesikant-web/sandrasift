# SANDRASIFT camera module + repository fixes

This patch adds a browser-only four-webcam panel to the existing single-file `index.html` dashboard. It does not upload video: webcam streams stay in the browser.

## Install into the GitHub repository

1. In the repository root, create `camera-system.css` and `camera-system.js` and paste the matching files from this patch.
2. In `index.html`, add this inside `<head>` after the existing `<style>...</style>` block:

   `<link rel="stylesheet" href="./camera-system.css">`

3. Add this immediately before `</body>`, after the existing scripts:

   `<script src="./camera-system.js" defer></script>`

4. Commit the three changed/new files to `main`, then reload GitHub Pages with a hard refresh.

The script inserts the camera section above the existing `.grid`, so you do not need to manually edit the page markup.

## Webcam requirements

- Use current Chrome or Edge, with the site opened over HTTPS (GitHub Pages is HTTPS) or localhost.
- Connect webcams, click **FIND CAMERAS**, choose one camera for each direction, then click **CONNECT SELECTED**.
- Browsers may require camera permission. If feeds fail, allow camera access in the browser's site settings.
- Some USB hubs or webcams cannot run four streams at once. Test one feed first, then connect the remaining feeds.
- The top-view canvas is a live visual composite preview, not calibrated 360° stitching. Real AVM stitching needs overlapping lenses, known camera mounting geometry, calibration, undistortion and perspective transforms.

## Repository bugs / security issues found by inspection

1. **Telemetry endpoint placeholder is malformed.** In `index.html`, the `PUBLIC_TELEMETRY_URL` value currently appears as Markdown link text (`[https://...](https://...)`) rather than a URL. `new URL()` will reject it. Replace it with a real endpoint such as `https://your-domain.example/api/status` when you have one. Do not substitute a made-up endpoint.
2. **Private-host validation regex appears malformed.** The `PRIVATE_HOST` regex in the source shows `.d+` where digit patterns should be `\\d+`. Correct it and test IPv4 private ranges carefully. Do not rely on client-side validation as a security boundary.
3. **Admin credentials are present in HTML comments at the bottom of the public source.** Remove those comments immediately and rotate the password if it is real. A password embedded in client-side HTML is public to every visitor. Client-side password checks are not real access control; use a server-side authentication mechanism for sensitive settings.
4. **Autoplaying music may fail by browser policy.** The current script tries autoplay, which browsers commonly block. The existing button-based fallback is the right approach; remove the autoplay attempt if you want predictable behaviour.

I could inspect the public source, but this chat does not have permission to commit changes to your GitHub repository. These files are a patch to add; they have not been pushed to `main` and cannot be claimed as deployed.
