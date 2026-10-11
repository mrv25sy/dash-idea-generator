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
- Shared site logos use square, tightly framed transparent asset pointers; derive the local favicon from the same red source to keep branding consistent.
- Theme selection uses a root data-theme attribute and semantic CSS token overrides, with local storage only for this visual preference; keeps all pages and cart synchronized without a backend.
- The announcement ticker contains two identical padded tracks translated by half their combined width; ensures a seamless right-to-left loop.
- Drop browsing uses the shared Embla carousel controls with centered slides; keeps touch gestures, keyboard navigation, and arrow navigation on one engine.
