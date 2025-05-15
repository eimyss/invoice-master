import React from "react";
import AppRouter from "./router"; // Ensure this path is correct
import { AuthProvider } from "./contexts/AuthContext"; // Ensure this path is correct
import "./index.css"; // Import Tailwind CSS
import { NotificationProvider } from './context/NotificationContext';
import NotificationContainer from './components/Notification/NotificationContainer';

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
      <NotificationContainer />
    </NotificationProvider>
  );
}

export default App;
