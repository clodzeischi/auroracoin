import {Header} from "./components/Header.jsx";
import {CoinCount} from "./components/CoinCount.jsx";
import {CoinTable} from "./components/CoinTable.jsx";
import {CoinDashboard} from "./components/CoinDashboard.jsx";
import {MockDataBanner} from "./components/MockDataBanner.jsx";
import {useAuth} from "./hooks/useAuth.js";

export const App = () => {

    const { user, loading, login, logout } = useAuth();

    return (
        <>
            <MockDataBanner />
            <div className="shell">
                <Header user={user} loading={loading} login={login} logout={logout}/>
                <CoinCount/>
                <CoinDashboard />
                {user && <CoinTable />}
            </div>
        </>
    )
}
