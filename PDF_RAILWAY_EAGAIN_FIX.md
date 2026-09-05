# Railway PDF Chrome EAGAIN fix

## Symptom

Ready to Ship invoice download returned:

`PDF generation failed: Failed to launch the browser process: spawn /usr/bin/google-chrome EAGAIN`

## Cause addressed

`EAGAIN` means Linux temporarily refused to create another browser process, normally because the container reached process or memory pressure. The old invoice route launched and destroyed a full Google Chrome process tree for every PDF request. In a container, orphaned Chrome children can also accumulate when PID 1 does not reap them.

## Changes

- Docker image now installs Debian `chromium` instead of Google Chrome Stable.
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
- `tini` is PID 1 and reaps orphaned Chromium processes.
- The invoice PDF route reuses one Chromium browser per Next.js process.
- PDF generation is serialized so multiple users cannot start multiple heavy browser jobs at once.
- Chromium uses `--single-process`, `--no-zygote`, `--disable-dev-shm-usage`, and other low-resource flags.
- Browser launch retries up to three times only when the error is `EAGAIN`.
- Each PDF closes its page after generation but keeps the shared browser alive.
- PDF viewport device scale factor reduced from 1.5 to 1 because PDF output is vector-based and this lowers rendering memory pressure.

## Deployment

Railway must rebuild the Docker image. A simple app restart without a Docker rebuild is not enough because Chromium and tini are installed during image build.

Run locally before pushing:

```powershell
npm install
npx prisma generate
npm run build
```

Then push:

```powershell
git status
git add .
git commit -m "Fix Railway invoice PDF Chrome EAGAIN"
git push origin main
```
