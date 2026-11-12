/**
 * Enclosure Lab trusted store catalog.
 *
 * This module is intended to be imported ONLY by Supabase Edge Functions.
 * Never accept unit prices supplied by the browser as authoritative.
 *
 * Prices are stored in integer cents.
 * Update this catalog whenever the public storefront's listed prices change.
 */
export const PRODUCT_CATALOG = {
  "knob-signature": {
    name: "EL Signature Bass Knob",
    unitAmount: 2999,
    currency: "usd",
    active: true,
  },
  "knob-carbon": {
    name: "Carbon Series Bass Knob",
    unitAmount: 3499,
    currency: "usd",
    active: true,
  },
  "knob-color": {
    name: "Color Pop Custom Bass Knob",
    unitAmount: 3499,
    currency: "usd",
    active: true,
  },
  "kit-custom": {
    name: "DIY Subwoofer Box Kit",
    unitAmount: 16472,
    currency: "usd",
    active: true,
  },
  "kicker-c8-prefab": {
    name: "Kicker Comp C8 Prefab Box",
    unitAmount: 14000,
    currency: "usd",
    active: true,
  },
  "skar-sdr10-prefab": {
    name: "Skar Audio SDR-10 D4 Prefab Subwoofer Box",
    unitAmount: 18000,
    currency: "usd",
    active: true,
  },
} as const;

export type StoreProductId = keyof typeof PRODUCT_CATALOG;

export function getTrustedProduct(productId: string) {
  if (!Object.prototype.hasOwnProperty.call(PRODUCT_CATALOG, productId)) {
    return null;
  }
  return PRODUCT_CATALOG[productId as StoreProductId];
}

export function calculateStoreProductSubtotalCents(
  items: Array<{ productId: string; quantity: number }>,
) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    throw new Error("Cart must contain between 1 and 50 product lines.");
  }

  let subtotal = 0;
  const normalized = items.map((item) => {
    const product = getTrustedProduct(item.productId);
    const quantity = Number(item.quantity);

    if (!product || !product.active) {
      throw new Error(`Product is unavailable: ${item.productId}`);
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new Error("Each product quantity must be between 1 and 20.");
    }

    const lineTotal = product.unitAmount * quantity;
    subtotal += lineTotal;

    return {
      productId: item.productId,
      name: product.name,
      quantity,
      unitAmount: product.unitAmount,
      lineTotal,
      currency: product.currency,
    };
  });

  if (!Number.isSafeInteger(subtotal) || subtotal > 2_000_000) {
    throw new Error("Cart total is outside the allowed range.");
  }

  return { currency: "usd" as const, subtotalCents: subtotal, items: normalized };
}
