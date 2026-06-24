---
name: local-uri-as-public-url
description: InventoryItem.imageUri is a local file:// path — never pass it as a network-visible URL to Supabase tables or Edge Functions
metadata:
  type: feedback
---

`InventoryItem.imageUri` holds a local device path (e.g. `file:///data/user/0/...`). It is produced by the image picker and stored in SQLite for the business owner's own device.

Passing it as `product_image_url` to `online_catalog` (or any Supabase table) corrupts the row: the URL is unreachable on any other device. Customers will see a broken image placeholder.

**Why:** The catalog screen (`catalog.tsx`) called `addProductToCatalog(..., product.imageUri, ...)` directly. The value is a local URI, not a Supabase Storage public URL.

**How to apply:** When adding a product to `online_catalog`, always pass `undefined` for `productImageUrl` unless the image has been explicitly uploaded to Supabase Storage and the returned public URL is in hand. The upload-to-Storage step is a separate feature; do not conflate it with the catalog toggle flow.

Related: [[customer-rls-bypass]]
