export const Intro = ({ onSignIn, onPairDevice }) => (
    <main className="intro">
        <h1 className="intro-title">A bank account for your kid<br />that you actually hold.</h1>

        <div className="intro-body">
            <p>
                AuroraCoin is an allowance tracker that works like a virtual bank
                account. When your child earns money, you add it to their balance.
                When they want something at a store, you pay with your card and
                withdraw the amount from their account.
            </p>
            <p>
                You keep physical control of the money. They get a real balance, a
                history they can look through, and a sense of how a balance sheet
                works.
            </p>
        </div>

        <div className="intro-actions">
            <button className="btn btn-primary btn-lg" onClick={onSignIn}>
                Sign in with Google
            </button>
            <p className="intro-note">
                New here or coming back — same button. We'll set you up if it's your
                first time.
            </p>
        </div>

        <p className="intro-pair">
            Setting up a child's device?{' '}
            <button type="button" className="link-btn link-inline" onClick={onPairDevice}>
                Pair it with a code
            </button>
        </p>
    </main>
);
