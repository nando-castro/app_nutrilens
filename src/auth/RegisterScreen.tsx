import { useState } from "react";
import type { User } from "../types";
import { registerUser, setAuthSession } from "./auth.api";

type Props = {
  onRegister: (user: User) => void;
  onBackToLogin: () => void;
};

export function RegisterScreen({ onRegister, onBackToLogin }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Informe seu nome completo.");
    if (!email.trim()) return setError("Informe um e-mail válido.");
    if (!password.trim() || password.length < 6)
      return setError("A senha deve ter pelo menos 6 caracteres.");
    if (password !== confirmPassword)
      return setError("As senhas não coincidem.");

    try {
      setLoading(true);

      const { user, accessToken } = await registerUser({
        apiBaseUrl: API_BASE_URL,
        dto: { name: name.trim(), email: email.trim(), password },
      });

      setAuthSession(accessToken, user);
      onRegister(user);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Não foi possível cadastrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <div className="w-full max-w-[380px] bg-white rounded-[18px] shadow-[0_18px_40px_rgba(15,23,42,0.08)] px-6 pt-7 pb-6 flex flex-col gap-4 lg:px-7 lg:pt-8 lg:pb-7">
        <div>
          <p className="font-extrabold text-[32px] mt-2 text-center text-gray-600">
            🍽️ Nutrilens
          </p>
          <h1 className="m-0 text-center text-[20px] font-semibold text-gray-900">
            Criar Conta
          </h1>
          <p className="mt-2 text-center text-[13px] text-gray-600">
            Crie sua conta para começar a registrar suas refeições.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-full border border-gray-200 bg-blue-50 px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25"
            />
          </div>

          <div className="relative">
            <input
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-full border border-gray-200 bg-blue-50 px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25"
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-full border border-gray-200 bg-blue-50 px-4 py-2.5 pr-11 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base text-gray-700 hover:text-gray-900"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirmar senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-full border border-gray-200 bg-blue-50 px-4 py-2.5 pr-11 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base text-gray-700 hover:text-gray-900"
              aria-label={
                showConfirmPassword ? "Ocultar senha" : "Mostrar senha"
              }
            >
              {showConfirmPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {error && <p className="m-0 text-[13px] text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-full bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>

        <div className="mt-1 flex flex-col items-center gap-1.5">
          <span className="text-[13px] text-gray-600">Já tem conta?</span>

          <button
            type="button"
            onClick={onBackToLogin}
            className="p-0 text-[13px] text-blue-600 hover:underline"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
