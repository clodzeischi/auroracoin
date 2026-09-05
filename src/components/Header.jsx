import {Button, Navbar, NavbarBrand} from "reactstrap";
import {useState} from "react";
import {CoinForm} from "./CoinForm.jsx";

export const Header = ({user, loading, login, logout}) => {

    const [modalOpen, setModalOpen] = useState(false);

    return (
        <>
            <Navbar color="light">
                <NavbarBrand href="/">
                    <img className='mx-2' alt="logo" src="/favicon.ico" style={{height: 40, width: 40}}/>
                    AuroraCoin
                </NavbarBrand>
                {/* While auth is resolving, render nothing rather than flashing
                    a Login button at someone who is already signed in. */}
                { loading ? null : user ? (
                    <>
                        <Button color='primary' onClick={() => {setModalOpen(true)}}>Add item</Button>
                        <Button color='secondary' onClick={logout}>Logout</Button>
                    </>

                ) : (
                    <Button color='secondary' onClick={login}>Login with Google</Button>
                )}
            </Navbar>
            <CoinForm isOpen={modalOpen} toggle={ () => {setModalOpen(!modalOpen)}} user={user} />
        </>
    )
}
