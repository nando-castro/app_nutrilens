import { useEffect, useMemo, useState } from "react";
import { clearAuthSession, getAuthToken, getAuthUser } from "./auth/auth.api";
import { LoginScreen } from "./auth/LoginScreen";
import { RegisterScreen } from "./auth/RegisterScreen";
import { AppShell } from "./layout/AppShell";
import { FoodAnalyzeScreen } from "./meals/FoodAnalyzeScreen";
import { MealsHistoryScreen } from "./meals/MealsHistoryScreen";
import type { SavedMeal, Screen, User } from "./types";

type LoggedScreen = Extract<Screen, "analyze" | "history">;

const LS_LAST_SCREEN_KEY = "nutrilens:lastScreen";

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("login");
  const [user, setUser] = useState<User | null>(null);
  const [meals, setMeals] = useState<SavedMeal[]>([]);

  // Reidrata sessão no reload
  useEffect(() => {
    const token = getAuthToken();
    const savedUser = getAuthUser();

    if (token && savedUser) {
      setUser(savedUser);

      const last = localStorage.getItem(LS_LAST_SCREEN_KEY) as Screen | null;
      if (last === "history" || last === "analyze") setCurrentScreen(last);
      else setCurrentScreen("analyze");
    }
  }, []);

  // Persiste última tela logada
  useEffect(() => {
    if (!user) return;
    if (currentScreen === "analyze" || currentScreen === "history") {
      localStorage.setItem(LS_LAST_SCREEN_KEY, currentScreen);
    }
  }, [currentScreen, user]);

  const loggedScreen: LoggedScreen = useMemo(() => {
    if (currentScreen === "analyze" || currentScreen === "history")
      return currentScreen;
    return "analyze";
  }, [currentScreen]);

  function handleLogin(userData: User) {
    setUser(userData);
    setCurrentScreen("analyze");
  }

  function handleRegister(userData: User) {
    setUser(userData);
    setCurrentScreen("analyze");
  }

  function handleLogout() {
    clearAuthSession(); // limpa token + user do storage
    localStorage.removeItem(LS_LAST_SCREEN_KEY);

    setUser(null);
    setMeals([]);
    setCurrentScreen("login");
  }

  function handleSaveMeal(meal: SavedMeal) {
    setMeals((prev) => [meal, ...prev]);
    setCurrentScreen("history");
  }

  // 1) TELA DE CADASTRO
  if (!user && currentScreen === "register") {
    return (
      <RegisterScreen
        onBackToLogin={() => setCurrentScreen("login")}
        onRegister={handleRegister}
      />
    );
  }

  // 2) TELA DE LOGIN
  if (!user) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onGoToRegister={() => setCurrentScreen("register")}
      />
    );
  }

  // 3) ÁREA LOGADA
  return (
    <AppShell
      user={user}
      currentScreen={loggedScreen}
      onChangeScreen={(s) => setCurrentScreen(s)}
      onLogout={handleLogout}
    >
      {loggedScreen === "analyze" && (
        <FoodAnalyzeScreen user={user} onSaveMeal={handleSaveMeal} />
      )}

      {loggedScreen === "history" && <MealsHistoryScreen meals={meals} />}
    </AppShell>
  );
}

export default App;
