import { Route, Routes } from "react-router-dom";
import HomePage from "./routes/HomePage";
import DesignPage from "./routes/DesignPage";
import EditorPage from "./routes/EditorPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/design" element={<DesignPage />} />
      <Route path="/editor" element={<EditorPage />} />
    </Routes>
  );
}
