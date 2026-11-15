# @canvas-glide/angular

Pan, zoom and pinch-to-zoom for Angular, built on [canvas-glide](https://github.com/vrtexe/canvas-glide): a `glideViewport` directive that turns any element into a pan-and-zoom viewport with signals for its state, and a ready `<glide-canvas>` image viewer.

[![npm version](https://img.shields.io/npm/v/@canvas-glide/angular.svg?style=flat-square)](https://www.npmjs.com/package/@canvas-glide/angular)
[![license](https://img.shields.io/npm/l/@canvas-glide/angular.svg?style=flat-square)](LICENSE.md)

It needs Angular 22, is built in the Angular Package Format, and works with zoneless change detection. Components render on the server; input handling starts after the first render in the browser.

## Install

```sh
npm install @canvas-glide/angular
```

`canvas-glide` is a dependency and installs with it. `@angular/core` and `@angular/common` are peer dependencies.

## Image viewer

```ts
import { DecimalPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { GlideCanvas, Renderer } from '@canvas-glide/angular';

@Component({
  selector: 'app-viewer',
  imports: [GlideCanvas, DecimalPipe],
  template: `
    <input type="file" accept="image/*" (change)="onChange($event)" />
    <button (click)="viewer.glide.zoomIn()">+</button>
    <button (click)="viewer.glide.zoomOut()">−</button>
    <button (click)="viewer.glide.fit()">Fit</button>
    <span>{{ viewer.glide.transform().scale * 100 | number: '1.0-0' }}%</span>

    <div style="width: 800px; height: 500px">
      <glide-canvas #viewer [image]="file()" [renderer]="Renderer.Image" />
    </div>
  `,
})
export class Viewer {
  protected readonly Renderer = Renderer;
  protected readonly file = signal<File | null>(null);

  protected onChange(event: Event) {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }
}
```

`<glide-canvas>` fills its parent, so the parent needs a size. At scale 1 the image is fitted inside the box with its aspect ratio kept, and a new image starts fitted. The image can be panned until it just leaves the box, and no further. Its `glide` member is the `GlideViewport` of the viewer; `#viewer="glideViewport"` gives the same object.

## glideViewport

The `glideViewport` directive (`GlideViewport`, exported as `glideViewport`) attaches pan and zoom to its host element. After the first render in the browser the host gets pointer and wheel listeners (the wheel listener is not passive, so the wheel zooms instead of scrolling the page); `touch-action: none` and `user-select: none` are host bindings.

| Member | Type | Meaning |
|---|---|---|
| `transform` | `Signal<Transform>` | The current `{ origin, scale }`, updated at most once per animation frame. |
| `moving` | `Signal<boolean>` | Whether a pointer drag is in progress. |
| `viewportSize` | `Signal<Size>` | The host's size in CSS pixels. |
| `contentSize` | `WritableSignal<Size \| null>` | The content's size at scale 1; `fit`, `center` and the default pan limit use it. |
| `pannable` | `Signal<boolean>` | Whether pointer drags pan, from `move.enabled`. |
| `engine` | `CanvasEngine` | The underlying engine, with every method documented in the [canvas-glide README](https://github.com/vrtexe/canvas-glide#methods). |
| `zoomIn`, `zoomOut`, `zoomTo`, `panTo`, `setTransform`, `fit`, `center`, `reset` | method | The engine methods of the same names. `zoomIn` and `zoomOut` ignore a non-number argument. |

The input `[glideViewport]` takes the [canvas-glide options](https://github.com/vrtexe/canvas-glide#options) without `getViewportRect`, which the directive provides from its host. `getCanvasRect` is optional and defaults to `contentSize`. The directive adds a default origin limit that keeps the content reachable; `constraints.origin` replaces it. The options are read once, when the engine is first used. On `<glide-canvas>` the same input is `[options]`.

## Your own content

This example pans and zooms a 1200 by 800 pixel `<div>`:

```ts
import { Component, afterNextRender, computed, viewChild } from '@angular/core';
import { GlideViewport } from '@canvas-glide/angular';

@Component({
  selector: 'app-board',
  imports: [GlideViewport],
  template: `
    <div class="viewport" glideViewport>
      <div class="content" [style.transform]="contentTransform()">Your content</div>
    </div>
  `,
  styles: `
    .viewport {
      width: 800px;
      height: 500px;
      overflow: hidden;
    }

    .content {
      width: 1200px;
      height: 800px;
      transform-origin: 0 0;
    }
  `,
})
export class Board {
  private readonly glide = viewChild.required(GlideViewport);

  protected readonly contentTransform = computed(() => {
    const { origin, scale } = this.glide().transform();
    return `translate(${-origin.x * scale}px, ${-origin.y * scale}px) scale(${scale})`;
  });

  constructor() {
    afterNextRender(() => this.glide().contentSize.set({ width: 1200, height: 800 }));
  }
}
```

## glide-canvas

| Input | Type | Usage |
|---|---|---|
| `image` | `Blob \| null` | The image to show; a `File` from an `<input type="file">` is a `Blob`. `null` clears the view. |
| `renderer` | `Renderer` | `Renderer.Canvas` (default), `Renderer.Image` or `Renderer.Html`. |
| `options` | `GlideOptions` | The `glideViewport` options, read once when the engine is first used. |

Projected content is an overlay in image coordinates at scale 1, moved and scaled with the image, for markers and annotations.

| Renderer | How it draws |
|---|---|
| `Renderer.Canvas` | Draws the decoded bitmap into a `<canvas>` sized in device pixels. |
| `Renderer.Image` | Moves and scales an `<img>` with a CSS `transform`. |
| `Renderer.Html` | Resizes the `<img>` to the zoomed size and scrolls its container, with no CSS transform, so the browser rasterizes the image at its displayed size. |

The image and HTML renderers load PNG, JPEG, GIF, WebP, AVIF and BMP through a `blob:` URL and every other type, such as SVG, through a `data:` URL, so a script inside an uploaded SVG cannot run in your page's origin.

## Development

The library is the `canvas-glide` project in this Angular workspace (`projects/canvas-glide`), and the workspace app in `src/` is a demo that uses it. `canvas-glide` is listed in the library's `dependencies` (`^1.0.1`) and linked from `../lib` in the workspace's `devDependencies`. Build `lib` first, then:

```sh
npm install
npx ng test canvas-glide --watch=false
npx ng build canvas-glide
npx ng build
```

`ng test canvas-glide` runs the Vitest suite in jsdom, with the 2D context, `createImageBitmap` and `ResizeObserver` stubbed, and one server render with `@angular/platform-server`. `ng build canvas-glide` writes the package to `dist/canvas-glide-angular` with ng-packagr; `ng build` builds the demo, which imports the library from there.

## License

MIT, see [LICENSE.md](LICENSE.md).
