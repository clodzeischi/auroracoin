# AuroraCoin

An allowance tracker shaped like a bank account a parent actually holds. Parents
record what a child earns and spends; the child sees a balance and a history on
a paired device. React 19 + Vite + Firestore. No router, no state library, no
TypeScript.

## Commands

```
yarn dev            # mock data by default - no .env or Firebase project needed
yarn test           # unit suite, fast and offline
yarn test:rules     # firestore.rules against the emulator (needs Java + firebase CLI)
yarn verify         # lint + test + test:rules + build + verify:build
```

`yarn verify` is the gate. Run it before calling anything done.

Deploy target is the Firebase project `auroracoin-3f1b4` (hosting serves `dist`).

## The load-bearing ideas

Read these before changing anything; each one is a decision that cost something
to arrive at, and the code assumes it everywhere.

**Money is integer hundredths, never a float.** `src/utils/money.js` is the only
module that converts between `1007` and `"10.07"`, and it combines digits
arithmetically rather than multiplying a parsed float. `firestore.rules` enforces
`amountMinor is int` server-side. Never introduce a float amount, and never sum
in display units.

**One seam for data.** `src/data/index.js` is the single place the app decides
where data comes from. Components and hooks depend on that interface; nothing
outside `src/data/` imports `firebase/*`. Both backends
(`firestoreBackend.js`, `mockBackend.js`) implement the same shape, and adding a
method to one means adding it to the other.

**The mock backend must never ship.** `shouldUseMockData()` returns false for any
production build and is deliberately not overridable. `import.meta.env.PROD`
folds the mock branch away at build time, and `scripts/verify-build.mjs` fails
the build if a mock artefact survives into `dist`. Keep that script's needles
accurate if you rename mock things.

**`firestore.rules` is the authorization model, not a formality.** Nothing in the
client stops a hand-rolled SDK call, so every access decision lives in the rules
and is tested against a real emulator in `rules-tests/`. A change to who can see
or write what is a rules change first and a UI change second.

## Data model

```
families/{fid}                     name, createdBy, parentUids[], parents{uid:{...}}
  children/{cid}                   name, createdAt
    transactions/{tid}             amountMinor, comment, category, user, userName,
                                   timestamp, editedBy?, editedByName?, editedAt?
invites/{email}                    familyId, invitedByName     - keyed by address
pairings/{code}                    familyId, childId, expiresAt - keyed by the secret
devices/{uid}                      familyId, childId, code      - keyed by anon uid
```

A pairing code is reused while it is still live rather than minted on every
open: the pairing dialog doubles as the revoke-a-device screen, so minting per
open would leave a working code behind every time somebody came to take access
away.

Membership is an **array on the family document**, not a subcollection - see the
batched-write trap below for why.

`invites`, `pairings` and `devices` are all top-level and keyed by something
known before the person or device has an identity. That is the recurring shape:
you cannot name a uid that does not exist yet, so you key by what you do know
(an email, a spoken code) and trade it for a durable record.

## Two traps this codebase has already hit

**Rules evaluate a batched write against the state from *before* the batch.**
This has bitten the design twice:

1. Family membership cannot live in a subcollection written alongside a new
   family, because the membership document could not verify the family it
   belonged to - which would have let anyone make themselves a parent of any
   family. Hence `parentUids` on the family document.
2. A pairing's `delete` cannot be restricted to "the device that just paired",
   because the `devices/{uid}` document created in the same batch does not exist
   yet when the delete is checked. The delete is widened to any signed-in caller
   who can name the code; the comment in `firestore.rules` explains the trade.

If a rule needs to see a document another write in the same request creates, it
cannot, and no amount of reordering fixes it.

**A device's authority never outlives its child.** `deleteChild` removes the
child's transactions, its paired devices and its unredeemed pairing codes, but
that is several separate commits and a closed tab can interrupt it. So the rules
check it too: `devicePointsAtLiveChild()` requires `children/{cid}` to still
exist before a device may read anything. Cleanup code is the optimisation; the
rule is the guarantee.

