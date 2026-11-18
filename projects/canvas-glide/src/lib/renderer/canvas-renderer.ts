import { Component, ElementRef, afterRenderEffect, effect, inject, input, PLATFORM_ID, resource, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GlideViewport } from '../glide-viewport';
import { drawImage } from '../util/draw';
import { createImageBitmapSafe } from '../util/image';
import { fitContent } from './image-source';

@Component({
  selector: 'glide-canvas-renderer',
  template: `<canvas #canvas style="position: absolute; inset: 0; width: 100%; height: 100%"></canvas>`,
})
export class CanvasRenderer {
  readonly image = input<Blob | null>(null);

  readonly #glide = inject(GlideViewport);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly #browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly #bitmap = resource({
    params: () => (this.#browser ? { image: this.image() } : undefined),
    loader: ({ params }) => createImageBitmapSafe(params.image),
  });

  constructor() {
    effect((onCleanup) => {
      const bitmap = this.#bitmap.value();
      onCleanup(() => bitmap?.close());
    });

    fitContent(this.#bitmap.value);

    afterRenderEffect(() => {
      drawImage(
        this.canvas().nativeElement,
        this.#bitmap.value(),
        this.#glide.transform(),
        this.#glide.viewportSize(),
        this.#glide.contentSize(),
      );
    });
  }
}
