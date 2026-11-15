import { Component, computed, inject, input } from '@angular/core';
import { GlideViewport } from './glide-viewport';
import { CanvasRenderer } from './renderer/canvas-renderer';
import { HtmlRenderer } from './renderer/html-renderer';
import { ImageRenderer } from './renderer/image-renderer';

export type Renderer = (typeof Renderer)[keyof typeof Renderer];
export const Renderer = Object.freeze({
  Canvas: 'canvas',
  Image: 'image',
  /** Renders the image as a resized, scrolled `<img>`, not arbitrary HTML. */
  Html: 'html',
} as const);

/**
 * An image viewer. Projected content is an overlay in image coordinates at scale 1, moved and scaled with the image.
 * The pan and zoom state is the `glide` member, or `#viewer="glideViewport"` in a template.
 */
@Component({
  selector: 'glide-canvas',
  imports: [CanvasRenderer, ImageRenderer, HtmlRenderer],
  hostDirectives: [{ directive: GlideViewport, inputs: ['glideViewport: options'] }],
  host: {
    style: 'display: block; position: relative; width: 100%; height: 100%; overflow: hidden; overscroll-behavior: contain',
    '[style.cursor]': 'cursor()',
  },
  template: `
    @switch (renderer()) {
      @case ('image') {
        <glide-image-renderer [image]="image()" />
      }
      @case ('html') {
        <glide-html-renderer [image]="image()" />
      }
      @default {
        <glide-canvas-renderer [image]="image()" />
      }
    }

    <div
      style="position: absolute; top: 0; left: 0; transform-origin: 0 0"
      [style.width.px]="glide.contentSize()?.width ?? 0"
      [style.height.px]="glide.contentSize()?.height ?? 0"
      [style.transform]="overlayTransform()"
    >
      <ng-content />
    </div>
  `,
})
export class GlideCanvas {
  /** The image to show; `null` clears the view. */
  readonly image = input<Blob | null>(null);
  readonly renderer = input<Renderer>(Renderer.Canvas);

  /** The pan and zoom state of this viewer. */
  readonly glide = inject(GlideViewport);

  protected readonly cursor = computed(() =>
    this.glide.moving() ? 'grabbing' : this.glide.pannable() ? 'grab' : undefined,
  );

  protected readonly overlayTransform = computed(() => {
    const { origin, scale } = this.glide.transform();
    return `scale(${scale}) translate(${-origin.x}px, ${-origin.y}px)`;
  });
}
