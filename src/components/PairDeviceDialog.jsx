import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal.jsx';
import { RevocableList } from './RevocableList.jsx';
import { PAIRING_TTL_MINUTES } from '../data/pairing.js';

const pairedOn = (date) =>
    date instanceof Date
        ? `paired ${date.getDate()} ${date.toLocaleDateString(undefined, { month: 'long' })}`
        : 'paired';

const isLive = (pairing) => !pairing.expiresAt || pairing.expiresAt > new Date();

/**
 * The parent's half of pairing: make a code, read it out, and see what is
 * already paired. Codes and devices are listed together because they are the
 * same question asked twice - what can currently open this child's ledger.
 *
 * The dialog owns the code rather than being handed one, because whether a
 * code is needed at all is its question to ask: this is also the screen a
 * parent opens to revoke a device, and minting on every open would leave a
 * live code behind each time somebody came here to take one away.
 */
export const PairDeviceDialog = ({
    child, devices = [], pairings = [], onCreateCode, onCancelCode, onUnpair, onClose,
}) => {
    const [made, setMade] = useState(null);
    const [error, setError] = useState(null);
    const asked = useRef(false);

    const live = pairings.filter(isLive);
    const reusable = live.find((pairing) => pairing.code !== made) ?? null;
    const code = made ?? reusable?.code ?? null;

    useEffect(() => {
        // At most one request per opening, whatever the identity of the props.
        if (asked.current || reusable) return;
        asked.current = true;

        let abandoned = false;
        Promise.resolve()
            .then(onCreateCode)
            .then((fresh) => {
                if (!abandoned) setMade(fresh);
            })
            .catch(() => {
                if (!abandoned) setError('Could not make a code. Please try again.');
            });
        return () => {
            abandoned = true;
        };
    }, [reusable, onCreateCode]);

    const spares = live
        .filter((pairing) => pairing.code !== code)
        .map((pairing) => ({
            id: pairing.code,
            label: pairing.code,
            labelClassName: 'code-inline',
            actionLabel: `Cancel code ${pairing.code}`,
        }));

    return (
        <Modal
            title={`Pair a device for ${child.name}`}
            titleId="pair-title"
            onClose={onClose}
            foot={<button className="btn btn-quiet" onClick={onClose}>Done</button>}
        >
            {error ? (
                <div role="alert" className="alert">{error}</div>
            ) : !code ? (
                <p className="state">Making a code…</p>
            ) : (
                <>
                    <p className="code-display" aria-label={`Pairing code ${[...code].join(' ')}`}>
                        {code}
                    </p>
                    <p className="field-hint code-expiry">
                        Expires within {PAIRING_TTL_MINUTES} minutes, and works once.
                    </p>
                    <ol className="pair-steps">
                        <li>On the child's device, open <strong>{window.location.host}</strong></li>
                        <li>Tap <strong>Set up a child's device</strong></li>
                        <li>Type this code</li>
                    </ol>
                </>
            )}

            <RevocableList
                label="Other unused codes"
                items={spares}
                onRevoke={onCancelCode}
            />

            <RevocableList
                label={`Devices paired to ${child.name}`}
                action="Unpair"
                items={devices.map((device) => ({
                    id: device.id,
                    label: pairedOn(device.pairedAt),
                    actionLabel: `Unpair this device from ${child.name}`,
                }))}
                onRevoke={onUnpair}
            />
        </Modal>
    );
};
