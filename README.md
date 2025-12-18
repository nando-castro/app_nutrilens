# Nutrilens 🍽️
**Autores:** Fernando Castro • Amanda Felix

Aplicação web para análise de refeições por imagem, cálculo aproximado de calorias e histórico diário.

## Visão geral
O Nutrilens permite ao usuário:
- Fazer login e manter sessão segura
- Enviar uma foto (upload ou câmera) para análise automática
- Ajustar itens e porções manualmente
- Salvar a refeição com imagem e calorias
- Visualizar histórico por dia e abrir detalhes em modal
- Excluir refeições do histórico

## Tecnologias

### Frontend
- React + TypeScript
- TailwindCSS
- Fetch com autenticação (token JWT)

### Banco de dados
- PostgreSQL
- Migrations via Prisma

## Requisitos
- Node.js (versão recomendada: 18+)
- PostgreSQL (versão recomendada: 14+)
- pnpm, npm ou yarn

## Como rodar localmente

### 1) Clonar e instalar
```bash
git clone https://github.com/nando-castro/app_nutrilens.git
cd app_nutrilens
cp .env.example .env
pnpm install
pnpm run dev
```

---
