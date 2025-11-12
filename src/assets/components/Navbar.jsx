import { useState } from "react";
import { Link } from "react-router-dom";

const Navbar = ({ isLoggedIn, email, setUser, setIsLoggedIn }) => {
  const apiUrl = import.meta.env.VITE_API_URL;

  const [isAccountClicked, setIsAccountClicked] = useState(false);

  const handleLogInBtnClick = () => {
    window.location.href = `${apiUrl}/login`;
  };

  const handleSignInBtnClick = () => {
    window.location.href = `${apiUrl}/sign-in`;
  };

  const handleLogoutBtnClick = async () => {
    try {
      const res = await fetch(`${apiUrl}/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        setUser(null);
        setIsLoggedIn(false);
        window.location.href = "/";
      }
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <div className="navbar-container">
      <div>
        <Link to="/" className="default-text">
          FakeOrReal
        </Link>
      </div>
      {isLoggedIn ? (
        <div className="account-big-container">
          <button className="account-container" onClick={() => setIsAccountClicked((prev) => !prev)}>
            <img src="/user.svg" alt="user-icon" className="w-4" />
            <div className="account-information-container">
              <p className="default-text">{email ? email : ""}</p>
              <img src="/angle-small-down.svg" alt="dropdown-icon" className={`w-4 ${isAccountClicked ? "dropdown-opened" : ""}`} />
            </div>
          </button>
          {isAccountClicked ? (
            <button className="logout-btn" onClick={handleLogoutBtnClick}>
              <p className="default-text">Log out</p>
            </button>
          ) : (
            ""
          )}
        </div>
      ) : (
        <div className="nav-btn-container">
          <button className="btn-container log-in-btn" onClick={handleLogInBtnClick}>
            Log In
          </button>
          <button className="btn-container sign-in-btn" onClick={handleSignInBtnClick}>
            Sign In
          </button>
        </div>
      )}
    </div>
  );
};

export default Navbar;
