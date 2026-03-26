# OroCommerce Storefront API — Integration Guide

A technology-agnostic reference for integrating with the OroCommerce Storefront API. Covers the complete buyer journey: authentication, catalog browsing, shopping lists, checkout, and order history.

Use this guide to build a custom storefront on any stack (mobile app, SPA, server-rendered, headless CMS, etc.).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Conventions](#conventions)
3. [Authentication](#authentication)
4. [Catalog (Products & Categories)](#catalog-products--categories)
5. [Shopping Lists](#shopping-lists)
6. [Checkout](#checkout)
7. [Orders](#orders)
8. [End-to-End Flow](#end-to-end-flow)
9. [Implementation Notes](#implementation-notes)

---

## Prerequisites

Before integrating, you need:

- An OroCommerce instance with the Storefront API enabled
- An OAuth2 client configured in Oro back-office (`client_id` and `client_secret`)
- The base URL of your Oro instance (e.g. `https://oro.example.com`)

All endpoint paths in this document are relative to that base URL.

---

## Conventions

### JSON:API

All resource endpoints use the [JSON:API v1.0](https://jsonapi.org/) specification. The OAuth token endpoint is the only exception (standard OAuth2 form encoding).

### Required Headers

Include these headers on every JSON:API request:

```http
Content-Type: application/vnd.api+json
Accept: application/vnd.api+json
Authorization: Bearer {access_token}
X-Include: totalCount;noHateoas
```

| Header | Purpose |
|--------|---------|
| `Content-Type` / `Accept` | JSON:API media type |
| `Authorization` | OAuth2 Bearer token |
| `X-Include: totalCount` | Returns total record count in the `X-Include-Total-Count` response header (useful for pagination) |
| `X-Include: noHateoas` | Omits HATEOAS links from response, reducing payload size |

### Pagination

List endpoints support JSON:API pagination:

```
?page[number]=1&page[size]=12
```

### Sparse Fieldsets

Reduce payload size by requesting only the fields you need:

```
?fields[products]=name,sku,prices,images
```

### Including Related Resources

Fetch related resources in a single request using `include`:

```
?include=images,category
```

Related resources appear in the top-level `included` array and are linked via `relationships`.

---

## Authentication

All API access requires an OAuth2 Bearer token. Oro supports two authentication scenarios: guest access (anonymous browsing) and customer user login.

### Endpoint

```http
POST /oauth2-token
Content-Type: application/x-www-form-urlencoded
```

> This endpoint does NOT use JSON:API headers.

### Guest Access Token

Allows unauthenticated users to browse the catalog and categories.

**Request body (form-encoded):**

| Field | Value |
|-------|-------|
| `grant_type` | `password` |
| `client_id` | Your OAuth client ID |
| `client_secret` | Your OAuth client secret |
| `username` | `guest` |
| `password` | `guest` |

### Customer User Login

Authenticates a registered customer user. Grants access to shopping lists, checkout, and orders.

**Request body (form-encoded):**

| Field | Value |
|-------|-------|
| `grant_type` | `password` |
| `client_id` | Your OAuth client ID |
| `client_secret` | Your OAuth client secret |
| `username` | Customer user's email |
| `password` | Customer user's password |

### Response (both flows)

```json
{
  "access_token": "YWNjZXNzX3Rva2VuX2V4YW1wbGU...",
  "refresh_token": "cmVmcmVzaF90b2tlbl9leGFtcGxl...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

### Token Refresh

When the access token nears expiry, exchange the refresh token for a new pair.

**Request body (form-encoded):**

| Field | Value |
|-------|-------|
| `grant_type` | `refresh_token` |
| `client_id` | Your OAuth client ID |
| `client_secret` | Your OAuth client secret |
| `refresh_token` | The stored refresh token |

Returns the same response structure with new tokens.

### Error Response

```json
{
  "error": "invalid_grant",
  "error_description": "Invalid credentials.",
  "message": "The user credentials were incorrect."
}
```

### Recommended Token Management

- Cache tokens with their expiration time; refresh proactively (e.g. 60 seconds before expiry)
- Deduplicate concurrent token requests to avoid race conditions
- If refresh fails, fall back to full re-authentication
- Store user tokens in a session-scoped mechanism appropriate to your platform (e.g. `sessionStorage`, secure cookie, Keychain)

---

## Catalog (Products & Categories)

These endpoints work with both guest and authenticated tokens.

### List Products

```http
GET /api/products
```

**Query Parameters:**

| Parameter | Example | Description |
|-----------|---------|-------------|
| `page[number]` | `1` | Page number (1-based) |
| `page[size]` | `12` | Items per page |
| `include` | `images,category` | Sideload related resources |
| `fields[products]` | `name,sku,prices,images` | Sparse fieldset |
| `filter[featured]` | `yes` | Only featured products |
| `filter[rootCategory][gte]` | `42` | Products in category 42 and descendants |

**Response:**

```json
{
  "data": [
    {
      "type": "products",
      "id": "1",
      "attributes": {
        "name": "Laptop Pro 15",
        "names": { "default": "Laptop Pro 15" },
        "sku": "LP-15",
        "shortDescription": "High-performance laptop",
        "prices": [{ "price": 1299.99 }],
        "lowPrice": { "price": 1299.99 },
        "featured": true
      },
      "relationships": {
        "images": {
          "data": [{ "type": "productimages", "id": "10" }]
        },
        "category": {
          "data": { "type": "mastercatalogcategories", "id": "5" }
        }
      }
    }
  ],
  "included": [
    {
      "type": "productimages",
      "id": "10",
      "attributes": {
        "files": [{ "url": "/media/cache/attachment/filter/product_large/abc123.jpg" }]
      }
    },
    {
      "type": "mastercatalogcategories",
      "id": "5",
      "attributes": { "title": "Electronics", "url": "/electronics" }
    }
  ]
}
```

**Response Header:** `X-Include-Total-Count: 156` (total matching products for pagination).

**Image URLs** are relative to the Oro base URL. Prepend your instance URL to get the full path.

### Get Single Product

```http
GET /api/products/{id}
```

| Parameter | Recommended Value |
|-----------|-------------------|
| `include` | `images,category` |
| `fields[products]` | `name,names,sku,shortDescription,description,prices,featured,images,category,unitPrecisions` |

Same response structure as listing. The `unitPrecisions` field provides available units of measure (e.g. "item", "kg", "set") which you will need when adding items to a shopping list.

### Get Category Tree

```http
GET /api/mastercatalogtree
```

| Parameter | Value |
|-----------|-------|
| `include` | `category` |

**Response:**

```json
{
  "data": [
    {
      "type": "mastercatalogtree",
      "id": "1",
      "attributes": { "order": 1 },
      "relationships": {
        "category": {
          "data": { "type": "mastercatalogcategories", "id": "5" }
        },
        "parent": {
          "data": { "type": "mastercatalogtree", "id": "0" }
        }
      }
    }
  ],
  "included": [
    {
      "type": "mastercatalogcategories",
      "id": "5",
      "attributes": { "title": "Electronics", "url": "/electronics" }
    }
  ]
}
```

Build a hierarchical tree by mapping each node's `parent` relationship. Root nodes have `parent: null` or reference ID `"0"`.

---

## Shopping Lists

> Requires an authenticated customer user token.

Shopping lists are the Oro equivalent of a cart. A user can have multiple named lists, with one marked as default.

### List Shopping Lists

```http
GET /api/shoppinglists?include=items.product,items.unit
```

**Response:**

```json
{
  "data": [
    {
      "type": "shoppinglists",
      "id": "1",
      "attributes": {
        "name": "My List",
        "default": true,
        "total": 149.97,
        "subTotal": 149.97,
        "currency": "USD"
      },
      "relationships": {
        "items": {
          "data": [{ "type": "shoppinglistitems", "id": "10" }]
        }
      }
    }
  ],
  "included": [
    {
      "type": "shoppinglistitems",
      "id": "10",
      "attributes": {
        "quantity": 3,
        "value": 49.99,
        "currency": "USD"
      },
      "relationships": {
        "product": { "data": { "type": "products", "id": "1" } },
        "unit": { "data": { "type": "productunits", "id": "item" } }
      }
    },
    {
      "type": "products",
      "id": "1",
      "attributes": { "name": "Laptop Pro 15", "sku": "LP-15" }
    },
    {
      "type": "productunits",
      "id": "item",
      "attributes": { "label": "item", "defaultPrecision": 0 }
    }
  ]
}
```

### Create Shopping List

```http
POST /api/shoppinglists
```

```json
{
  "data": {
    "type": "shoppinglists",
    "attributes": {
      "name": "Project Supplies"
    }
  }
}
```

### Delete Shopping List

```http
DELETE /api/shoppinglists/{id}
```

Returns `204 No Content`.

### Set Default Shopping List

```http
PATCH /api/shoppinglists/{id}
```

```json
{
  "data": {
    "type": "shoppinglists",
    "id": "{id}",
    "attributes": {
      "default": true
    }
  }
}
```

### Add Item to Shopping List

```http
POST /api/shoppinglistitems
```

```json
{
  "data": {
    "type": "shoppinglistitems",
    "attributes": {
      "quantity": 2
    },
    "relationships": {
      "product": {
        "data": { "type": "products", "id": "{productId}" }
      },
      "shoppingList": {
        "data": { "type": "shoppinglists", "id": "{listId}" }
      },
      "unit": {
        "data": { "type": "productunits", "id": "{unitCode}" }
      }
    }
  }
}
```

The `unit` value (e.g. `"item"`, `"kg"`, `"set"`) comes from the product's `unitPrecisions` field.

### Update Item Quantity

```http
PATCH /api/shoppinglistitems/{itemId}
```

```json
{
  "data": {
    "type": "shoppinglistitems",
    "id": "{itemId}",
    "attributes": {
      "quantity": 5
    }
  }
}
```

### Update Item Unit

```http
PATCH /api/shoppinglistitems/{itemId}
```

```json
{
  "data": {
    "type": "shoppinglistitems",
    "id": "{itemId}",
    "attributes": {
      "quantity": 5
    },
    "relationships": {
      "unit": {
        "data": { "type": "productunits", "id": "{newUnitCode}" }
      }
    }
  }
}
```

> When changing the unit, always include the quantity — Oro may need to recalculate pricing.

### Remove Item

```http
DELETE /api/shoppinglistitems/{itemId}
```

Returns `204 No Content`.

---

## Checkout

> Requires an authenticated customer user token.

The checkout flow is a multi-step process: create checkout from a shopping list, configure addresses, select shipping/payment, validate, and place the order.

### Step 1 — Create Checkout from Shopping List

```http
POST /api/shoppinglists/{listId}/checkout
```

No request body. Returns the newly created checkout resource. Extract the `id` for subsequent calls.

### Step 2 — Load Checkout State

```http
GET /api/checkouts/{checkoutId}?include=lineItems.product
```

**Response:**

```json
{
  "data": {
    "type": "checkouts",
    "id": "1",
    "attributes": {
      "currency": "USD",
      "billingAddress": {
        "firstName": "John",
        "lastName": "Doe",
        "street": "123 Main St",
        "city": "Los Angeles",
        "region": "US-CA",
        "postalCode": "90001",
        "country": "US"
      },
      "shippingAddress": null,
      "shipToBillingAddress": false,
      "subtotals": {
        "subtotal": 149.97,
        "shipping": 0
      },
      "total": 149.97
    },
    "relationships": {
      "lineItems": {
        "data": [{ "type": "checkoutlineitems", "id": "100" }]
      }
    }
  },
  "included": [
    {
      "type": "checkoutlineitems",
      "id": "100",
      "attributes": {
        "quantity": 3,
        "price": 49.99,
        "subtotal": 149.97,
        "currency": "USD"
      },
      "relationships": {
        "product": { "data": { "type": "products", "id": "1" } }
      }
    }
  ]
}
```

### Step 3 — Get Available Addresses

Fetch saved customer addresses to offer as options:

```http
GET /api/checkouts/{checkoutId}/availableBillingAddresses
GET /api/checkouts/{checkoutId}/availableShippingAddresses
```

Both return an array of address resources the customer has on file.

### Step 4 — Set Addresses

**Option A: Enter a new address inline**

```http
PATCH /api/checkouts/{checkoutId}
```

```json
{
  "data": {
    "type": "checkouts",
    "id": "{checkoutId}",
    "attributes": {
      "billingAddress": {
        "firstName": "John",
        "lastName": "Doe",
        "organization": "Acme Corp",
        "street": "123 Main St",
        "street2": "Suite 100",
        "city": "Los Angeles",
        "region": "US-CA",
        "postalCode": "90001",
        "country": "US",
        "phone": "+1-555-123-4567"
      },
      "shipToBillingAddress": true
    }
  }
}
```

Set `shipToBillingAddress: true` to reuse the billing address for shipping, or provide a separate `shippingAddress` object.

**Option B: Use a saved address**

```json
{
  "data": {
    "type": "checkouts",
    "id": "{checkoutId}",
    "relationships": {
      "billingAddress": {
        "data": { "type": "checkoutaddresses", "id": "billing_address" }
      }
    }
  },
  "included": [
    {
      "type": "checkoutaddresses",
      "id": "billing_address",
      "relationships": {
        "customerUserAddress": {
          "data": { "type": "customeruseraddresses", "id": "{savedAddressId}" }
        }
      }
    }
  ]
}
```

> Use `customerAddress` instead of `customerUserAddress` for company-level addresses.

### Step 5 — Get Available Shipping Methods

```http
GET /api/checkouts/{checkoutId}/availableShippingMethods
```

**Response:**

```json
[
  {
    "type": "shippingmethods",
    "id": "flatrate_1",
    "attributes": {
      "label": "Flat Rate",
      "types": [
        {
          "id": "primary",
          "label": "Flat Rate Shipping",
          "price": 10.00,
          "currency": "USD"
        }
      ]
    }
  }
]
```

Each shipping method can have multiple types (service levels). You need both the method `id` and the type `id` when updating the checkout.

### Step 6 — Get Available Payment Methods

```http
GET /api/checkouts/{checkoutId}/availablePaymentMethods
```

**Response:**

```json
[
  {
    "type": "paymentmethods",
    "id": "payment_term_1",
    "attributes": {
      "label": "Net 30 Payment Terms"
    }
  }
]
```

### Step 7 — Set Shipping & Payment

```http
PATCH /api/checkouts/{checkoutId}
```

```json
{
  "data": {
    "type": "checkouts",
    "id": "{checkoutId}",
    "attributes": {
      "shippingMethod": "flatrate_1",
      "shippingMethodType": "primary",
      "paymentMethod": "payment_term_1",
      "poNumber": "PO-2024-001",
      "shipUntil": "2024-12-31",
      "customerNotes": "Leave packages at the front desk"
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `shippingMethod` | Yes | Method ID from available shipping methods |
| `shippingMethodType` | Yes | Type ID within the selected method |
| `paymentMethod` | Yes | Method ID from available payment methods |
| `poNumber` | No | Customer's purchase order number |
| `shipUntil` | No | Requested delivery date (ISO 8601) |
| `customerNotes` | No | Free-text notes for the order |

> After this PATCH, re-fetch the checkout (`GET /api/checkouts/{id}`) to get updated totals including shipping costs.

### Step 8 — Validate & Place Order

**Validate the checkout:**

```http
GET /api/checkouts/{checkoutId}/payment
```

```json
{
  "paymentUrl": "/api/checkouts/1/payment/purchase",
  "errors": []
}
```

If `errors` is non-empty, the checkout is incomplete — display the error messages and prompt the user to fix the issues.

**Place the order:**

```http
POST {paymentUrl}
```

The `paymentUrl` is dynamic — always use the value returned by the validation step.

```json
{
  "data": {
    "id": "1",
    "relationships": {
      "order": {
        "data": { "id": "42" }
      }
    }
  }
}
```

The value at `data.relationships.order.data.id` is the newly created order ID. Use it to redirect to an order confirmation page.

---

## Orders

> Requires an authenticated customer user token.

### List Orders

```http
GET /api/orders?include=lineItems&sort=-createdAt
```

**Response:**

```json
{
  "data": [
    {
      "type": "orders",
      "id": "42",
      "attributes": {
        "identifier": "ORD-000042",
        "status": "open",
        "internalStatus": "open",
        "createdAt": "2024-01-15T10:30:00Z",
        "total": 159.97,
        "currency": "USD"
      }
    }
  ]
}
```

### Get Order Detail

```http
GET /api/orders/{orderId}?include=lineItems,billingAddress,shippingAddress,paymentTerm
```

**Response:**

```json
{
  "data": {
    "type": "orders",
    "id": "42",
    "attributes": {
      "identifier": "ORD-000042",
      "status": "open",
      "internalStatus": "open",
      "createdAt": "2024-01-15T10:30:00Z",
      "total": 159.97,
      "subtotalValue": 149.97,
      "totalTaxAmount": 0,
      "shippingCostAmount": 10.00,
      "currency": "USD",
      "poNumber": "PO-2024-001",
      "shipUntil": "2024-12-31",
      "customerNotes": "Leave packages at the front desk",
      "paymentMethod": [{ "label": "Payment Terms", "code": "payment_term" }],
      "paymentStatus": "full",
      "shippingMethod": "Flat Rate",
      "billingAddress": {
        "firstName": "John",
        "lastName": "Doe",
        "organization": "Acme Corp",
        "street": "123 Main St",
        "street2": "Suite 100",
        "city": "Los Angeles",
        "region": "CA",
        "postalCode": "90001",
        "country": "US",
        "phone": "+1-555-123-4567"
      },
      "shippingAddress": {
        "firstName": "John",
        "lastName": "Doe",
        "street": "123 Main St",
        "city": "Los Angeles",
        "region": "CA",
        "postalCode": "90001",
        "country": "US"
      },
      "discounts": [
        { "description": "Loyalty discount", "amount": 15.00 }
      ]
    },
    "relationships": {
      "lineItems": {
        "data": [{ "type": "orderlineitems", "id": "100" }]
      },
      "paymentTerm": {
        "data": { "type": "paymentterms", "id": "1" }
      }
    }
  },
  "included": [
    {
      "type": "orderlineitems",
      "id": "100",
      "attributes": {
        "productName": "Laptop Pro 15",
        "productSku": "LP-15",
        "quantity": 3,
        "price": 49.99,
        "rowTotalValue": 149.97,
        "currency": "USD"
      }
    },
    {
      "type": "paymentterms",
      "id": "1",
      "attributes": { "label": "Net 30" }
    }
  ]
}
```

---

## End-to-End Flow

Below is the complete sequence of API calls for a typical buyer journey:

```
GUEST BROWSING
  POST /oauth2-token                              → obtain guest token
  GET  /api/mastercatalogtree                      → load category navigation
  GET  /api/products?filter[rootCategory][gte]=5   → browse by category
  GET  /api/products/{id}                          → view product detail

USER LOGIN
  POST /oauth2-token                               → obtain user token

SHOPPING LIST
  GET    /api/shoppinglists                        → load user's lists
  POST   /api/shoppinglists                        → create a new list
  POST   /api/shoppinglistitems                    → add product to list
  PATCH  /api/shoppinglistitems/{id}               → update quantity or unit
  DELETE /api/shoppinglistitems/{id}               → remove item

CHECKOUT
  POST  /api/shoppinglists/{id}/checkout           → create checkout session
  GET   /api/checkouts/{id}                        → load checkout state
  GET   /api/checkouts/{id}/availableBillingAddresses
  GET   /api/checkouts/{id}/availableShippingAddresses
  PATCH /api/checkouts/{id}                        → set addresses
  GET   /api/checkouts/{id}/availableShippingMethods
  GET   /api/checkouts/{id}/availablePaymentMethods
  PATCH /api/checkouts/{id}                        → set shipping + payment
  GET   /api/checkouts/{id}/payment                → validate checkout
  POST  {paymentUrl}                               → place order → returns orderId

ORDER CONFIRMATION
  GET   /api/orders/{orderId}                      → display order confirmation
  GET   /api/orders                                → order history
```

---

## Implementation Notes

### CORS

If your frontend runs on a different domain than Oro, configure CORS on the Oro instance or use a backend proxy to forward API requests.

### Resolving JSON:API Relationships

Resources reference related data via `relationships`. The actual data lives in the top-level `included` array. To resolve:

1. Read `relationships.{name}.data` to get `{ type, id }` pairs
2. Find matching entries in `included` by `type` + `id`
3. Consider using a JSON:API deserializer library for your platform (e.g. `jsonapi-serializer`, `Spraypaint`, `Kitsu`)

### Address Format

The `region` field uses ISO 3166-2 subdivision codes (e.g. `US-CA` for California). The `country` field uses ISO 3166-1 alpha-2 codes (e.g. `US`).

### Error Handling

- **401 Unauthorized** — Token expired or invalid; refresh and retry
- **403 Forbidden** — User lacks permission for the resource
- **404 Not Found** — Resource does not exist or is not visible to the current user
- **422 Unprocessable Entity** — Validation errors; check the `errors` array in the response body
- **409 Conflict** — Resource state conflict (e.g. checkout already completed)

### Rate Limiting

Oro may enforce rate limits depending on server configuration. Implement exponential backoff for `429 Too Many Requests` responses.
