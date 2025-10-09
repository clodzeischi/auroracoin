import {Header} from "./components/Header.jsx";
import {CoinCount} from "./components/CoinCount.jsx";
import {CoinTable} from "./components/CoinTable.jsx";
import {useAuth} from "./hooks/useAuth.js";

export const App = () => {

    const { user, login, logout } = useAuth();

    return (
        <div  style={{maxWidth: '1000px', margin: '0 auto'}}>
            <Header user={user} login={login} logout={logout}/>
            <CoinCount count={5}/>
            {user && <CoinTable />}
        </div>
    )
}