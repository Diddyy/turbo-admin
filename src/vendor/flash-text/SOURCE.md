# flash-text

The Flash client's text renderer: Sulake's bit-exact re-implementation of Adobe AIR's rasterizer,
which nitro-react draws every chat bubble with. Copied from nitro-next
`packages/nitro-theme/src/font/flash-text` at `1e0843c3`, unchanged, less `index.ts` and
`flashFonts.ts` (which load fonts through the client's asset bundles; the panel loads them in
`src/preview/text.ts`). `cssHexColor.ts` is the one function `browserTextCanvas.ts` took from the
theme's utils.

The captured fonts it draws from (`*.air51.json`) and the browser's fallback faces (`*.ttf`) are in
`public/fonts`, copied from nitro-react's `public/assets/fonts`.

To take a newer version, copy the same files over these and run `yarn typecheck`.
