import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { createEngine, type CanvasEngine, type CanvasEngineOptions, type Point, type Rect, type Transform } from 'canvas-glide';
import { createConstrainer } from './util/constraint';
import type { Size } from './util/size';

export type GlideOptions = Omit<CanvasEngineOptions, 'getViewportRect' | 'getCanvasRect'> & {
  /** Unscaled content size; defaults to `contentSize`. */
  getCanvasRect?: () => Rect | null;
};

/**
 * Makes its host element a pan-and-zoom viewport. Pointer and wheel input start after the first render in the browser.
 * The options (`[glideViewport]`) are read once, when the engine is first used.
 */
@Directive({
  selector: '[glideViewport]',
  exportAs: 'glideViewport',
  host: {
    '[style.touch-action]': '"none"',
    '[style.user-select]': '"none"',
  },
})
export class GlideViewport {
  readonly options = input<GlideOptions | '' | undefined>(undefined, { alias: 'glideViewport' });

  readonly #transform = linkedSignal<Transform>(() => (this.options() || {}).state?.initial ?? { origin: { x: 0, y: 0 }, scale: 1 });
  readonly #moving = signal(false);
  readonly #viewportSize = signal<Size>({ width: 0, height: 0 });

  /** The current transform, updated at most once per animation frame. */
  readonly transform = this.#transform.asReadonly();
  /** Whether a pointer drag is in progress. */
  readonly moving = this.#moving.asReadonly();
  /** The host element's size in CSS pixels. */
  readonly viewportSize = this.#viewportSize.asReadonly();
  /** The content's size at scale 1, used by fit, center and the default pan limit. */
  readonly contentSize = signal<Size | null>(null);
  /** Whether pointer drags pan, from `move.enabled`. */
  readonly pannable = computed(() => (this.options() || {}).move?.enabled !== false);

  readonly #element: HTMLElement = inject(ElementRef).nativeElement;
  #engine: CanvasEngine | undefined;
  #frame = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const element = this.#element;
      const { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onWheel } = this.engine.event;
      const listeners: [string, EventListener, AddEventListenerOptions?][] = [
        ['pointerdown', onPointerDown as EventListener],
        ['pointermove', onPointerMove as EventListener],
        ['pointerup', onPointerUp as EventListener],
        ['pointercancel', onPointerCancel as EventListener],
        ['wheel', onWheel as EventListener, { passive: false }],
      ];
      listeners.forEach(([type, listener, options]) => element.addEventListener(type, listener, options));

      const measure = () => this.#viewportSize.set({ width: element.clientWidth, height: element.clientHeight });
      const resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(element);
      measure();

      destroyRef.onDestroy(() => {
        listeners.forEach(([type, listener]) => element.removeEventListener(type, listener));
        resizeObserver.disconnect();
        cancelAnimationFrame(this.#frame);
      });
    });
  }

  /** The underlying engine, created on first use. */
  get engine(): CanvasEngine {
    return (this.#engine ??= this.#createEngine(this.options() || {}));
  }

  // A method handler such as `(click)="glide.zoomIn($event)"` may pass the event; only a number is a step.
  zoomIn(step?: number) {
    this.engine.zoomIn(typeof step === 'number' ? step : undefined);
  }

  zoomOut(step?: number) {
    this.engine.zoomOut(typeof step === 'number' ? step : undefined);
  }

  /** Sets the scale, keeping `pivot` (viewport pixels) or the viewport centre in place. */
  zoomTo(scale: number, pivot?: Point) {
    this.engine.zoomTo(scale, pivot);
  }

  panTo(origin: Point) {
    this.engine.panTo(origin);
  }

  setTransform(transform: Transform) {
    this.engine.setTransform(transform);
  }

  fit() {
    this.engine.fit();
  }

  center() {
    this.engine.center();
  }

  reset() {
    this.engine.reset();
  }

  #createEngine(options: GlideOptions): CanvasEngine {
    const getViewportRect = () => (this.#element.isConnected ? this.#element.getBoundingClientRect() : null);
    const getCanvasRect =
      options.getCanvasRect ??
      (() => {
        const size = untracked(this.contentSize);
        return size && { x: 0, y: 0, ...size };
      });

    const engine: CanvasEngine = createEngine({
      ...options,
      getViewportRect,
      getCanvasRect,
      constraints: {
        ...options.constraints,
        origin: options.constraints?.origin ?? {
          enabled: true,
          constrain: createConstrainer({ getViewportRect, getCanvasRect, getScale: () => engine.getScale() }),
        },
      },
      state: {
        ...options.state,
        onTransformChange: (next) => {
          if (!this.#frame && typeof requestAnimationFrame !== 'undefined') {
            this.#frame = requestAnimationFrame(() => {
              this.#frame = 0;
              this.#transform.set(engine.getTransform());
            });
          }
          options.state?.onTransformChange?.(next);
        },
      },
      move: {
        ...options.move,
        onIsMovingChange: (next) => {
          this.#moving.set(next);
          options.move?.onIsMovingChange?.(next);
        },
      },
    });
    return engine;
  }
}
