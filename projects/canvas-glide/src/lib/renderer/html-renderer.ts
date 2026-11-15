import { Component, ElementRef, afterRenderEffect, computed, inject, input, viewChild } from '@angular/core';
import { GlideViewport } from '../glide-viewport';
import { imageSource } from './image-source';

/**
 * Scroll-based renderer: no CSS transform and no <canvas>. Zoom resizes the <img>, so the browser rasterizes it at its
 * displayed size, and pan scrolls an overflow: hidden box. The img's padding adds one viewport of slack on every side,
 * so the image can be panned fully off-screen and negative origins are reachable scroll positions.
 */
@Component({
  selector: 'glide-html-renderer',
  template: `
    <div #scroller style="position: relative; width: 100%; height: 100%; overflow: hidden">
      @if (source.src(); as src) {
        <img
          [src]="src"
          alt=""
          draggable="false"
          style="display: block; box-sizing: content-box"
          [style.width.px]="width()"
          [style.height.px]="height()"
          [style.padding]="padding()"
          (load)="source.onLoad($event)"
        />
      }
    </div>
  `,
})
export class HtmlRenderer {
  readonly image = input<Blob | null>(null);

  readonly #glide = inject(GlideViewport);
  private readonly scroller = viewChild.required<ElementRef<HTMLDivElement>>('scroller');
  protected readonly source = imageSource(this.image);

  protected readonly width = computed(() => (this.#glide.contentSize()?.width ?? 0) * this.#glide.transform().scale);
  protected readonly height = computed(() => (this.#glide.contentSize()?.height ?? 0) * this.#glide.transform().scale);
  protected readonly padding = computed(() => {
    const { width, height } = this.#glide.viewportSize();
    return `${height}px ${width}px`;
  });

  constructor() {
    // Runs after the render that applied the new img size, so the scroll range is current.
    afterRenderEffect(() => {
      const { origin, scale } = this.#glide.transform();
      const { width, height } = this.#glide.viewportSize();
      if (this.source.natural()) this.scroller().nativeElement.scrollTo(width + origin.x * scale, height + origin.y * scale);
    });
  }
}
