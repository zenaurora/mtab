# mtab

A customizable browser new tab page built with Vue 3, TypeScript, Vite and Manifest V3.

## Docs

- [Icon drag and grid notes](docs/icon-drag-grid.md)
- [Wallpaper Blob flow](docs/wallpaper-blob-flow.md)
- [Browser bookmark bar flow](docs/browser-bookmark-bar.md)

## Local Development

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

The extension output is generated in `dist/`.

## Test As An Unpacked Chrome Extension

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the `dist/` directory.
6. Open a new tab to test mtab.

## Package For Chrome Web Store

```sh
npm run pack:extension
```

This creates:

```text
release/mtab-extension.zip
```

Upload that zip in the Chrome Web Store Developer Dashboard.

## Automatic GitHub Builds

This repo includes a GitHub Actions workflow at `.github/workflows/release.yml`.

On every push to `main` or `master`, GitHub Actions builds the extension and uploads `mtab-extension.zip` as a workflow artifact.

To create a downloadable GitHub Release automatically:

```sh
git tag v1.0.0
git push origin v1.0.0
```

GitHub will create a release for the tag and attach:

```text
mtab-extension.zip
```

For each new release, update the version in both `package.json` and `public/manifest.json`, then push a new tag such as `v1.0.1`.

## Store Listing Notes

Suggested single purpose:

```text
mtab replaces the browser new tab page with a customizable dashboard for shortcuts, search, widgets, notes, and wallpapers.
```

Data usage summary:

```text
mtab stores user configuration locally using browser storage. It does not require an account and does not sell or share user data.
```

Permissions used:

```text
storage: saves user settings, bookmarks, notes, wallpaper settings, and layout preferences locally.
```

Remote network usage:

```text
The app may fetch favicons for configured shortcuts and optional wallpaper data from user-entered URLs or Wallhaven search.
```
