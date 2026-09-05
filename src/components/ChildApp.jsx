import { ChildLedger } from './ChildLedger.jsx';
import { PairDevice } from './PairDevice.jsx';
import { useDevice } from '../hooks/useDevice.js';
import { useChild } from '../hooks/useChild.js';

/**
 * Everything a child's device is, and everything it can do.
 *
 * Held apart from App so the two personas do not interleave: the subscriptions
 * a child needs live here and open only when this renders, rather than sitting
 * in App behind a null guard that has to be kept in step with a branch fifty
 * lines further down.
 */
export const ChildApp = ({ backend, user, onExit }) => {
    const { device, loading } = useDevice(backend, user.uid);
    // Null until the device has a pairing to read a child from.
    const child = useChild(backend, device?.familyId ?? null, device?.childId ?? null);

    // The paired and unpaired screens look nothing alike, so neither is shown
    // until the device record has actually been read.
    if (loading) return <p className="state">Loading…</p>;

    if (!device) {
        return (
            <PairDevice
                onPair={(code) => backend.redeemPairingCode(code, user.uid)}
                onCancel={onExit}
            />
        );
    }

    return (
        <ChildLedger
            child={child}
            ledger={backend.ledgerFor(device.familyId, device.childId)}
            user={user}
        />
    );
};
