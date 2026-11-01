import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UnprocessableEntityException } from '@nestjs/common';
import { detectImageType, PRODUCT_IMAGES_PREFIX, removeUploadedImage, saveProductImage } from './product-images';
import { ProductsService } from './products.service';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(32)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const PID = '0192f000-0000-7000-8000-000000000001';

describe('Fotografías de productos (mejora n.° 4)', () => {
  let dir: string;
  const prev = process.env.UPLOADS_DIR;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'siven-uploads-'));
    process.env.UPLOADS_DIR = dir;
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (prev === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = prev;
  });

  it('reconoce JPG, PNG y WebP por sus primeros bytes y rechaza lo demás (SVG, texto, vacío)', () => {
    expect(detectImageType(JPG)).toBe('jpg');
    expect(detectImageType(PNG)).toBe('png');
    expect(detectImageType(WEBP)).toBe('webp');
    expect(detectImageType(SVG)).toBeNull();
    expect(detectImageType(Buffer.from('hola'))).toBeNull();
  });

  it('guarda con nombre generado por el servidor y solo borra fotos subidas válidas', async () => {
    const url = await saveProductImage(PID, PNG, 'png');
    expect(url.startsWith(PRODUCT_IMAGES_PREFIX)).toBe(true);
    expect(url).toMatch(new RegExp(`${PID}-[0-9a-f]{12}\\.png$`));
    expect(readdirSync(join(dir, 'products'))).toHaveLength(1);

    // Rutas ajenas o con trucos no borran nada.
    writeFileSync(join(dir, 'secreto.txt'), 'x');
    await removeUploadedImage('/product-images/catalogo/image1.png');
    await removeUploadedImage(`${PRODUCT_IMAGES_PREFIX}../secreto.txt`);
    expect(existsSync(join(dir, 'secreto.txt'))).toBe(true);

    await removeUploadedImage(url);
    expect(readdirSync(join(dir, 'products'))).toHaveLength(0);
  });

  describe('ProductsService.setImage / removeImage', () => {
    const actor = { id: 'u1', username: 'admin', role: 'ADMIN', permissions: [] } as never;
    const audit = { log: jest.fn() };
    const row = (imageUrl: string | null) => ({
      id: PID, sku: 'MNG-1', name: 'Manguera', description: null, imageUrl, categoryId: null, brandId: null,
      avgCost: { toString: () => '0' }, salePrice: { toString: () => '0' }, stock: 0, minStock: 0, isActive: true,
      createdAt: new Date(), updatedAt: new Date(), category: null, brand: null, stocks: [],
    });
    let current: string | null;
    const prisma = {
      product: {
        findUnique: jest.fn(() => Promise.resolve({ sku: 'MNG-1', imageUrl: current })),
        update: jest.fn(({ data }: { data: { imageUrl: string | null } }) => {
          current = data.imageUrl;
          return Promise.resolve(row(current));
        }),
      },
    };
    const service = new ProductsService(prisma as never, audit as never);

    beforeEach(() => {
      current = '/product-images/catalogo/image5.png';
      jest.clearAllMocks();
    });

    it('sin archivo, con SVG o mayor de 2 MB → 422 y no toca la BD', async () => {
      await expect(service.setImage(PID, undefined, actor)).rejects.toThrow(UnprocessableEntityException);
      await expect(service.setImage(PID, { buffer: SVG, size: SVG.length }, actor)).rejects.toThrow(UnprocessableEntityException);
      await expect(service.setImage(PID, { buffer: PNG, size: 3 * 1024 * 1024 }, actor)).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('reemplazar borra la foto subida anterior, pero no las imágenes del catálogo', async () => {
      const first = await service.setImage(PID, { buffer: PNG, size: PNG.length }, actor);
      expect(first.imageUrl).toMatch(/^\/api\/v1\/uploads\/products\/.+\.png$/);
      expect(readdirSync(join(dir, 'products'))).toHaveLength(1);

      const second = await service.setImage(PID, { buffer: JPG, size: JPG.length }, actor);
      expect(second.imageUrl).toMatch(/\.jpg$/);
      expect(readdirSync(join(dir, 'products'))).toEqual([second.imageUrl!.split('/').pop()]);

      const removed = await service.removeImage(PID, actor);
      expect(removed.imageUrl).toBeNull();
      expect(readdirSync(join(dir, 'products'))).toHaveLength(0);
      expect(audit.log).toHaveBeenCalledTimes(3);
    });
  });
});
