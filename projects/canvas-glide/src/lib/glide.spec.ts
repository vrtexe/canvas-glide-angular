import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GlideCanvas, Renderer } from './glide-canvas';
import { GlideViewport, type GlideOptions } from './glide-viewport';

// jsdom has no layout, no ResizeObserver, no pointer capture, no 2D context and no createImageBitmap.
// Every element has the size `layout`; `resize()` runs the ResizeObserver callbacks after changing it.
let layout = { width: 1000, height: 700 };
const resizeCallbacks = new Set<() => void>();
globalThis.ResizeObserver = class {
  readonly #callback: () => void;
  constructor(callback: () => void) {
    this.#callback = callback;
  }
  observe() {
    resizeCallbacks.add(this.#callback);
  }
  unobserve() {}
  disconnect() {
    resizeCallbacks.delete(this.#callback);
  }
} as unknown as typeof ResizeObserver;
const resize = (size: typeof layout) => {
  layout = size;
  resizeCallbacks.forEach((callback) => callback());
};
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => layout.width });
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => layout.height });
HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, ...layout }) as DOMRect;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
globalThis.createImageBitmap = (async () => ({ width: 300, height: 300, close() {} })) as unknown as typeof createImageBitmap;

const contexts = new WeakMap<HTMLCanvasElement, { calls: string[] }>();
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  if (!contexts.has(this)) {
    const calls: string[] = [];
    contexts.set(this, {
      calls,
      resetTransform: () => calls.push('reset'),
      clearRect: () => calls.push('clear'),
      setTransform: () => calls.push('transform'),
      drawImage: () => calls.push('draw'),
    } as { calls: string[] });
  }
  return contexts.get(this);
} as unknown as HTMLCanvasElement['getContext'];

const setDevicePixelRatio = (value: number) =>
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value });

/** Lets pending promises (image decoding), one animation frame and Angular's rendering run. */
async function settle(fixture: { whenStable: () => Promise<unknown> }) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await fixture.whenStable();
  }
}

@Component({
  imports: [GlideViewport],
  template: `<div [glideViewport]="options"></div>`,
})
class ViewportHost {
  options: GlideOptions = {};
  readonly glide = viewChild.required(GlideViewport);
}

async function viewport(options: GlideOptions = {}) {
  const fixture = TestBed.createComponent(ViewportHost);
  fixture.componentInstance.options = { getCanvasRect: () => ({ x: 0, y: 0, width: 400, height: 300 }), ...options };
  const rect = { x: 0, y: 0, width: 800, height: 600 };
  const node: HTMLElement = fixture.nativeElement.querySelector('div');
  node.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  return { glide: fixture.componentInstance.glide(), node, rect, fixture };
}

describe('GlideViewport', () => {
  it('keeps the default origin limit when constraints only sets a scale range', async () => {
    const { glide } = await viewport({ constraints: { scale: { constraints: [1, 4] } } });

    glide.zoomTo(10);
    glide.panTo({ x: 5000, y: 5000 });

    expect(glide.engine.getScale()).toBe(4);
    expect(glide.engine.getOrigin()).toEqual({ x: 400, y: 300 });
  });

  it('replaces the default origin limit with constraints.origin', async () => {
    const { glide } = await viewport({ constraints: { origin: { constraints: { x: [0, 10], y: [0, 10] } } } });

    glide.panTo({ x: 5000, y: 5000 });

    expect(glide.engine.getOrigin()).toEqual({ x: 10, y: 10 });
  });

  it('anchors a wheel zoom at the cursor after the viewport moved', async () => {
    const { glide, node, rect } = await viewport();
    glide.center();
    rect.x = 150;

    const before = glide.engine.getTransform();
    node.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 150 + 400, clientY: 300, cancelable: true }));
    const after = glide.engine.getTransform();

    expect(after.scale).toBeGreaterThan(before.scale);
    expect(after.origin.x + 400 / after.scale).toBeCloseTo(before.origin.x + 400 / before.scale, 9);
  });

  it('updates transform once per animation frame and follows a drag with moving', async () => {
    const { glide, node, fixture } = await viewport();

    glide.zoomIn();
    glide.zoomIn();
    expect(glide.transform().scale).toBe(1);
    await settle(fixture);
    expect(glide.transform()).toEqual(glide.engine.getTransform());

    node.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 10, clientY: 10 }));
    expect(glide.moving()).toBe(true);
    node.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, button: 0, clientX: 10, clientY: 10 }));
    expect(glide.moving()).toBe(false);
  });

  it('ignores an event passed to zoomIn as the step', async () => {
    const { glide } = await viewport();

    glide.zoomIn(new MouseEvent('click') as unknown as number);

    expect(glide.engine.getScale()).toBeCloseTo(1.1, 9);
  });
});

