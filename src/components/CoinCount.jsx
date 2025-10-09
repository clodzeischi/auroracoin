import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export const CoinCount = () => {
    const [totalCoins, setTotalCoins] = useState(0);

    useEffect( () => {
        const unsubscribe = onSnapshot(collection(db, 'transactions'), snapshot => {
            let total = 0;
            snapshot.forEach(doc => {
                total += doc.data().amount;
            });
            setTotalCoins(total);
        });

        return () => unsubscribe(); // cleanup on unmount
    }, []);

    return (
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', padding: '1rem' }}>
            Total Coins: {totalCoins}
        </div>
    );
}
