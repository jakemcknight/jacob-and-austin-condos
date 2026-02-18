# Project Instructions

## Balcony Viewer Update Workflow

When asked to "push the balcony viewer", "update the balcony viewer", or similar:

1. **Build & copy**: Run `/Users/jacobhannusch/Documents/balcony-viewer/push-to-condos.sh`
2. **Stage balcony files**: `git add public/balcony-viewer/`
3. **Commit**: `git commit -m "Update balcony viewer"`
4. **Push**: `git push origin main`
5. **Deploy**: `npx vercel --prod`

The balcony viewer source lives at `/Users/jacobhannusch/Documents/balcony-viewer/`.
The build output goes to `public/balcony-viewer/` in this project.