@Component({
  imports: [GlideCanvas],
  template: `
    <glide-canvas [image]="image()" [renderer]="renderer()">
      @if (marker()) {
        <span>marker</span>
      }
    </glide-canvas>
  `,
})
class CanvasHost {
  readonly image = signal<Blob | null>(new Blob(['x'], { type: 'image/png' }));
  readonly renderer = signal<Renderer>(Renderer.Canvas);
  readonly marker = signal(false);
  readonly viewer = viewChild.required(GlideCanvas);
}

async function canvasHost(setup: (host: CanvasHost) => void = () => {}) {
  const fixture = TestBed.createComponent(CanvasHost);
  setup(fixture.componentInstance);
  document.body.appendChild(fixture.nativeElement);
  await settle(fixture);
  return { fixture, host: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
}

describe('GlideCanvas', () => {
  afterEach(() => {
    setDevicePixelRatio(1);
    layout = { width: 1000, height: 700 };
  });

  it('clears the canvas when the image is removed', async () => {
    const { fixture, host, element } = await canvasHost();
    const calls = contexts.get(element.querySelector('canvas')!)!.calls;
    expect(calls).toContain('draw');

    calls.length = 0;
    host.image.set(null);
    await settle(fixture);

    expect(calls).toContain('clear');
    expect(calls).not.toContain('draw');
  });

  it('resizes the canvas backing store when devicePixelRatio changes', async () => {
    const { fixture, host, element } = await canvasHost();
    const canvas = element.querySelector('canvas')!;
    expect(canvas.width).toBe(1000);

    setDevicePixelRatio(2);
    host.viewer().glide.zoomIn();
    await settle(fixture);

    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(1400);
  });

  it('shows an SVG through a data: URL in the image renderer', async () => {
    const { element } = await canvasHost((host) => {
      host.renderer.set(Renderer.Image);
      host.image.set(new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"], { type: 'image/svg+xml' }));
    });

    expect(element.querySelector('img')!.getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('projects content into an overlay sized to the content and moved with the transform', async () => {
    const { fixture, host, element } = await canvasHost((h) => h.marker.set(true));

    const overlay = element.querySelector('span')!.parentElement!;
    expect(overlay.style.width).toBe('700px');
    expect(overlay.style.height).toBe('700px');

    host.viewer().glide.zoomTo(2, { x: 0, y: 0 });
    await settle(fixture);
    expect(overlay.style.transform).toMatch(/^scale\(2\)/);
  });

  for (const renderer of [Renderer.Canvas, Renderer.Image, Renderer.Html]) {
    it(`fits a new image in the ${renderer} renderer once the viewport has a size`, async () => {
      layout = { width: 0, height: 0 };
      const { fixture, host, element } = await canvasHost((h) => h.renderer.set(renderer));
      const img = element.querySelector('img');
      if (img) {
        Object.defineProperties(img, { naturalWidth: { value: 300 }, naturalHeight: { value: 300 } });
        img.dispatchEvent(new Event('load'));
        await settle(fixture);
      }

      resize({ width: 1000, height: 700 });
      await settle(fixture);

      const { glide } = host.viewer();
      expect(glide.contentSize()).toEqual({ width: 700, height: 700 });
      expect(glide.engine.getTransform()).toEqual({ origin: { x: -150, y: 0 }, scale: 1 });
    });
  }

  it('keeps the view when the viewport is resized after the image was fitted', async () => {
    const { fixture, host } = await canvasHost();
    const { glide } = host.viewer();
    const fitted = glide.engine.getTransform();

    resize({ width: 800, height: 700 });
    await settle(fixture);

    expect(glide.contentSize()).toEqual({ width: 700, height: 700 });
    expect(glide.engine.getTransform()).toEqual(fitted);
  });
});
