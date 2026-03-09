//import RegisterForm from './components/RegisterForm';
//import reactLogo from './assets/react.svg'
/*
function App() {
  return (
    <div className="App">
      <RegisterForm />
    </div>
  );
}*/ 
// THIS WAS THE PREVIOUS, I KEEP IT JUST IN CASE.

import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import GamePage from "./pages/GamePage";
import RegisterScreen from "./components/RegisterForm";
import GameSelectionScreen from "./components/GameSelectionScreen";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/register" element={<RegisterScreen />} />
      <Route path="/gamey" element={<GamePage />} />
      <Route path="/gameSelection" element={<GameSelectionScreen/>}/>
    </Routes>
  );
}

 
export default App;
