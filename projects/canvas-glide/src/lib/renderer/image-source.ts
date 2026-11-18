import { effect, inject, PLATFORM_ID, resource, signal, untracked, type Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GlideViewport } from '../glide-viewport';
import { createImageUrlSafe, revokeImageUrl } from '../util/image';
import { fitInto, type Size } from '../util/size';

/** Keeps the content size fitted into the viewport and fits the view once per new `natural` size; call from a constructor. */
export function fitContent(natural: Signal<Size | null | undefined>) {
  const glide = inject(GlideViewport);
  let fitted: Size | null | undefined;

  // An image can load before the viewport is measured (hidden or not laid out yet), so the fit waits for a size; a
  // later resize keeps the view and only updates the content size.
  effect(() => {
    const size = natural();
    const viewportSize = glide.viewportSize();
    glide.contentSize.set(size ? fitInto(viewportSize, size) : null);
    if (size && size !== fitted && viewportSize.width && viewportSize.height) {
      fitted = size;
      untracked(() => glide.fit());
    }
  });
}

/** The URL and natural size of the image for the img-based renderers; call from a constructor, pass the img's load event to `onLoad`. */
export function imageSource(image: Signal<Blob | null>) {
  const browser = isPlatformBrowser(inject(PLATFORM_ID));
  const natural = signal<Size | null>(null);

  const url = resource({
    params: () => (browser ? { image: image() } : undefined),
    loader: ({ params }) => createImageUrlSafe(params.image),
  });

  effect((onCleanup) => {
    const current = url.value();
    natural.set(null);
    onCleanup(() => revokeImageUrl(current ?? null));
  });

  fitContent(natural);

  return {
    src: url.value,
    natural: natural.asReadonly(),
    onLoad(event: Event) {
      const img = event.target as HTMLImageElement;
      natural.set({ width: img.naturalWidth, height: img.naturalHeight });
    },
  };
}
