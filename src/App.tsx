import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Game from './pages/Game';
import Teacher from './pages/Teacher';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/game" element={<Game />} />
          <Route path="/teacher" element={<Teacher />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
