import { Component, computed, inject, input } from '@angular/core';
import { GlideViewport } from '../glide-viewport';
import { imageSource } from './image-source';

@Component({
  selector: 'glide-image-renderer',
  template: `
    <div
      style="position: relative; transform-origin: 0 0"
      [style.width.px]="glide.contentSize()?.width ?? 0"
      [style.height.px]="glide.contentSize()?.height ?? 0"
      [style.transform]="transform()"
    >
      @if (source.src(); as src) {
        <img
          [src]="src"
          alt=""
          draggable="false"
          style="display: block; width: 100%; height: 100%"
          [style.visibility]="source.natural() ? 'visible' : 'hidden'"
          (load)="source.onLoad($event)"
        />
      }
    </div>
  `,
})
export class ImageRenderer {
  readonly image = input<Blob | null>(null);

  protected readonly glide = inject(GlideViewport);
  protected readonly source = imageSource(this.image);

  protected readonly transform = computed(() => {
    const { origin, scale } = this.glide.transform();
    return `scale(${scale}) translate(${-origin.x}px, ${-origin.y}px)`;
  });
}
