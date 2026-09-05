import {useState} from "react";
import {CoinForm} from "./CoinForm.jsx";

export const Header = ({user, loading, login, logout}) => {

    const [modalOpen, setModalOpen] = useState(false);

    return (
        <>
            <header className="header">
                <a className="brand" href="/">
                    <img alt="" src="/favicon.ico" />
                    <span>AuroraCoin</span>
                </a>
                <div className="header-actions">
                    {/* While auth is resolving, render nothing rather than flashing
                        a sign-in button at someone who is already signed in. */}
                    {loading ? null : user ? (
                        <>
                            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                                Add transaction
                            </button>
                            <button className="btn btn-quiet" onClick={logout}>Sign out</button>
                        </>
                    ) : (
                        <button className="btn btn-quiet" onClick={login}>Sign in with Google</button>
                    )}
                </div>
            </header>
            <CoinForm
                isOpen={modalOpen}
                toggle={() => setModalOpen(!modalOpen)}
                user={user}
            />
        </>
    )
}
