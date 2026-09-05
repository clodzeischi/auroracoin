# AuroraCoin

An allowance tracker shaped like a bank account you actually hold. You record
what your child earns and spends; they get a real balance, a history they can
look through, and a feel for how a balance sheet works. The money stays in your
pocket - when they want something, you pay and withdraw it from their account.

## Running it

```bash
yarn
yarn dev
```

That's it. The dev server runs against in-memory mock data by default, so it
needs no `.env`, no Firebase project and no network. A banner across the top
makes the mock obvious and switches between the parent and child views.

To run against real Firestore, copy `.env.example` to `.env`, fill it in with

```bash
firebase apps:sdkconfig web <APP_ID>
```

and set `VITE_USE_MOCK_DATA=false`. A production build always uses real
Firestore regardless of the flag.

### Two sign-in providers have to be enabled

In the Firebase console, under **Authentication → Sign-in method**, enable both:

- **Google** — how a parent signs in.
- **Anonymous** — how a child's device signs in. Without it `signInAnonymously`
  returns `auth/admin-restricted-operation` and pairing a child's device cannot
  start at all.

Anonymous sessions are not a hole in the model: an anonymous user that has not
redeemed a pairing code can read nothing, which `rules-tests/` asserts
directly. A device may only ever see the one child its `devices/{uid}` record
names, and only while that child exists.

## How it works

Parents sign in with Google and can invite a second parent by email. A child's
device signs in anonymously and is paired by typing a short code the parent
reads out; from then on it sees exactly one child's ledger, read-only.

Money is stored as an integer number of hundredths, never a float, so a balance
cannot drift a penny out. Access is enforced by `firestore.rules`, which is
tested against the Firestore emulator rather than assumed.

## Commands

| | |
|---|---|
| `yarn dev` | dev server, mock data |
| `yarn test` | unit and component tests |
| `yarn test:rules` | security rules, against the emulator (needs Java) |
| `yarn build` | production bundle |
| `yarn verify` | everything above, plus a check that no mock data reached the bundle |

`yarn verify` is the gate before deploying.

## Deploying

```bash
yarn verify
npx firebase deploy
```

Hosting serves `dist`; `firestore.rules` deploys with it.
