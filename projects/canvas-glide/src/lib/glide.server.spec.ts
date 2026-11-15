import { Component } from '@angular/core';
import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, renderApplication } from '@angular/platform-server';
import { GlideCanvas, Renderer } from './glide-canvas';

@Component({
  selector: 'glide-server-host',
  imports: [GlideCanvas],
  template: `
    <glide-canvas [renderer]="renderer" [image]="null">
      <span>marker</span>
    </glide-canvas>
  `,
})
class ServerHost {
  readonly renderer = Renderer.Image;
}

describe('GlideCanvas on the server', () => {
  it('renders without the browser-only parts', async () => {
    const html = await renderApplication(
      (context: BootstrapContext) => bootstrapApplication(ServerHost, { providers: [provideServerRendering()] }, context),
      { document: '<html><body><glide-server-host></glide-server-host></body></html>', url: '/' },
    );

    expect(html).toContain('overscroll-behavior: contain');
    expect(html).toContain('marker');
  });
});
