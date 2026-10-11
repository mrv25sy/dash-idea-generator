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

## Rules

- Personal data is reached only through the authenticated server functions in `src/goals.functions.ts`, never from a browser query or a route loader. Why: those endpoints stay callable directly, so row-level security plus a server-side identity check is the only boundary that keeps one person's rows away from another.
- Keep exactly one auth-state listener, the one in `src/components/session.tsx`, and read session state from `useSession()`. Why: extra subscriptions cause refresh storms and a header that disagrees with the real session.
