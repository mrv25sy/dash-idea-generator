<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Editable site settings live in src/config.ts; product/content data goes in separate data files — owner edits placeholders without touching components.
- Lovable Cloud is connected (owner enabled it Oct 2026); new backend work uses Cloud — cart/orders currently still localStorage/WhatsApp until migrated.
- Shared site logos use tightly cropped transparent asset pointers with bundled data-URL fallbacks for external hosting; derive the local favicon from the same red source to keep branding consistent and avoid dependence on Lovable asset serving.
- Theme selection uses a root data-theme attribute and semantic CSS token overrides, with local storage only for this visual preference; keeps all pages and cart synchronized without a backend.
- The announcement ticker contains two identical padded tracks translated by half their combined width; ensures a seamless right-to-left loop.
- Use Embla for the centered Drops carousel, with content sourced from the existing drops data and presentation in semantic global CSS; this keeps swipe physics, looping, and desktop navigation consistent without duplicating catalog content.
- Until the generated Cloud snapshot includes migration 0006, use the migration-derived StoreDatabase extension through the existing client for profiles, settings, and order ownership; this preserves one session and strict query types without modifying generated files or changing runtime permissions.
- Dashboard-managed drops and custom homepage sections are JSON values in store_settings (drops_json, sections_json), loaded by loadCatalog; avoids schema changes on the owner-managed database.
- Product ratings live in product_ratings (one row per user+product, RLS own-write); loaded once client-side and shared by all star widgets.
