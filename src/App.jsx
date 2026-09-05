import {Header} from "./components/Header.jsx";
import {CoinCount} from "./components/CoinCount.jsx";
import {CoinTable} from "./components/CoinTable.jsx";
import {MockDataBanner} from "./components/MockDataBanner.jsx";
import {useAuth} from "./hooks/useAuth.js";

export const App = () => {

    const { user, loading, login, logout } = useAuth();

    return (
        <div  style={{maxWidth: '1000px', margin: '0 auto'}}>
            <MockDataBanner />
            <Header user={user} loading={loading} login={login} logout={logout}/>
            <CoinCount/>
            {user && <CoinTable />}
        </div>
    )
}
