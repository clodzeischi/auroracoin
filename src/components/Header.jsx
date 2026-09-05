import {useState} from "react";
import {CoinForm} from "./CoinForm.jsx";
import {isChild} from "../data/roles.js";

export const Header = ({user, loading, login, logout}) => {

    const [modalOpen, setModalOpen] = useState(false);
    const child = isChild(user);

    return (
        <>
            <header className="header">
                <a className="brand" href="/">
                    <img alt="" src="/favicon.ico" />
                    <span>AuroraCoin</span>
                </a>
                <div className="header-actions">
                    {/* A child gets no auth controls. Her session is anonymous:
                        signing out would destroy the device pairing for good,
                        and signing in would replace it. Neither is offered.
                        While auth is still resolving, render nothing rather
                        than flashing a sign-in button at someone signed in. */}
                    {loading || child ? null : user ? (
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
            {!child && (
                <CoinForm
                    isOpen={modalOpen}
                    toggle={() => setModalOpen(!modalOpen)}
                    user={user}
                />
            )}
        </>
    )
}
