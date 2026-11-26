# Brand assets

- `logo-on-light.webp` / `logo-on-dark.webp`: full lockup (heart mark + wordmark), transparent. Pick by the surface it sits on.
- `mark-on-light.webp` / `mark-on-dark.webp`: heart mark only, transparent.
- `bg/*.webp`: background photos, listed in `lib/brandImages.ts`. Add a photo by dropping a ~1600px-wide WebP here and adding one line to that file.

`components/ui/Logo.tsx` is the only component that reads the logo files.
App/PWA icons in `public/icons` are the mark on white.
