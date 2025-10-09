import { useEffect, useState } from 'react';
import { auth, provider } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

export const useAuth = () => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, setUser);
        return () => unsubscribe();
    }, []);

    const login = () => signInWithPopup(auth, provider);
    const logout = () => signOut(auth);

    return { user, login, logout };
}
