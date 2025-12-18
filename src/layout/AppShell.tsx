import { useEffect, useMemo, useState } from "react";
import type { Screen, User } from "../types";

type Props = {
  user: User;
  currentScreen: Extract<Screen, "analyze" | "history">;
  onChangeScreen: (screen: Screen) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

type NavItem = {
  id: Extract<Screen, "analyze" | "history">;
  label: string;
  icon: string; // mantém seus ícones atuais
};

const NAV_ITEMS: NavItem[] = [
  { id: "analyze", label: "Analisar refeição", icon: "🍽️" },
  { id: "history", label: "Histórico", icon: "📅" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppShell({
  user,
  currentScreen,
  onChangeScreen,
  onLogout,
  children,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const firstName = useMemo(
    () => user.name?.split(" ")[0] ?? "Usuário",
    [user.name]
  );

  function handleNavClick(id: NavItem["id"]) {
    onChangeScreen(id);
    setMobileOpen(false);
  }

  // ESC fecha drawer
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // trava scroll quando drawer está aberto
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* SIDEBAR DESKTOP (branco, estilo imagem 1) */}
      <aside className="hidden md:flex w-[280px] bg-white border-r border-slate-200 p-4 flex-col justify-between sticky top-0 h-screen">
        <div>
          <div className="flex items-center gap-3 px-1 pb-4">
            <div className="h-10 w-10 grid place-items-center rounded-xl border border-blue-100 bg-blue-50 text-base">
              🍽️
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-[18px]">Nutrilens</div>
              <div className="text-[12px] text-slate-500 mt-1">
                Painel de Refeições
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => {
              const active = currentScreen === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition",
                    "active:translate-y-[1px]",
                    active
                      ? "bg-blue-600 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <span className="w-[22px] grid place-items-center text-base">
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className={cn(
            "mt-auto pt-4", // opcional: cria respiro antes
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl",
            "border border-slate-200 bg-white",
            "text-red-600 font-bold transition",
            "hover:bg-red-50 hover:border-red-200 active:translate-y-[1px]"
          )}
        >
          <span className="w-[22px] grid place-items-center text-base">⏏</span>
          <span>Sair</span>
        </button>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOPBAR */}
        <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* botão menu mobile */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              className={cn(
                "md:hidden h-10 w-10 rounded-xl border border-slate-200 bg-white",
                "grid place-items-center transition hover:bg-slate-100 active:translate-y-[1px]"
              )}
            >
              {/* hamburger */}
              <div className="grid gap-1">
                <span className="h-[2px] w-[18px] bg-slate-700 rounded-full" />
                <span className="h-[2px] w-[18px] bg-slate-700 rounded-full" />
                <span className="h-[2px] w-[18px] bg-slate-700 rounded-full" />
              </div>
            </button>

            <div className="min-w-0">
              <div className="font-extrabold text-sm text-slate-900">
                Painel de refeições
              </div>
              <div className="text-xs text-slate-500 truncate max-w-[70vw]">
                Acompanhe as calorias das suas refeições do dia.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-slate-200 bg-white">
              <div className="h-7 w-7 rounded-full bg-slate-900 text-white grid place-items-center font-extrabold text-xs">
                {firstName.charAt(0).toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="text-xs font-extrabold">{firstName}</div>
              </div>
            </div>
          </div>
        </header>

        {/* CONTEÚDO */}
        <main className="p-4">{children}</main>
      </div>

      {/* OVERLAY + DRAWER (mobile) */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          "transition-opacity duration-200",
          "motion-reduce:transition-none",
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      >
        {/* overlay escuro */}
        <div
          className={cn(
            "absolute inset-0 bg-slate-900/45 transition-opacity duration-300 ease-out",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
        />

        {/* drawer */}
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute left-0 top-0 h-full w-[280px] bg-white border-r border-slate-200 p-4 shadow-2xl",
            "flex flex-col",
            "transform transition-transform duration-300 ease-out will-change-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 grid place-items-center rounded-xl border border-blue-100 bg-blue-50">
                🍽️
              </div>
              <div className="font-extrabold text-[18px]">Nutrilens</div>
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
              className={cn(
                "h-10 w-10 rounded-xl border border-slate-200 bg-white",
                "grid place-items-center transition hover:bg-slate-100 active:translate-y-[1px]"
              )}
            >
              ✕
            </button>
          </div>

          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => {
              const active = currentScreen === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition",
                    "active:translate-y-[1px]",
                    active
                      ? "bg-blue-600 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <span className="w-[22px] grid place-items-center text-base">
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={onLogout}
            className={cn(
              "mt-auto w-full flex items-center gap-3 px-3 py-2 rounded-xl",
              "border border-slate-200 bg-white",
              "text-red-600 font-bold transition",
              "hover:bg-red-50 hover:border-red-200 active:translate-y-[1px]"
            )}
          >
            <span className="w-[22px] grid place-items-center text-base">
              ⏏
            </span>
            <span>Sair</span>
          </button>
        </aside>
      </div>
    </div>
  );
}
