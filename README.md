# AngelDLO — Ideas que cobran vida

Portfolio and applications: https://angeldlo.github.io/

A scroll-driven Three.js scene connects four chapters: an LED sphere, a lunar surface, an opening mechanical shell and an orbital core. All content and project links are ordinary HTML; the 3D canvas is decorative. Native scrolling, keyboard navigation, persistent motion controls and a static fallback are included.

## Develop

Requires Node.js 20+ and pnpm.

```sh
pnpm install
pnpm test
pnpm build
```

Serve the repository root using any local static server. `src/index.html`, `src/styles.css` and `src/*.js` are the editable sources. The build writes `index.html` and `assets/`; commit these generated files because GitHub Pages serves them directly. `public/` contains the original bundled textures.

The renderer caps its resolution at 2.2 million pixels, targets at most 60 frames/s on desktop and 30 on smaller screens, and stops its continuous loop while paused, hidden or outside the story. These are rendering limits, not guarantees of actual device performance. Reduced motion switches scenes immediately at chapter boundaries. An explicit visitor preference takes precedence and is stored locally when storage is available.

## Attribution

Lunar maps: NASA's Scientific Visualization Studio, [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/). See [THIRD_PARTY.md](THIRD_PARTY.md) for asset sources and software licenses.
