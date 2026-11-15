import { createImageUrlSafe, revokeImageUrl } from './image';

describe('image URLs', () => {
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;

  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  function fakeObjectUrls() {
    const create = vi.fn(() => 'blob:test');
    const revoke = vi.fn();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    return { create, revoke };
  }

  it('gives a raster image a blob: URL, which revokeImageUrl releases', async () => {
    const { create, revoke } = fakeObjectUrls();

    const url = await createImageUrlSafe(new Blob(['x'], { type: 'image/png' }));
    revokeImageUrl(url);

    expect(url).toBe('blob:test');
    expect(create).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });

  it("gives an SVG a data: URL, so its scripts cannot run in the page's origin", async () => {
    const { create, revoke } = fakeObjectUrls();

    const url = await createImageUrlSafe(new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"], { type: 'image/svg+xml' }));
    revokeImageUrl(url);

    expect(url).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(create).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
  });

  it('gives no URL without an image', async () => {
    expect(await createImageUrlSafe(null)).toBeNull();
  });
});
