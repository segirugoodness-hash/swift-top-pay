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

- Centralize Supabase auth-transition handling in the root so shared profile consumers do not create duplicate listeners or retain another user's cached data.
- Keep all wallet-vend pricing, payment authorization, provider execution, and ledger settlement inside authenticated server functions and database transactions; clients may present quotes but never supply trusted costs, provider paths, or payment approval state.
