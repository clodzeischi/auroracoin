import { useState } from 'react';
import { CoinCount } from './CoinCount.jsx';
import { CoinDashboard } from './CoinDashboard.jsx';
import { CoinTable } from './CoinTable.jsx';
import { CoinForm } from './CoinForm.jsx';
import { isChild } from '../data/roles.js';

/**
 * One child's account: the page this app has always been, now scoped to a
 * child. The add control lives here rather than in the header, because a
 * transaction cannot exist without knowing whose ledger it belongs to.
 */
export const ChildLedger = ({ child, ledger, user, onBack }) => {
    const [adding, setAdding] = useState(false);
    const readOnly = isChild(user);

    return (
        <main>
            <div className="ledger-head">
                {onBack ? (
                    <button type="button" className="back-link" onClick={onBack}>
                        ← All accounts
                    </button>
                ) : <span />}
                {!readOnly && (
                    <button className="btn btn-primary" onClick={() => setAdding(true)}>
                        Add transaction
                    </button>
                )}
            </div>

            <CoinCount ledger={ledger} label={child ? `${child.name}'s balance` : 'Total balance'} />
            <CoinDashboard backend={ledger} />
            <CoinTable backend={ledger} user={user} />

            {!readOnly && (
                <CoinForm
                    isOpen={adding}
                    toggle={() => setAdding(false)}
                    user={user}
                    backend={ledger}
                />
            )}
        </main>
    );
};
