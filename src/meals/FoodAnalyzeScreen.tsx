import { fetchAuth } from "@/auth/auth.api";
import alimentosJson from "@/data/alimentos.json";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  FoodItemUI,
  MealType,
  SavedMeal,
  SavedMealItem,
  User,
} from "../types";

type BackendItem = {
  nome: string;
  caloriasPorPorcao: number; // kcal / 100g
  porcaoDescricao: string;
  confianca: number;
};

type AnalysisResponse = {
  itens: BackendItem[];
  mensagem: string;
};

type Alimento = {
  id: number;
  description: string;
  category?: string;
  energy_kcal: number;
};

const alimentos = alimentosJson as unknown as Alimento[];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

interface Props {
  user: User;
  onSaveMeal: (meal: SavedMeal) => void;
}

const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  snack: "Lanche",
  dinner: "Jantar",
  supper: "Ceia",
  other: "Outro",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeSearch(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function FoodAnalyzeScreen({ user, onSaveMeal }: Props) {
  const [mealType, setMealType] = useState<MealType>("lunch");

  const [file, setFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const [items, setItems] = useState<FoodItemUI[]>([]);
  const [backendMessage, setBackendMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // câmera

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">(
    "environment"
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ===== MODAL (ADICIONAR ITEM PELO JSON) =====
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [foodQuery, setFoodQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<Alimento | null>(null);
  const [modalGrams, setModalGrams] = useState(100);

  const filteredFoods = useMemo(() => {
    const q = normalizeSearch(foodQuery);
    if (!q) return alimentos.slice(0, 30);

    const out: Alimento[] = [];
    for (let i = 0; i < alimentos.length; i++) {
      const a = alimentos[i];
      const hay = normalizeSearch(a.description);
      if (hay.includes(q)) out.push(a);
      if (out.length >= 50) break;
    }
    return out;
  }, [foodQuery]);

  function openAddModal() {
    setError(null);
    setAddModalOpen(true);
    setFoodQuery("");
    setSelectedFood(null);
    setModalGrams(100);
  }

  function closeAddModal() {
    setAddModalOpen(false);
  }

  function addSelectedFoodToMeal() {
    if (!selectedFood) return;

    const kcalPor100g = Math.round(Number(selectedFood.energy_kcal) || 0);
    if (kcalPor100g <= 0) {
      setError("Esse alimento não possui calorias válidas na base.");
      return;
    }

    const quantidade = modalGrams > 0 ? modalGrams : 100;

    const newItem: FoodItemUI = {
      id: `manual-${Date.now()}`,
      nome: selectedFood.description,
      quantidadeGramas: quantidade,
      kcalPor100g,
      origem: "manual",
    };

    setItems((prev) => [...prev, newItem]);
    closeAddModal();
  }

  // ===== HELPERS =====
  function resetResult() {
    setItems([]);
    setBackendMessage("");
    setError(null);
  }

  function readFileAsDataUrl(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPreviewDataUrl(reader.result);
    };
    reader.readAsDataURL(f);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    readFileAsDataUrl(selected);
    resetResult();
  }

  // ===== CÂMERA =====
  function stopCamera() {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
      // eslint-disable-next-line no-param-reassign
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setIsCameraOpen(false);
  }

  async function openCamera(facing: "environment" | "user" = cameraFacing) {
    resetResult();
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Câmera não disponível neste dispositivo/navegador.");
      return;
    }

    // fecha stream anterior, se existir
    stopCamera();

    // alguns navegadores falham com facingMode, então fazemos fallback
    const tryConstraints: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      { video: true, audio: false },
    ];

    try {
      let stream: MediaStream | null = null;

      for (const constraints of tryConstraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch {
          // tenta próximo
        }
      }

      if (!stream) throw new Error("Não foi possível obter stream de câmera.");

      streamRef.current = stream;
      setIsCameraOpen(true);

      // aguarda o videoRef existir
      requestAnimationFrame(async () => {
        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        videoRef.current.playsInline = true;

        // iOS às vezes precisa aguardar metadata
        await new Promise<void>((resolve) => {
          const v = videoRef.current!;
          const onReady = () => {
            v.removeEventListener("loadedmetadata", onReady);
            resolve();
          };
          v.addEventListener("loadedmetadata", onReady);
        });

        try {
          await videoRef.current.play();
        } catch {
          // se o navegador bloquear autoplay, o usuário ainda consegue tocar no vídeo
        }
      });
    } catch {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
      setIsCameraOpen(false);
    }
  }

  async function toggleCamera() {
    const next = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(next);
    await openCamera(next);
  }

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCapturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (!vw || !vh) {
      setError("Não foi possível capturar a imagem da câmera.");
      return;
    }

    // limita o maior lado (ex: 1280px)
    const MAX = 1280;
    const scale = Math.min(1, MAX / Math.max(vw, vh));
    const width = Math.round(vw * scale);
    const height = Math.round(vh * scale);

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Erro ao preparar a captura da imagem.");
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Erro ao gerar a imagem capturada.");
          return;
        }

        const capturedFile = new File([blob], "foto-camera.jpg", {
          type: "image/jpeg",
        });

        setFile(capturedFile);
        resetResult();

        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string")
            setPreviewDataUrl(reader.result);
        };
        reader.readAsDataURL(capturedFile);

        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  }

  // ===== BACKEND (ANÁLISE) =====
  async function handleAnalyze() {
    if (!file) {
      setError("Selecione uma imagem ou tire uma foto primeiro.");
      return;
    }

    setLoading(true);
    setError(null);
    setItems([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/food/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Erro ao analisar imagem.");
      }

      const data = (await response.json()) as AnalysisResponse;
      setBackendMessage(data.mensagem);

      const mapped = data.itens.map<FoodItemUI>((item, index) => ({
        id: `vision-${index}`,
        nome: item.nome,
        quantidadeGramas: 100,
        kcalPor100g: Math.round(item.caloriasPorPorcao),
        confianca: item.confianca,
        origem: "vision",
      }));

      setItems(mapped);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Falha desconhecida na análise da imagem.");
    } finally {
      setLoading(false);
    }
  }

  // ===== CÁLCULOS =====
  function calcItemCalories(it: FoodItemUI): number {
    return Math.round((it.kcalPor100g * it.quantidadeGramas) / 100);
  }

  const totalCalories = items.reduce(
    (acc, item) => acc + calcItemCalories(item),
    0
  );

  // ===== EDIÇÃO/REMOÇÃO =====
  function updateItemQuantity(id: string, grams: number) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, quantidadeGramas: grams } : it))
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // ===== SALVAR (BACKEND) =====
  async function handleSaveMealClick() {
    if (!items.length || !previewDataUrl || !file) {
      setError("É necessário ter uma foto e ao menos um alimento.");
      return;
    }

    setSaving(true);
    setError(null);
    setBackendMessage("");

    try {
      const payload = {
        type: mealType,
        takenAt: new Date().toISOString(),
        items: items.map((it) => ({
          name: it.nome,
          grams: it.quantidadeGramas,
          caloriesPer100g: it.kcalPor100g,
          confidence: it.confianca ?? null,
          source: it.origem, // "vision" | "manual"
        })),
      };

      const formData = new FormData();
      formData.append("file", file);
      formData.append("data", JSON.stringify(payload));

      const resp = await fetchAuth(`${API_BASE_URL}/meals`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Erro ao salvar refeição.");
      }

      // Tipar o retorno evita "any" e erros do eslint
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
        type: MealType;
        takenAt: string;
        createdAt?: string;
        totalCalories: number;
        imagePath?: string | null;
        items: MealItemApi[];
      };

      const saved = (await resp.json()) as MealApi;

      const savedItems: SavedMealItem[] = saved.items.map((it) => ({
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

      const savedMeal: SavedMeal = {
        id: String(saved.id),
        userId: String(saved.userId),
        mealType: saved.type,
        dateTime: new Date(saved.takenAt).toISOString(),
        createdAt: new Date(saved.createdAt ?? saved.takenAt).toISOString(),
        totalCalories: Number(saved.totalCalories) || 0,
        photoUrl: saved.imagePath ?? undefined,
        photoDataUrl: previewDataUrl,
        items: savedItems,
      };

      onSaveMeal(savedMeal);
      setBackendMessage("Refeição salva com sucesso.");
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Falha desconhecida ao salvar a refeição.");
    } finally {
      setSaving(false);
    }
  }

  const hasItems = items.length > 0;

  useEffect(() => {
    if (!addModalOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [addModalOpen]);

  return (
    <section className="max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CARD: CAPTURA */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Foto da refeição
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Envie uma foto ou use a câmera para analisar.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo de refeição
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25"
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType)}
            >
              {(
                Object.keys(MEAL_TYPE_LABEL) as Array<
                  keyof typeof MEAL_TYPE_LABEL
                >
              ).map((key) => (
                <option key={key} value={key}>
                  {MEAL_TYPE_LABEL[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Selecionar imagem
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-700
                         file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white
                         hover:file:bg-slate-800"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => (isCameraOpen ? stopCamera() : openCamera())}
              className={cn(
                "flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800",
                "hover:bg-slate-50 active:translate-y-[1px] transition"
              )}
            >
              {isCameraOpen ? "Fechar câmera" : "Usar câmera"}
            </button>

            {/* <button
              type="button"
              disabled={!isCameraOpen}
              onClick={handleCapturePhoto}
              className={cn(
                "flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition",
                !isCameraOpen
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-800 hover:bg-slate-50 active:translate-y-[1px]"
              )}
            >
              Capturar
            </button> */}
          </div>

          {isCameraOpen && (
            <div className="fixed inset-0 z-[70] bg-black" onClick={stopCamera}>
              <div
                className="absolute inset-0"
                onClick={(e) => e.stopPropagation()}
              >
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* topo */}
                <div className="absolute left-0 right-0 top-0 p-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-xl bg-white/90 px-3 py-2 text-sm font-bold text-slate-900"
                  >
                    Fechar
                  </button>

                  {/* <button
                    type="button"
                    onClick={toggleCamera}
                    className="rounded-xl bg-white/90 px-3 py-2 text-sm font-bold text-slate-900"
                  >
                    Trocar
                  </button> */}
                </div>

                {/* bottom bar fixa */}
                <div className="absolute left-0 right-0 bottom-0 p-4">
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-slate-900 active:scale-[0.99] transition"
                  >
                    Capturar foto
                  </button>
                </div>
              </div>
            </div>
          )}

          {previewDataUrl && !isCameraOpen && (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">
                  Pré-visualização
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewDataUrl(null);
                    resetResult();
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Remover
                </button>
              </div>

              <div className="mt-2 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                <img
                  src={previewDataUrl}
                  alt="Pré-visualização"
                  className="w-full max-h-[320px] object-cover"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!file || loading}
            onClick={handleAnalyze}
            className={cn(
              "mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition",
              !file || loading
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:translate-y-[1px]"
            )}
          >
            {loading ? "Analisando..." : "Analisar imagem"}
          </button>

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-[13px] text-red-700">{error}</p>
            </div>
          )}

          {backendMessage && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[13px] text-slate-600">{backendMessage}</p>
            </div>
          )}
        </div>

        {/* CARD: ITENS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Itens da refeição
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Ajuste as porções e remova o que estiver incorreto.
              </p>
            </div>

            {hasItems && (
              <div className="text-right">
                <div className="text-xs text-slate-500">Total (aprox.)</div>
                <div className="text-lg font-extrabold text-slate-900">
                  {totalCalories} kcal
                </div>
              </div>
            )}
          </div>

          {!hasItems ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[13px] text-slate-600">
                Assim que a análise for feita, os alimentos aparecerão aqui para
                você ajustar as porções.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm sm:text-base break-words sm:truncate">
                      {item.nome}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {item.kcalPor100g} kcal / 100g
                      {item.confianca !== undefined && (
                        <> · conf. {(item.confianca * 100).toFixed(1)}%</>
                      )}
                      <> · {item.origem === "vision" ? "Visão" : "Manual"}</>
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 sm:ml-4">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        value={item.quantidadeGramas}
                        onChange={(e) =>
                          updateItemQuantity(
                            item.id,
                            Number(e.target.value) || 0
                          )
                        }
                        className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none
                                   focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25"
                      />
                      <span className="text-sm text-slate-500">g</span>
                    </div>

                    <div className="w-[92px] text-right font-extrabold text-slate-900">
                      {calcItemCalories(item)} kcal
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                      aria-label="Remover item"
                      title="Remover"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5">
            <button
              type="button"
              onClick={openAddModal}
              className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 transition hover:bg-slate-50 active:translate-y-[1px]"
            >
              Adicionar alimento
            </button>
          </div>

          <button
            type="button"
            disabled={!hasItems || !previewDataUrl || saving}
            onClick={handleSaveMealClick}
            className={cn(
              "mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition",
              !hasItems || !previewDataUrl || saving
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-slate-900 hover:bg-slate-800 active:translate-y-[1px]"
            )}
          >
            {saving ? "Salvando..." : "Salvar refeição"}
          </button>
        </div>
      </div>

      {/* MODAL: adicionar alimento manualmente via base JSON */}
      {addModalOpen && (
        <div
          className="
      fixed inset-0 z-[60] bg-black/40
      p-4
      overflow-y-auto
      flex items-start justify-center
    "
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={closeAddModal}
        >
          <div
            className="
        w-full max-w-2xl
        rounded-2xl bg-white border border-slate-200 shadow-xl
        max-h-[calc(100dvh-2rem)]
        flex flex-col
        overflow-hidden
      "
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER FIXO */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div>
                <div className="text-base font-extrabold text-slate-900">
                  Adicionar alimento
                </div>
                <div className="text-xs text-slate-500">
                  Pesquise na base e selecione para preencher as calorias
                  automaticamente.
                </div>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            {/* BODY SCROLLÁVEL */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* COLUNA: BUSCA */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Buscar alimento
                  </label>
                  <input
                    value={foodQuery}
                    onChange={(e) => setFoodQuery(e.target.value)}
                    placeholder="Ex: arroz, frango, tomate..."
                    className="w-full rounded-xl border border-slate-200 bg-blue-50 px-3 py-2 text-sm text-slate-900 outline-none
                         placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25"
                  />

                  <div className="mt-2 rounded-2xl border border-slate-200 overflow-hidden">
                    {/* Aqui pode continuar com max-h, pois o body já é scrollável */}
                    <div className="max-h-[360px] overflow-auto">
                      {filteredFoods.length === 0 ? (
                        <div className="p-3 text-sm text-slate-600">
                          Nenhum alimento encontrado.
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-200">
                          {filteredFoods.map((a) => {
                            const isSelected = selectedFood?.id === a.id;
                            return (
                              <li key={a.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedFood(a)}
                                  className={cn(
                                    "w-full text-left p-3 hover:bg-slate-50 transition",
                                    isSelected && "bg-blue-50"
                                  )}
                                >
                                  <div className="font-bold text-slate-900">
                                    {a.description}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {a.category ? `${a.category} · ` : ""}
                                    {Math.round(
                                      Number(a.energy_kcal) || 0
                                    )}{" "}
                                    kcal / 100g
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Mostrando até 50 resultados.
                  </div>
                </div>

                {/* COLUNA: SELEÇÃO */}
                <div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-extrabold text-slate-700">
                      Selecionado
                    </div>

                    {selectedFood ? (
                      <div className="mt-2">
                        <div className="font-extrabold text-slate-900">
                          {selectedFood.description}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          {selectedFood.category
                            ? `${selectedFood.category} · `
                            : ""}
                          {Math.round(Number(selectedFood.energy_kcal) || 0)}{" "}
                          kcal / 100g
                        </div>

                        <div className="mt-3">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Quantidade (g)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={modalGrams}
                            onChange={(e) =>
                              setModalGrams(Number(e.target.value) || 0)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none
                                 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25"
                          />
                        </div>

                        <div className="mt-3 text-sm text-slate-700">
                          <span className="text-slate-500">Estimativa:</span>{" "}
                          <span className="font-extrabold text-slate-900">
                            {Math.round(
                              (Math.round(
                                Number(selectedFood.energy_kcal) || 0
                              ) *
                                (modalGrams || 0)) /
                                100
                            )}{" "}
                            kcal
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-600">
                        Selecione um alimento na lista ao lado.
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={closeAddModal}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      disabled={!selectedFood}
                      onClick={addSelectedFoodToMeal}
                      className={cn(
                        "flex-1 rounded-xl px-4 py-2 text-sm font-extrabold text-white transition",
                        !selectedFood
                          ? "bg-blue-300 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 active:translate-y-[1px]"
                      )}
                    >
                      Adicionar à refeição
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
