import { effect, inject, PLATFORM_ID, resource, signal, type Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GlideViewport } from '../glide-viewport';
import { createImageUrlSafe, revokeImageUrl } from '../util/image';
import { fitInto, type Size } from '../util/size';

/** The URL and natural size of the image for the img-based renderers; call from a constructor, pass the img's load event to `onLoad`. */
export function imageSource(image: Signal<Blob | null>) {
  const glide = inject(GlideViewport);
  const browser = isPlatformBrowser(inject(PLATFORM_ID));
  const natural = signal<Size | null>(null);

  const url = resource({
    params: () => (browser ? { image: image() } : undefined),
    loader: ({ params }) => createImageUrlSafe(params.image),
  });

  effect((onCleanup) => {
    const current = url.value();
    natural.set(null);
    if (!current) glide.contentSize.set(null);
    onCleanup(() => revokeImageUrl(current ?? null));
  });

  // A resize keeps the view and only updates the content size.
  effect(() => {
    const viewportSize = glide.viewportSize();
    const size = natural();
    if (size) glide.contentSize.set(fitInto(viewportSize, size));
  });

  return {
    src: url.value,
    natural: natural.asReadonly(),
    /** A new image is fitted once, when it has loaded. */
    onLoad(event: Event) {
      const img = event.target as HTMLImageElement;
      natural.set({ width: img.naturalWidth, height: img.naturalHeight });
      glide.contentSize.set(fitInto(glide.viewportSize(), { width: img.naturalWidth, height: img.naturalHeight }));
      glide.fit();
    },
  };
}
