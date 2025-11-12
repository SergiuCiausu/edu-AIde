import { Routes, Route } from "react-router-dom";
import Home from "./assets/Home";
import "./App.css";

function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </div>
  );
}

export default App;
