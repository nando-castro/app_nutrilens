// src/components/layout/BottomNav.tsx
import type { Screen } from "../types";

type Props = {
  currentScreen: Screen;
  onChangeScreen: (screen: Screen) => void;
};

export function BottomNav({ currentScreen, onChangeScreen }: Props) {
  const isAnalyze = currentScreen === "analyze";
  const isHistory = currentScreen === "history";

  return (
    <nav
      style={{
        marginTop: 16,
        paddingTop: 10,
        borderTop: "1px solid rgba(31,41,55,0.9)",
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <button
        type="button"
        className="button secondary"
        style={{
          flex: 1,
          borderRadius: 999,
          background: isAnalyze ? "var(--accent-soft)" : "transparent",
          borderColor: isAnalyze ? "var(--accent)" : "var(--border)",
        }}
        onClick={() => onChangeScreen("analyze")}
      >
        Analisar refeição
      </button>

      <button
        type="button"
        className="button secondary"
        style={{
          flex: 1,
          borderRadius: 999,
          background: isHistory ? "var(--accent-soft)" : "transparent",
          borderColor: isHistory ? "var(--accent)" : "var(--border)",
        }}
        onClick={() => onChangeScreen("history")}
      >
        Histórico
      </button>
    </nav>
  );
}
