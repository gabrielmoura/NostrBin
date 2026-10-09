# NostrBin

NostrBin is a decentralized, relay-aware place to publish, discover, and share code snippets on Nostr.

It is built as a browser-first React application: snippets are signed by the user, published directly to their Nostr write relays, and remain identifiable independently of any single web domain.

## Highlights

- Publish interoperable code snippets as NIP-C0 `kind:1337` events.
- Discover recent public snippets through a bounded set of relays.
- Browse your snippets and legacy NostrBin paste events.
- Share NIP-19 identifiers, download source files, open raw content, copy code, and export code as a PNG image.
- Infer language and syntax highlighting from snippet metadata, extension, or filename.
- Resolve NIP-65 relay lists and Nostr profile metadata efficiently.
- Use NIP-22 comments, NIP-25 reactions, NIP-09 deletion requests, and NIP-40 expiration tags where supported.
- Persist received events locally in IndexedDB for fast repeat access and offline-friendly reads.
- Keep snippets safe to view: remote code is rendered as text and is never executed.

## Requirements

- Node.js 20 or newer
- pnpm 10 or newer
- A Nostr signer: a NIP-07 browser extension or a locally entered key for development

## Getting started

```bash
pnpm install
pnpm dev
```

Open the address displayed by Vite, normally `http://localhost:5173`.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite development server. |
| `pnpm typecheck` | Run strict TypeScript project checks. |
| `pnpm lint` | Run Biome formatting and lint checks. |
| `pnpm test` | Run the Vitest suite. |
| `pnpm build` | Type-check and create a production build. |

## Nostr interoperability

New snippets use NIP-C0 metadata such as `l`, `name`, `extension`, `description`, `runtime`, `license`, `dep`, and `repo`. NostrBin prefers NIP-19 `note` identifiers for compact links while accepting `nevent` and hexadecimal event IDs for interoperability.

Publication is relay-aware: when a NIP-65 relay list is available, snippets are sent to the author’s write relays and the interface reports partial publication rather than assuming success after a single response.

## Privacy and security

- Snippet content is published only when you explicitly choose to publish it.
- Local drafts and UI preferences are not Nostr events.
- The optional client tag is emitted only when a valid application handler descriptor has been configured.
- Nostr relay availability and deletion are distributed properties; a deletion request cannot guarantee removal of copies held by every relay.

## Support the project

If NostrBin is useful to you, consider supporting its development:

- Send Sats to [`verdantkite75@walletofsatoshi.com`](lightning:verdantkite75@walletofsatoshi.com)
- Follow the Nostr profile [`npub102cjfjzr29gxjw84q27lzj53gvwecr6h3rdd3tlhxk4xerxvn89qal7ng0`](nostr:npub102cjfjzr29gxjw84q27lzj53gvwecr6h3rdd3tlhxk4xerxvn89qal7ng0)

## License

NostrBin is licensed under the [MIT License](LICENSE).
