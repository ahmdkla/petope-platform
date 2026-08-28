/**
 * Shared shape for `/api/search` results.
 *
 * It lives here rather than in the route module so the client palette does not
 * import a type *out of a file that imports the database*. That import is
 * type-only today and therefore erased, but one person turning `import type`
 * into `import` would pull the route — and `lib/db` behind it — into the
 * browser bundle. A leaf module with no imports of its own cannot do that.
 *
 * `scripts/check-client-bundle.mjs` is the backstop if it happens anyway.
 */
export type SearchHit = {
  kind: 'listing' | 'deal' | 'middleman';
  id: string;
  href: string;
  title: string;
  subtitle: string;
  meta: string | null;
};
