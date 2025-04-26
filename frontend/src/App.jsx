import React from "react";
import AppRouter from "./router"; // Ensure this path is correct
import { AuthProvider } from "./contexts/AuthContext"; // Ensure this path is correct
import "./index.css"; // Import Tailwind CSS

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