**Ledger handles must keep a stable identity.** `backend.ledgerFor(fid, cid)` is
cached in both backends. Components subscribe in an effect keyed on the ledger
object, so returning a fresh object per call made every render of an ancestor
tear down and re-establish one Firestore listener per child - re-reading, and
re-paying for, the whole collection every time a dialog opened. Regression tests
live in both backend test files.

## Screen transitions

There is no router. `App` picks a screen from state, and two rules keep that
honest:

- **A step is held open by intent, not by the condition that opened it.** The
  add-children step is held by `addingChildren`, not by `children.length === 0`
  — that was the bug: the first child arriving made the condition false and
  ejected the parent mid-flow, before Done had ever rendered. The count only
  suppresses a one-frame flash of an empty dashboard.
- **Anything reachable from the family view pushes a history entry, and leaves
  by unwinding it.** That covers the child ledger and the add-children step.
  The on-screen button calls `window.history.back()` too, so the button and the
  phone's back gesture cannot disagree. Screens that are *not* reachable from
  the family view (intro, naming a family, accepting an invite) push nothing.

Closing the step is what re-runs the effect that opens it, so a family with no
children cannot be escaped into an empty dashboard. `src/App.test.jsx` drives
these through the real mock backend.

## Shared pieces, and when to reach for them

Four things exist because a third copy showed up. Use them rather than writing
a fourth:

- `hooks/useLive.js` — `useLiveDoc` / `useLiveList`. Every "subscribe while the
  ids are known, reset when they are not" hook is one line on top of these.
  `useDevice` and `useTransactions` are deliberately *not*, because they must
  distinguish "nothing here" from "still loading".
- `components/Modal.jsx` — overlay, Escape, and the head/body/foot frame, with
  the accessibility details in one place. `dismissible={false}` gives the
  alertdialog shape.
- `components/RevocableList.jsx` — a labelled list where each row has one
  destructive control. Pending invites, unused codes, paired devices.
- `data/pairing.js` — the code alphabet, TTL, normalization and failure
  taxonomy, shared by both backends and both sides of the UI.

`components/ChildApp.jsx` holds the whole child persona, so its subscriptions
open only for a child session and `App` does not carry both graphs at once.

## Personas

A parent signs in with Google; a child's device signs in **anonymously** and
stays that way. Anonymity is the entire signal, and the rules key on the same
thing - a child session has no email, so it cannot satisfy any rule that writes
to a ledger. Client and server therefore agree by construction.

What a child session may *see* comes from its `devices/{uid}` record, never from
the session. `src/data/roles.js` answers "which persona", `useDevice` answers
"which ledger".

In dev, the mock banner switches between parent, paired child, and unpaired
child without any real account.

## Testing

Two suites, deliberately separate:

- **`yarn test`** - unit and component tests under `src/`. Fast, offline, no
  emulator. Hooks take their backend as an argument so tests pass in a double
  (`src/test/fakeBackend.js`) rather than mocking modules.
- **`yarn test:rules`** - `rules-tests/` against the Firestore emulator. Slower
  and needs Java. This is the only place authorization is actually verified.

`src/data/categories.rules.test.js` is a third thing: the category enum exists
in both JS and the rules file and cannot be shared, so a test greps the rules to
prove they have not drifted. Add a category in both places.

## Conventions

- Comments explain **why**, not what. The existing ones are load-bearing
  documentation of decisions - match that register rather than narrating code.
- Indentation is 4 spaces in `src/components/` and `src/App.jsx`, 2 spaces
  everywhere else (`data/`, `hooks/`, `utils/`, `analytics/`). Follow the file
  you are in.
- Components are named exports, arrow functions, `.jsx`.
- No CSS framework. `src/styles.css` is a hand-authored design system with
  tokens at the top and a working dark mode; add to it rather than inlining
  styles beyond one-off spacing.
- Green means coins in, violet means coins out, throughout.
