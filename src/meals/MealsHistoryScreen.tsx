// src/meals/MealsHistoryScreen.tsx
import { fetchAuth } from "@/auth/auth.api";
import { useEffect, useMemo, useState } from "react";
import type { MealType, SavedMeal, SavedMealItem } from "../types";

interface Props {
  // agora o histórico não depende mais do estado em memória
  // (isso resolve o problema do reload)
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  snack: "Lanche",
  dinner: "Jantar",
  supper: "Ceia",
  other: "Outro",
};

function todayISODate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Se por algum motivo calories vier 0, recalcula pelo padrão
function getItemCalories(kcalPer100g: number, grams: number, calories: number) {
  if (calories && calories > 0) return Math.round(calories);
  return Math.round((kcalPer100g * grams) / 100);
}

// Usa totalCalories se vier preenchido; senão soma dos itens
function getMealTotalCalories(meal: SavedMeal) {
  if (meal.totalCalories && meal.totalCalories > 0) {
    return Math.round(meal.totalCalories);
  }

  return meal.items.reduce(
    (acc, it) => acc + getItemCalories(it.kcalPer100g, it.grams, it.calories),
    0
  );
}

function formatDateTime(meal: SavedMeal) {
  const date = new Date(meal.dateTime || meal.createdAt);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(meal: SavedMeal) {
  const date = new Date(meal.dateTime || meal.createdAt);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function normalizeMealType(v: string): MealType {
  const s = String(v || "").toLowerCase();
  const allowed: MealType[] = [
    "breakfast",
    "lunch",
    "snack",
    "dinner",
    "supper",
    "other",
  ];
  return allowed.includes(s as MealType) ? (s as MealType) : "other";
}

export function MealsHistoryScreen({}: Props) {
  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(todayISODate());
  const [openedMeal, setOpenedMeal] = useState<SavedMeal | null>(null);

  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ====== API types (sem any) ======
  type MealItemApi = {
    id: string;
    name: string;
    grams: number;
    caloriesPer100g: number;
    calories: number;
    confidence: number | null;
    source: "VISION" | "MANUAL" | "vision" | "manual";
  };

  type MealApi = {
    id: string;
    userId: string;
    type: string; // meal type
    takenAt: string;
    createdAt?: string;
    totalCalories: number;
    imagePath?: string | null;
    items: MealItemApi[];
  };

  function mapApiMealToSavedMeal(m: MealApi): SavedMeal {
    const items: SavedMealItem[] = (m.items ?? []).map((it) => ({
      id: String(it.id),
      name: String(it.name),
      grams: Number(it.grams) || 0,
      kcalPer100g: Number(it.caloriesPer100g) || 0,
      calories: Number(it.calories) || 0,
      confidence: it.confidence ?? undefined,
      source:
        String(it.source).toLowerCase() === "vision" || it.source === "VISION"
          ? "vision"
          : "manual",
    }));

    return {
      id: String(m.id),
      userId: String(m.userId),
      mealType: normalizeMealType(m.type),
      dateTime: new Date(m.takenAt).toISOString(),
      createdAt: new Date(m.createdAt ?? m.takenAt).toISOString(),
      totalCalories: Number(m.totalCalories) || 0,
      photoUrl: m.imagePath ? `${API_BASE_URL}${m.imagePath}` : undefined,
      items,
    };
  }

  async function loadMealsByDay(dateIso: string) {
    setLoading(true);
    setError(null);

    try {
      const resp = await fetchAuth(`${API_BASE_URL}/meals?date=${dateIso}`, {
        method: "GET",
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Erro ao carregar histórico.");
      }

      const data = (await resp.json()) as MealApi[];
      const mapped = data.map(mapApiMealToSavedMeal);

      mapped.sort(
        (a, b) =>
          new Date(b.dateTime || b.createdAt).getTime() -
          new Date(a.dateTime || a.createdAt).getTime()
      );

      setMeals(mapped);
    } catch (e) {
      setMeals([]);
      setError(e instanceof Error ? e.message : "Falha ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(mealId: string) {
    try {
      const resp = await fetchAuth(`${API_BASE_URL}/meals/${mealId}`, {
        method: "DELETE",
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Erro ao excluir refeição.");
      }

      setMeals((prev) => prev.filter((m) => m.id !== mealId));
      setOpenedMeal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao excluir refeição.");
    }
  }

  useEffect(() => {
    if (selectedDate) loadMealsByDay(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return meals;

    return meals.filter((m) => {
      const label = (MEAL_TYPE_LABEL[m.mealType] ?? "Refeição").toLowerCase();
      const itemsText = m.items
        .map((i) => i.name)
        .join(" ")
        .toLowerCase();
      return label.includes(q) || itemsText.includes(q);
    });
  }, [meals, query]);

  // ====== NOVO: soma diária para a data selecionada (usa a lista sem filtro de texto) ======
  const dailyTotalCalories = useMemo(() => {
    return meals.reduce((acc, m) => acc + getMealTotalCalories(m), 0);
  }, [meals]);

  // ====== NOVO: opcional — soma do que está filtrado por texto (se quiser exibir também) ======
  const filteredTotalCalories = useMemo(() => {
    return filtered.reduce((acc, m) => acc + getMealTotalCalories(m), 0);
  }, [filtered]);

  return (
    <section className="max-w-6xl mx-auto w-full">
      {/* Header + filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            Histórico de refeições
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Filtre por dia, busque por texto e clique para ver os detalhes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-44">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none
                         placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25"
            />
          </div>

          <div className="w-full sm:w-64">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Buscar
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: almoço, arroz, frango..."
              className="w-full rounded-xl border border-slate-200 bg-blue-50 px-3 py-2 text-sm text-slate-900 outline-none
                         placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25"
            />
          </div>
        </div>
      </div>

      {/* ====== NOVO: cartão de resumo do dia ====== */}
      <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-600">
              Total de calorias do dia{" "}
              <span className="font-bold text-slate-800">
                {selectedDate
                  ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                      "pt-BR",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      }
                    )
                  : ""}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              {query.trim()
                ? ` · Filtrado: ${Math.round(filteredTotalCalories)} kcal`
                : ""}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-slate-500">Total consumido</div>
            <div className="text-2xl font-extrabold text-slate-900">
              {Math.round(dailyTotalCalories)} kcal
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-white border border-red-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[13px] text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[13px] text-slate-600">Carregando...</p>
        </div>
      ) : !filtered.length ? (
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[13px] text-slate-600">
            Nenhuma refeição encontrada para essa data/filtros.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((meal) => {
            const total = getMealTotalCalories(meal);
            const label = MEAL_TYPE_LABEL[meal.mealType] ?? "Refeição";

            return (
              <li key={meal.id}>
                <button
                  type="button"
                  onClick={() => setOpenedMeal(meal)}
                  className="w-full text-left bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3
                             flex items-center justify-between gap-4 hover:border-blue-400 hover:shadow-md
                             transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                      {label[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-800">
                          {label}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {formatDateOnly(meal)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 truncate">
                        {meal.items.length} item(ns) ·{" "}
                        {meal.items
                          .map((i) => i.name)
                          .slice(0, 3)
                          .join(", ")}
                        {meal.items.length > 3 ? "..." : ""}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-slate-500">
                      Total (aprox.)
                    </div>
                    <div className="text-lg font-extrabold text-slate-900">
                      {total} kcal
                    </div>
                    <div className="mt-1 text-[11px] text-blue-600">
                      Ver detalhes
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal de detalhes (COM SCROLL NO CELULAR) */}
      {openedMeal && (
        <div
          className="fixed inset-0 z-40 bg-black/40 p-4 overflow-y-auto"
          onClick={() => setOpenedMeal(null)}
        >
          <div
            className="mx-auto w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  {MEAL_TYPE_LABEL[openedMeal.mealType] ?? "Refeição"}
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {formatDateTime(openedMeal)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDelete(openedMeal.id)}
                  className="text-[13px] font-semibold text-red-600 hover:text-red-700"
                >
                  Excluir
                </button>

                <button
                  type="button"
                  onClick={() => setOpenedMeal(null)}
                  className="text-slate-500 hover:text-slate-800 text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="max-h-[calc(100vh-140px)] overflow-y-auto">
              {(openedMeal.photoDataUrl || openedMeal.photoUrl) && (
                <div className="p-4 pb-0">
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                    <div className="aspect-[16/7] w-full">
                      <img
                        src={openedMeal.photoDataUrl || openedMeal.photoUrl}
                        alt="Foto da refeição"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4">
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700">
                    Itens da refeição
                  </div>

                  <ul className="divide-y divide-slate-200">
                    {openedMeal.items.map((item) => {
                      const kcal = getItemCalories(
                        item.kcalPer100g,
                        item.grams,
                        item.calories
                      );

                      return (
                        <li
                          key={item.id}
                          className="px-3 py-2 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {item.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {item.grams}g · {item.kcalPer100g} kcal / 100g
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-sm font-extrabold text-slate-900">
                              {kcal} kcal
                            </div>
                            <div className="text-xs text-slate-500">
                              {item.source === "vision" ? "Visão" : "Manual"}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Total (aprox.)</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {getMealTotalCalories(openedMeal)} kcal
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
