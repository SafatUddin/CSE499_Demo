import { prisma } from './db';

export const CATALOG_SOURCES = ['CUSTOM', 'SHOPIFY', 'WOOCOMMERCE', 'CSV'] as const;
export type CatalogSource = typeof CATALOG_SOURCES[number];

export function isCatalogSource(value: unknown): value is CatalogSource {
  return typeof value === 'string' && (CATALOG_SOURCES as readonly string[]).includes(value);
}

export async function getCatalogSource(storeId: string): Promise<CatalogSource> {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { catalogSource: true } });
  return isCatalogSource(store?.catalogSource) ? store.catalogSource : 'CUSTOM';
}

export async function assertCatalogSourceAvailable(storeId: string, requested: CatalogSource): Promise<void> {
  const current = await getCatalogSource(storeId);
  if (current !== 'CUSTOM' && current !== requested) {
    throw new Error(`CATALOG_SOURCE_LOCKED:${current}`);
  }
}

export async function setCatalogSource(storeId: string, source: CatalogSource): Promise<void> {
  const current = await getCatalogSource(storeId);
  if (current === source) return;

  if (current !== 'CUSTOM') {
    const connected = await prisma.channel.findFirst({
      where: {
        storeId,
        connected: true,
        type: current === 'SHOPIFY' ? 'SHOPIFY' : current === 'WOOCOMMERCE' ? 'WOOCOMMERCE' : undefined,
      },
      select: { id: true },
    });
    if (connected) throw new Error(`CATALOG_SOURCE_CONNECTED:${current}`);
  }

  await prisma.store.update({ where: { id: storeId }, data: { catalogSource: source } });
}