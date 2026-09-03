import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, ChevronRight, Flame, Dumbbell, Wind, Clock, Gauge, HeartPulse, StickyNote, Maximize, Minimize, Eye, EyeOff, Home, Target, RefreshCw, Pill as PillIcon, Apple, Sparkles, FileText, Menu, X } from "lucide-react";
import { api, resolveMediaUrl, setUnauthorizedHandler } from "./api";

/* ============================================================
   DESIGN TOKENS
   Conceito: "pista à noite" — cockpit de treino para atletas.
   Cor base grafite-pinho profundo, acento coral-pista (intensidade),
   ouro (recordes/metas), azul-aço (dados secundários).
   Tipografia: Bebas Neue (placar/números grandes), Inter (corpo),
   JetBrains Mono (splits, paces, datas — dados tabulares).
   Assinatura visual: traço de "pulso de treino" (linha tipo ECG)
   usado como divisor recorrente.
============================================================= */
const T = {
  bg: "#101B26",
  bgElevated: "#16232F",
  surface: "#1C2B3A",
  surfaceAlt: "#233647",
  border: "#2C4256",
  coral: "#E8352A",
  coralDim: "#5E1712",
  gold: "#FCB712",
  steel: "#3D83C4",
  textPrimary: "#F3F5F7",
  textMuted: "#93A2B0",
  danger: "#FF4D42",
  good: "#4FBF82",
};

const FONT_IMPORT_ID = "perf-app-fonts";
function ensureFonts() {
  if (document.getElementById(FONT_IMPORT_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_IMPORT_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(link);
}

const GLOBAL_STYLE_ID = "perf-app-global-style";
function ensureGlobalStyles() {
  if (document.getElementById(GLOBAL_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = GLOBAL_STYLE_ID;
  style.textContent = `
    * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    ::selection { background: ${T.coral}55; color: ${T.textPrimary}; }

    .pulso-app-bg {
      background:
        radial-gradient(1200px 600px at 15% -10%, ${T.surfaceAlt}55 0%, transparent 60%),
        radial-gradient(900px 500px at 100% 0%, ${T.steel}22 0%, transparent 55%),
        ${T.bg};
    }

    .pulso-card {
      transition: box-shadow .22s ease, transform .22s ease, border-color .22s ease;
      box-shadow: 0 1px 0 rgba(255,255,255,0.02) inset, 0 10px 28px -16px rgba(0,0,0,0.65);
    }
    .pulso-card--interactive:hover {
      box-shadow: 0 1px 0 rgba(255,255,255,0.03) inset, 0 16px 36px -14px rgba(0,0,0,0.75);
      transform: translateY(-1px);
      border-color: ${T.border};
    }

    .pulso-btn {
      transition: transform .14s ease, box-shadow .14s ease, filter .14s ease, opacity .14s ease;
    }
    .pulso-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
    .pulso-btn:active:not(:disabled) { transform: translateY(0); filter: brightness(0.94); }
    .pulso-btn:disabled { opacity: 0.5; cursor: default; }

    .pulso-navitem {
      border-left: 3px solid transparent;
      background: transparent;
      color: ${T.textMuted};
      transition: background .16s ease, color .16s ease, border-color .16s ease;
    }
    .pulso-navitem:hover { background: rgba(255,255,255,0.035); color: ${T.textPrimary}; }
    .pulso-navitem-active {
      background: ${T.surface} !important;
      color: ${T.textPrimary} !important;
      border-left: 3px solid ${T.coral};
    }

    .pulso-input {
      transition: border-color .16s ease, box-shadow .16s ease;
    }
    .pulso-input:focus {
      border-color: ${T.steel} !important;
      box-shadow: 0 0 0 3px ${T.steel}26;
    }

    .pulso-scale-in { animation: pulsoScaleIn .22s cubic-bezier(.2,.7,.3,1); }
    @keyframes pulsoScaleIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  `;
  document.head.appendChild(style);
}

/* ============================================================
   PULSE DIVIDER — elemento de assinatura
============================================================= */
function PulseDivider({ color = T.coral, height = 28 }) {
  const pts =
    "0,14 40,14 52,4 64,24 76,14 300,14 312,4 324,24 336,14 600,14 612,4 624,24 636,14 900,14";
  return (
    <svg
      viewBox="0 0 900 28"
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

// ============================================================
// BASE DE DADOS TACO — Tabela Brasileira de Composição de Alimentos
// 4ª edição ampliada e revisada (NEPA/UNICAMP, 2011).
// 584 alimentos, valores por 100g de parte comestível.
// Campos: id, category, name, kcal, protein(g), lipids(g), carb(g), fiber(g), calcium(mg), magnesium(mg).
// ============================================================
const TACO_FOODS = [{"id":1,"category":"Cereais e derivados","name":"Arroz, integral, cozido","kcal":124.0,"protein":2.6,"lipids":1.0,"carb":25.8,"fiber":2.7,"calcium":5.0,"magnesium":59.0},{"id":2,"category":"Cereais e derivados","name":"Arroz, integral, cru","kcal":360.0,"protein":7.3,"lipids":1.9,"carb":77.5,"fiber":4.8,"calcium":8.0,"magnesium":110.0},{"id":3,"category":"Cereais e derivados","name":"Arroz, tipo 1, cozido","kcal":128.0,"protein":2.5,"lipids":0.2,"carb":28.1,"fiber":1.6,"calcium":4.0,"magnesium":2.0},{"id":4,"category":"Cereais e derivados","name":"Arroz, tipo 1, cru","kcal":358.0,"protein":7.2,"lipids":0.3,"carb":78.8,"fiber":1.6,"calcium":4.0,"magnesium":30.0},{"id":5,"category":"Cereais e derivados","name":"Arroz, tipo 2, cozido","kcal":130.0,"protein":2.6,"lipids":0.4,"carb":28.2,"fiber":1.1,"calcium":3.0,"magnesium":6.0},{"id":6,"category":"Cereais e derivados","name":"Arroz, tipo 2, cru","kcal":358.0,"protein":7.2,"lipids":0.3,"carb":78.9,"fiber":1.7,"calcium":5.0,"magnesium":29.0},{"id":7,"category":"Cereais e derivados","name":"Aveia, flocos, crua","kcal":394.0,"protein":13.9,"lipids":8.5,"carb":66.6,"fiber":9.1,"calcium":48.0,"magnesium":119.0},{"id":8,"category":"Cereais e derivados","name":"Biscoito, doce, maisena","kcal":443.0,"protein":8.1,"lipids":12.0,"carb":75.2,"fiber":2.1,"calcium":54.0,"magnesium":37.0},{"id":9,"category":"Cereais e derivados","name":"Biscoito, doce, recheado com chocolate","kcal":472.0,"protein":6.4,"lipids":19.6,"carb":70.5,"fiber":3.0,"calcium":27.0,"magnesium":48.0},{"id":10,"category":"Cereais e derivados","name":"Biscoito, doce, recheado com morango","kcal":471.0,"protein":5.7,"lipids":19.6,"carb":71.0,"fiber":1.5,"calcium":36.0,"magnesium":27.0},{"id":11,"category":"Cereais e derivados","name":"Biscoito, doce, wafer, recheado de chocolate","kcal":502.0,"protein":5.6,"lipids":24.7,"carb":67.5,"fiber":1.8,"calcium":23.0,"magnesium":48.0},{"id":12,"category":"Cereais e derivados","name":"Biscoito, doce, wafer, recheado de morango","kcal":513.0,"protein":4.5,"lipids":26.4,"carb":67.4,"fiber":0.8,"calcium":14.0,"magnesium":19.0},{"id":13,"category":"Cereais e derivados","name":"Biscoito, salgado, cream cracker","kcal":432.0,"protein":10.1,"lipids":14.4,"carb":68.7,"fiber":2.5,"calcium":20.0,"magnesium":40.0},{"id":14,"category":"Cereais e derivados","name":"Bolo, mistura para","kcal":419.0,"protein":6.2,"lipids":6.1,"carb":84.7,"fiber":1.7,"calcium":59.0,"magnesium":28.0},{"id":15,"category":"Cereais e derivados","name":"Bolo, pronto, aipim","kcal":324.0,"protein":4.4,"lipids":12.7,"carb":47.9,"fiber":0.7,"calcium":85.0,"magnesium":10.0},{"id":16,"category":"Cereais e derivados","name":"Bolo, pronto, chocolate","kcal":410.0,"protein":6.2,"lipids":18.5,"carb":54.7,"fiber":1.4,"calcium":75.0,"magnesium":28.0},{"id":17,"category":"Cereais e derivados","name":"Bolo, pronto, coco","kcal":333.0,"protein":5.7,"lipids":11.3,"carb":52.3,"fiber":1.1,"calcium":57.0,"magnesium":16.0},{"id":18,"category":"Cereais e derivados","name":"Bolo, pronto, milho","kcal":311.0,"protein":4.8,"lipids":12.4,"carb":45.1,"fiber":0.7,"calcium":83.0,"magnesium":10.0},{"id":19,"category":"Cereais e derivados","name":"Canjica, branca, crua","kcal":358.0,"protein":7.2,"lipids":1.0,"carb":78.1,"fiber":5.5,"calcium":2.0,"magnesium":12.0},{"id":20,"category":"Cereais e derivados","name":"Canjica, com leite integral","kcal":112.0,"protein":2.4,"lipids":1.2,"carb":23.6,"fiber":1.2,"calcium":43.0,"magnesium":6.0},{"id":21,"category":"Cereais e derivados","name":"Cereais, milho, flocos, com sal","kcal":370.0,"protein":7.3,"lipids":1.6,"carb":80.8,"fiber":5.3,"calcium":2.0,"magnesium":20.0},{"id":22,"category":"Cereais e derivados","name":"Cereais, milho, flocos, sem sal","kcal":363.0,"protein":6.9,"lipids":1.2,"carb":80.4,"fiber":1.8,"calcium":2.0,"magnesium":17.0},{"id":23,"category":"Cereais e derivados","name":"Cereais, mingau, milho, infantil","kcal":394.0,"protein":6.4,"lipids":1.1,"carb":87.3,"fiber":3.2,"calcium":219.0,"magnesium":16.0},{"id":24,"category":"Cereais e derivados","name":"Cereais, mistura para vitamina, trigo, cevada e aveia","kcal":381.0,"protein":8.9,"lipids":2.1,"carb":81.6,"fiber":5.0,"calcium":584.0,"magnesium":72.0},{"id":25,"category":"Cereais e derivados","name":"Cereal matinal, milho","kcal":365.0,"protein":7.2,"lipids":1.0,"carb":83.8,"fiber":4.1,"calcium":143.0,"magnesium":11.0},{"id":26,"category":"Cereais e derivados","name":"Cereal matinal, milho, açúcar","kcal":377.0,"protein":4.7,"lipids":0.7,"carb":88.8,"fiber":2.1,"calcium":56.0,"magnesium":8.0},{"id":27,"category":"Cereais e derivados","name":"Creme de arroz, pó","kcal":386.0,"protein":7.0,"lipids":1.2,"carb":83.9,"fiber":1.1,"calcium":7.0,"magnesium":51.0},{"id":28,"category":"Cereais e derivados","name":"Creme de milho, pó","kcal":333.0,"protein":4.8,"lipids":1.6,"carb":86.1,"fiber":3.7,"calcium":323.0,"magnesium":30.0},{"id":29,"category":"Cereais e derivados","name":"Curau, milho verde","kcal":78.0,"protein":2.4,"lipids":1.6,"carb":13.9,"fiber":0.5,"calcium":53.0,"magnesium":16.0},{"id":30,"category":"Cereais e derivados","name":"Curau, milho verde, mistura para","kcal":402.0,"protein":2.2,"lipids":13.4,"carb":79.8,"fiber":2.5,"calcium":31.0,"magnesium":9.0},{"id":31,"category":"Cereais e derivados","name":"Farinha, de arroz, enriquecida","kcal":363.0,"protein":1.3,"lipids":0.3,"carb":85.5,"fiber":0.6,"calcium":1.0,"magnesium":4.0},{"id":32,"category":"Cereais e derivados","name":"Farinha, de centeio, integral","kcal":336.0,"protein":12.5,"lipids":1.8,"carb":73.3,"fiber":15.5,"calcium":34.0,"magnesium":120.0},{"id":33,"category":"Cereais e derivados","name":"Farinha, de milho, amarela","kcal":351.0,"protein":7.2,"lipids":1.5,"carb":79.1,"fiber":5.5,"calcium":1.0,"magnesium":31.0},{"id":34,"category":"Cereais e derivados","name":"Farinha, de rosca","kcal":371.0,"protein":11.4,"lipids":1.5,"carb":75.8,"fiber":4.8,"calcium":35.0,"magnesium":57.0},{"id":35,"category":"Cereais e derivados","name":"Farinha, de trigo","kcal":360.0,"protein":9.8,"lipids":1.4,"carb":75.1,"fiber":2.3,"calcium":18.0,"magnesium":31.0},{"id":36,"category":"Cereais e derivados","name":"Farinha, láctea, de cereais","kcal":415.0,"protein":11.9,"lipids":5.8,"carb":77.8,"fiber":1.9,"calcium":196.0,"magnesium":58.0},{"id":37,"category":"Cereais e derivados","name":"Lasanha, massa fresca, cozida","kcal":164.0,"protein":5.8,"lipids":1.2,"carb":32.5,"fiber":1.6,"calcium":10.0,"magnesium":4.0},{"id":38,"category":"Cereais e derivados","name":"Lasanha, massa fresca, crua","kcal":220.0,"protein":7.0,"lipids":1.3,"carb":45.1,"fiber":1.6,"calcium":17.0,"magnesium":13.0},{"id":39,"category":"Cereais e derivados","name":"Macarrão, instantâneo","kcal":436.0,"protein":8.8,"lipids":17.2,"carb":62.4,"fiber":5.6,"calcium":18.0,"magnesium":19.0},{"id":40,"category":"Cereais e derivados","name":"Macarrão, trigo, cru","kcal":371.0,"protein":10.0,"lipids":1.3,"carb":77.9,"fiber":2.9,"calcium":17.0,"magnesium":28.0},{"id":41,"category":"Cereais e derivados","name":"Macarrão, trigo, cru, com ovos","kcal":371.0,"protein":10.3,"lipids":2.0,"carb":76.6,"fiber":2.3,"calcium":19.0,"magnesium":null},{"id":42,"category":"Cereais e derivados","name":"Milho, amido, cru","kcal":361.0,"protein":0.6,"lipids":null,"carb":87.1,"fiber":0.7,"calcium":1.0,"magnesium":3.0},{"id":43,"category":"Cereais e derivados","name":"Milho, fubá, cru","kcal":353.0,"protein":7.2,"lipids":1.9,"carb":78.9,"fiber":4.7,"calcium":3.0,"magnesium":41.0},{"id":44,"category":"Cereais e derivados","name":"Milho, verde, cru","kcal":138.0,"protein":6.6,"lipids":0.6,"carb":28.6,"fiber":3.9,"calcium":2.0,"magnesium":33.0},{"id":45,"category":"Cereais e derivados","name":"Milho, verde, enlatado, drenado","kcal":98.0,"protein":3.2,"lipids":2.4,"carb":17.1,"fiber":4.6,"calcium":2.0,"magnesium":20.0},{"id":46,"category":"Cereais e derivados","name":"Mingau tradicional, pó","kcal":373.0,"protein":0.6,"lipids":0.4,"carb":89.3,"fiber":0.9,"calcium":522.0,"magnesium":4.0},{"id":47,"category":"Cereais e derivados","name":"Pamonha, barra para cozimento, pré-cozida","kcal":171.0,"protein":2.6,"lipids":4.8,"carb":30.7,"fiber":2.4,"calcium":4.0,"magnesium":15.0},{"id":48,"category":"Cereais e derivados","name":"Pão, aveia, forma","kcal":343.0,"protein":12.4,"lipids":5.7,"carb":59.6,"fiber":6.0,"calcium":109.0,"magnesium":57.0},{"id":49,"category":"Cereais e derivados","name":"Pão, de soja","kcal":309.0,"protein":11.3,"lipids":3.6,"carb":56.5,"fiber":5.7,"calcium":90.0,"magnesium":48.0},{"id":50,"category":"Cereais e derivados","name":"Pão, glúten, forma","kcal":253.0,"protein":12.0,"lipids":2.7,"carb":44.1,"fiber":2.5,"calcium":156.0,"magnesium":24.0},{"id":51,"category":"Cereais e derivados","name":"Pão, milho, forma","kcal":292.0,"protein":8.3,"lipids":3.1,"carb":56.4,"fiber":4.3,"calcium":78.0,"magnesium":29.0},{"id":52,"category":"Cereais e derivados","name":"Pão, trigo, forma, integral","kcal":253.0,"protein":9.4,"lipids":3.7,"carb":49.9,"fiber":6.9,"calcium":132.0,"magnesium":60.0},{"id":53,"category":"Cereais e derivados","name":"Pão, trigo, francês","kcal":300.0,"protein":8.0,"lipids":3.1,"carb":58.6,"fiber":2.3,"calcium":16.0,"magnesium":25.0},{"id":54,"category":"Cereais e derivados","name":"Pão, trigo, sovado","kcal":311.0,"protein":8.4,"lipids":2.8,"carb":61.5,"fiber":2.4,"calcium":52.0,"magnesium":22.0},{"id":55,"category":"Cereais e derivados","name":"Pastel, de carne, cru","kcal":289.0,"protein":10.7,"lipids":8.8,"carb":42.0,"fiber":1.0,"calcium":17.0,"magnesium":18.0},{"id":56,"category":"Cereais e derivados","name":"Pastel, de carne, frito","kcal":388.0,"protein":10.1,"lipids":20.1,"carb":43.8,"fiber":1.0,"calcium":13.0,"magnesium":14.0},{"id":57,"category":"Cereais e derivados","name":"Pastel, de queijo, cru","kcal":308.0,"protein":9.9,"lipids":9.6,"carb":45.9,"fiber":1.1,"calcium":155.0,"magnesium":16.0},{"id":58,"category":"Cereais e derivados","name":"Pastel, de queijo, frito","kcal":422.0,"protein":8.7,"lipids":22.7,"carb":48.1,"fiber":0.9,"calcium":126.0,"magnesium":15.0},{"id":59,"category":"Cereais e derivados","name":"Pastel, massa, crua","kcal":310.0,"protein":6.9,"lipids":5.5,"carb":57.4,"fiber":1.4,"calcium":13.0,"magnesium":14.0},{"id":60,"category":"Cereais e derivados","name":"Pastel, massa, frita","kcal":570.0,"protein":6.0,"lipids":40.9,"carb":49.3,"fiber":1.3,"calcium":11.0,"magnesium":13.0},{"id":61,"category":"Cereais e derivados","name":"Pipoca, com óleo de soja, sem sal","kcal":448.0,"protein":9.9,"lipids":15.9,"carb":70.3,"fiber":14.3,"calcium":3.0,"magnesium":91.0},{"id":62,"category":"Cereais e derivados","name":"Polenta, pré-cozida","kcal":103.0,"protein":2.3,"lipids":0.3,"carb":23.3,"fiber":2.4,"calcium":1.0,"magnesium":4.0},{"id":63,"category":"Cereais e derivados","name":"Torrada, pão francês","kcal":377.0,"protein":10.5,"lipids":3.3,"carb":74.6,"fiber":3.4,"calcium":19.0,"magnesium":32.0},{"id":64,"category":"Verduras, hortaliças e derivados","name":"Abóbora, cabotian, cozida","kcal":48.0,"protein":1.4,"lipids":0.7,"carb":10.8,"fiber":2.5,"calcium":8.0,"magnesium":9.0},{"id":65,"category":"Verduras, hortaliças e derivados","name":"Abóbora, cabotian, crua","kcal":39.0,"protein":1.7,"lipids":0.5,"carb":8.4,"fiber":2.2,"calcium":18.0,"magnesium":9.0},{"id":66,"category":"Verduras, hortaliças e derivados","name":"Abóbora, menina brasileira, crua","kcal":14.0,"protein":0.6,"lipids":null,"carb":3.3,"fiber":1.2,"calcium":9.0,"magnesium":4.0},{"id":67,"category":"Verduras, hortaliças e derivados","name":"Abóbora, moranga, crua","kcal":12.0,"protein":1.0,"lipids":0.1,"carb":2.7,"fiber":1.7,"calcium":3.0,"magnesium":2.0},{"id":68,"category":"Verduras, hortaliças e derivados","name":"Abóbora, moranga, refogada","kcal":29.0,"protein":0.4,"lipids":0.8,"carb":6.0,"fiber":1.5,"calcium":19.0,"magnesium":7.0},{"id":69,"category":"Verduras, hortaliças e derivados","name":"Abobora, pescoço, crua","kcal":24.0,"protein":0.7,"lipids":0.1,"carb":6.1,"fiber":2.3,"calcium":9.0,"magnesium":7.0},{"id":70,"category":"Verduras, hortaliças e derivados","name":"Abobrinha, italiana, cozida","kcal":15.0,"protein":1.1,"lipids":0.2,"carb":3.0,"fiber":1.6,"calcium":17.0,"magnesium":17.0},{"id":71,"category":"Verduras, hortaliças e derivados","name":"Abobrinha, italiana, crua","kcal":19.0,"protein":1.1,"lipids":0.1,"carb":4.3,"fiber":1.4,"calcium":15.0,"magnesium":20.0},{"id":72,"category":"Verduras, hortaliças e derivados","name":"Abobrinha, italiana, refogada","kcal":24.0,"protein":1.1,"lipids":0.8,"carb":4.2,"fiber":1.4,"calcium":21.0,"magnesium":13.0},{"id":73,"category":"Verduras, hortaliças e derivados","name":"Abobrinha, paulista, crua","kcal":31.0,"protein":0.6,"lipids":0.1,"carb":7.9,"fiber":2.6,"calcium":19.0,"magnesium":9.0},{"id":74,"category":"Verduras, hortaliças e derivados","name":"Acelga, crua","kcal":21.0,"protein":1.4,"lipids":0.1,"carb":4.6,"fiber":1.1,"calcium":43.0,"magnesium":10.0},{"id":75,"category":"Verduras, hortaliças e derivados","name":"Agrião, cru","kcal":17.0,"protein":2.7,"lipids":0.2,"carb":2.3,"fiber":2.1,"calcium":133.0,"magnesium":18.0},{"id":76,"category":"Verduras, hortaliças e derivados","name":"Aipo, cru","kcal":19.0,"protein":0.8,"lipids":0.1,"carb":4.3,"fiber":1.0,"calcium":65.0,"magnesium":9.0},{"id":77,"category":"Verduras, hortaliças e derivados","name":"Alface, americana, crua","kcal":9.0,"protein":0.6,"lipids":0.1,"carb":1.7,"fiber":1.0,"calcium":14.0,"magnesium":6.0},{"id":78,"category":"Verduras, hortaliças e derivados","name":"Alface, crespa, crua","kcal":11.0,"protein":1.3,"lipids":0.2,"carb":1.7,"fiber":1.8,"calcium":38.0,"magnesium":11.0},{"id":79,"category":"Verduras, hortaliças e derivados","name":"Alface, lisa, crua","kcal":14.0,"protein":1.7,"lipids":0.1,"carb":2.4,"fiber":2.3,"calcium":28.0,"magnesium":9.0},{"id":80,"category":"Verduras, hortaliças e derivados","name":"Alface, roxa, crua","kcal":13.0,"protein":0.9,"lipids":0.2,"carb":2.5,"fiber":2.0,"calcium":34.0,"magnesium":9.0},{"id":81,"category":"Verduras, hortaliças e derivados","name":"Alfavaca, crua","kcal":29.0,"protein":2.7,"lipids":0.5,"carb":5.2,"fiber":4.1,"calcium":258.0,"magnesium":84.0},{"id":82,"category":"Verduras, hortaliças e derivados","name":"Alho, cru","kcal":113.0,"protein":7.0,"lipids":0.2,"carb":23.9,"fiber":4.3,"calcium":14.0,"magnesium":21.0},{"id":83,"category":"Verduras, hortaliças e derivados","name":"Alho-poró, cru","kcal":32.0,"protein":1.4,"lipids":0.1,"carb":6.9,"fiber":2.5,"calcium":34.0,"magnesium":11.0},{"id":84,"category":"Verduras, hortaliças e derivados","name":"Almeirão, cru","kcal":18.0,"protein":1.8,"lipids":0.2,"carb":3.3,"fiber":2.6,"calcium":19.0,"magnesium":21.0},{"id":85,"category":"Verduras, hortaliças e derivados","name":"Almeirão, refogado","kcal":65.0,"protein":1.7,"lipids":4.8,"carb":5.7,"fiber":3.4,"calcium":63.0,"magnesium":17.0},{"id":86,"category":"Verduras, hortaliças e derivados","name":"Batata, baroa, cozida","kcal":80.0,"protein":0.9,"lipids":0.2,"carb":18.9,"fiber":1.8,"calcium":12.0,"magnesium":8.0},{"id":87,"category":"Verduras, hortaliças e derivados","name":"Batata, baroa, crua","kcal":101.0,"protein":1.0,"lipids":0.2,"carb":24.0,"fiber":2.1,"calcium":17.0,"magnesium":12.0},{"id":88,"category":"Verduras, hortaliças e derivados","name":"Batata, doce, cozida","kcal":77.0,"protein":0.6,"lipids":0.1,"carb":18.4,"fiber":2.2,"calcium":17.0,"magnesium":11.0},{"id":89,"category":"Verduras, hortaliças e derivados","name":"Batata, doce, crua","kcal":118.0,"protein":1.3,"lipids":0.1,"carb":28.2,"fiber":2.6,"calcium":21.0,"magnesium":17.0},{"id":90,"category":"Verduras, hortaliças e derivados","name":"Batata, frita, tipo chips, industrializada","kcal":543.0,"protein":5.6,"lipids":36.6,"carb":51.2,"fiber":2.5,"calcium":12.0,"magnesium":24.0},{"id":91,"category":"Verduras, hortaliças e derivados","name":"Batata, inglesa, cozida","kcal":52.0,"protein":1.2,"lipids":null,"carb":11.9,"fiber":1.3,"calcium":4.0,"magnesium":5.0},{"id":92,"category":"Verduras, hortaliças e derivados","name":"Batata, inglesa, crua","kcal":64.0,"protein":1.8,"lipids":null,"carb":14.7,"fiber":1.2,"calcium":4.0,"magnesium":15.0},{"id":93,"category":"Verduras, hortaliças e derivados","name":"Batata, inglesa, frita","kcal":267.0,"protein":5.0,"lipids":13.1,"carb":35.6,"fiber":8.1,"calcium":6.0,"magnesium":14.0},{"id":94,"category":"Verduras, hortaliças e derivados","name":"Batata, inglesa, sauté","kcal":68.0,"protein":1.3,"lipids":0.9,"carb":14.1,"fiber":1.4,"calcium":4.0,"magnesium":6.0},{"id":95,"category":"Verduras, hortaliças e derivados","name":"Berinjela, cozida","kcal":19.0,"protein":0.7,"lipids":0.1,"carb":4.5,"fiber":2.5,"calcium":11.0,"magnesium":9.0},{"id":96,"category":"Verduras, hortaliças e derivados","name":"Berinjela, crua","kcal":20.0,"protein":1.2,"lipids":0.1,"carb":4.4,"fiber":2.9,"calcium":9.0,"magnesium":13.0},{"id":97,"category":"Verduras, hortaliças e derivados","name":"Beterraba, cozida","kcal":32.0,"protein":1.3,"lipids":0.1,"carb":7.2,"fiber":1.9,"calcium":15.0,"magnesium":17.0},{"id":98,"category":"Verduras, hortaliças e derivados","name":"Beterraba, crua","kcal":49.0,"protein":1.9,"lipids":0.1,"carb":11.1,"fiber":3.4,"calcium":18.0,"magnesium":24.0},{"id":99,"category":"Verduras, hortaliças e derivados","name":"Biscoito, polvilho doce","kcal":438.0,"protein":1.3,"lipids":12.2,"carb":80.5,"fiber":1.2,"calcium":30.0,"magnesium":6.0},{"id":100,"category":"Verduras, hortaliças e derivados","name":"Brócolis, cozido","kcal":25.0,"protein":2.1,"lipids":0.5,"carb":4.4,"fiber":3.4,"calcium":51.0,"magnesium":15.0},{"id":101,"category":"Verduras, hortaliças e derivados","name":"Brócolis, cru","kcal":25.0,"protein":3.6,"lipids":0.3,"carb":4.0,"fiber":2.9,"calcium":86.0,"magnesium":30.0},{"id":102,"category":"Verduras, hortaliças e derivados","name":"Cará, cozido","kcal":78.0,"protein":1.5,"lipids":0.1,"carb":18.9,"fiber":2.6,"calcium":5.0,"magnesium":15.0},{"id":103,"category":"Verduras, hortaliças e derivados","name":"Cará, cru","kcal":96.0,"protein":2.3,"lipids":0.1,"carb":23.0,"fiber":7.3,"calcium":4.0,"magnesium":11.0},{"id":104,"category":"Verduras, hortaliças e derivados","name":"Caruru, cru","kcal":34.0,"protein":3.2,"lipids":0.6,"carb":6.0,"fiber":4.5,"calcium":455.0,"magnesium":197.0},{"id":105,"category":"Verduras, hortaliças e derivados","name":"Catalonha, crua","kcal":24.0,"protein":1.9,"lipids":0.3,"carb":4.8,"fiber":2.0,"calcium":57.0,"magnesium":17.0},{"id":106,"category":"Verduras, hortaliças e derivados","name":"Catalonha, refogada","kcal":63.0,"protein":2.0,"lipids":4.8,"carb":4.8,"fiber":3.7,"calcium":63.0,"magnesium":16.0},{"id":107,"category":"Verduras, hortaliças e derivados","name":"Cebola, crua","kcal":39.0,"protein":1.7,"lipids":0.1,"carb":8.9,"fiber":2.2,"calcium":14.0,"magnesium":12.0},{"id":108,"category":"Verduras, hortaliças e derivados","name":"Cebolinha, crua","kcal":20.0,"protein":1.9,"lipids":0.4,"carb":3.4,"fiber":3.6,"calcium":80.0,"magnesium":25.0},{"id":109,"category":"Verduras, hortaliças e derivados","name":"Cenoura, cozida","kcal":30.0,"protein":0.8,"lipids":0.2,"carb":6.7,"fiber":2.6,"calcium":26.0,"magnesium":14.0},{"id":110,"category":"Verduras, hortaliças e derivados","name":"Cenoura, crua","kcal":34.0,"protein":1.3,"lipids":0.2,"carb":7.7,"fiber":3.2,"calcium":23.0,"magnesium":11.0},{"id":111,"category":"Verduras, hortaliças e derivados","name":"Chicória, crua","kcal":14.0,"protein":1.1,"lipids":0.1,"carb":2.9,"fiber":2.2,"calcium":45.0,"magnesium":14.0},{"id":112,"category":"Verduras, hortaliças e derivados","name":"Chuchu, cozido","kcal":19.0,"protein":0.4,"lipids":null,"carb":4.8,"fiber":1.0,"calcium":8.0,"magnesium":7.0},{"id":113,"category":"Verduras, hortaliças e derivados","name":"Chuchu, cru","kcal":17.0,"protein":0.7,"lipids":0.1,"carb":4.1,"fiber":1.3,"calcium":12.0,"magnesium":7.0},{"id":114,"category":"Verduras, hortaliças e derivados","name":"Coentro, folhas desidratadas","kcal":309.0,"protein":20.9,"lipids":10.4,"carb":48.0,"fiber":37.3,"calcium":784.0,"magnesium":393.0},{"id":115,"category":"Verduras, hortaliças e derivados","name":"Couve, manteiga, crua","kcal":27.0,"protein":2.9,"lipids":0.5,"carb":4.3,"fiber":3.1,"calcium":131.0,"magnesium":35.0},{"id":116,"category":"Verduras, hortaliças e derivados","name":"Couve, manteiga, refogada","kcal":90.0,"protein":1.7,"lipids":6.6,"carb":8.7,"fiber":5.7,"calcium":177.0,"magnesium":26.0},{"id":117,"category":"Verduras, hortaliças e derivados","name":"Couve-flor, crua","kcal":23.0,"protein":1.9,"lipids":0.2,"carb":4.5,"fiber":2.4,"calcium":18.0,"magnesium":12.0},{"id":118,"category":"Verduras, hortaliças e derivados","name":"Couve-flor, cozida","kcal":19.0,"protein":1.2,"lipids":0.3,"carb":3.9,"fiber":2.1,"calcium":16.0,"magnesium":5.0},{"id":119,"category":"Verduras, hortaliças e derivados","name":"Espinafre, Nova Zelândia, cru","kcal":16.0,"protein":2.0,"lipids":0.2,"carb":2.6,"fiber":2.1,"calcium":98.0,"magnesium":82.0},{"id":120,"category":"Verduras, hortaliças e derivados","name":"Espinafre, Nova Zelândia, refogado","kcal":67.0,"protein":2.7,"lipids":5.4,"carb":4.2,"fiber":2.5,"calcium":112.0,"magnesium":123.0},{"id":121,"category":"Verduras, hortaliças e derivados","name":"Farinha, de mandioca, crua","kcal":361.0,"protein":1.6,"lipids":0.3,"carb":87.9,"fiber":6.4,"calcium":65.0,"magnesium":37.0},{"id":122,"category":"Verduras, hortaliças e derivados","name":"Farinha, de mandioca, torrada","kcal":365.0,"protein":1.2,"lipids":0.3,"carb":89.2,"fiber":6.5,"calcium":76.0,"magnesium":40.0},{"id":123,"category":"Verduras, hortaliças e derivados","name":"Farinha, de puba","kcal":360.0,"protein":1.6,"lipids":0.5,"carb":87.3,"fiber":4.2,"calcium":41.0,"magnesium":27.0},{"id":124,"category":"Verduras, hortaliças e derivados","name":"Fécula, de mandioca","kcal":331.0,"protein":0.5,"lipids":0.3,"carb":81.1,"fiber":0.6,"calcium":12.0,"magnesium":3.0},{"id":125,"category":"Verduras, hortaliças e derivados","name":"Feijão, broto, cru","kcal":39.0,"protein":4.2,"lipids":0.1,"carb":7.8,"fiber":2.0,"calcium":14.0,"magnesium":25.0},{"id":126,"category":"Verduras, hortaliças e derivados","name":"Inhame, cru","kcal":97.0,"protein":2.1,"lipids":0.2,"carb":23.2,"fiber":1.7,"calcium":12.0,"magnesium":29.0},{"id":127,"category":"Verduras, hortaliças e derivados","name":"Jiló, cru","kcal":27.0,"protein":1.4,"lipids":0.2,"carb":6.2,"fiber":4.8,"calcium":20.0,"magnesium":21.0},{"id":128,"category":"Verduras, hortaliças e derivados","name":"Jurubeba, crua","kcal":126.0,"protein":4.4,"lipids":3.9,"carb":23.1,"fiber":23.9,"calcium":151.0,"magnesium":65.0},{"id":129,"category":"Verduras, hortaliças e derivados","name":"Mandioca, cozida","kcal":125.0,"protein":0.6,"lipids":0.3,"carb":30.1,"fiber":1.6,"calcium":19.0,"magnesium":27.0},{"id":130,"category":"Verduras, hortaliças e derivados","name":"Mandioca, crua","kcal":151.0,"protein":1.1,"lipids":0.3,"carb":36.2,"fiber":1.9,"calcium":15.0,"magnesium":44.0},{"id":131,"category":"Verduras, hortaliças e derivados","name":"Mandioca, farofa, temperada","kcal":406.0,"protein":2.1,"lipids":9.1,"carb":80.3,"fiber":7.8,"calcium":66.0,"magnesium":34.0},{"id":132,"category":"Verduras, hortaliças e derivados","name":"Mandioca, frita","kcal":300.0,"protein":1.4,"lipids":11.2,"carb":50.3,"fiber":1.9,"calcium":23.0,"magnesium":95.0},{"id":133,"category":"Verduras, hortaliças e derivados","name":"Manjericão, cru","kcal":21.0,"protein":2.0,"lipids":0.4,"carb":3.6,"fiber":3.3,"calcium":211.0,"magnesium":58.0},{"id":134,"category":"Verduras, hortaliças e derivados","name":"Maxixe, cru","kcal":14.0,"protein":1.4,"lipids":0.1,"carb":2.7,"fiber":2.2,"calcium":21.0,"magnesium":10.0},{"id":135,"category":"Verduras, hortaliças e derivados","name":"Mostarda, folha, crua","kcal":18.0,"protein":2.1,"lipids":0.2,"carb":3.2,"fiber":1.9,"calcium":68.0,"magnesium":16.0},{"id":136,"category":"Verduras, hortaliças e derivados","name":"Nhoque, batata, cozido","kcal":181.0,"protein":5.9,"lipids":1.9,"carb":36.8,"fiber":1.8,"calcium":11.0,"magnesium":18.0},{"id":137,"category":"Verduras, hortaliças e derivados","name":"Nabo, cru","kcal":18.0,"protein":1.2,"lipids":0.1,"carb":4.1,"fiber":2.6,"calcium":42.0,"magnesium":15.0},{"id":138,"category":"Verduras, hortaliças e derivados","name":"Palmito, juçara, em conserva","kcal":23.0,"protein":1.8,"lipids":0.4,"carb":4.3,"fiber":3.2,"calcium":58.0,"magnesium":34.0},{"id":139,"category":"Verduras, hortaliças e derivados","name":"Palmito, pupunha, em conserva","kcal":29.0,"protein":2.5,"lipids":0.5,"carb":5.5,"fiber":2.6,"calcium":32.0,"magnesium":25.0},{"id":140,"category":"Verduras, hortaliças e derivados","name":"Pão, de queijo, assado","kcal":363.0,"protein":5.1,"lipids":24.6,"carb":34.2,"fiber":0.6,"calcium":102.0,"magnesium":8.0},{"id":141,"category":"Verduras, hortaliças e derivados","name":"Pão, de queijo, cru","kcal":295.0,"protein":3.6,"lipids":14.0,"carb":38.5,"fiber":1.0,"calcium":88.0,"magnesium":7.0},{"id":142,"category":"Verduras, hortaliças e derivados","name":"Pepino, cru","kcal":10.0,"protein":0.9,"lipids":null,"carb":2.0,"fiber":1.1,"calcium":10.0,"magnesium":9.0},{"id":143,"category":"Verduras, hortaliças e derivados","name":"Pimentão, amarelo, cru","kcal":28.0,"protein":1.2,"lipids":0.4,"carb":6.0,"fiber":1.9,"calcium":10.0,"magnesium":11.0},{"id":144,"category":"Verduras, hortaliças e derivados","name":"Pimentão, verde, cru","kcal":21.0,"protein":1.1,"lipids":0.2,"carb":4.9,"fiber":2.6,"calcium":9.0,"magnesium":8.0},{"id":145,"category":"Verduras, hortaliças e derivados","name":"Pimentão, vermelho, cru","kcal":23.0,"protein":1.0,"lipids":0.1,"carb":5.5,"fiber":1.6,"calcium":6.0,"magnesium":11.0},{"id":146,"category":"Verduras, hortaliças e derivados","name":"Polvilho, doce","kcal":351.0,"protein":0.4,"lipids":null,"carb":86.8,"fiber":0.2,"calcium":27.0,"magnesium":4.0},{"id":147,"category":"Verduras, hortaliças e derivados","name":"Quiabo, cru","kcal":30.0,"protein":1.9,"lipids":0.3,"carb":6.4,"fiber":4.6,"calcium":112.0,"magnesium":50.0},{"id":148,"category":"Verduras, hortaliças e derivados","name":"Rabanete, cru","kcal":14.0,"protein":1.4,"lipids":0.1,"carb":2.7,"fiber":2.2,"calcium":21.0,"magnesium":10.0},{"id":149,"category":"Verduras, hortaliças e derivados","name":"Repolho, branco, cru","kcal":17.0,"protein":0.9,"lipids":0.1,"carb":3.9,"fiber":1.9,"calcium":35.0,"magnesium":9.0},{"id":150,"category":"Verduras, hortaliças e derivados","name":"Repolho, roxo, cru","kcal":31.0,"protein":1.9,"lipids":0.1,"carb":7.2,"fiber":2.0,"calcium":44.0,"magnesium":18.0},{"id":151,"category":"Verduras, hortaliças e derivados","name":"Repolho, roxo, refogado","kcal":42.0,"protein":1.8,"lipids":1.2,"carb":7.6,"fiber":1.8,"calcium":43.0,"magnesium":17.0},{"id":152,"category":"Verduras, hortaliças e derivados","name":"Rúcula, crua","kcal":13.0,"protein":1.8,"lipids":0.1,"carb":2.2,"fiber":1.7,"calcium":117.0,"magnesium":18.0},{"id":153,"category":"Verduras, hortaliças e derivados","name":"Salsa, crua","kcal":33.0,"protein":3.3,"lipids":0.6,"carb":5.7,"fiber":1.9,"calcium":179.0,"magnesium":21.0},{"id":154,"category":"Verduras, hortaliças e derivados","name":"Seleta de legumes, enlatada","kcal":57.0,"protein":3.4,"lipids":0.4,"carb":12.7,"fiber":3.1,"calcium":16.0,"magnesium":16.0},{"id":155,"category":"Verduras, hortaliças e derivados","name":"Serralha, crua","kcal":30.0,"protein":2.7,"lipids":0.7,"carb":4.9,"fiber":3.5,"calcium":126.0,"magnesium":30.0},{"id":156,"category":"Verduras, hortaliças e derivados","name":"Taioba, crua","kcal":34.0,"protein":2.9,"lipids":0.9,"carb":5.4,"fiber":4.5,"calcium":141.0,"magnesium":38.0},{"id":157,"category":"Verduras, hortaliças e derivados","name":"Tomate, com semente, cru","kcal":15.0,"protein":1.1,"lipids":0.2,"carb":3.1,"fiber":1.2,"calcium":7.0,"magnesium":11.0},{"id":158,"category":"Verduras, hortaliças e derivados","name":"Tomate, extrato","kcal":61.0,"protein":2.4,"lipids":0.2,"carb":15.0,"fiber":2.8,"calcium":29.0,"magnesium":29.0},{"id":159,"category":"Verduras, hortaliças e derivados","name":"Tomate, molho industrializado","kcal":38.0,"protein":1.4,"lipids":0.9,"carb":7.7,"fiber":3.1,"calcium":12.0,"magnesium":17.0},{"id":160,"category":"Verduras, hortaliças e derivados","name":"Tomate, purê","kcal":28.0,"protein":1.4,"lipids":null,"carb":6.9,"fiber":1.0,"calcium":13.0,"magnesium":15.0},{"id":161,"category":"Verduras, hortaliças e derivados","name":"Tomate, salada","kcal":21.0,"protein":0.8,"lipids":null,"carb":5.1,"fiber":2.3,"calcium":7.0,"magnesium":10.0},{"id":162,"category":"Verduras, hortaliças e derivados","name":"Vagem, crua","kcal":25.0,"protein":1.8,"lipids":0.2,"carb":5.3,"fiber":2.4,"calcium":41.0,"magnesium":18.0},{"id":163,"category":"Frutas e derivados","name":"Abacate, cru","kcal":96.0,"protein":1.2,"lipids":8.4,"carb":6.0,"fiber":6.3,"calcium":8.0,"magnesium":15.0},{"id":164,"category":"Frutas e derivados","name":"Abacaxi, cru","kcal":48.0,"protein":0.9,"lipids":0.1,"carb":12.3,"fiber":1.0,"calcium":22.0,"magnesium":18.0},{"id":165,"category":"Frutas e derivados","name":"Abacaxi, polpa, congelada","kcal":31.0,"protein":0.5,"lipids":0.1,"carb":7.8,"fiber":0.3,"calcium":14.0,"magnesium":10.0},{"id":166,"category":"Frutas e derivados","name":"Abiu, cru","kcal":62.0,"protein":0.8,"lipids":0.7,"carb":14.9,"fiber":1.7,"calcium":6.0,"magnesium":9.0},{"id":167,"category":"Frutas e derivados","name":"Açaí, polpa, com xarope de guaraná e glucose","kcal":110.0,"protein":0.7,"lipids":3.7,"carb":21.5,"fiber":1.7,"calcium":22.0,"magnesium":13.0},{"id":168,"category":"Frutas e derivados","name":"Açaí, polpa, congelada","kcal":58.0,"protein":0.8,"lipids":3.9,"carb":6.2,"fiber":2.6,"calcium":35.0,"magnesium":17.0},{"id":169,"category":"Frutas e derivados","name":"Acerola, crua","kcal":33.0,"protein":0.9,"lipids":0.2,"carb":8.0,"fiber":1.5,"calcium":13.0,"magnesium":13.0},{"id":170,"category":"Frutas e derivados","name":"Acerola, polpa, congelada","kcal":22.0,"protein":0.6,"lipids":null,"carb":5.5,"fiber":0.7,"calcium":8.0,"magnesium":9.0},{"id":171,"category":"Frutas e derivados","name":"Ameixa, calda, enlatada","kcal":183.0,"protein":0.4,"lipids":null,"carb":46.9,"fiber":0.5,"calcium":13.0,"magnesium":10.0},{"id":172,"category":"Frutas e derivados","name":"Ameixa, crua","kcal":53.0,"protein":0.8,"lipids":null,"carb":13.9,"fiber":2.4,"calcium":6.0,"magnesium":5.0},{"id":173,"category":"Frutas e derivados","name":"Ameixa, em calda, enlatada, drenada","kcal":177.0,"protein":1.0,"lipids":0.3,"carb":47.7,"fiber":4.5,"calcium":39.0,"magnesium":14.0},{"id":174,"category":"Frutas e derivados","name":"Atemóia, crua","kcal":97.0,"protein":1.0,"lipids":0.3,"carb":25.3,"fiber":2.1,"calcium":23.0,"magnesium":25.0},{"id":175,"category":"Frutas e derivados","name":"Banana, da terra, crua","kcal":128.0,"protein":1.4,"lipids":0.2,"carb":33.7,"fiber":1.5,"calcium":4.0,"magnesium":24.0},{"id":176,"category":"Frutas e derivados","name":"Banana, doce em barra","kcal":280.0,"protein":2.2,"lipids":0.1,"carb":75.7,"fiber":3.8,"calcium":12.0,"magnesium":49.0},{"id":177,"category":"Frutas e derivados","name":"Banana, figo, crua","kcal":105.0,"protein":1.1,"lipids":0.1,"carb":27.8,"fiber":2.8,"calcium":6.0,"magnesium":30.0},{"id":178,"category":"Frutas e derivados","name":"Banana, maçã, crua","kcal":87.0,"protein":1.8,"lipids":0.1,"carb":22.3,"fiber":2.6,"calcium":3.0,"magnesium":24.0},{"id":179,"category":"Frutas e derivados","name":"Banana, nanica, crua","kcal":92.0,"protein":1.4,"lipids":0.1,"carb":23.8,"fiber":1.9,"calcium":3.0,"magnesium":28.0},{"id":180,"category":"Frutas e derivados","name":"Banana, ouro, crua","kcal":112.0,"protein":1.5,"lipids":0.2,"carb":29.3,"fiber":2.0,"calcium":3.0,"magnesium":28.0},{"id":181,"category":"Frutas e derivados","name":"Banana, pacova, crua","kcal":78.0,"protein":1.2,"lipids":0.1,"carb":20.3,"fiber":2.0,"calcium":5.0,"magnesium":30.0},{"id":182,"category":"Frutas e derivados","name":"Banana, prata, crua","kcal":98.0,"protein":1.3,"lipids":0.1,"carb":26.0,"fiber":2.0,"calcium":8.0,"magnesium":26.0},{"id":183,"category":"Frutas e derivados","name":"Cacau, cru","kcal":74.0,"protein":1.0,"lipids":0.1,"carb":19.4,"fiber":2.2,"calcium":12.0,"magnesium":25.0},{"id":184,"category":"Frutas e derivados","name":"Cajá-Manga, cru","kcal":46.0,"protein":1.3,"lipids":null,"carb":11.4,"fiber":2.6,"calcium":13.0,"magnesium":11.0},{"id":185,"category":"Frutas e derivados","name":"Cajá, polpa, congelada","kcal":26.0,"protein":0.6,"lipids":0.2,"carb":6.4,"fiber":1.4,"calcium":9.0,"magnesium":7.0},{"id":186,"category":"Frutas e derivados","name":"Caju, cru","kcal":43.0,"protein":1.0,"lipids":0.3,"carb":10.3,"fiber":1.7,"calcium":1.0,"magnesium":10.0},{"id":187,"category":"Frutas e derivados","name":"Caju, polpa, congelada","kcal":37.0,"protein":0.5,"lipids":0.2,"carb":9.4,"fiber":0.8,"calcium":1.0,"magnesium":7.0},{"id":188,"category":"Frutas e derivados","name":"Caju, suco concentrado, envasado","kcal":45.0,"protein":0.4,"lipids":0.2,"carb":10.7,"fiber":0.6,"calcium":1.0,"magnesium":8.0},{"id":189,"category":"Frutas e derivados","name":"Caqui, chocolate, cru","kcal":71.0,"protein":0.4,"lipids":0.1,"carb":19.3,"fiber":6.5,"calcium":18.0,"magnesium":9.0},{"id":190,"category":"Frutas e derivados","name":"Carambola, crua","kcal":46.0,"protein":0.9,"lipids":0.2,"carb":11.5,"fiber":2.0,"calcium":5.0,"magnesium":7.0},{"id":191,"category":"Frutas e derivados","name":"Ciriguela, crua","kcal":76.0,"protein":1.4,"lipids":0.4,"carb":18.9,"fiber":3.9,"calcium":27.0,"magnesium":18.0},{"id":192,"category":"Frutas e derivados","name":"Cupuaçu, cru","kcal":49.0,"protein":1.2,"lipids":1.0,"carb":10.4,"fiber":3.1,"calcium":13.0,"magnesium":18.0},{"id":193,"category":"Frutas e derivados","name":"Cupuaçu, polpa, congelada","kcal":49.0,"protein":0.8,"lipids":0.6,"carb":11.4,"fiber":1.6,"calcium":5.0,"magnesium":14.0},{"id":194,"category":"Frutas e derivados","name":"Figo, cru","kcal":41.0,"protein":1.0,"lipids":0.2,"carb":10.2,"fiber":1.8,"calcium":27.0,"magnesium":11.0},{"id":195,"category":"Frutas e derivados","name":"Figo, enlatado, em calda","kcal":184.0,"protein":0.6,"lipids":0.2,"carb":50.3,"fiber":2.0,"calcium":33.0,"magnesium":7.0},{"id":196,"category":"Frutas e derivados","name":"Fruta-pão, crua","kcal":67.0,"protein":1.1,"lipids":0.2,"carb":17.2,"fiber":5.5,"calcium":34.0,"magnesium":24.0},{"id":197,"category":"Frutas e derivados","name":"Goiaba, branca, com casca, crua","kcal":52.0,"protein":0.9,"lipids":0.5,"carb":12.4,"fiber":6.3,"calcium":5.0,"magnesium":7.0},{"id":198,"category":"Frutas e derivados","name":"Goiaba, doce em pasta","kcal":269.0,"protein":0.6,"lipids":0.0,"carb":74.1,"fiber":3.7,"calcium":10.0,"magnesium":6.0},{"id":199,"category":"Frutas e derivados","name":"Goiaba, doce, cascão","kcal":286.0,"protein":0.4,"lipids":0.1,"carb":78.7,"fiber":4.4,"calcium":15.0,"magnesium":10.0},{"id":200,"category":"Frutas e derivados","name":"Goiaba, vermelha, com casca, crua","kcal":54.0,"protein":1.1,"lipids":0.4,"carb":13.0,"fiber":6.2,"calcium":4.0,"magnesium":7.0},{"id":201,"category":"Frutas e derivados","name":"Graviola, crua","kcal":62.0,"protein":0.8,"lipids":0.2,"carb":15.8,"fiber":1.9,"calcium":40.0,"magnesium":23.0},{"id":202,"category":"Frutas e derivados","name":"Graviola, polpa, congelada","kcal":38.0,"protein":0.6,"lipids":0.1,"carb":9.8,"fiber":1.2,"calcium":6.0,"magnesium":10.0},{"id":203,"category":"Frutas e derivados","name":"Jabuticaba, crua","kcal":58.0,"protein":0.6,"lipids":0.1,"carb":15.3,"fiber":2.3,"calcium":8.0,"magnesium":18.0},{"id":204,"category":"Frutas e derivados","name":"Jaca, crua","kcal":88.0,"protein":1.4,"lipids":0.3,"carb":22.5,"fiber":2.4,"calcium":11.0,"magnesium":40.0},{"id":205,"category":"Frutas e derivados","name":"Jambo, cru","kcal":27.0,"protein":0.9,"lipids":0.1,"carb":6.5,"fiber":5.1,"calcium":14.0,"magnesium":14.0},{"id":206,"category":"Frutas e derivados","name":"Jamelão, cru","kcal":41.0,"protein":0.5,"lipids":0.1,"carb":10.6,"fiber":1.8,"calcium":3.0,"magnesium":2.0},{"id":207,"category":"Frutas e derivados","name":"Kiwi, cru","kcal":51.0,"protein":1.3,"lipids":0.6,"carb":11.5,"fiber":2.7,"calcium":24.0,"magnesium":11.0},{"id":208,"category":"Frutas e derivados","name":"Laranja, baía, crua","kcal":45.0,"protein":1.0,"lipids":0.1,"carb":11.5,"fiber":1.1,"calcium":35.0,"magnesium":9.0},{"id":209,"category":"Frutas e derivados","name":"Laranja, baía, suco","kcal":37.0,"protein":0.7,"lipids":null,"carb":8.7,"fiber":null,"calcium":6.0,"magnesium":8.0},{"id":210,"category":"Frutas e derivados","name":"Laranja, da terra, crua","kcal":51.0,"protein":1.1,"lipids":0.2,"carb":12.9,"fiber":4.0,"calcium":51.0,"magnesium":14.0},{"id":211,"category":"Frutas e derivados","name":"Laranja, da terra, suco","kcal":41.0,"protein":0.7,"lipids":0.1,"carb":9.6,"fiber":1.0,"calcium":13.0,"magnesium":10.0},{"id":212,"category":"Frutas e derivados","name":"Laranja, lima, crua","kcal":46.0,"protein":1.1,"lipids":0.1,"carb":11.5,"fiber":1.8,"calcium":31.0,"magnesium":10.0},{"id":213,"category":"Frutas e derivados","name":"Laranja, lima, suco","kcal":39.0,"protein":0.7,"lipids":0.1,"carb":9.2,"fiber":0.4,"calcium":8.0,"magnesium":11.0},{"id":214,"category":"Frutas e derivados","name":"Laranja, pêra, crua","kcal":37.0,"protein":1.0,"lipids":0.1,"carb":8.9,"fiber":0.8,"calcium":22.0,"magnesium":9.0},{"id":215,"category":"Frutas e derivados","name":"Laranja, pêra, suco","kcal":33.0,"protein":0.7,"lipids":0.1,"carb":7.6,"fiber":null,"calcium":7.0,"magnesium":8.0},{"id":216,"category":"Frutas e derivados","name":"Laranja, valência, crua","kcal":46.0,"protein":0.8,"lipids":0.2,"carb":11.7,"fiber":1.7,"calcium":34.0,"magnesium":14.0},{"id":217,"category":"Frutas e derivados","name":"Laranja, valência, suco","kcal":36.0,"protein":0.5,"lipids":0.1,"carb":8.6,"fiber":0.4,"calcium":9.0,"magnesium":10.0},{"id":218,"category":"Frutas e derivados","name":"Limão, cravo, suco","kcal":14.0,"protein":0.3,"lipids":null,"carb":5.2,"fiber":null,"calcium":10.0,"magnesium":9.0},{"id":219,"category":"Frutas e derivados","name":"Limão, galego, suco","kcal":22.0,"protein":0.6,"lipids":0.1,"carb":7.3,"fiber":null,"calcium":5.0,"magnesium":6.0},{"id":220,"category":"Frutas e derivados","name":"Limão, tahiti, cru","kcal":32.0,"protein":0.9,"lipids":0.1,"carb":11.1,"fiber":1.2,"calcium":51.0,"magnesium":10.0},{"id":221,"category":"Frutas e derivados","name":"Maçã, Argentina, com casca, crua","kcal":63.0,"protein":0.2,"lipids":0.2,"carb":16.6,"fiber":2.0,"calcium":3.0,"magnesium":5.0},{"id":222,"category":"Frutas e derivados","name":"Maçã, Fuji, com casca, crua","kcal":56.0,"protein":0.3,"lipids":null,"carb":15.2,"fiber":1.3,"calcium":2.0,"magnesium":2.0},{"id":223,"category":"Frutas e derivados","name":"Macaúba, crua","kcal":404.0,"protein":2.1,"lipids":40.7,"carb":13.9,"fiber":13.4,"calcium":67.0,"magnesium":66.0},{"id":224,"category":"Frutas e derivados","name":"Mamão, doce em calda, drenado","kcal":196.0,"protein":0.2,"lipids":0.1,"carb":54.0,"fiber":1.3,"calcium":20.0,"magnesium":6.0},{"id":225,"category":"Frutas e derivados","name":"Mamão, Formosa, cru","kcal":45.0,"protein":0.8,"lipids":0.1,"carb":11.6,"fiber":1.8,"calcium":25.0,"magnesium":17.0},{"id":226,"category":"Frutas e derivados","name":"Mamão, Papaia, cru","kcal":40.0,"protein":0.5,"lipids":0.1,"carb":10.4,"fiber":1.0,"calcium":22.0,"magnesium":22.0},{"id":227,"category":"Frutas e derivados","name":"Mamão verde, doce em calda, drenado","kcal":209.0,"protein":0.3,"lipids":0.1,"carb":57.6,"fiber":1.2,"calcium":12.0,"magnesium":5.0},{"id":228,"category":"Frutas e derivados","name":"Manga, Haden, crua","kcal":64.0,"protein":0.4,"lipids":0.3,"carb":16.7,"fiber":1.6,"calcium":12.0,"magnesium":8.0},{"id":229,"category":"Frutas e derivados","name":"Manga, Palmer, crua","kcal":72.0,"protein":0.4,"lipids":0.2,"carb":19.4,"fiber":1.6,"calcium":12.0,"magnesium":9.0},{"id":230,"category":"Frutas e derivados","name":"Manga, polpa, congelada","kcal":48.0,"protein":0.4,"lipids":0.2,"carb":12.5,"fiber":1.1,"calcium":7.0,"magnesium":9.0},{"id":231,"category":"Frutas e derivados","name":"Manga, Tommy Atkins, crua","kcal":51.0,"protein":0.9,"lipids":0.2,"carb":12.8,"fiber":2.1,"calcium":8.0,"magnesium":7.0},{"id":232,"category":"Frutas e derivados","name":"Maracujá, cru","kcal":68.0,"protein":2.0,"lipids":2.1,"carb":12.3,"fiber":1.1,"calcium":5.0,"magnesium":28.0},{"id":233,"category":"Frutas e derivados","name":"Maracujá, polpa, congelada","kcal":39.0,"protein":0.8,"lipids":0.2,"carb":9.6,"fiber":0.5,"calcium":5.0,"magnesium":10.0},{"id":234,"category":"Frutas e derivados","name":"Maracujá, suco concentrado, envasado","kcal":42.0,"protein":0.8,"lipids":0.2,"carb":9.6,"fiber":0.4,"calcium":4.0,"magnesium":4.0},{"id":235,"category":"Frutas e derivados","name":"Melancia, crua","kcal":33.0,"protein":0.9,"lipids":null,"carb":8.1,"fiber":0.1,"calcium":8.0,"magnesium":10.0},{"id":236,"category":"Frutas e derivados","name":"Melão, cru","kcal":29.0,"protein":0.7,"lipids":null,"carb":7.5,"fiber":0.3,"calcium":3.0,"magnesium":6.0},{"id":237,"category":"Frutas e derivados","name":"Mexerica, Murcote, crua","kcal":58.0,"protein":0.9,"lipids":0.1,"carb":14.9,"fiber":3.1,"calcium":33.0,"magnesium":12.0},{"id":238,"category":"Frutas e derivados","name":"Mexerica, Rio, crua","kcal":37.0,"protein":0.7,"lipids":0.1,"carb":9.3,"fiber":2.7,"calcium":17.0,"magnesium":8.0},{"id":239,"category":"Frutas e derivados","name":"Morango, cru","kcal":30.0,"protein":0.9,"lipids":0.3,"carb":6.8,"fiber":1.7,"calcium":11.0,"magnesium":10.0},{"id":240,"category":"Frutas e derivados","name":"Nêspera, crua","kcal":43.0,"protein":0.3,"lipids":null,"carb":11.5,"fiber":3.0,"calcium":20.0,"magnesium":10.0},{"id":241,"category":"Frutas e derivados","name":"Pequi, cru","kcal":205.0,"protein":2.3,"lipids":18.0,"carb":13.0,"fiber":19.0,"calcium":32.0,"magnesium":30.0},{"id":242,"category":"Frutas e derivados","name":"Pêra, Park, crua","kcal":61.0,"protein":0.2,"lipids":0.2,"carb":16.1,"fiber":3.0,"calcium":9.0,"magnesium":6.0},{"id":243,"category":"Frutas e derivados","name":"Pêra, Williams, crua","kcal":53.0,"protein":0.6,"lipids":0.1,"carb":14.0,"fiber":3.0,"calcium":8.0,"magnesium":6.0},{"id":244,"category":"Frutas e derivados","name":"Pêssego, Aurora, cru","kcal":36.0,"protein":0.8,"lipids":null,"carb":9.3,"fiber":1.4,"calcium":3.0,"magnesium":4.0},{"id":245,"category":"Frutas e derivados","name":"Pêssego, enlatado, em calda","kcal":63.0,"protein":0.7,"lipids":null,"carb":16.9,"fiber":1.0,"calcium":4.0,"magnesium":4.0},{"id":246,"category":"Frutas e derivados","name":"Pinha, crua","kcal":88.0,"protein":1.5,"lipids":0.3,"carb":22.4,"fiber":3.4,"calcium":21.0,"magnesium":31.0},{"id":247,"category":"Frutas e derivados","name":"Pitanga, crua","kcal":41.0,"protein":0.9,"lipids":0.2,"carb":10.2,"fiber":3.2,"calcium":18.0,"magnesium":12.0},{"id":248,"category":"Frutas e derivados","name":"Pitanga, polpa, congelada","kcal":19.0,"protein":0.3,"lipids":0.1,"carb":4.8,"fiber":0.7,"calcium":8.0,"magnesium":6.0},{"id":249,"category":"Frutas e derivados","name":"Romã, crua","kcal":56.0,"protein":0.4,"lipids":null,"carb":15.1,"fiber":0.4,"calcium":5.0,"magnesium":13.0},{"id":250,"category":"Frutas e derivados","name":"Tamarindo, cru","kcal":276.0,"protein":3.2,"lipids":0.5,"carb":72.5,"fiber":6.4,"calcium":37.0,"magnesium":59.0},{"id":251,"category":"Frutas e derivados","name":"Tangerina, Poncã, crua","kcal":38.0,"protein":0.8,"lipids":0.1,"carb":9.6,"fiber":0.9,"calcium":13.0,"magnesium":8.0},{"id":252,"category":"Frutas e derivados","name":"Tangerina, Poncã, suco","kcal":36.0,"protein":0.5,"lipids":null,"carb":8.8,"fiber":null,"calcium":4.0,"magnesium":6.0},{"id":253,"category":"Frutas e derivados","name":"Tucumã, cru","kcal":262.0,"protein":2.1,"lipids":19.1,"carb":26.5,"fiber":12.7,"calcium":46.0,"magnesium":121.0},{"id":254,"category":"Frutas e derivados","name":"Umbu, cru","kcal":37.0,"protein":0.8,"lipids":null,"carb":9.4,"fiber":2.0,"calcium":12.0,"magnesium":11.0},{"id":255,"category":"Frutas e derivados","name":"Umbu, polpa, congelada","kcal":34.0,"protein":0.5,"lipids":0.1,"carb":8.8,"fiber":1.3,"calcium":11.0,"magnesium":8.0},{"id":256,"category":"Frutas e derivados","name":"Uva, Itália, crua","kcal":53.0,"protein":0.7,"lipids":0.2,"carb":13.6,"fiber":0.9,"calcium":7.0,"magnesium":5.0},{"id":257,"category":"Frutas e derivados","name":"Uva, Rubi, crua","kcal":49.0,"protein":0.6,"lipids":0.2,"carb":12.7,"fiber":0.9,"calcium":8.0,"magnesium":6.0},{"id":258,"category":"Frutas e derivados","name":"Uva, suco concentrado, envasado","kcal":58.0,"protein":null,"lipids":null,"carb":14.7,"fiber":0.2,"calcium":9.0,"magnesium":7.0},{"id":261,"category":"Gorduras e óleos","name":"Manteiga, com sal","kcal":726.0,"protein":0.4,"lipids":82.4,"carb":0.1,"fiber":null,"calcium":9.0,"magnesium":1.0},{"id":262,"category":"Gorduras e óleos","name":"Manteiga, sem sal","kcal":758.0,"protein":0.4,"lipids":86.0,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":1.0},{"id":263,"category":"Gorduras e óleos","name":"Margarina, com óleo hidrogenado, com sal (65% de lipídeos)","kcal":596.0,"protein":null,"lipids":67.4,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":1.0},{"id":264,"category":"Gorduras e óleos","name":"Margarina, com óleo hidrogenado, sem sal (80% de lipídeos)","kcal":723.0,"protein":null,"lipids":81.7,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":1.0},{"id":265,"category":"Gorduras e óleos","name":"Margarina, com óleo interesterificado, com sal (65%de lipídeos)","kcal":594.0,"protein":null,"lipids":67.2,"carb":0.0,"fiber":null,"calcium":5.0,"magnesium":1.0},{"id":266,"category":"Gorduras e óleos","name":"Margarina, com óleo interesterificado, sem sal (65% de lipídeos)","kcal":593.0,"protein":null,"lipids":67.1,"carb":0.0,"fiber":null,"calcium":5.0,"magnesium":1.0},{"id":273,"category":"Pescados e frutos do mar","name":"Abadejo, filé, congelado, assado","kcal":112.0,"protein":23.5,"lipids":1.2,"carb":0.0,"fiber":null,"calcium":23.0,"magnesium":20.0},{"id":274,"category":"Pescados e frutos do mar","name":"Abadejo, filé, congelado,cozido","kcal":91.0,"protein":19.3,"lipids":0.9,"carb":0.0,"fiber":null,"calcium":17.0,"magnesium":16.0},{"id":275,"category":"Pescados e frutos do mar","name":"Abadejo, filé, congelado, cru","kcal":59.0,"protein":13.1,"lipids":0.4,"carb":0.0,"fiber":null,"calcium":10.0,"magnesium":14.0},{"id":276,"category":"Pescados e frutos do mar","name":"Abadejo, filé, congelado, grelhado","kcal":130.0,"protein":27.6,"lipids":1.3,"carb":0.0,"fiber":null,"calcium":20.0,"magnesium":22.0},{"id":277,"category":"Pescados e frutos do mar","name":"Atum, conserva em óleo","kcal":166.0,"protein":26.2,"lipids":6.0,"carb":0.0,"fiber":null,"calcium":7.0,"magnesium":29.0},{"id":278,"category":"Pescados e frutos do mar","name":"Atum, fresco, cru","kcal":118.0,"protein":25.7,"lipids":0.9,"carb":0.0,"fiber":null,"calcium":7.0,"magnesium":32.0},{"id":279,"category":"Pescados e frutos do mar","name":"Bacalhau, salgado, cru","kcal":136.0,"protein":29.0,"lipids":1.3,"carb":0.0,"fiber":null,"calcium":157.0,"magnesium":49.0},{"id":280,"category":"Pescados e frutos do mar","name":"Bacalhau, salgado, refogado","kcal":140.0,"protein":24.0,"lipids":3.6,"carb":1.2,"fiber":null,"calcium":59.0,"magnesium":15.0},{"id":281,"category":"Pescados e frutos do mar","name":"Cação, posta, com farinha de trigo, frita","kcal":208.0,"protein":25.0,"lipids":10.0,"carb":3.1,"fiber":0.5,"calcium":30.0,"magnesium":26.0},{"id":282,"category":"Pescados e frutos do mar","name":"Cação, posta, cozida","kcal":116.0,"protein":25.6,"lipids":0.7,"carb":0.0,"fiber":null,"calcium":10.0,"magnesium":21.0},{"id":283,"category":"Pescados e frutos do mar","name":"Cação, posta, crua","kcal":83.0,"protein":17.9,"lipids":0.8,"carb":0.0,"fiber":null,"calcium":9.0,"magnesium":19.0},{"id":284,"category":"Pescados e frutos do mar","name":"Camarão, Rio Grande, grande, cozido","kcal":90.0,"protein":19.0,"lipids":1.0,"carb":0.0,"fiber":null,"calcium":90.0,"magnesium":19.0},{"id":285,"category":"Pescados e frutos do mar","name":"Camarão, Rio Grande, grande, cru","kcal":47.0,"protein":10.0,"lipids":0.5,"carb":0.0,"fiber":null,"calcium":51.0,"magnesium":27.0},{"id":286,"category":"Pescados e frutos do mar","name":"Camarão, Sete Barbas, sem cabeça, com casca, frito","kcal":231.0,"protein":18.4,"lipids":15.6,"carb":2.9,"fiber":null,"calcium":960.0,"magnesium":74.0},{"id":287,"category":"Pescados e frutos do mar","name":"Caranguejo, cozido","kcal":83.0,"protein":18.5,"lipids":0.4,"carb":0.0,"fiber":null,"calcium":357.0,"magnesium":52.0},{"id":288,"category":"Pescados e frutos do mar","name":"Corimba, cru","kcal":128.0,"protein":17.4,"lipids":6.0,"carb":0.0,"fiber":null,"calcium":40.0,"magnesium":23.0},{"id":289,"category":"Pescados e frutos do mar","name":"Corimbatá, assado","kcal":261.0,"protein":19.9,"lipids":19.6,"carb":0.0,"fiber":null,"calcium":22.0,"magnesium":24.0},{"id":290,"category":"Pescados e frutos do mar","name":"Corimbatá, cozido","kcal":239.0,"protein":20.1,"lipids":16.9,"carb":0.0,"fiber":null,"calcium":65.0,"magnesium":23.0},{"id":291,"category":"Pescados e frutos do mar","name":"Corvina de água doce, crua","kcal":101.0,"protein":18.9,"lipids":2.2,"carb":0.0,"fiber":null,"calcium":39.0,"magnesium":25.0},{"id":292,"category":"Pescados e frutos do mar","name":"Corvina do mar, crua","kcal":94.0,"protein":18.6,"lipids":1.6,"carb":0.0,"fiber":null,"calcium":null,"magnesium":24.0},{"id":293,"category":"Pescados e frutos do mar","name":"Corvina grande, assada","kcal":147.0,"protein":26.8,"lipids":3.6,"carb":0.0,"fiber":null,"calcium":60.0,"magnesium":24.0},{"id":294,"category":"Pescados e frutos do mar","name":"Corvina grande, cozida","kcal":100.0,"protein":23.4,"lipids":2.6,"carb":0.0,"fiber":null,"calcium":69.0,"magnesium":22.0},{"id":295,"category":"Pescados e frutos do mar","name":"Dourada de água doce, fresca","kcal":131.0,"protein":18.8,"lipids":5.6,"carb":0.0,"fiber":null,"calcium":12.0,"magnesium":26.0},{"id":296,"category":"Pescados e frutos do mar","name":"Lambari, congelado, cru","kcal":131.0,"protein":16.8,"lipids":6.5,"carb":0.0,"fiber":null,"calcium":1181.0,"magnesium":45.0},{"id":297,"category":"Pescados e frutos do mar","name":"Lambari, congelado, frito","kcal":327.0,"protein":28.4,"lipids":22.8,"carb":0.0,"fiber":null,"calcium":1881.0,"magnesium":66.0},{"id":298,"category":"Pescados e frutos do mar","name":"Lambari, fresco, cru","kcal":152.0,"protein":15.7,"lipids":9.4,"carb":0.0,"fiber":null,"calcium":590.0,"magnesium":32.0},{"id":299,"category":"Pescados e frutos do mar","name":"Manjuba, com farinha de trigo, frita","kcal":344.0,"protein":23.5,"lipids":22.6,"carb":10.2,"fiber":0.4,"calcium":763.0,"magnesium":47.0},{"id":300,"category":"Pescados e frutos do mar","name":"Manjuba, frita","kcal":349.0,"protein":30.1,"lipids":24.5,"carb":0.0,"fiber":null,"calcium":575.0,"magnesium":32.0},{"id":301,"category":"Pescados e frutos do mar","name":"Merluza, filé, assado","kcal":122.0,"protein":26.6,"lipids":0.9,"carb":0.0,"fiber":null,"calcium":36.0,"magnesium":20.0},{"id":302,"category":"Pescados e frutos do mar","name":"Merluza, filé, cru","kcal":89.0,"protein":16.6,"lipids":2.0,"carb":0.0,"fiber":null,"calcium":20.0,"magnesium":27.0},{"id":303,"category":"Pescados e frutos do mar","name":"Merluza, filé, frito","kcal":192.0,"protein":26.9,"lipids":8.5,"carb":0.0,"fiber":null,"calcium":36.0,"magnesium":38.0},{"id":304,"category":"Pescados e frutos do mar","name":"Pescada, branca, crua","kcal":111.0,"protein":16.3,"lipids":4.6,"carb":0.0,"fiber":null,"calcium":16.0,"magnesium":19.0},{"id":305,"category":"Pescados e frutos do mar","name":"Pescada, branca, frita","kcal":223.0,"protein":27.4,"lipids":11.8,"carb":0.0,"fiber":null,"calcium":378.0,"magnesium":30.0},{"id":306,"category":"Pescados e frutos do mar","name":"Pescada, filé, com farinha de trigo, frito","kcal":283.0,"protein":21.4,"lipids":19.1,"carb":5.0,"fiber":null,"calcium":26.0,"magnesium":28.0},{"id":307,"category":"Pescados e frutos do mar","name":"Pescada, filé, cru","kcal":107.0,"protein":16.7,"lipids":4.0,"carb":0.0,"fiber":null,"calcium":14.0,"magnesium":23.0},{"id":308,"category":"Pescados e frutos do mar","name":"Pescada, filé, frito","kcal":154.0,"protein":28.6,"lipids":3.6,"carb":0.0,"fiber":null,"calcium":10.0,"magnesium":21.0},{"id":309,"category":"Pescados e frutos do mar","name":"Pescada, filé, molho escabeche","kcal":142.0,"protein":11.8,"lipids":8.0,"carb":5.0,"fiber":0.8,"calcium":20.0,"magnesium":18.0},{"id":310,"category":"Pescados e frutos do mar","name":"Pescadinha, crua","kcal":76.0,"protein":15.5,"lipids":1.1,"carb":0.0,"fiber":null,"calcium":332.0,"magnesium":34.0},{"id":311,"category":"Pescados e frutos do mar","name":"Pintado, assado","kcal":192.0,"protein":36.5,"lipids":4.0,"carb":0.0,"fiber":null,"calcium":114.0,"magnesium":42.0},{"id":312,"category":"Pescados e frutos do mar","name":"Pintado, cru","kcal":91.0,"protein":18.6,"lipids":1.3,"carb":0.0,"fiber":null,"calcium":12.0,"magnesium":24.0},{"id":313,"category":"Pescados e frutos do mar","name":"Pintado, grelhado","kcal":152.0,"protein":30.8,"lipids":2.3,"carb":0.0,"fiber":null,"calcium":69.0,"magnesium":27.0},{"id":314,"category":"Pescados e frutos do mar","name":"Porquinho, cru","kcal":93.0,"protein":20.5,"lipids":0.6,"carb":0.0,"fiber":null,"calcium":26.0,"magnesium":24.0},{"id":315,"category":"Pescados e frutos do mar","name":"Salmão, filé, com pele, fresco, grelhado","kcal":229.0,"protein":23.9,"lipids":14.0,"carb":0.0,"fiber":null,"calcium":29.0,"magnesium":28.0},{"id":316,"category":"Pescados e frutos do mar","name":"Salmão, sem pele, fresco, cru","kcal":170.0,"protein":19.3,"lipids":9.7,"carb":0.0,"fiber":null,"calcium":9.0,"magnesium":27.0},{"id":317,"category":"Pescados e frutos do mar","name":"Salmão, sem pele, fresco, grelhado","kcal":243.0,"protein":26.1,"lipids":14.5,"carb":0.0,"fiber":null,"calcium":15.0,"magnesium":38.0},{"id":318,"category":"Pescados e frutos do mar","name":"Sardinha, assada","kcal":164.0,"protein":32.2,"lipids":3.0,"carb":0.0,"fiber":null,"calcium":438.0,"magnesium":51.0},{"id":319,"category":"Pescados e frutos do mar","name":"Sardinha, conserva em óleo","kcal":285.0,"protein":15.9,"lipids":24.0,"carb":0.0,"fiber":null,"calcium":550.0,"magnesium":35.0},{"id":320,"category":"Pescados e frutos do mar","name":"Sardinha, frita","kcal":257.0,"protein":33.4,"lipids":12.7,"carb":0.0,"fiber":null,"calcium":482.0,"magnesium":39.0},{"id":321,"category":"Pescados e frutos do mar","name":"Sardinha, inteira, crua","kcal":114.0,"protein":21.1,"lipids":2.7,"carb":0.0,"fiber":null,"calcium":167.0,"magnesium":29.0},{"id":322,"category":"Pescados e frutos do mar","name":"Tucunaré, filé, congelado, cru","kcal":88.0,"protein":18.0,"lipids":1.2,"carb":0.0,"fiber":null,"calcium":19.0,"magnesium":26.0},{"id":323,"category":"Carnes e derivados","name":"Apresuntado","kcal":129.0,"protein":13.5,"lipids":6.7,"carb":2.9,"fiber":null,"calcium":23.0,"magnesium":15.0},{"id":324,"category":"Carnes e derivados","name":"Caldo de carne, tablete","kcal":241.0,"protein":7.8,"lipids":16.6,"carb":15.1,"fiber":0.6,"calcium":129.0,"magnesium":22.0},{"id":325,"category":"Carnes e derivados","name":"Caldo de galinha, tablete","kcal":251.0,"protein":6.3,"lipids":20.4,"carb":10.6,"fiber":11.8,"calcium":16.0,"magnesium":13.0},{"id":326,"category":"Carnes e derivados","name":"Carne, bovina, acém, moído, cozido","kcal":212.0,"protein":26.7,"lipids":10.9,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":17.0},{"id":327,"category":"Carnes e derivados","name":"Carne, bovina, acém, moído, cru","kcal":137.0,"protein":19.4,"lipids":5.9,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":14.0},{"id":328,"category":"Carnes e derivados","name":"Carne, bovina, acém, sem gordura, cozido","kcal":215.0,"protein":27.3,"lipids":10.9,"carb":0.0,"fiber":null,"calcium":7.0,"magnesium":14.0},{"id":329,"category":"Carnes e derivados","name":"Carne, bovina, acém, sem gordura, cru","kcal":144.0,"protein":20.8,"lipids":6.1,"carb":0.0,"fiber":null,"calcium":5.0,"magnesium":13.0},{"id":330,"category":"Carnes e derivados","name":"Carne, bovina, almôndegas, cruas","kcal":189.0,"protein":12.3,"lipids":11.2,"carb":9.8,"fiber":null,"calcium":22.0,"magnesium":24.0},{"id":331,"category":"Carnes e derivados","name":"Carne, bovina, almôndegas, fritas","kcal":272.0,"protein":18.2,"lipids":15.8,"carb":14.3,"fiber":null,"calcium":27.0,"magnesium":48.0},{"id":332,"category":"Carnes e derivados","name":"Carne, bovina, bucho, cozido","kcal":133.0,"protein":21.6,"lipids":4.5,"carb":0.0,"fiber":null,"calcium":13.0,"magnesium":7.0},{"id":333,"category":"Carnes e derivados","name":"Carne, bovina, bucho, cru","kcal":137.0,"protein":20.5,"lipids":5.5,"carb":0.0,"fiber":null,"calcium":9.0,"magnesium":6.0},{"id":334,"category":"Carnes e derivados","name":"Carne, bovina, capa de contra-filé, com gordura, crua","kcal":217.0,"protein":19.2,"lipids":15.0,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":17.0},{"id":335,"category":"Carnes e derivados","name":"Carne, bovina, capa de contra-filé, com gordura, grelhada","kcal":312.0,"protein":30.7,"lipids":20.0,"carb":0.0,"fiber":null,"calcium":7.0,"magnesium":18.0},{"id":336,"category":"Carnes e derivados","name":"Carne, bovina, capa de contra-filé, sem gordura, crua","kcal":131.0,"protein":21.5,"lipids":4.3,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":20.0},{"id":337,"category":"Carnes e derivados","name":"Carne, bovina, capa de contra-filé, sem gordura, grelhada","kcal":239.0,"protein":35.1,"lipids":10.0,"carb":0.0,"fiber":null,"calcium":9.0,"magnesium":26.0},{"id":338,"category":"Carnes e derivados","name":"Carne, bovina, charque, cozido","kcal":263.0,"protein":36.4,"lipids":11.9,"carb":0.0,"fiber":null,"calcium":15.0,"magnesium":13.0},{"id":339,"category":"Carnes e derivados","name":"Carne, bovina, charque, cru","kcal":249.0,"protein":22.7,"lipids":16.8,"carb":0.0,"fiber":null,"calcium":15.0,"magnesium":13.0},{"id":340,"category":"Carnes e derivados","name":"Carne, bovina, contra-filé, à milanesa","kcal":352.0,"protein":20.6,"lipids":24.0,"carb":12.2,"fiber":0.4,"calcium":15.0,"magnesium":27.0},{"id":341,"category":"Carnes e derivados","name":"Carne, bovina, contra-filé de costela, cru","kcal":202.0,"protein":19.8,"lipids":13.1,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":14.0},{"id":342,"category":"Carnes e derivados","name":"Carne, bovina, contra-filé de costela, grelhado","kcal":275.0,"protein":29.9,"lipids":16.3,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":24.0},{"id":343,"category":"Carnes e derivados","name":"Carne, bovina, contra-filé, com gordura, cru","kcal":206.0,"protein":21.2,"lipids":12.8,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":18.0},{"id":344,"category":"Carnes e derivados","name":"Carne, bovina, contra-filé, com gordura, grelhado","kcal":278.0,"protein":32.4,"lipids":15.5,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":19.0},{"id":345,"category":"Carnes e derivados","name":"Carne, bovina, contra-filé, sem gordura, cru","kcal":157.0,"protein":24.0,"lipids":6.0,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":21.0},{"id":346,"category":"Carnes e derivados","name":"Carne, bovina, contra-filé, sem gordura, grelhado","kcal":194.0,"protein":35.9,"lipids":4.5,"carb":0.0,"fiber":null,"calcium":5.0,"magnesium":21.0},{"id":347,"category":"Carnes e derivados","name":"Carne, bovina, costela, assada","kcal":373.0,"protein":28.8,"lipids":27.7,"carb":0.0,"fiber":null,"calcium":28.0,"magnesium":20.0},{"id":348,"category":"Carnes e derivados","name":"Carne, bovina, costela, crua","kcal":358.0,"protein":16.7,"lipids":31.8,"carb":0.0,"fiber":null,"calcium":null,"magnesium":12.0},{"id":349,"category":"Carnes e derivados","name":"Carne, bovina, coxão duro, sem gordura, cozido","kcal":217.0,"protein":31.9,"lipids":8.9,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":14.0},{"id":350,"category":"Carnes e derivados","name":"Carne, bovina, coxão duro, sem gordura, cru","kcal":148.0,"protein":21.5,"lipids":6.2,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":21.0},{"id":351,"category":"Carnes e derivados","name":"Carne, bovina, coxão mole, sem gordura, cozido","kcal":219.0,"protein":32.4,"lipids":8.9,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":13.0},{"id":352,"category":"Carnes e derivados","name":"Carne, bovina, coxão mole, sem gordura, cru","kcal":169.0,"protein":21.2,"lipids":8.7,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":21.0},{"id":353,"category":"Carnes e derivados","name":"Carne, bovina, cupim, assado","kcal":330.0,"protein":28.6,"lipids":23.0,"carb":0.0,"fiber":null,"calcium":8.0,"magnesium":18.0},{"id":354,"category":"Carnes e derivados","name":"Carne, bovina, cupim, cru","kcal":221.0,"protein":19.5,"lipids":15.3,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":13.0},{"id":355,"category":"Carnes e derivados","name":"Carne, bovina, fígado, cru","kcal":141.0,"protein":20.7,"lipids":5.4,"carb":1.1,"fiber":null,"calcium":4.0,"magnesium":12.0},{"id":356,"category":"Carnes e derivados","name":"Carne, bovina, fígado, grelhado","kcal":225.0,"protein":29.9,"lipids":9.0,"carb":4.2,"fiber":null,"calcium":6.0,"magnesium":10.0},{"id":357,"category":"Carnes e derivados","name":"Carne, bovina, filé mingnon, sem gordura, cru","kcal":143.0,"protein":21.6,"lipids":5.6,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":21.0},{"id":358,"category":"Carnes e derivados","name":"Carne, bovina, filé mingnon, sem gordura, grelhado","kcal":220.0,"protein":32.8,"lipids":8.8,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":28.0},{"id":359,"category":"Carnes e derivados","name":"Carne, bovina, flanco, sem gordura, cozido","kcal":196.0,"protein":29.4,"lipids":7.8,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":14.0},{"id":360,"category":"Carnes e derivados","name":"Carne, bovina, flanco, sem gordura, cru","kcal":141.0,"protein":20.0,"lipids":6.2,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":18.0},{"id":361,"category":"Carnes e derivados","name":"Carne, bovina, fraldinha, com gordura, cozida","kcal":338.0,"protein":24.2,"lipids":26.0,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":14.0},{"id":362,"category":"Carnes e derivados","name":"Carne, bovina, fraldinha, com gordura, crua","kcal":221.0,"protein":17.6,"lipids":16.1,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":16.0},{"id":363,"category":"Carnes e derivados","name":"Carne, bovina, lagarto, cozido","kcal":222.0,"protein":32.9,"lipids":9.1,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":13.0},{"id":364,"category":"Carnes e derivados","name":"Carne, bovina, lagarto, cru","kcal":135.0,"protein":20.5,"lipids":5.2,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":20.0},{"id":365,"category":"Carnes e derivados","name":"Carne, bovina, língua, cozida","kcal":315.0,"protein":21.4,"lipids":24.8,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":12.0},{"id":366,"category":"Carnes e derivados","name":"Carne, bovina, língua, crua","kcal":215.0,"protein":17.1,"lipids":15.8,"carb":0.0,"fiber":null,"calcium":5.0,"magnesium":15.0},{"id":367,"category":"Carnes e derivados","name":"Carne, bovina, maminha, crua","kcal":153.0,"protein":20.9,"lipids":7.0,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":16.0},{"id":368,"category":"Carnes e derivados","name":"Carne, bovina, maminha, grelhada","kcal":153.0,"protein":30.7,"lipids":2.4,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":21.0},{"id":369,"category":"Carnes e derivados","name":"Carne, bovina, miolo de alcatra, sem gordura, cru","kcal":163.0,"protein":21.6,"lipids":7.8,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":20.0},{"id":370,"category":"Carnes e derivados","name":"Carne, bovina, miolo de alcatra, sem gordura, grelhado","kcal":241.0,"protein":31.9,"lipids":11.6,"carb":0.0,"fiber":null,"calcium":5.0,"magnesium":26.0},{"id":371,"category":"Carnes e derivados","name":"Carne, bovina, músculo, sem gordura, cozido","kcal":194.0,"protein":31.2,"lipids":6.7,"carb":0.0,"fiber":null,"calcium":5.0,"magnesium":13.0},{"id":372,"category":"Carnes e derivados","name":"Carne, bovina, músculo, sem gordura, cru","kcal":142.0,"protein":21.6,"lipids":5.5,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":17.0},{"id":373,"category":"Carnes e derivados","name":"Carne, bovina, paleta, com gordura, crua","kcal":159.0,"protein":21.4,"lipids":7.5,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":14.0},{"id":374,"category":"Carnes e derivados","name":"Carne, bovina, paleta, sem gordura, cozida","kcal":194.0,"protein":29.7,"lipids":7.4,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":18.0},{"id":375,"category":"Carnes e derivados","name":"Carne, bovina, paleta, sem gordura, crua","kcal":141.0,"protein":21.0,"lipids":5.7,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":18.0},{"id":376,"category":"Carnes e derivados","name":"Carne, bovina, patinho, sem gordura, cru","kcal":133.0,"protein":21.7,"lipids":4.5,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":20.0},{"id":377,"category":"Carnes e derivados","name":"Carne, bovina, patinho, sem gordura, grelhado","kcal":219.0,"protein":35.9,"lipids":7.3,"carb":0.0,"fiber":null,"calcium":5.0,"magnesium":27.0},{"id":378,"category":"Carnes e derivados","name":"Carne, bovina, peito, sem gordura, cozido","kcal":338.0,"protein":22.2,"lipids":27.0,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":14.0},{"id":379,"category":"Carnes e derivados","name":"Carne, bovina, peito, sem gordura, cru","kcal":259.0,"protein":17.6,"lipids":20.4,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":15.0},{"id":380,"category":"Carnes e derivados","name":"Carne, bovina, picanha, com gordura, crua","kcal":213.0,"protein":18.8,"lipids":14.7,"carb":0.0,"fiber":null,"calcium":2.0,"magnesium":14.0},{"id":381,"category":"Carnes e derivados","name":"Carne, bovina, picanha, com gordura, grelhada","kcal":289.0,"protein":26.4,"lipids":19.5,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":24.0},{"id":382,"category":"Carnes e derivados","name":"Carne, bovina, picanha, sem gordura, crua","kcal":134.0,"protein":21.3,"lipids":4.7,"carb":0.0,"fiber":null,"calcium":3.0,"magnesium":20.0},{"id":383,"category":"Carnes e derivados","name":"Carne, bovina, picanha, sem gordura, grelhada","kcal":238.0,"protein":31.9,"lipids":11.3,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":25.0},{"id":384,"category":"Carnes e derivados","name":"Carne, bovina, seca, cozida","kcal":313.0,"protein":26.9,"lipids":21.9,"carb":0.0,"fiber":null,"calcium":13.0,"magnesium":12.0},{"id":385,"category":"Carnes e derivados","name":"Carne, bovina, seca, crua","kcal":313.0,"protein":19.7,"lipids":25.4,"carb":0.0,"fiber":null,"calcium":14.0,"magnesium":12.0},{"id":386,"category":"Carnes e derivados","name":"Coxinha de frango, frita","kcal":283.0,"protein":9.6,"lipids":11.8,"carb":34.5,"fiber":5.0,"calcium":18.0,"magnesium":17.0},{"id":387,"category":"Carnes e derivados","name":"Croquete, de carne, cru","kcal":246.0,"protein":12.0,"lipids":15.6,"carb":13.9,"fiber":2.5,"calcium":24.0,"magnesium":null},{"id":388,"category":"Carnes e derivados","name":"Croquete, de carne, frito","kcal":347.0,"protein":16.9,"lipids":22.7,"carb":18.1,"fiber":3.1,"calcium":30.0,"magnesium":null},{"id":389,"category":"Carnes e derivados","name":"Empada de frango, pré-cozida, assada","kcal":358.0,"protein":6.9,"lipids":15.6,"carb":47.5,"fiber":2.2,"calcium":16.0,"magnesium":18.0},{"id":390,"category":"Carnes e derivados","name":"Empada, de frango, pré-cozida","kcal":377.0,"protein":7.3,"lipids":22.9,"carb":35.5,"fiber":2.2,"calcium":14.0,"magnesium":17.0},{"id":391,"category":"Carnes e derivados","name":"Frango, asa, com pele, crua","kcal":213.0,"protein":18.1,"lipids":15.1,"carb":0.0,"fiber":null,"calcium":11.0,"magnesium":23.0},{"id":392,"category":"Carnes e derivados","name":"Frango, caipira, inteiro, com pele, cozido","kcal":243.0,"protein":23.9,"lipids":15.6,"carb":0.0,"fiber":null,"calcium":17.0,"magnesium":18.0},{"id":393,"category":"Carnes e derivados","name":"Frango, caipira, inteiro, sem pele, cozido","kcal":196.0,"protein":29.6,"lipids":7.7,"carb":0.0,"fiber":null,"calcium":66.0,"magnesium":23.0},{"id":394,"category":"Carnes e derivados","name":"Frango, coração, cru","kcal":222.0,"protein":12.6,"lipids":18.6,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":20.0},{"id":395,"category":"Carnes e derivados","name":"Frango, coração, grelhado","kcal":207.0,"protein":22.4,"lipids":12.1,"carb":0.6,"fiber":null,"calcium":8.0,"magnesium":20.0},{"id":396,"category":"Carnes e derivados","name":"Frango, coxa, com pele, assada","kcal":215.0,"protein":28.5,"lipids":10.4,"carb":0.1,"fiber":null,"calcium":8.0,"magnesium":14.0},{"id":397,"category":"Carnes e derivados","name":"Frango, coxa, com pele, crua","kcal":161.0,"protein":17.1,"lipids":9.8,"carb":0.0,"fiber":null,"calcium":8.0,"magnesium":26.0},{"id":398,"category":"Carnes e derivados","name":"Frango, coxa, sem pele, cozida","kcal":167.0,"protein":26.9,"lipids":5.8,"carb":0.0,"fiber":null,"calcium":12.0,"magnesium":11.0},{"id":399,"category":"Carnes e derivados","name":"Frango, coxa, sem pele, crua","kcal":120.0,"protein":17.8,"lipids":4.9,"carb":0.0,"fiber":null,"calcium":8.0,"magnesium":27.0},{"id":400,"category":"Carnes e derivados","name":"Frango, fígado, cru","kcal":106.0,"protein":17.6,"lipids":3.5,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":28.0},{"id":401,"category":"Carnes e derivados","name":"Frango, filé, à milanesa","kcal":221.0,"protein":28.5,"lipids":7.8,"carb":7.5,"fiber":1.1,"calcium":9.0,"magnesium":35.0},{"id":402,"category":"Carnes e derivados","name":"Frango, inteiro, com pele, cru","kcal":226.0,"protein":16.4,"lipids":17.3,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":24.0},{"id":403,"category":"Carnes e derivados","name":"Frango, inteiro, sem pele, assado","kcal":187.0,"protein":28.0,"lipids":7.5,"carb":0.0,"fiber":null,"calcium":9.0,"magnesium":14.0},{"id":404,"category":"Carnes e derivados","name":"Frango, inteiro, sem pele, cozido","kcal":170.0,"protein":25.0,"lipids":7.1,"carb":0.0,"fiber":null,"calcium":8.0,"magnesium":12.0},{"id":405,"category":"Carnes e derivados","name":"Frango, inteiro, sem pele, cru","kcal":129.0,"protein":20.6,"lipids":4.6,"carb":0.0,"fiber":null,"calcium":7.0,"magnesium":27.0},{"id":406,"category":"Carnes e derivados","name":"Frango, peito, com pele, assado","kcal":212.0,"protein":33.4,"lipids":7.6,"carb":0.0,"fiber":null,"calcium":8.0,"magnesium":18.0},{"id":407,"category":"Carnes e derivados","name":"Frango, peito, com pele, cru","kcal":149.0,"protein":20.8,"lipids":6.7,"carb":0.0,"fiber":null,"calcium":8.0,"magnesium":28.0},{"id":408,"category":"Carnes e derivados","name":"Frango, peito, sem pele, cozido","kcal":163.0,"protein":31.5,"lipids":3.2,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":14.0},{"id":409,"category":"Carnes e derivados","name":"Frango, peito, sem pele, cru","kcal":119.0,"protein":21.5,"lipids":3.0,"carb":0.0,"fiber":null,"calcium":7.0,"magnesium":31.0},{"id":410,"category":"Carnes e derivados","name":"Frango, peito, sem pele, grelhado","kcal":159.0,"protein":32.0,"lipids":2.5,"carb":0.0,"fiber":null,"calcium":5.0,"magnesium":18.0},{"id":411,"category":"Carnes e derivados","name":"Frango, sobrecoxa, com pele, assada","kcal":260.0,"protein":28.7,"lipids":15.2,"carb":0.0,"fiber":null,"calcium":11.0,"magnesium":15.0},{"id":412,"category":"Carnes e derivados","name":"Frango, sobrecoxa, com pele, crua","kcal":255.0,"protein":15.5,"lipids":20.9,"carb":0.0,"fiber":null,"calcium":7.0,"magnesium":22.0},{"id":413,"category":"Carnes e derivados","name":"Frango, sobrecoxa, sem pele, assada","kcal":233.0,"protein":29.2,"lipids":12.0,"carb":0.0,"fiber":null,"calcium":12.0,"magnesium":17.0},{"id":414,"category":"Carnes e derivados","name":"Frango, sobrecoxa, sem pele, crua","kcal":162.0,"protein":17.6,"lipids":9.6,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":26.0},{"id":415,"category":"Carnes e derivados","name":"Hambúrguer, bovino, cru","kcal":215.0,"protein":13.2,"lipids":16.2,"carb":4.2,"fiber":null,"calcium":34.0,"magnesium":25.0},{"id":416,"category":"Carnes e derivados","name":"Hambúrguer, bovino, frito","kcal":258.0,"protein":20.0,"lipids":17.0,"carb":6.3,"fiber":null,"calcium":62.0,"magnesium":60.0},{"id":417,"category":"Carnes e derivados","name":"Hambúrguer, bovino, grelhado","kcal":210.0,"protein":13.2,"lipids":12.4,"carb":11.3,"fiber":null,"calcium":56.0,"magnesium":48.0},{"id":418,"category":"Carnes e derivados","name":"Lingüiça, frango, crua","kcal":218.0,"protein":14.2,"lipids":17.4,"carb":0.0,"fiber":null,"calcium":11.0,"magnesium":19.0},{"id":419,"category":"Carnes e derivados","name":"Lingüiça, frango, frita","kcal":245.0,"protein":18.3,"lipids":18.5,"carb":0.0,"fiber":null,"calcium":15.0,"magnesium":29.0},{"id":420,"category":"Carnes e derivados","name":"Lingüiça, frango, grelhada","kcal":244.0,"protein":18.2,"lipids":18.4,"carb":0.0,"fiber":null,"calcium":14.0,"magnesium":21.0},{"id":421,"category":"Carnes e derivados","name":"Lingüiça, porco, crua","kcal":227.0,"protein":16.1,"lipids":17.6,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":14.0},{"id":422,"category":"Carnes e derivados","name":"Lingüiça, porco, frita","kcal":280.0,"protein":20.5,"lipids":21.3,"carb":0.0,"fiber":null,"calcium":8.0,"magnesium":18.0},{"id":423,"category":"Carnes e derivados","name":"Lingüiça, porco, grelhada","kcal":296.0,"protein":23.2,"lipids":21.9,"carb":0.0,"fiber":null,"calcium":8.0,"magnesium":19.0},{"id":424,"category":"Carnes e derivados","name":"Mortadela","kcal":269.0,"protein":12.0,"lipids":21.6,"carb":5.8,"fiber":null,"calcium":67.0,"magnesium":19.0},{"id":425,"category":"Carnes e derivados","name":"Peru, congelado, assado","kcal":163.0,"protein":26.2,"lipids":5.7,"carb":0.0,"fiber":null,"calcium":14.0,"magnesium":12.0},{"id":426,"category":"Carnes e derivados","name":"Peru, congelado, cru","kcal":94.0,"protein":18.1,"lipids":1.8,"carb":0.0,"fiber":null,"calcium":10.0,"magnesium":19.0},{"id":427,"category":"Carnes e derivados","name":"Porco, bisteca, crua","kcal":164.0,"protein":21.5,"lipids":8.0,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":24.0},{"id":428,"category":"Carnes e derivados","name":"Porco, bisteca, frita","kcal":311.0,"protein":33.7,"lipids":18.5,"carb":0.0,"fiber":null,"calcium":69.0,"magnesium":29.0},{"id":429,"category":"Carnes e derivados","name":"Porco, bisteca, grelhada","kcal":280.0,"protein":28.9,"lipids":17.4,"carb":0.0,"fiber":null,"calcium":34.0,"magnesium":25.0},{"id":430,"category":"Carnes e derivados","name":"Porco, costela, assada","kcal":402.0,"protein":30.2,"lipids":30.3,"carb":0.0,"fiber":null,"calcium":17.0,"magnesium":14.0},{"id":431,"category":"Carnes e derivados","name":"Porco, costela, crua","kcal":256.0,"protein":18.0,"lipids":19.8,"carb":0.0,"fiber":null,"calcium":15.0,"magnesium":18.0},{"id":432,"category":"Carnes e derivados","name":"Porco, lombo, assado","kcal":210.0,"protein":35.7,"lipids":6.4,"carb":0.0,"fiber":null,"calcium":20.0,"magnesium":18.0},{"id":433,"category":"Carnes e derivados","name":"Porco, lombo, cru","kcal":176.0,"protein":22.6,"lipids":8.8,"carb":0.0,"fiber":null,"calcium":4.0,"magnesium":24.0},{"id":434,"category":"Carnes e derivados","name":"Porco, orelha, salgada, crua","kcal":258.0,"protein":18.5,"lipids":19.9,"carb":0.0,"fiber":null,"calcium":5.0,"magnesium":2.0},{"id":435,"category":"Carnes e derivados","name":"Porco, pernil, assado","kcal":262.0,"protein":32.1,"lipids":13.9,"carb":0.0,"fiber":null,"calcium":18.0,"magnesium":27.0},{"id":436,"category":"Carnes e derivados","name":"Porco, pernil, cru","kcal":186.0,"protein":20.1,"lipids":11.1,"carb":0.0,"fiber":null,"calcium":13.0,"magnesium":23.0},{"id":437,"category":"Carnes e derivados","name":"Porco, rabo, salgado, cru","kcal":377.0,"protein":15.6,"lipids":34.5,"carb":0.0,"fiber":null,"calcium":22.0,"magnesium":4.0},{"id":438,"category":"Carnes e derivados","name":"Presunto, com capa de gordura","kcal":128.0,"protein":14.4,"lipids":6.8,"carb":1.4,"fiber":null,"calcium":12.0,"magnesium":17.0},{"id":439,"category":"Carnes e derivados","name":"Presunto, sem capa de gordura","kcal":94.0,"protein":14.3,"lipids":2.7,"carb":2.1,"fiber":null,"calcium":23.0,"magnesium":18.0},{"id":440,"category":"Carnes e derivados","name":"Quibe, assado","kcal":136.0,"protein":14.6,"lipids":2.7,"carb":12.9,"fiber":1.9,"calcium":16.0,"magnesium":36.0},{"id":441,"category":"Carnes e derivados","name":"Quibe, cru","kcal":109.0,"protein":12.4,"lipids":1.7,"carb":10.8,"fiber":1.6,"calcium":12.0,"magnesium":26.0},{"id":442,"category":"Carnes e derivados","name":"Quibe, frito","kcal":254.0,"protein":14.9,"lipids":15.8,"carb":12.3,"fiber":3.0,"calcium":39.0,"magnesium":null},{"id":443,"category":"Carnes e derivados","name":"Salame","kcal":398.0,"protein":25.8,"lipids":30.6,"carb":2.9,"fiber":null,"calcium":87.0,"magnesium":30.0},{"id":444,"category":"Carnes e derivados","name":"Toucinho, cru","kcal":593.0,"protein":11.5,"lipids":60.3,"carb":0.0,"fiber":null,"calcium":2.0,"magnesium":4.0},{"id":445,"category":"Carnes e derivados","name":"Toucinho, frito","kcal":697.0,"protein":27.3,"lipids":64.3,"carb":0.0,"fiber":null,"calcium":9.0,"magnesium":9.0},{"id":446,"category":"Leite e derivados","name":"Bebida láctea, pêssego","kcal":55.0,"protein":2.1,"lipids":1.9,"carb":7.6,"fiber":0.3,"calcium":89.0,"magnesium":9.0},{"id":447,"category":"Leite e derivados","name":"Creme de Leite","kcal":221.0,"protein":1.5,"lipids":22.5,"carb":4.5,"fiber":null,"calcium":83.0,"magnesium":8.0},{"id":448,"category":"Leite e derivados","name":"Iogurte, natural","kcal":51.0,"protein":4.1,"lipids":3.0,"carb":1.9,"fiber":null,"calcium":143.0,"magnesium":11.0},{"id":449,"category":"Leite e derivados","name":"Iogurte, natural, desnatado","kcal":41.0,"protein":3.8,"lipids":0.3,"carb":5.8,"fiber":null,"calcium":157.0,"magnesium":12.0},{"id":450,"category":"Leite e derivados","name":"Iogurte, sabor abacaxi","kcal":null,"protein":null,"lipids":null,"carb":null,"fiber":null,"calcium":null,"magnesium":null},{"id":451,"category":"Leite e derivados","name":"Iogurte, sabor morango","kcal":70.0,"protein":2.7,"lipids":2.3,"carb":9.7,"fiber":0.2,"calcium":101.0,"magnesium":8.0},{"id":452,"category":"Leite e derivados","name":"Iogurte, sabor pêssego","kcal":68.0,"protein":2.5,"lipids":2.3,"carb":9.4,"fiber":0.7,"calcium":95.0,"magnesium":8.0},{"id":453,"category":"Leite e derivados","name":"Leite, condensado","kcal":313.0,"protein":7.7,"lipids":6.7,"carb":57.0,"fiber":null,"calcium":246.0,"magnesium":22.0},{"id":454,"category":"Leite e derivados","name":"Leite, de cabra","kcal":66.0,"protein":3.1,"lipids":3.8,"carb":5.2,"fiber":null,"calcium":112.0,"magnesium":10.0},{"id":455,"category":"Leite e derivados","name":"Leite, de vaca, achocolatado","kcal":83.0,"protein":2.1,"lipids":2.2,"carb":14.2,"fiber":0.6,"calcium":70.0,"magnesium":13.0},{"id":456,"category":"Leite e derivados","name":"Leite, de vaca, desnatado, pó","kcal":362.0,"protein":34.7,"lipids":0.9,"carb":53.0,"fiber":null,"calcium":1363.0,"magnesium":109.0},{"id":457,"category":"Leite e derivados","name":"Leite, de vaca, desnatado, UHT","kcal":null,"protein":null,"lipids":null,"carb":null,"fiber":null,"calcium":134.0,"magnesium":10.0},{"id":458,"category":"Leite e derivados","name":"Leite, de vaca, integral","kcal":null,"protein":null,"lipids":null,"carb":null,"fiber":null,"calcium":123.0,"magnesium":10.0},{"id":459,"category":"Leite e derivados","name":"Leite, de vaca, integral, pó","kcal":497.0,"protein":25.4,"lipids":26.9,"carb":39.2,"fiber":null,"calcium":890.0,"magnesium":77.0},{"id":460,"category":"Leite e derivados","name":"Leite, fermentado","kcal":70.0,"protein":1.9,"lipids":0.1,"carb":15.7,"fiber":null,"calcium":72.0,"magnesium":6.0},{"id":461,"category":"Leite e derivados","name":"Queijo, minas, frescal","kcal":264.0,"protein":17.4,"lipids":20.2,"carb":3.2,"fiber":null,"calcium":579.0,"magnesium":7.0},{"id":462,"category":"Leite e derivados","name":"Queijo, minas, meia cura","kcal":321.0,"protein":21.2,"lipids":24.6,"carb":3.6,"fiber":null,"calcium":696.0,"magnesium":27.0},{"id":463,"category":"Leite e derivados","name":"Queijo, mozarela","kcal":330.0,"protein":22.6,"lipids":25.2,"carb":3.0,"fiber":null,"calcium":875.0,"magnesium":24.0},{"id":464,"category":"Leite e derivados","name":"Queijo, parmesão","kcal":453.0,"protein":35.6,"lipids":33.5,"carb":1.7,"fiber":null,"calcium":992.0,"magnesium":33.0},{"id":465,"category":"Leite e derivados","name":"Queijo, pasteurizado","kcal":303.0,"protein":9.4,"lipids":27.4,"carb":5.7,"fiber":null,"calcium":323.0,"magnesium":16.0},{"id":466,"category":"Leite e derivados","name":"Queijo, petit suisse, morango","kcal":121.0,"protein":5.8,"lipids":2.8,"carb":18.5,"fiber":null,"calcium":731.0,"magnesium":27.0},{"id":467,"category":"Leite e derivados","name":"Queijo, prato","kcal":360.0,"protein":22.7,"lipids":29.1,"carb":1.9,"fiber":null,"calcium":940.0,"magnesium":28.0},{"id":468,"category":"Leite e derivados","name":"Queijo, requeijão, cremoso","kcal":257.0,"protein":9.6,"lipids":23.4,"carb":2.4,"fiber":null,"calcium":259.0,"magnesium":12.0},{"id":469,"category":"Leite e derivados","name":"Queijo, ricota","kcal":140.0,"protein":12.6,"lipids":8.1,"carb":3.8,"fiber":null,"calcium":253.0,"magnesium":12.0},{"id":470,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Bebida isotônica, sabores variados","kcal":26.0,"protein":0.0,"lipids":0.0,"carb":6.4,"fiber":null,"calcium":1.0,"magnesium":null},{"id":471,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Café, infusão 10%","kcal":9.0,"protein":0.7,"lipids":0.1,"carb":1.5,"fiber":null,"calcium":3.0,"magnesium":10.0},{"id":473,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Cana, caldo de","kcal":65.0,"protein":null,"lipids":null,"carb":18.2,"fiber":0.1,"calcium":9.0,"magnesium":12.0},{"id":474,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Cerveja, pilsen 2","kcal":41.0,"protein":0.6,"lipids":null,"carb":3.3,"fiber":null,"calcium":5.0,"magnesium":7.0},{"id":475,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Chá, erva-doce, infusão 5%","kcal":1.0,"protein":0.0,"lipids":0.0,"carb":0.4,"fiber":null,"calcium":2.0,"magnesium":1.0},{"id":476,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Chá, mate, infusão 5%","kcal":3.0,"protein":0.0,"lipids":0.1,"carb":0.6,"fiber":null,"calcium":1.0,"magnesium":2.0},{"id":477,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Chá, preto, infusão 5%","kcal":2.0,"protein":0.0,"lipids":0.0,"carb":0.6,"fiber":null,"calcium":0.0,"magnesium":1.0},{"id":478,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Coco, água de","kcal":22.0,"protein":0.0,"lipids":0.0,"carb":5.3,"fiber":0.1,"calcium":19.0,"magnesium":5.0},{"id":479,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Refrigerante, tipo água tônica","kcal":31.0,"protein":0.0,"lipids":0.0,"carb":8.0,"fiber":null,"calcium":1.0,"magnesium":null},{"id":480,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Refrigerante, tipo cola","kcal":34.0,"protein":0.0,"lipids":0.0,"carb":8.7,"fiber":null,"calcium":1.0,"magnesium":null},{"id":481,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Refrigerante, tipo guaraná","kcal":39.0,"protein":0.0,"lipids":0.0,"carb":10.0,"fiber":null,"calcium":1.0,"magnesium":null},{"id":482,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Refrigerante, tipo laranja","kcal":46.0,"protein":0.0,"lipids":0.0,"carb":11.8,"fiber":null,"calcium":2.0,"magnesium":1.0},{"id":483,"category":"Bebidas (alcoólicas e não alcoólicas)","name":"Refrigerante, tipo limão","kcal":40.0,"protein":0.0,"lipids":0.0,"carb":10.3,"fiber":null,"calcium":2.0,"magnesium":1.0},{"id":484,"category":"Ovos e derivados","name":"Omelete, de queijo","kcal":268.0,"protein":15.6,"lipids":22.0,"carb":0.4,"fiber":null,"calcium":166.0,"magnesium":14.0},{"id":485,"category":"Ovos e derivados","name":"Ovo, de codorna, inteiro, cru","kcal":177.0,"protein":13.7,"lipids":12.7,"carb":0.8,"fiber":null,"calcium":79.0,"magnesium":11.0},{"id":486,"category":"Ovos e derivados","name":"Ovo, de galinha, clara, cozida/10minutos","kcal":59.0,"protein":13.4,"lipids":0.1,"carb":0.0,"fiber":null,"calcium":6.0,"magnesium":11.0},{"id":487,"category":"Ovos e derivados","name":"Ovo, de galinha, gema, cozida/10minutos","kcal":353.0,"protein":15.9,"lipids":30.8,"carb":1.6,"fiber":null,"calcium":114.0,"magnesium":9.0},{"id":488,"category":"Ovos e derivados","name":"Ovo, de galinha, inteiro, cozido/10minutos","kcal":146.0,"protein":13.3,"lipids":9.5,"carb":0.6,"fiber":null,"calcium":49.0,"magnesium":11.0},{"id":489,"category":"Ovos e derivados","name":"Ovo, de galinha, inteiro, cru","kcal":143.0,"protein":13.0,"lipids":8.9,"carb":1.6,"fiber":null,"calcium":42.0,"magnesium":13.0},{"id":490,"category":"Ovos e derivados","name":"Ovo, de galinha, inteiro, frito","kcal":240.0,"protein":15.6,"lipids":18.6,"carb":1.2,"fiber":null,"calcium":73.0,"magnesium":16.0},{"id":491,"category":"Produtos açucarados","name":"Achocolatado, pó","kcal":401.0,"protein":4.2,"lipids":2.2,"carb":91.2,"fiber":3.9,"calcium":44.0,"magnesium":77.0},{"id":492,"category":"Produtos açucarados","name":"Açúcar, cristal","kcal":387.0,"protein":0.3,"lipids":null,"carb":99.6,"fiber":null,"calcium":8.0,"magnesium":1.0},{"id":493,"category":"Produtos açucarados","name":"Açúcar, mascavo","kcal":369.0,"protein":0.8,"lipids":0.1,"carb":94.5,"fiber":null,"calcium":127.0,"magnesium":80.0},{"id":494,"category":"Produtos açucarados","name":"Açúcar, refinado","kcal":387.0,"protein":0.3,"lipids":null,"carb":99.5,"fiber":null,"calcium":4.0,"magnesium":1.0},{"id":495,"category":"Produtos açucarados","name":"Chocolate, ao leite","kcal":540.0,"protein":7.2,"lipids":30.3,"carb":59.6,"fiber":2.2,"calcium":191.0,"magnesium":57.0},{"id":496,"category":"Produtos açucarados","name":"Chocolate, ao leite, com castanha do Pará","kcal":559.0,"protein":7.4,"lipids":34.2,"carb":55.4,"fiber":2.5,"calcium":171.0,"magnesium":80.0},{"id":497,"category":"Produtos açucarados","name":"Chocolate, ao leite, dietético","kcal":557.0,"protein":6.9,"lipids":33.8,"carb":56.3,"fiber":2.8,"calcium":188.0,"magnesium":67.0},{"id":498,"category":"Produtos açucarados","name":"Chocolate, meio amargo","kcal":475.0,"protein":4.9,"lipids":29.9,"carb":62.4,"fiber":4.9,"calcium":45.0,"magnesium":107.0},{"id":499,"category":"Produtos açucarados","name":"Cocada branca","kcal":449.0,"protein":1.1,"lipids":13.6,"carb":81.4,"fiber":3.6,"calcium":7.0,"magnesium":17.0},{"id":500,"category":"Produtos açucarados","name":"Doce, de abóbora, cremoso","kcal":199.0,"protein":0.9,"lipids":0.2,"carb":54.6,"fiber":2.3,"calcium":13.0,"magnesium":6.0},{"id":501,"category":"Produtos açucarados","name":"Doce, de leite, cremoso","kcal":306.0,"protein":5.5,"lipids":6.0,"carb":59.5,"fiber":null,"calcium":195.0,"magnesium":16.0},{"id":502,"category":"Produtos açucarados","name":"Geléia, mocotó, natural","kcal":106.0,"protein":2.1,"lipids":0.1,"carb":24.2,"fiber":null,"calcium":4.0,"magnesium":1.0},{"id":503,"category":"Produtos açucarados","name":"Glicose de milho","kcal":292.0,"protein":0.0,"lipids":0.0,"carb":79.4,"fiber":null,"calcium":6.0,"magnesium":2.0},{"id":504,"category":"Produtos açucarados","name":"Maria mole","kcal":301.0,"protein":3.8,"lipids":0.2,"carb":73.6,"fiber":0.7,"calcium":13.0,"magnesium":7.0},{"id":505,"category":"Produtos açucarados","name":"Maria mole, coco queimado","kcal":307.0,"protein":3.9,"lipids":0.1,"carb":75.1,"fiber":0.6,"calcium":19.0,"magnesium":6.0},{"id":506,"category":"Produtos açucarados","name":"Marmelada","kcal":257.0,"protein":0.4,"lipids":0.1,"carb":70.8,"fiber":4.1,"calcium":11.0,"magnesium":6.0},{"id":507,"category":"Produtos açucarados","name":"Mel, de abelha","kcal":309.0,"protein":0.0,"lipids":0.0,"carb":84.0,"fiber":null,"calcium":10.0,"magnesium":6.0},{"id":508,"category":"Produtos açucarados","name":"Melado","kcal":297.0,"protein":0.0,"lipids":0.0,"carb":76.6,"fiber":null,"calcium":102.0,"magnesium":115.0},{"id":509,"category":"Produtos açucarados","name":"Quindim","kcal":411.0,"protein":4.7,"lipids":24.4,"carb":46.3,"fiber":3.2,"calcium":37.0,"magnesium":15.0},{"id":510,"category":"Produtos açucarados","name":"Rapadura","kcal":352.0,"protein":1.0,"lipids":0.1,"carb":90.8,"fiber":null,"calcium":30.0,"magnesium":47.0},{"id":511,"category":"Miscelâneas","name":"Café, pó, torrado","kcal":419.0,"protein":14.7,"lipids":11.9,"carb":65.8,"fiber":51.2,"calcium":107.0,"magnesium":165.0},{"id":512,"category":"Miscelâneas","name":"Capuccino, pó","kcal":417.0,"protein":11.3,"lipids":8.6,"carb":73.6,"fiber":2.4,"calcium":467.0,"magnesium":71.0},{"id":514,"category":"Miscelâneas","name":"Fermento, biológico, levedura, tablete","kcal":90.0,"protein":17.0,"lipids":1.5,"carb":7.7,"fiber":4.2,"calcium":18.0,"magnesium":38.0},{"id":515,"category":"Miscelâneas","name":"Gelatina, sabores variados, pó","kcal":380.0,"protein":8.9,"lipids":null,"carb":89.2,"fiber":null,"calcium":27.0,"magnesium":2.0},{"id":518,"category":"Miscelâneas","name":"Shoyu","kcal":61.0,"protein":3.3,"lipids":0.3,"carb":11.6,"fiber":null,"calcium":15.0,"magnesium":24.0},{"id":520,"category":"Outros alimentos industrializados","name":"Azeitona, preta, conserva","kcal":194.0,"protein":1.2,"lipids":20.3,"carb":5.5,"fiber":4.6,"calcium":59.0,"magnesium":5.0},{"id":521,"category":"Outros alimentos industrializados","name":"Azeitona, verde, conserva","kcal":137.0,"protein":0.9,"lipids":14.2,"carb":4.1,"fiber":3.8,"calcium":46.0,"magnesium":4.0},{"id":522,"category":"Outros alimentos industrializados","name":"Chantilly, spray, com gordura vegetal","kcal":315.0,"protein":0.5,"lipids":27.3,"carb":16.9,"fiber":null,"calcium":2.0,"magnesium":1.0},{"id":523,"category":"Outros alimentos industrializados","name":"Leite, de coco","kcal":166.0,"protein":1.0,"lipids":18.4,"carb":2.2,"fiber":0.7,"calcium":6.0,"magnesium":17.0},{"id":524,"category":"Outros alimentos industrializados","name":"Maionese, tradicional com ovos","kcal":302.0,"protein":0.6,"lipids":30.5,"carb":7.9,"fiber":null,"calcium":3.0,"magnesium":1.0},{"id":525,"category":"Alimentos preparados","name":"Acarajé","kcal":289.0,"protein":8.3,"lipids":19.9,"carb":19.1,"fiber":9.4,"calcium":124.0,"magnesium":51.0},{"id":526,"category":"Alimentos preparados","name":"Arroz carreteiro","kcal":154.0,"protein":10.8,"lipids":7.1,"carb":11.6,"fiber":1.5,"calcium":13.0,"magnesium":9.0},{"id":527,"category":"Alimentos preparados","name":"Baião de dois, arroz e feijão-de-corda","kcal":136.0,"protein":6.2,"lipids":3.2,"carb":20.4,"fiber":5.1,"calcium":33.0,"magnesium":19.0},{"id":528,"category":"Alimentos preparados","name":"Barreado","kcal":165.0,"protein":18.3,"lipids":9.5,"carb":0.2,"fiber":0.1,"calcium":15.0,"magnesium":21.0},{"id":529,"category":"Alimentos preparados","name":"Bife à cavalo, com contra filé","kcal":291.0,"protein":23.7,"lipids":21.1,"carb":0.0,"fiber":null,"calcium":26.0,"magnesium":19.0},{"id":530,"category":"Alimentos preparados","name":"Bolinho de arroz","kcal":274.0,"protein":8.0,"lipids":8.3,"carb":41.7,"fiber":2.7,"calcium":24.0,"magnesium":13.0},{"id":531,"category":"Alimentos preparados","name":"Camarão à baiana","kcal":101.0,"protein":7.9,"lipids":6.0,"carb":3.2,"fiber":0.4,"calcium":43.0,"magnesium":15.0},{"id":532,"category":"Alimentos preparados","name":"Charuto, de repolho","kcal":78.0,"protein":6.8,"lipids":1.1,"carb":10.1,"fiber":1.5,"calcium":23.0,"magnesium":13.0},{"id":533,"category":"Alimentos preparados","name":"Cuscuz, de milho, cozido com sal","kcal":113.0,"protein":2.2,"lipids":0.7,"carb":25.3,"fiber":2.1,"calcium":2.0,"magnesium":3.0},{"id":534,"category":"Alimentos preparados","name":"Cuscuz, paulista","kcal":142.0,"protein":2.6,"lipids":4.6,"carb":22.5,"fiber":2.4,"calcium":14.0,"magnesium":5.0},{"id":535,"category":"Alimentos preparados","name":"Cuxá, molho","kcal":80.0,"protein":5.6,"lipids":3.6,"carb":5.7,"fiber":3.0,"calcium":105.0,"magnesium":34.0},{"id":536,"category":"Alimentos preparados","name":"Dobradinha","kcal":125.0,"protein":19.8,"lipids":4.4,"carb":0.0,"fiber":null,"calcium":11.0,"magnesium":8.0},{"id":537,"category":"Alimentos preparados","name":"Estrogonofe de carne","kcal":173.0,"protein":15.0,"lipids":10.8,"carb":3.0,"fiber":1.1,"calcium":22.0,"magnesium":null},{"id":538,"category":"Alimentos preparados","name":"Estrogonofe de frango","kcal":157.0,"protein":17.6,"lipids":8.0,"carb":2.6,"fiber":1.0,"calcium":25.0,"magnesium":null},{"id":539,"category":"Alimentos preparados","name":"Feijão tropeiro mineiro","kcal":152.0,"protein":10.2,"lipids":6.8,"carb":19.6,"fiber":3.6,"calcium":41.0,"magnesium":36.0},{"id":540,"category":"Alimentos preparados","name":"Feijoada","kcal":117.0,"protein":8.7,"lipids":6.5,"carb":11.6,"fiber":5.1,"calcium":32.0,"magnesium":32.0},{"id":541,"category":"Alimentos preparados","name":"Frango, com açafrão","kcal":113.0,"protein":9.7,"lipids":6.2,"carb":4.1,"fiber":0.2,"calcium":13.0,"magnesium":16.0},{"id":542,"category":"Alimentos preparados","name":"Macarrão, molho bolognesa","kcal":120.0,"protein":4.9,"lipids":0.9,"carb":22.5,"fiber":0.8,"calcium":11.0,"magnesium":10.0},{"id":543,"category":"Alimentos preparados","name":"Maniçoba","kcal":134.0,"protein":10.0,"lipids":8.7,"carb":3.4,"fiber":2.2,"calcium":66.0,"magnesium":24.0},{"id":544,"category":"Alimentos preparados","name":"Quibebe","kcal":86.0,"protein":8.6,"lipids":2.7,"carb":6.6,"fiber":1.7,"calcium":8.0,"magnesium":10.0},{"id":545,"category":"Alimentos preparados","name":"Salada, de legumes, com maionese","kcal":96.0,"protein":1.1,"lipids":7.0,"carb":8.9,"fiber":2.2,"calcium":12.0,"magnesium":9.0},{"id":546,"category":"Alimentos preparados","name":"Salada, de legumes, cozida no vapor","kcal":35.0,"protein":2.0,"lipids":0.3,"carb":7.1,"fiber":2.5,"calcium":33.0,"magnesium":19.0},{"id":547,"category":"Alimentos preparados","name":"Salpicão, de frango","kcal":148.0,"protein":13.9,"lipids":7.8,"carb":4.6,"fiber":0.4,"calcium":9.0,"magnesium":13.0},{"id":548,"category":"Alimentos preparados","name":"Sarapatel","kcal":123.0,"protein":18.5,"lipids":4.4,"carb":1.1,"fiber":1.1,"calcium":13.0,"magnesium":null},{"id":549,"category":"Alimentos preparados","name":"Tabule","kcal":57.0,"protein":2.0,"lipids":1.2,"carb":10.6,"fiber":2.1,"calcium":19.0,"magnesium":18.0},{"id":550,"category":"Alimentos preparados","name":"Tacacá","kcal":47.0,"protein":7.0,"lipids":0.4,"carb":3.4,"fiber":0.2,"calcium":45.0,"magnesium":30.0},{"id":551,"category":"Alimentos preparados","name":"Tapioca, com manteiga","kcal":348.0,"protein":0.1,"lipids":10.9,"carb":63.6,"fiber":null,"calcium":30.0,"magnesium":3.0},{"id":552,"category":"Alimentos preparados","name":"Tucupi, com pimenta-de-cheiro","kcal":27.0,"protein":2.1,"lipids":0.3,"carb":4.7,"fiber":0.2,"calcium":28.0,"magnesium":42.0},{"id":553,"category":"Alimentos preparados","name":"Vaca atolada","kcal":145.0,"protein":5.1,"lipids":9.3,"carb":10.1,"fiber":2.3,"calcium":63.0,"magnesium":16.0},{"id":554,"category":"Alimentos preparados","name":"Vatapá","kcal":255.0,"protein":6.0,"lipids":23.2,"carb":9.7,"fiber":1.7,"calcium":47.0,"magnesium":39.0},{"id":555,"category":"Alimentos preparados","name":"Virado à paulista","kcal":307.0,"protein":10.2,"lipids":25.6,"carb":14.1,"fiber":2.2,"calcium":41.0,"magnesium":22.0},{"id":556,"category":"Alimentos preparados","name":"Yakisoba","kcal":113.0,"protein":7.5,"lipids":2.6,"carb":18.3,"fiber":1.1,"calcium":14.0,"magnesium":13.0},{"id":557,"category":"Leguminosas e derivados","name":"Amendoim, grão, cru","kcal":544.0,"protein":27.2,"lipids":43.9,"carb":20.3,"fiber":8.0,"calcium":null,"magnesium":171.0},{"id":558,"category":"Leguminosas e derivados","name":"Amendoim, torrado, salgado","kcal":606.0,"protein":22.5,"lipids":54.0,"carb":18.7,"fiber":7.8,"calcium":39.0,"magnesium":159.0},{"id":559,"category":"Leguminosas e derivados","name":"Ervilha, em vagem","kcal":88.0,"protein":7.5,"lipids":0.5,"carb":14.2,"fiber":9.7,"calcium":24.0,"magnesium":42.0},{"id":560,"category":"Leguminosas e derivados","name":"Ervilha, enlatada, drenada","kcal":74.0,"protein":4.6,"lipids":0.4,"carb":13.4,"fiber":5.1,"calcium":22.0,"magnesium":23.0},{"id":561,"category":"Leguminosas e derivados","name":"Feijão, carioca, cozido","kcal":76.0,"protein":4.8,"lipids":0.5,"carb":13.6,"fiber":8.5,"calcium":27.0,"magnesium":42.0},{"id":562,"category":"Leguminosas e derivados","name":"Feijão, carioca, cru","kcal":329.0,"protein":20.0,"lipids":1.3,"carb":61.2,"fiber":18.4,"calcium":123.0,"magnesium":210.0},{"id":563,"category":"Leguminosas e derivados","name":"Feijão, fradinho, cozido","kcal":78.0,"protein":5.1,"lipids":0.6,"carb":13.5,"fiber":7.5,"calcium":17.0,"magnesium":38.0},{"id":564,"category":"Leguminosas e derivados","name":"Feijão, fradinho, cru","kcal":339.0,"protein":20.2,"lipids":2.4,"carb":61.2,"fiber":23.6,"calcium":78.0,"magnesium":178.0},{"id":565,"category":"Leguminosas e derivados","name":"Feijão, jalo, cozido","kcal":93.0,"protein":6.1,"lipids":0.5,"carb":16.5,"fiber":13.9,"calcium":29.0,"magnesium":44.0},{"id":566,"category":"Leguminosas e derivados","name":"Feijão, jalo, cru","kcal":328.0,"protein":20.1,"lipids":0.9,"carb":61.5,"fiber":30.3,"calcium":98.0,"magnesium":170.0},{"id":567,"category":"Leguminosas e derivados","name":"Feijão, preto, cozido","kcal":77.0,"protein":4.5,"lipids":0.5,"carb":14.0,"fiber":8.4,"calcium":29.0,"magnesium":40.0},{"id":568,"category":"Leguminosas e derivados","name":"Feijão, preto, cru","kcal":324.0,"protein":21.3,"lipids":1.2,"carb":58.8,"fiber":21.8,"calcium":111.0,"magnesium":188.0},{"id":569,"category":"Leguminosas e derivados","name":"Feijão, rajado, cozido","kcal":85.0,"protein":5.5,"lipids":0.4,"carb":15.3,"fiber":9.3,"calcium":29.0,"magnesium":42.0},{"id":570,"category":"Leguminosas e derivados","name":"Feijão, rajado, cru","kcal":326.0,"protein":17.3,"lipids":1.2,"carb":62.9,"fiber":24.0,"calcium":111.0,"magnesium":170.0},{"id":571,"category":"Leguminosas e derivados","name":"Feijão, rosinha, cozido","kcal":68.0,"protein":4.5,"lipids":0.5,"carb":11.8,"fiber":4.8,"calcium":19.0,"magnesium":43.0},{"id":572,"category":"Leguminosas e derivados","name":"Feijão, rosinha, cru","kcal":337.0,"protein":20.9,"lipids":1.3,"carb":62.2,"fiber":20.6,"calcium":68.0,"magnesium":184.0},{"id":573,"category":"Leguminosas e derivados","name":"Feijão, roxo, cozido","kcal":77.0,"protein":5.7,"lipids":0.5,"carb":12.9,"fiber":11.5,"calcium":23.0,"magnesium":34.0},{"id":574,"category":"Leguminosas e derivados","name":"Feijão, roxo, cru","kcal":331.0,"protein":22.2,"lipids":1.2,"carb":60.0,"fiber":33.8,"calcium":120.0,"magnesium":162.0},{"id":575,"category":"Leguminosas e derivados","name":"Grão-de-bico, cru","kcal":355.0,"protein":21.2,"lipids":5.4,"carb":57.9,"fiber":12.4,"calcium":114.0,"magnesium":146.0},{"id":576,"category":"Leguminosas e derivados","name":"Guandu, cru","kcal":344.0,"protein":19.0,"lipids":2.1,"carb":64.0,"fiber":21.3,"calcium":129.0,"magnesium":166.0},{"id":577,"category":"Leguminosas e derivados","name":"Lentilha, cozida","kcal":93.0,"protein":6.3,"lipids":0.5,"carb":16.3,"fiber":7.9,"calcium":16.0,"magnesium":22.0},{"id":578,"category":"Leguminosas e derivados","name":"Lentilha, crua","kcal":339.0,"protein":23.2,"lipids":0.8,"carb":62.0,"fiber":16.9,"calcium":54.0,"magnesium":94.0},{"id":579,"category":"Leguminosas e derivados","name":"Paçoca, amendoim","kcal":487.0,"protein":16.0,"lipids":26.1,"carb":52.4,"fiber":7.3,"calcium":22.0,"magnesium":101.0},{"id":580,"category":"Leguminosas e derivados","name":"Pé-de-moleque, amendoim","kcal":503.0,"protein":13.2,"lipids":28.0,"carb":54.7,"fiber":3.4,"calcium":27.0,"magnesium":108.0},{"id":581,"category":"Leguminosas e derivados","name":"Soja, farinha","kcal":404.0,"protein":36.0,"lipids":14.6,"carb":38.4,"fiber":20.2,"calcium":206.0,"magnesium":242.0},{"id":582,"category":"Leguminosas e derivados","name":"Soja, extrato solúvel, natural, fluido","kcal":39.0,"protein":2.4,"lipids":1.6,"carb":4.3,"fiber":0.4,"calcium":17.0,"magnesium":15.0},{"id":583,"category":"Leguminosas e derivados","name":"Soja, extrato solúvel, pó","kcal":459.0,"protein":35.7,"lipids":26.2,"carb":28.5,"fiber":7.3,"calcium":359.0,"magnesium":216.0},{"id":584,"category":"Leguminosas e derivados","name":"Soja, queijo (tofu)","kcal":64.0,"protein":6.6,"lipids":4.0,"carb":2.1,"fiber":0.8,"calcium":81.0,"magnesium":38.0},{"id":585,"category":"Leguminosas e derivados","name":"Tremoço, cru","kcal":381.0,"protein":33.6,"lipids":10.3,"carb":43.8,"fiber":32.3,"calcium":177.0,"magnesium":121.0},{"id":586,"category":"Leguminosas e derivados","name":"Tremoço, em conserva","kcal":121.0,"protein":11.1,"lipids":3.8,"carb":12.4,"fiber":14.4,"calcium":16.0,"magnesium":4.0},{"id":587,"category":"Nozes e sementes","name":"Amêndoa, torrada, salgada","kcal":581.0,"protein":18.6,"lipids":47.3,"carb":29.5,"fiber":11.6,"calcium":237.0,"magnesium":222.0},{"id":588,"category":"Nozes e sementes","name":"Castanha-de-caju, torrada, salgada","kcal":570.0,"protein":18.5,"lipids":46.3,"carb":29.1,"fiber":3.7,"calcium":33.0,"magnesium":237.0},{"id":589,"category":"Nozes e sementes","name":"Castanha-do-Brasil, crua","kcal":643.0,"protein":14.5,"lipids":63.5,"carb":15.1,"fiber":7.9,"calcium":146.0,"magnesium":365.0},{"id":590,"category":"Nozes e sementes","name":"Coco, cru","kcal":406.0,"protein":3.7,"lipids":42.0,"carb":10.4,"fiber":5.4,"calcium":6.0,"magnesium":51.0},{"id":591,"category":"Nozes e sementes","name":"Coco, verde, cru","kcal":null,"protein":null,"lipids":null,"carb":null,"fiber":null,"calcium":null,"magnesium":null},{"id":592,"category":"Nozes e sementes","name":"Farinha, de mesocarpo de babaçu, crua","kcal":329.0,"protein":1.4,"lipids":0.2,"carb":79.2,"fiber":17.9,"calcium":61.0,"magnesium":39.0},{"id":593,"category":"Nozes e sementes","name":"Gergelim, semente","kcal":584.0,"protein":21.2,"lipids":50.4,"carb":21.6,"fiber":11.9,"calcium":825.0,"magnesium":361.0},{"id":594,"category":"Nozes e sementes","name":"Linhaça, semente","kcal":495.0,"protein":14.1,"lipids":32.3,"carb":43.3,"fiber":33.5,"calcium":211.0,"magnesium":347.0},{"id":595,"category":"Nozes e sementes","name":"Pinhão, cozido","kcal":174.0,"protein":3.0,"lipids":0.7,"carb":43.9,"fiber":15.6,"calcium":16.0,"magnesium":53.0},{"id":596,"category":"Nozes e sementes","name":"Pupunha, cozida","kcal":219.0,"protein":2.5,"lipids":12.8,"carb":29.6,"fiber":4.3,"calcium":28.0,"magnesium":25.0},{"id":597,"category":"Nozes e sementes","name":"Noz, crua","kcal":620.0,"protein":14.0,"lipids":59.4,"carb":18.4,"fiber":7.2,"calcium":105.0,"magnesium":153.0}];

const emptyCore = () => ({
  goals: [],
  trainings: [],
  plannedWorkouts: [],
  modalities: [],
  supplements: [],
  supplementSuggestions: [],
  reports: [],
  analyses: [],
  bodyAssessments: [],
  trainingAssessments: [],
  diet: {
    targetKcal: "",
    targetProtein: "",
    targetCarb: "",
    targetFat: "",
    meals: [],
    questionnaire: { rotina: "", alimentacaoAtual: "", gosta: "", naoGosta: "", paladar: "", suplementos: "", observacoes: "" },
  },
});

// Tenta casar um nome de alimento (ex: sugerido pela IA) com um item exato da TACO_FOODS.
function matchTacoFood(name) {
  if (!name) return null;
  const n = normalizeSearch(name);
  let best = null;
  for (const f of TACO_FOODS) {
    const fn = normalizeSearch(f.name);
    if (fn === n) return f;
    if (fn.includes(n) || n.includes(fn)) {
      if (!best || Math.abs(fn.length - n.length) < Math.abs(normalizeSearch(best.name).length - n.length)) {
        best = f;
      }
    }
  }
  return best;
}

function calcAge(birthDateStr) {
  if (!birthDateStr) return null;
  const b = new Date(birthDateStr + "T00:00:00");
  if (isNaN(b)) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

function fileToResizedBase64(file, maxDim = 1100, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Lê qualquer arquivo (ex: PDF) como base64 puro, sem processar como imagem.
function fileToRawBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   SMALL UI PRIMITIVES
============================================================= */
function Card({ children, style, className, ...rest }) {
  return (
    <div
      className={`pulso-card${className ? " " + className : ""}`}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: 18,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div
      style={{
        fontFamily: "Inter",
        fontSize: 11,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: T.textMuted,
        fontWeight: 600,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Input({ className, ...props }) {
  return (
    <input
      {...props}
      className={`pulso-input${className ? " " + className : ""}`}
      style={{
        width: "100%",
        background: T.bgElevated,
        border: `1px solid ${T.border}`,
        borderRadius: 7,
        padding: "9px 11px",
        color: T.textPrimary,
        fontFamily: "Inter",
        fontSize: 14,
        outline: "none",
        boxSizing: "border-box",
        ...props.style,
      }}
    />
  );
}

function PasswordInput({ style, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <Input {...props} type={visible ? "text" : "password"} style={{ paddingRight: 40, ...style }} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: T.textMuted,
          padding: 6,
          display: "flex",
          alignItems: "center",
        }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function Select({ className, ...props }) {
  return (
    <select
      {...props}
      className={`pulso-input${className ? " " + className : ""}`}
      style={{
        width: "100%",
        background: T.bgElevated,
        border: `1px solid ${T.border}`,
        borderRadius: 7,
        padding: "9px 11px",
        color: T.textPrimary,
        fontFamily: "Inter",
        fontSize: 14,
        outline: "none",
        boxSizing: "border-box",
        ...props.style,
      }}
    >
      {props.children}
    </select>
  );
}

function TextArea({ className, ...props }) {
  return (
    <textarea
      {...props}
      className={`pulso-input${className ? " " + className : ""}`}
      style={{
        width: "100%",
        background: T.bgElevated,
        border: `1px solid ${T.border}`,
        borderRadius: 7,
        padding: "9px 11px",
        color: T.textPrimary,
        fontFamily: "Inter",
        fontSize: 14,
        outline: "none",
        resize: "vertical",
        boxSizing: "border-box",
        ...props.style,
      }}
    />
  );
}

function Btn({ children, variant = "primary", style, className, ...rest }) {
  const base = {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 13.5,
    padding: "9px 16px",
    borderRadius: 7,
    cursor: "pointer",
    border: "1px solid transparent",
  };
  const variants = {
    primary: { background: T.coral, color: "#1A0D08" },
    gold: { background: T.gold, color: "#241906" },
    ghost: {
      background: "transparent",
      color: T.textPrimary,
      border: `1px solid ${T.border}`,
    },
    steel: { background: T.steel, color: "#0A161D" },
    danger: {
      background: "transparent",
      color: T.danger,
      border: `1px solid ${T.danger}`,
    },
  };
  return (
    <button
      {...rest}
      className={`pulso-btn${className ? " " + className : ""}`}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

function Pill({ children, color = T.steel }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "JetBrains Mono",
        fontSize: 11,
        padding: "3px 9px",
        borderRadius: 999,
        color,
        border: `1px solid ${color}55`,
        background: `${color}18`,
      }}
    >
      {children}
    </span>
  );
}

function EmptyState({ title, hint }) {
  return (
    <div
      style={{
        padding: "36px 18px",
        textAlign: "center",
        color: T.textMuted,
        fontFamily: "Inter",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 13 }}>{hint}</div>
    </div>
  );
}

/* ============================================================
   PROFILE GATE — criar / selecionar atleta
============================================================= */
// ATENÇÃO: isso não é um hash criptográfico seguro — é só uma ofuscação simples
// para não guardar a senha em texto puro no armazenamento local. Como este app
// não tem backend, qualquer "login" aqui é um gate local, não autenticação real.
// Um produto de verdade precisa de um servidor fazendo isso com bcrypt/argon2.
function ProfileGate({ onEnter }) {
  const [mode, setMode] = useState("login"); // "signup" | "login" | "reset"
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [modality, setModality] = useState("Corrida de rua");
  const [level, setLevel] = useState("Amador");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [trainingTime, setTrainingTime] = useState("1 ano ou menos");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("Feminino");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [resetStep, setResetStep] = useState("request"); // "request" | "verify"
  const [resetCodeInput, setResetCodeInput] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  const [error, setError] = useState("");

  async function handleSignup() {
    setError("");
    if (!name.trim() || !email.trim() || !password) {
      setError("Preencha nome, email e senha.");
      return;
    }
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!weight.trim() || !height.trim()) {
      setError("Preencha peso e altura para continuar.");
      return;
    }
    if (isNaN(Number(weight.replace(",", "."))) || isNaN(Number(height.replace(",", ".")))) {
      setError("Peso e altura precisam ser números (ex: 72.5 e 1.75).");
      return;
    }
    if (!birthDate) {
      setError("Preencha sua data de nascimento.");
      return;
    }
    const age = calcAge(birthDate);
    if (age === null || age < 10 || age > 100) {
      setError("Confira a data de nascimento informada.");
      return;
    }
    setSubmitting(true);
    try {
      const account = await api.signup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        modality,
        level,
        weight: Number(weight.replace(",", ".")),
        height: Number(height.replace(",", ".")),
        trainingTime,
        birthDate,
        sex,
      });
      onEnter(account);
    } catch (e) {
      setError(e.message || "Não consegui criar a conta agora.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin() {
    setError("");
    if (!loginEmail.trim() || !loginPassword) {
      setError("Preencha email e senha.");
      return;
    }
    setSubmitting(true);
    try {
      const account = await api.login({ email: loginEmail.trim().toLowerCase(), password: loginPassword });
      onEnter(account);
    } catch (e) {
      setError(e.message || "Email ou senha incorretos.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendCode() {
    setError("");
    if (!resetEmail.trim()) {
      setError("Preencha o email da conta.");
      return;
    }
    setSubmitting(true);
    try {
      await api.forgotPassword(resetEmail.trim().toLowerCase());
      setResetCodeInput("");
      setResetStep("verify");
    } catch (e) {
      setError(e.message || "Não consegui enviar o código agora.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyAndReset() {
    setError("");
    if (!resetCodeInput.trim()) {
      setError("Digite o código recebido.");
      return;
    }
    if (!resetPassword) {
      setError("Preencha a nova senha.");
      return;
    }
    if (resetPassword.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    try {
      await api.resetPassword({
        email: resetEmail.trim().toLowerCase(),
        code: resetCodeInput.trim(),
        newPassword: resetPassword,
      });
      setResetSuccess(true);
      setResetPassword("");
      setResetConfirmPassword("");
    } catch (e) {
      setError(e.message || "Código inválido ou expirado.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetFlowReset() {
    setResetStep("request");
    setResetCodeInput("");
    setResetPassword("");
    setResetConfirmPassword("");
    setResetSuccess(false);
    setError("");
  }

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div
          style={{
            fontFamily: "Bebas Neue",
            fontSize: 40,
            letterSpacing: "0.04em",
            color: T.textPrimary,
            lineHeight: 1,
          }}
        >
          PULSO
        </div>
        <div
          style={{
            fontFamily: "Inter",
            fontSize: 13,
            color: T.textMuted,
            marginTop: 4,
            marginBottom: 18,
          }}
        >
          Acompanhamento de treino e evolução para atletas
        </div>
        <PulseDivider height={20} />

        <div style={{ display: "flex", gap: 4, margin: "18px 0 14px 0", background: T.bgElevated, borderRadius: 8, padding: 3 }}>
          <button
            onClick={() => { setMode("login"); resetFlowReset(); }}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: 13,
              background: mode === "login" ? T.surface : "transparent",
              color: mode === "login" ? T.textPrimary : T.textMuted,
            }}
          >
            Entrar
          </button>
          <button
            onClick={() => { setMode("signup"); resetFlowReset(); }}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: 13,
              background: mode === "signup" ? T.surface : "transparent",
              color: mode === "signup" ? T.textPrimary : T.textMuted,
            }}
          >
            Criar conta
          </button>
        </div>

        {mode === "login" ? (
          <Card>
            <Label>Entrar na sua conta</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                name="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
              <PasswordInput
                autoComplete="current-password"
                name="password"
                placeholder="Senha"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <button
                onClick={() => {
                  setMode("reset");
                  resetFlowReset();
                  setResetEmail(loginEmail);
                }}
                style={{
                  alignSelf: "flex-end",
                  background: "none",
                  border: "none",
                  color: T.steel,
                  fontFamily: "Inter",
                  fontSize: 12.5,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Esqueci minha senha
              </button>
              {error && (
                <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5 }}>{error}</div>
              )}
              <Btn variant="primary" onClick={handleLogin} disabled={submitting}>
                {submitting ? "Entrando..." : "Entrar"}
              </Btn>
            </div>
          </Card>
        ) : mode === "reset" ? (
          <Card>
            <Label>Recuperar senha</Label>
            {resetSuccess ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ color: T.good, fontFamily: "Inter", fontSize: 13 }}>
                  Senha atualizada. Já pode entrar com a nova senha.
                </div>
                <Btn
                  variant="primary"
                  onClick={() => {
                    setMode("login");
                    setLoginEmail(resetEmail);
                    resetFlowReset();
                  }}
                >
                  Voltar para o login
                </Btn>
              </div>
            ) : resetStep === "request" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted }}>
                  Informe o email da conta. Vamos gerar um código de verificação de 6 dígitos.
                </div>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  name="email"
                  placeholder="Email da conta"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                />
                {error && (
                  <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5 }}>{error}</div>
                )}
                <Btn variant="primary" onClick={handleSendCode} disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar código"}
                </Btn>
                <button
                  onClick={() => { setMode("login"); resetFlowReset(); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: T.textMuted,
                    fontFamily: "Inter",
                    fontSize: 12.5,
                    cursor: "pointer",
                    padding: 0,
                    alignSelf: "center",
                  }}
                >
                  Voltar para o login
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    fontFamily: "Inter",
                    fontSize: 12,
                    color: T.textMuted,
                    background: T.bgElevated,
                    border: `1px dashed ${T.border}`,
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  Se este email estiver cadastrado, enviamos um código de verificação de 6
                  dígitos para <strong style={{ color: T.textPrimary }}>{resetEmail}</strong>. Ele
                  expira em 10 minutos.
                </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Código de 6 dígitos"
                  value={resetCodeInput}
                  onChange={(e) => setResetCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{ textAlign: "center", fontFamily: "JetBrains Mono", fontSize: 18, letterSpacing: "0.2em" }}
                />
                <PasswordInput
                  autoComplete="new-password"
                  name="new-password"
                  placeholder="Nova senha (mín. 8 caracteres)"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
                <PasswordInput
                  autoComplete="new-password"
                  name="confirm-new-password"
                  placeholder="Confirmar nova senha"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyAndReset()}
                />
                {error && (
                  <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5 }}>{error}</div>
                )}
                <Btn variant="primary" onClick={handleVerifyAndReset} disabled={submitting}>
                  {submitting ? "Confirmando..." : "Confirmar código e salvar senha"}
                </Btn>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button
                    onClick={() => setResetStep("request")}
                    style={{ background: "none", border: "none", color: T.textMuted, fontFamily: "Inter", fontSize: 12, cursor: "pointer", padding: 0 }}
                  >
                    Reenviar código
                  </button>
                  <button
                    onClick={() => { setMode("login"); resetFlowReset(); }}
                    style={{ background: "none", border: "none", color: T.textMuted, fontFamily: "Inter", fontSize: 12, cursor: "pointer", padding: 0 }}
                  >
                    Voltar para o login
                  </button>
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <Label>Criar conta de atleta</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Input
                type="text"
                autoComplete="name"
                name="name"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                name="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <PasswordInput
                autoComplete="new-password"
                name="new-password"
                placeholder="Criar senha (mín. 8 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordInput
                autoComplete="new-password"
                name="confirm-password"
                placeholder="Confirmar senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignup()}
              />
              <Select value={modality} onChange={(e) => setModality(e.target.value)}>
                <option>Corrida de rua</option>
                <option>Ciclismo</option>
                <option>Triatlo</option>
                <option>Crossfit</option>
                <option>Luta / MMA / Combate</option>
                <option>Futebol</option>
                <option>Natação</option>
                <option>Musculação / Força</option>
                <option>Outra</option>
              </Select>
              <Select value={level} onChange={(e) => setLevel(e.target.value)}>
                <option>Amador</option>
                <option>Semi-amador</option>
                <option>Semi-profissional</option>
              </Select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input
                  type="date"
                  autoComplete="bday"
                  placeholder="Data de nascimento"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
                <Select value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option>Feminino</option>
                  <option>Masculino</option>
                </Select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Peso (kg)"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Altura (m)"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>
              <div>
                <Label>Há quanto tempo está treinando?</Label>
                <Select value={trainingTime} onChange={(e) => setTrainingTime(e.target.value)}>
                  <option>1 ano ou menos</option>
                  <option>1 a 2 anos</option>
                  <option>2 anos ou mais</option>
                </Select>
              </div>

              {error && (
                <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5 }}>{error}</div>
              )}
              <Btn variant="primary" onClick={handleSignup} disabled={submitting}>
                {submitting ? "Criando conta..." : "Criar conta e entrar"}
              </Btn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   NAV
============================================================= */
const TABS = [
  { id: "dashboard", label: "Painel" },
  { id: "metas", label: "Metas & Provas" },
  { id: "treinos", label: "Treinos" },
  { id: "sincronia", label: "Sincronia (print)" },
  { id: "evolucao", label: "Evolução física" },
  { id: "suplementos", label: "Suplementos" },
  { id: "nutricao", label: "Nutrição" },
  { id: "analise", label: "Análise IA" },
  { id: "relatorios", label: "Relatórios" },
];

const TAB_ICONS = {
  dashboard: Home,
  metas: Target,
  treinos: Dumbbell,
  sincronia: RefreshCw,
  evolucao: HeartPulse,
  suplementos: PillIcon,
  nutricao: Apple,
  analise: Sparkles,
  relatorios: FileText,
};

function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < breakpoint);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

function NavList({ active, setActive, onNavigate }) {
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {TABS.map((t) => {
        const Icon = TAB_ICONS[t.id];
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => {
              setActive(t.id);
              if (onNavigate) onNavigate();
            }}
            className={`pulso-navitem${isActive ? " pulso-navitem-active" : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 14px",
              borderRadius: 8,
              border: "none",
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: 13.5,
              textAlign: "left",
              cursor: "pointer",
              width: "100%",
            }}
          >
            <Icon size={18} style={{ flexShrink: 0 }} />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

function Sidebar({ profile, active, setActive, onSwitch, isFullscreen, toggleFullscreen, fullscreenSupported }) {
  return (
    <div
      style={{
        width: 232,
        flexShrink: 0,
        minHeight: "100vh",
        background: T.bgElevated,
        borderRight: `1px solid ${T.border}`,
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
      }}
    >
      <div style={{ padding: "26px 20px 14px 20px" }}>
        <div style={{ fontFamily: "Bebas Neue", fontSize: 30, letterSpacing: "0.05em", color: T.textPrimary, lineHeight: 1 }}>
          PULSO
        </div>
        <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 12.5, color: T.textPrimary, marginTop: 8 }}>
          {profile.name}
        </div>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.textMuted, marginTop: 1 }}>
          {profile.modality}
        </div>
      </div>
      <div style={{ padding: "0 20px" }}>
        <PulseDivider height={14} />
      </div>
      <div style={{ flex: 1, padding: "10px 12px", overflowY: "auto" }}>
        <NavList active={active} setActive={setActive} />
      </div>
      <div style={{ padding: 14, borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
        {fullscreenSupported && (
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Sair da tela cheia" : "Expandir tela cheia"}
            style={{
              background: "transparent",
              border: `1px solid ${T.border}`,
              borderRadius: 7,
              color: T.textMuted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              width: 38,
              height: 38,
              padding: 0,
              flexShrink: 0,
            }}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        )}
        <button
          onClick={onSwitch}
          style={{
            flex: 1,
            background: "transparent",
            border: `1px solid ${T.border}`,
            borderRadius: 7,
            color: T.textMuted,
            fontFamily: "Inter",
            fontSize: 12.5,
            fontWeight: 600,
            padding: "8px 11px",
            cursor: "pointer",
          }}
        >
          sair
        </button>
      </div>
    </div>
  );
}

function MobileTopBar({ profile, onOpenMenu, isFullscreen, toggleFullscreen, fullscreenSupported }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        background: T.bgElevated,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onOpenMenu}
          style={{
            background: "transparent",
            border: `1px solid ${T.border}`,
            borderRadius: 7,
            color: T.textPrimary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            cursor: "pointer",
          }}
        >
          <Menu size={18} />
        </button>
        <div>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 22, letterSpacing: "0.05em", color: T.textPrimary, lineHeight: 1 }}>
            PULSO
          </div>
          <div style={{ fontFamily: "Inter", fontSize: 11, color: T.textMuted }}>{profile.name}</div>
        </div>
      </div>
      {fullscreenSupported && (
        <button
          onClick={toggleFullscreen}
          style={{
            background: "transparent",
            border: `1px solid ${T.border}`,
            borderRadius: 7,
            color: T.textMuted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            cursor: "pointer",
          }}
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      )}
    </div>
  );
}

function MobileDrawer({ open, onClose, profile, active, setActive, onSwitch }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }}
      />
      <div
        style={{
          position: "relative",
          width: 260,
          maxWidth: "82vw",
          height: "100%",
          background: T.bgElevated,
          borderRight: `1px solid ${T.border}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 18px 10px" }}>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 26, letterSpacing: "0.05em", color: T.textPrimary }}>PULSO</div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: "0 18px 10px", fontFamily: "Inter", fontSize: 12.5, color: T.textMuted }}>
          {profile.name} · {profile.modality}
        </div>
        <div style={{ padding: "0 18px" }}>
          <PulseDivider height={14} />
        </div>
        <div style={{ flex: 1, padding: "10px 12px", overflowY: "auto" }}>
          <NavList active={active} setActive={setActive} onNavigate={onClose} />
        </div>
        <div style={{ padding: 14, borderTop: `1px solid ${T.border}` }}>
          <button
            onClick={onSwitch}
            style={{
              width: "100%",
              background: "transparent",
              border: `1px solid ${T.border}`,
              borderRadius: 7,
              color: T.textMuted,
              fontFamily: "Inter",
              fontSize: 12.5,
              fontWeight: 600,
              padding: "9px 11px",
              cursor: "pointer",
            }}
          >
            sair
          </button>
        </div>
      </div>
    </div>
  );
}

function RightRail({ core, profile }) {
  const nextGoal = [...core.goals]
    .filter((g) => daysUntil(g.targetDate) >= 0)
    .sort((a, b) => daysUntil(a.targetDate) - daysUntil(b.targetDate))[0];

  const today = new Date().toISOString().slice(0, 10);
  const todaysWorkouts = core.plannedWorkouts.filter((w) => w.date === today);
  const todaysDone = todaysWorkouts.filter((w) => w.done).length;

  return (
    <div
      style={{
        width: 250,
        flexShrink: 0,
        borderLeft: `1px solid ${T.border}`,
        padding: "26px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        minHeight: "100vh",
      }}
    >
      <div>
        <Label>Próxima prova</Label>
        {nextGoal ? (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontFamily: "Bebas Neue", fontSize: 46, color: T.coral, lineHeight: 1 }}>
              {daysUntil(nextGoal.targetDate)}
              <span style={{ fontSize: 14, marginLeft: 5, color: T.textMuted, fontFamily: "Inter" }}>dias</span>
            </div>
            <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 12.5, marginTop: 4 }}>{nextGoal.title}</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.textMuted }}>{nextGoal.targetDate}</div>
          </div>
        ) : (
          <div style={{ fontFamily: "Inter", fontSize: 12, color: T.textMuted, marginTop: 6 }}>
            Nenhuma prova cadastrada.
          </div>
        )}
      </div>

      <PulseDivider height={16} />

      <div>
        <Label>Hoje</Label>
        {todaysWorkouts.length === 0 ? (
          <div style={{ fontFamily: "Inter", fontSize: 12, color: T.textMuted, marginTop: 6 }}>
            Nenhum treino programado para hoje.
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontFamily: "Bebas Neue", fontSize: 28, color: T.gold }}>
              {todaysDone}/{todaysWorkouts.length}
            </div>
            <div style={{ fontFamily: "Inter", fontSize: 12, color: T.textMuted }}>treinos concluídos</div>
          </div>
        )}
      </div>

      <PulseDivider height={16} />

      <div>
        <Label>Data</Label>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 12.5, color: T.textPrimary, marginTop: 6, textTransform: "capitalize" }}>
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD
============================================================= */
function daysUntil(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

function Dashboard({ core, profile }) {
  const nextGoal = [...core.goals]
    .filter((g) => daysUntil(g.targetDate) >= 0)
    .sort((a, b) => daysUntil(a.targetDate) - daysUntil(b.targetDate))[0];

  const last7 = core.trainings
    .filter((t) => {
      const d = (Date.now() - new Date(t.date).getTime()) / 86400000;
      return d >= 0 && d <= 7;
    });

  const totalDuration = last7.reduce((s, t) => s + (Number(t.duration) || 0), 0);
  const totalDistance = last7.reduce((s, t) => s + (Number(t.distance) || 0), 0);
  const avgEffort =
    last7.length > 0
      ? (last7.reduce((s, t) => s + (Number(t.effort) || 0), 0) / last7.length).toFixed(1)
      : "—";

  const upcomingPlanned = core.plannedWorkouts
    .filter((w) => daysUntil(w.date) >= 0)
    .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
    .slice(0, 4);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card
        style={{
          background: `linear-gradient(135deg, ${T.surfaceAlt}, ${T.surface})`,
          borderColor: T.coral + "33",
        }}
      >
        {nextGoal ? (
          <div>
            <Label>Próxima prova / meta</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
              <div
                style={{
                  fontFamily: "Bebas Neue",
                  fontSize: 64,
                  color: T.coral,
                  lineHeight: 1,
                }}
              >
                {daysUntil(nextGoal.targetDate)}
                <span style={{ fontSize: 20, marginLeft: 6, color: T.textMuted }}>dias</span>
              </div>
              <div>
                <div style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 17 }}>
                  {nextGoal.title}
                </div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 12.5, color: T.textMuted }}>
                  {nextGoal.targetDate} · meta: {nextGoal.targetMetric || "—"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Nenhuma prova cadastrada"
            hint='Cadastre uma meta ou competição na aba "Metas & Provas" para ver a contagem regressiva aqui.'
          />
        )}
      </Card>

      <PulseDivider height={18} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        {[
          { label: "Treinos (7 dias)", value: last7.length, unit: "sessões" },
          { label: "Duração total", value: totalDuration, unit: "min" },
          { label: "Distância total", value: totalDistance.toFixed(1), unit: "km" },
          { label: "Esforço médio", value: avgEffort, unit: "/10" },
        ].map((s) => (
          <Card key={s.label} style={{ padding: 14 }}>
            <Label>{s.label}</Label>
            <div style={{ fontFamily: "Bebas Neue", fontSize: 32, color: T.textPrimary }}>
              {s.value}
              <span style={{ fontFamily: "Inter", fontSize: 13, color: T.textMuted, marginLeft: 5 }}>
                {s.unit}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <Label>Próximos treinos programados</Label>
        {upcomingPlanned.length === 0 ? (
          <EmptyState
            title="Sem treinos programados"
            hint='Gere uma rotina de treino automática na aba "Treinos".'
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {upcomingPlanned.map((w) => (
              <div
                key={w.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  background: T.bgElevated,
                  borderRadius: 7,
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13.5 }}>
                    {w.title}
                  </div>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 11.5, color: T.textMuted }}>
                    {w.date} · {w.type}
                  </div>
                </div>
                <Pill color={T.steel}>{daysUntil(w.date) === 0 ? "hoje" : `${daysUntil(w.date)}d`}</Pill>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   METAS & PROVAS
============================================================= */
function Metas({ core, updateCore }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [metric, setMetric] = useState("");
  const [type, setType] = useState("Competição");
  const [notes, setNotes] = useState("");

  function addGoal() {
    if (!title.trim() || !date) return;
    const goal = {
      id: "g_" + Date.now(),
      title: title.trim(),
      targetDate: date,
      targetMetric: metric.trim(),
      competitionType: type,
      notes: notes.trim(),
    };
    updateCore({ ...core, goals: [...core.goals, goal] });
    setTitle("");
    setDate("");
    setMetric("");
    setNotes("");
  }

  function removeGoal(id) {
    updateCore({ ...core, goals: core.goals.filter((g) => g.id !== id) });
  }

  const sorted = [...core.goals].sort(
    (a, b) => new Date(a.targetDate) - new Date(b.targetDate)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <Label>Nova meta ou competição</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Input placeholder="Título (ex: Meia Maratona de Floripa)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option>Competição</option>
            <option>Meta pessoal</option>
            <option>Teste / avaliação</option>
          </Select>
          <Input placeholder="Meta em número (ex: 45min nos 10km)" value={metric} onChange={(e) => setMetric(e.target.value)} />
        </div>
        <div style={{ marginTop: 10 }}>
          <TextArea rows={2} placeholder="Observações (contexto, intenção)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div style={{ marginTop: 10 }}>
          <Btn variant="primary" onClick={addGoal} disabled={!title.trim() || !date}>
            Adicionar
          </Btn>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.length === 0 ? (
          <EmptyState title="Nenhuma meta cadastrada" hint="Adicione a primeira acima." />
        ) : (
          sorted.map((g) => {
            const d = daysUntil(g.targetDate);
            return (
              <Card key={g.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                    <div style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 15 }}>{g.title}</div>
                    <Pill color={g.competitionType === "Competição" ? T.coral : T.steel}>
                      {g.competitionType}
                    </Pill>
                  </div>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: T.textMuted }}>
                    {g.targetDate} · {d >= 0 ? `${d} dias restantes` : "encerrada"}
                    {g.targetMetric ? ` · meta: ${g.targetMetric}` : ""}
                  </div>
                  {g.notes && (
                    <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted, marginTop: 4 }}>
                      {g.notes}
                    </div>
                  )}
                </div>
                <Btn variant="danger" onClick={() => removeGoal(g.id)} style={{ height: 32 }}>
                  remover
                </Btn>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ============================================================
   TREINOS — log manual + geração de rotina por IA
============================================================= */
const WEEKDAY_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function weekdayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return "";
  return WEEKDAY_PT[d.getDay()];
}

const MODALITY_COLORS = [T.coral, T.gold, T.steel, T.good];
function modalityColor(name) {
  if (!name || name === "Descanso") return T.textMuted;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return MODALITY_COLORS[hash % MODALITY_COLORS.length];
}

const MODALITY_GROUPS = [
  {
    label: "Corrida & endurance",
    options: ["Corrida de rua", "Trail running", "Ultramaratona", "Duatlo", "Triatlo", "Caminhada / marcha atlética"],
  },
  {
    label: "Ciclismo & remo",
    options: ["Ciclismo de estrada", "Mountain bike", "Spinning / indoor bike", "Remo", "Canoagem"],
  },
  {
    label: "Natação & aquáticos",
    options: ["Natação", "Surf", "Triatlo aquático"],
  },
  {
    label: "Força & funcional",
    options: ["Crossfit", "Musculação / força", "Levantamento de peso olímpico", "Powerlifting", "Calistenia", "Treinamento funcional", "Hyrox"],
  },
  {
    label: "Lutas & combate",
    options: ["Jiu-jitsu", "MMA", "Boxe", "Muay Thai", "Judô", "Karatê", "Taekwondo", "Wrestling / luta olímpica", "Kickboxing"],
  },
  {
    label: "Esportes de quadra e campo",
    options: ["Futebol", "Futsal", "Vôlei", "Basquete", "Handebol", "Tênis", "Beach tennis", "Padel"],
  },
  {
    label: "Outras modalidades",
    options: ["Atletismo (pista e campo)", "Ginástica artística", "Escalada", "Patinação", "Skate", "Hipismo", "Yoga", "Pilates"],
  },
];

function ModalidadesManager({ core, updateCore, profile }) {
  const [selected, setSelected] = useState(MODALITY_GROUPS[0].options[0]);
  const [customName, setCustomName] = useState("");
  const [freq, setFreq] = useState("3x por semana");
  const modalities = core.modalities || [];
  const isCustom = selected === "Outra";

  function add() {
    const finalName = isCustom ? customName.trim() : selected;
    if (!finalName) return;
    const m = { id: "mod_" + Date.now(), name: finalName, frequency: freq };
    updateCore({ ...core, modalities: [...modalities, m] });
    setCustomName("");
  }
  function remove(id) {
    updateCore({ ...core, modalities: modalities.filter((m) => m.id !== id) });
  }

  return (
    <Card>
      <Label>Modalidades praticadas</Label>
      <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted, marginBottom: 12 }}>
        Cadastre tudo que o atleta pratica e com que frequência (ex: Crossfit — todos os dias, Corrida de rua — 2 a 3x por semana). Isso alimenta a montagem da planilha.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isCustom ? "1.5fr 1.5fr 1.1fr auto" : "2fr 1.3fr auto", gap: 8, alignItems: "end" }}>
        <div>
          <Label>Modalidade</Label>
          <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {MODALITY_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label="Não listada">
              <option value="Outra">Outra (digitar)</option>
            </optgroup>
          </Select>
        </div>
        {isCustom && (
          <div>
            <Label>Qual?</Label>
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Nome da modalidade" />
          </div>
        )}
        <div>
          <Label>Frequência</Label>
          <Select value={freq} onChange={(e) => setFreq(e.target.value)}>
            <option>Todos os dias</option>
            <option>5-6x por semana</option>
            <option>4x por semana</option>
            <option>3x por semana</option>
            <option>2 a 3x por semana</option>
            <option>2x por semana</option>
            <option>1x por semana</option>
          </Select>
        </div>
        <Btn variant="primary" onClick={add} disabled={isCustom && !customName.trim()}>
          Adicionar
        </Btn>
      </div>

      {modalities.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {modalities.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: T.bgElevated,
                border: `1px solid ${modalityColor(m.name)}55`,
                borderRadius: 999,
                padding: "5px 6px 5px 12px",
              }}
            >
              <span style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 600, color: modalityColor(m.name) }}>
                {m.name}
              </span>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.textMuted }}>{m.frequency}</span>
              <button
                onClick={() => remove(m.id)}
                style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "0 4px" }}
              >
                ×
              </button>
            </div>

          ))}
        </div>
      )}
    </Card>
  );
}

function DetailRow({ icon: Icon, label, value, color = T.textMuted }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Icon size={15} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontFamily: "Inter", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textMuted, fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textPrimary, marginTop: 1 }}>{value}</div>
      </div>
    </div>
  );
}

function TrainingItemDetail({ item, core, updateCore, profile, nextGoal, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateDetail() {
    setLoading(true);
    setError("");
    try {
      const { detail } = await api.ai.detalharSessao({ item, profile: { level: profile.level }, nextGoal });
      updateCore({
        ...core,
        plannedWorkouts: core.plannedWorkouts.map((w) => (w.id === item.id ? { ...w, detail } : w)),
      });
    } catch (e) {
      console.error(e);
      setError(`Não consegui detalhar essa sessão${e && e.message ? ` (${e.message})` : ""}.`);
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && !item.detail && !loading) generateDetail();
  }

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          padding: "8px 9px",
          cursor: "pointer",
          background: expanded ? T.bgElevated : "transparent",
        }}
        onClick={handleToggle}
      >
        <input
          type="checkbox"
          checked={!!item.done}
          onChange={(e) => {
            e.stopPropagation();
            onToggle(item.id);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ marginTop: 3 }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <Pill color={modalityColor(item.modality || item.type)}>{item.modality || item.type}</Pill>
            <span style={{ fontWeight: 600, textDecoration: item.done ? "line-through" : "none" }}>{item.title}</span>
            {item.intensity && item.modality !== "Descanso" && (
              <Pill color={item.intensity === "alto" ? T.coral : item.intensity === "moderado" ? T.gold : T.steel}>
                {item.intensity}
              </Pill>
            )}
          </div>
          <div style={{ color: T.textMuted, marginTop: 2, fontSize: 12 }}>{item.description}</div>
        </div>
        {expanded ? <ChevronDown size={16} color={T.textMuted} /> : <ChevronRight size={16} color={T.textMuted} />}
      </div>

      {expanded && (
        <div style={{ padding: "12px 14px 14px 14px", borderTop: `1px solid ${T.border}`, background: T.bg }}>
          {loading && (
            <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted }}>Detalhando a sessão...</div>
          )}
          {!loading && error && (
            <div>
              <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5, marginBottom: 8 }}>{error}</div>
              <Btn variant="ghost" onClick={generateDetail} style={{ fontSize: 12 }}>
                Tentar novamente
              </Btn>
            </div>
          )}
          {!loading && !error && item.detail && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                <DetailRow icon={Clock} label="Tempo estimado" value={item.detail.estimatedDuration} color={T.gold} />
                <DetailRow icon={Gauge} label="Pace / ritmo alvo" value={item.detail.pace} color={T.steel} />
                <DetailRow icon={HeartPulse} label="Zona alvo" value={item.detail.targetZone} color={T.coral} />
              </div>
              <PulseDivider height={12} color={T.border} />
              <DetailRow icon={Flame} label="Aquecimento" value={item.detail.warmup} color={T.coral} />
              <DetailRow icon={Dumbbell} label="Treino principal" value={item.detail.main} color={T.textPrimary} />
              <DetailRow icon={Wind} label="Volta à calma / alongamento" value={item.detail.cooldown} color={T.steel} />
              <DetailRow icon={StickyNote} label="Observação" value={item.detail.notes} color={T.gold} />
            </div>
          )}
          {!loading && !error && !item.detail && (
            <Btn variant="gold" onClick={generateDetail} style={{ fontSize: 12 }}>
              Gerar detalhamento
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}


function TreinoAtualImport({ core, updateCore, profile }) {
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileKind, setFileKind] = useState(null); // "image" | "pdf"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const assessments = core.trainingAssessments || [];

  async function handleFile(f) {
    if (!f) return;
    setFile(f);
    if (f.type === "application/pdf") {
      setFileKind("pdf");
      setFilePreview(f.name);
    } else {
      setFileKind("image");
      const resized = await fileToResizedBase64(f, 1200, 0.85);
      setFilePreview(resized);
    }
  }

  function clearFile() {
    setFile(null);
    setFilePreview(null);
    setFileKind(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function analyze() {
    if (!description.trim() && !file) {
      setError("Descreva o treino atual em texto e/ou anexe uma foto/PDF dele.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      let imageBase64;
      let pdfBase64;
      if (file) {
        if (fileKind === "pdf") {
          pdfBase64 = await fileToRawBase64(file);
        } else {
          imageBase64 = filePreview.split(",")[1];
        }
      }

      const { assessment } = await api.ai.avaliacaoTreinoAtual({
        description: description.trim(),
        profile: { name: profile.name, level: profile.level, modality: profile.modality },
        fileKind,
        imageBase64,
        pdfBase64,
      });

      const entry = { id: "ta_" + Date.now(), date: new Date().toISOString(), sourceText: description.trim(), ...assessment };
      updateCore({ ...core, trainingAssessments: [entry, ...assessments] });
      setDescription("");
      clearFile();
    } catch (e) {
      console.error(e);
      setError(`Não consegui analisar o treino atual agora${e && e.message ? ` (${e.message})` : ""}. Tente novamente.`);
    } finally {
      setLoading(false);
    }
  }

  const sorted = [...assessments].sort((a, b) => new Date(b.date) - new Date(a.date));
  const levelColor = (lvl) => (lvl === "Avançado" ? T.coral : lvl === "Intermediário" ? T.gold : T.steel);

  return (
    <Card>
      <Label>Treino atual (independente da modalidade)</Label>
      <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted, marginBottom: 12 }}>
        Escreva como está o treino que o atleta já faz hoje, e/ou anexe uma foto ou PDF da planilha/print atual. A IA
        analisa o conteúdo (não só o nome da modalidade) e estima o nível real e o grau de dificuldade.
      </div>
      <TextArea
        rows={3}
        placeholder="Ex: treino 5x na semana, faço agachamento, supino e levantamento terra com cargas moderadas, mais 20min de corrida no final..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => handleFile(e.target.files[0])}
          style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted }}
        />
        {file && (
          <button onClick={clearFile} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 12 }}>
            remover anexo
          </button>
        )}
      </div>
      {fileKind === "image" && filePreview && (
        <img src={filePreview} alt="treino atual" style={{ maxWidth: 160, marginTop: 10, borderRadius: 8, border: `1px solid ${T.border}` }} />
      )}
      {fileKind === "pdf" && filePreview && (
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: T.gold, marginTop: 10 }}>📄 {filePreview}</div>
      )}
      <div style={{ marginTop: 12 }}>
        <Btn variant="gold" onClick={analyze} disabled={loading}>
          {loading ? "Analisando..." : "Analisar treino atual"}
        </Btn>
      </div>
      {error && <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5, marginTop: 8 }}>{error}</div>}

      {sorted.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {sorted.map((a) => (
            <div key={a.id} style={{ background: T.bgElevated, borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 11.5, color: T.textMuted }}>
                  {new Date(a.date).toLocaleString("pt-BR")}
                </div>
                <Pill color={levelColor(a.estimatedLevel)}>{a.estimatedLevel || "—"}</Pill>
              </div>
              {a.difficultySummary && (
                <div style={{ fontFamily: "Inter", fontSize: 12.5, marginBottom: 6 }}>
                  <strong style={{ color: T.textPrimary }}>Dificuldade real: </strong>
                  <span style={{ color: T.textMuted }}>{a.difficultySummary}</span>
                </div>
              )}
              {a.strengths && (
                <div style={{ fontFamily: "Inter", fontSize: 12.5, marginBottom: 6 }}>
                  <strong style={{ color: T.good }}>Pontos fortes: </strong>
                  <span style={{ color: T.textMuted }}>{a.strengths}</span>
                </div>
              )}
              {a.gaps && (
                <div style={{ fontFamily: "Inter", fontSize: 12.5, marginBottom: 6 }}>
                  <strong style={{ color: T.coral }}>Lacunas / atenção: </strong>
                  <span style={{ color: T.textMuted }}>{a.gaps}</span>
                </div>
              )}
              {a.recommendation && (
                <div style={{ fontFamily: "Inter", fontSize: 12.5 }}>
                  <strong style={{ color: T.gold }}>Próximo passo: </strong>
                  <span style={{ color: T.textMuted }}>{a.recommendation}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Treinos({ core, updateCore, profile }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "Corrida",
    duration: "",
    distance: "",
    hrAvg: "",
    effort: "5",
    notes: "",
  });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [weeks, setWeeks] = useState(2);
  const [copyMsg, setCopyMsg] = useState("");

  const modalities = core.modalities || [];
  const [focusId, setFocusId] = useState("");
  const [preferences, setPreferences] = useState("");

  useEffect(() => {
    if (!focusId && modalities.length > 0) setFocusId(modalities[0].id);
    if (focusId && !modalities.find((m) => m.id === focusId)) {
      setFocusId(modalities.length > 0 ? modalities[0].id : "");
    }
  }, [modalities, focusId]);

  const nextGoal = [...core.goals]
    .filter((g) => daysUntil(g.targetDate) >= 0)
    .sort((a, b) => daysUntil(a.targetDate) - daysUntil(b.targetDate))[0];

  function addTraining() {
    if (!form.date) return;
    const t = {
      id: "tr_" + Date.now(),
      source: "manual",
      completed: true,
      ...form,
    };
    updateCore({ ...core, trainings: [t, ...core.trainings] });
    setForm({ ...form, duration: "", distance: "", hrAvg: "", notes: "" });
  }

  function removeTraining(id) {
    updateCore({ ...core, trainings: core.trainings.filter((t) => t.id !== id) });
  }

  async function generatePlan(toGoal = false) {
    const focusModality = modalities.find((m) => m.id === focusId);
    if (!focusModality) {
      setGenError('Cadastre ao menos uma modalidade praticada acima e escolha qual é o foco desta planilha.');
      return;
    }
    setGenerating(true);
    setGenError("");
    try {
      const recent = core.trainings.slice(0, 8).map((t) => ({
        date: t.date,
        type: t.type,
        duration: t.duration,
        effort: t.effort,
      }));

      const others = modalities.filter((m) => m.id !== focusId);
      const latestAssessment = (core.trainingAssessments || [])[0];

      const { plannedWorkouts, truncated } = await api.ai.gerarPlanilha({
        profile: { name: profile.name, level: profile.level },
        focusModality: { name: focusModality.name, frequency: focusModality.frequency },
        others: others.map((m) => ({ name: m.name, frequency: m.frequency })),
        nextGoal: nextGoal
          ? { title: nextGoal.title, targetDate: nextGoal.targetDate, targetMetric: nextGoal.targetMetric }
          : null,
        latestAssessment: latestAssessment
          ? {
              estimatedLevel: latestAssessment.estimatedLevel,
              difficultySummary: latestAssessment.difficultySummary,
              gaps: latestAssessment.gaps,
            }
          : null,
        preferences: preferences.trim(),
        recentTrainings: recent,
        weeks,
        toGoal,
      });
      updateCore({ ...core, plannedWorkouts: [...plannedWorkouts, ...core.plannedWorkouts] });
      if (truncated) {
        setGenError("A resposta da IA foi cortada pelo limite de tamanho — alguns dias do fim do período podem estar faltando. O que veio já foi salvo; gere de novo se precisar completar.");
      }
    } catch (e) {
      console.error(e);
      setGenError(
        e && e.message && e.message.includes("JSON")
          ? "A IA retornou uma planilha incompleta e não deu pra recuperar nenhum item. Tente novamente ou peça um período menor."
          : `Não consegui gerar a planilha agora (${e && e.message ? e.message : "erro desconhecido"}). Tente novamente.`
      );
    } finally {
      setGenerating(false);
    }
  }

  function toggleComplete(id) {
    updateCore({
      ...core,
      plannedWorkouts: core.plannedWorkouts.map((w) =>
        w.id === id ? { ...w, done: !w.done } : w
      ),
    });
  }

  const upcoming = [...core.plannedWorkouts].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  // agrupa por data para exibir como planilha
  const byDate = {};
  upcoming.forEach((w) => {
    if (!byDate[w.date]) byDate[w.date] = [];
    byDate[w.date].push(w);
  });
  const dateRows = Object.keys(byDate).sort((a, b) => new Date(a) - new Date(b));

  function copyAsSheet() {
    const header = "Data\tDia\tTreinos";
    const lines = dateRows.map((date) => {
      const items = byDate[date];
      const cell = items
        .map((i) => `${i.modality || i.type}: ${i.title} (${i.intensity || "-"}) — ${i.description}`)
        .join(" | ");
      return [date, weekdayLabel(date), cell].join("\t");
    });
    const tsv = [header, ...lines].join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(tsv)
        .then(() => setCopyMsg("Planilha copiada — cole no Excel, Sheets ou Numbers."))
        .catch(() => setCopyMsg("Não consegui copiar automaticamente. Selecione a tabela manualmente."));
    } else {
      setCopyMsg("Cópia automática indisponível neste navegador.");
    }
    setTimeout(() => setCopyMsg(""), 4000);
  }

  const history = [...core.trainings].sort((a, b) => new Date(b.date) - new Date(a.date));
  const focusModality = modalities.find((m) => m.id === focusId);
  const others = modalities.filter((m) => m.id !== focusId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <ModalidadesManager core={core} updateCore={updateCore} profile={profile} />

      <TreinoAtualImport core={core} updateCore={updateCore} profile={profile} />

      <Card>
        <Label>Montar planilha de treino</Label>
        {modalities.length === 0 ? (
          <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted }}>
            Cadastre ao menos uma modalidade praticada acima para começar a montar a planilha.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <Label>Gerar planilha com foco em</Label>
                <Select value={focusId} onChange={(e) => setFocusId(e.target.value)}>
                  {modalities.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.frequency})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Outras modalidades consideradas</Label>
                <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted, paddingTop: 9 }}>
                  {others.length > 0 ? others.map((m) => `${m.name} (${m.frequency})`).join(" · ") : "nenhuma outra cadastrada"}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <Label>Preferências ou restrições para esta planilha (opcional)</Label>
              <TextArea
                rows={2}
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder='Ex: "não fazer treino de tiro na planilha de corrida", "evitar treino de perna nos dias de corrida longa", "priorizar treinos pela manhã"'
              />
            </div>

            {focusModality && (
              <div style={{ fontFamily: "Inter", fontSize: 12, color: T.textMuted, marginTop: 8 }}>
                {nextGoal ? (
                  <>
                    Prova/meta cadastrada: <strong style={{ color: T.textPrimary }}>{nextGoal.title}</strong> em {nextGoal.targetDate}
                    {nextGoal.targetMetric ? ` · meta: ${nextGoal.targetMetric}` : ""} — será considerada se fizer sentido para {focusModality.name}.
                  </>
                ) : (
                  'Nenhuma prova cadastrada em "Metas & Provas" — a IA foca em evolução geral.'
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
              <Select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} style={{ width: 130 }}>
                <option value={1}>1 semana</option>
                <option value={2}>2 semanas</option>
              </Select>
              <Btn variant="gold" onClick={() => generatePlan(false)} disabled={generating}>
                {generating ? "Gerando..." : "Gerar planilha"}
              </Btn>
              {nextGoal && (
                <Btn variant="primary" onClick={() => generatePlan(true)} disabled={generating}>
                  {generating ? "Gerando..." : "Gerar rumo à prova"}
                </Btn>
              )}
              {dateRows.length > 0 && (
                <Btn variant="ghost" onClick={copyAsSheet}>
                  Copiar planilha
                </Btn>
              )}
              {copyMsg && (
                <span style={{ fontFamily: "Inter", fontSize: 12, color: T.good }}>{copyMsg}</span>
              )}
            </div>
            {nextGoal && Math.ceil(daysUntil(nextGoal.targetDate) / 7) > 2 && (
              <div style={{ fontFamily: "Inter", fontSize: 12, color: T.textMuted, marginTop: 8 }}>
                A prova está a {Math.ceil(daysUntil(nextGoal.targetDate) / 7)} semanas — a IA gera 2 semanas por vez, ajustadas à fase atual da preparação. Volte aqui periodicamente pra gerar as próximas.
              </div>
            )}
          </>
        )}
        {genError && (
          <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5, marginTop: 8 }}>
            {genError}
          </div>
        )}
      </Card>

      <Card style={{ overflowX: "auto" }}>
        <Label>Planilha semanal</Label>
        {dateRows.length === 0 ? (
          <EmptyState title="Nenhum treino programado" hint='Preencha o formulário acima e clique em "Gerar planilha".' />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontFamily: "Inter", fontSize: 12.5 }}>
            <thead>
              <tr>
                {["Data", "Dia", "Treinos"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      color: T.textMuted,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: `1px solid ${T.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dateRows.map((date) => {
                const items = byDate[date];
                const cellStyle = { padding: "9px 10px", borderBottom: `1px solid ${T.border}`, verticalAlign: "top" };
                return (
                  <tr key={date}>
                    <td style={{ ...cellStyle, fontFamily: "JetBrains Mono", whiteSpace: "nowrap" }}>{date}</td>
                    <td style={{ ...cellStyle, fontFamily: "JetBrains Mono", textTransform: "capitalize", whiteSpace: "nowrap" }}>
                      {weekdayLabel(date)}
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {items.map((item) => (
                          <TrainingItemDetail
                            key={item.id}
                            item={item}
                            core={core}
                            updateCore={updateCore}
                            profile={profile}
                            nextGoal={nextGoal}
                            onToggle={toggleComplete}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <Label>Registrar treino realizado (manual)</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option>Corrida</option>
            <option>Ciclismo</option>
            <option>Natação</option>
            <option>Crossfit</option>
            <option>Força</option>
            <option>Luta / combate</option>
            <option>Recuperação</option>
            <option>Outro</option>
          </Select>
          <Input placeholder="Duração (min)" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          <Input placeholder="Distância (km)" value={form.distance} onChange={(e) => setForm({ ...form, distance: e.target.value })} />
          <Input placeholder="FC média (bpm)" value={form.hrAvg} onChange={(e) => setForm({ ...form, hrAvg: e.target.value })} />
          <Select value={form.effort} onChange={(e) => setForm({ ...form, effort: e.target.value })}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Esforço {n}/10
              </option>
            ))}
          </Select>
        </div>
        <div style={{ marginTop: 10 }}>
          <TextArea rows={2} placeholder="Notas (sensações, clima, etc.)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div style={{ marginTop: 10 }}>
          <Btn variant="primary" onClick={addTraining}>
            Registrar treino
          </Btn>
        </div>
      </Card>

      <Card>
        <Label>Histórico de treinos</Label>
        {history.length === 0 ? (
          <EmptyState title="Sem treinos registrados" hint="Registre manualmente acima ou sincronize um print." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {history.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  background: T.bgElevated,
                  borderRadius: 7,
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13 }}>{t.type}</span>
                    <Pill color={t.source === "screenshot" ? T.gold : t.source === "descricao" ? T.steel : T.textMuted}>
                      {t.source === "screenshot" ? "via print" : t.source === "descricao" ? "via descrição" : "manual"}
                    </Pill>
                  </div>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>
                    {t.date} {t.duration ? `· ${t.duration}min` : ""} {t.distance ? `· ${t.distance}km` : ""}{" "}
                    {t.hrAvg ? `· FC ${t.hrAvg}bpm` : ""} {t.pace ? `· ritmo ${t.pace}` : ""} {t.calories ? `· ${t.calories}kcal` : ""}
                  </div>
                </div>
                <button
                  onClick={() => removeTraining(t.id)}
                  style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 12 }}
                >
                  remover
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   SINCRONIA — upload de print + leitura por IA (visão)
============================================================= */
function Sincronia({ core, updateCore }) {
  const [preview, setPreview] = useState(null);
  const [base64, setBase64] = useState(null);
  const [mediaType, setMediaType] = useState("image/jpeg");
  const [status, setStatus] = useState("idle"); // idle | reading | done | error
  const [extracted, setExtracted] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const fileRef = useRef(null);

  const [description, setDescription] = useState("");
  const [descStatus, setDescStatus] = useState("idle"); // idle | reading | done | error
  const [descExtracted, setDescExtracted] = useState(null);
  const [descErrMsg, setDescErrMsg] = useState("");

  async function handleFile(file) {
    if (!file) return;
    setStatus("idle");
    setExtracted(null);
    const resized = await fileToResizedBase64(file);
    setPreview(resized);
    setBase64(resized.split(",")[1]);
    setMediaType("image/jpeg");
  }

  async function readScreenshot() {
    if (!base64) return;
    setStatus("reading");
    setErrMsg("");
    try {
      const { data } = await api.ai.lerPrintTreino({ imageBase64: base64, mediaType });
      setExtracted(data);
      setStatus("done");
    } catch (e) {
      console.error(e);
      setStatus("error");
      setErrMsg(`Não consegui ler essa imagem${e && e.message ? ` (${e.message})` : ""}. Tente um print mais nítido.`);
    }
  }

  function confirmAndSave() {
    if (!extracted) return;
    const t = {
      id: "tr_" + Date.now(),
      source: "screenshot",
      completed: true,
      date: extracted.date || new Date().toISOString().slice(0, 10),
      type: extracted.type || "Outro",
      duration: extracted.duration ?? "",
      distance: extracted.distance ?? "",
      pace: extracted.pace ?? "",
      hrAvg: extracted.hrAvg ?? "",
      hrMax: extracted.hrMax ?? "",
      calories: extracted.calories ?? "",
      effort: "",
      notes: extracted.notes || "",
    };
    updateCore({ ...core, trainings: [t, ...core.trainings] });
    setPreview(null);
    setBase64(null);
    setExtracted(null);
    setStatus("idle");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function analyzeDescription() {
    if (!description.trim()) return;
    setDescStatus("reading");
    setDescErrMsg("");
    try {
      const { data } = await api.ai.interpretarTreinoTexto({ description: description.trim() });
      setDescExtracted(data);
      setDescStatus("done");
    } catch (e) {
      console.error(e);
      setDescStatus("error");
      setDescErrMsg(`Não consegui interpretar essa descrição agora${e && e.message ? ` (${e.message})` : ""}. Tente novamente.`);
    }
  }

  function confirmAndSaveDescription() {
    if (!descExtracted) return;
    const t = {
      id: "tr_" + Date.now(),
      source: "descricao",
      completed: true,
      date: descExtracted.date || new Date().toISOString().slice(0, 10),
      type: descExtracted.type || "Outro",
      duration: descExtracted.duration ?? "",
      distance: descExtracted.distance ?? "",
      pace: descExtracted.pace ?? "",
      hrAvg: descExtracted.hrAvg ?? "",
      hrMax: descExtracted.hrMax ?? "",
      calories: descExtracted.calories ?? "",
      effort: "",
      notes: descExtracted.notes || "",
    };
    updateCore({ ...core, trainings: [t, ...core.trainings] });
    setDescription("");
    setDescExtracted(null);
    setDescStatus("idle");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <Label>Enviar print do relógio / app de treino</Label>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted, marginBottom: 12 }}>
          Tire uma captura de tela do resumo do treino no Garmin Connect, Apple Saúde, Strava ou similar. A IA lê a imagem e extrai os dados automaticamente — você confirma antes de salvar.
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFile(e.target.files[0])}
          style={{ fontFamily: "Inter", fontSize: 13, color: T.textMuted }}
        />

        {preview && (
          <div style={{ marginTop: 14, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <img
              src={preview}
              alt="preview"
              style={{ maxWidth: 220, borderRadius: 8, border: `1px solid ${T.border}` }}
            />
            <div style={{ flex: 1, minWidth: 220 }}>
              {status === "idle" && (
                <Btn variant="gold" onClick={readScreenshot}>
                  Ler dados com IA
                </Btn>
              )}
              {status === "reading" && (
                <div style={{ fontFamily: "Inter", color: T.textMuted, fontSize: 13 }}>
                  Lendo imagem...
                </div>
              )}
              {status === "error" && (
                <div>
                  <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 13, marginBottom: 8 }}>
                    {errMsg}
                  </div>
                  <Btn variant="ghost" onClick={readScreenshot}>
                    Tentar novamente
                  </Btn>
                </div>
              )}
              {status === "done" && extracted && (
                <div>
                  <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13, marginBottom: 8, color: T.good }}>
                    Dados extraídos — confira antes de salvar
                  </div>
                  <div
                    style={{
                      fontFamily: "JetBrains Mono",
                      fontSize: 12.5,
                      color: T.textPrimary,
                      background: T.bgElevated,
                      borderRadius: 7,
                      padding: 10,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 4,
                    }}
                  >
                    <div>tipo: {extracted.type || "—"}</div>
                    <div>data: {extracted.date || "—"}</div>
                    <div>duração: {extracted.duration ?? "—"} min</div>
                    <div>distância: {extracted.distance ?? "—"} km</div>
                    <div>ritmo: {extracted.pace ?? "—"}</div>
                    <div>FC média: {extracted.hrAvg ?? "—"}</div>
                    <div>FC máx: {extracted.hrMax ?? "—"}</div>
                    <div>calorias: {extracted.calories ?? "—"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <Btn variant="primary" onClick={confirmAndSave}>
                      Confirmar e salvar
                    </Btn>
                    <Btn variant="ghost" onClick={() => { setPreview(null); setExtracted(null); setStatus("idle"); }}>
                      Descartar
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <Label>Descreva aqui como foi seu treino</Label>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted, marginBottom: 12 }}>
          Não tem print à mão? Conta em texto como foi — a IA extrai os dados (tipo, duração, distância, ritmo,
          FC, calorias) automaticamente. Você confirma antes de salvar.
        </div>
        <TextArea
          rows={3}
          placeholder="Ex: corri 8km hoje de manhã em 42 minutos, ritmo em torno de 5'15/km, senti bem leve..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div style={{ marginTop: 10 }}>
          {descStatus !== "done" && (
            <Btn variant="gold" onClick={analyzeDescription} disabled={!description.trim() || descStatus === "reading"}>
              {descStatus === "reading" ? "Interpretando..." : "Interpretar com IA"}
            </Btn>
          )}
        </div>
        {descStatus === "error" && (
          <div style={{ marginTop: 10 }}>
            <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 13, marginBottom: 8 }}>{descErrMsg}</div>
            <Btn variant="ghost" onClick={analyzeDescription}>
              Tentar novamente
            </Btn>
          </div>
        )}
        {descStatus === "done" && descExtracted && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13, marginBottom: 8, color: T.good }}>
              Dados extraídos — confira antes de salvar
            </div>
            <div
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: 12.5,
                color: T.textPrimary,
                background: T.bgElevated,
                borderRadius: 7,
                padding: 10,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 4,
              }}
            >
              <div>tipo: {descExtracted.type || "—"}</div>
              <div>data: {descExtracted.date || "—"}</div>
              <div>duração: {descExtracted.duration ?? "—"} min</div>
              <div>distância: {descExtracted.distance ?? "—"} km</div>
              <div>ritmo: {descExtracted.pace ?? "—"}</div>
              <div>FC média: {descExtracted.hrAvg ?? "—"}</div>
              <div>FC máx: {descExtracted.hrMax ?? "—"}</div>
              <div>calorias: {descExtracted.calories ?? "—"}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Btn variant="primary" onClick={confirmAndSaveDescription}>
                Confirmar e salvar
              </Btn>
              <Btn variant="ghost" onClick={() => { setDescExtracted(null); setDescStatus("idle"); }}>
                Descartar
              </Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   EVOLUÇÃO FÍSICA — fotos por data
============================================================= */

/* ============================================================
   RELATÓRIO DE COMPOSIÇÃO CORPORAL — cálculos e classificações
============================================================= */
function classifyBMI(bmi) {
  if (bmi < 18.5) return { label: "Baixo peso", color: T.steel };
  if (bmi < 25) return { label: "Eutrofia", color: T.good };
  if (bmi < 30) return { label: "Sobrepeso", color: T.gold };
  return { label: "Obesidade", color: T.coral };
}
function classifyFatPercent(pct, sex) {
  const f = sex === "Feminino";
  const t = f ? [14, 24, 32] : [6, 17, 25];
  if (pct < t[0]) return { label: "Atenção", color: T.steel };
  if (pct < t[1]) return { label: "Baixo risco", color: T.good };
  if (pct < t[2]) return { label: "Moderado", color: T.gold };
  return { label: "Alto risco", color: T.coral };
}
function classifyIMM(val, sex) {
  const f = sex === "Feminino";
  const t = f ? [14, 17] : [17.8, 22.3];
  if (val < t[0]) return { label: "Baixo", color: T.steel };
  if (val < t[1]) return { label: "Adequado", color: T.good };
  return { label: "Alto", color: T.gold };
}
function classifyIMG(val, sex) {
  const f = sex === "Feminino";
  const t = f ? [3.5, 5.9] : [2.2, 4.4];
  if (val < t[0]) return { label: "Baixo", color: T.good };
  if (val < t[1]) return { label: "Adequado", color: T.gold };
  return { label: "Alto", color: T.coral };
}
function classifyWaist(cm, sex) {
  const f = sex === "Feminino";
  const t = f ? [80, 88] : [94, 102];
  if (cm < t[0]) return { label: "Baixo risco", color: T.good };
  if (cm < t[1]) return { label: "Moderado", color: T.gold };
  return { label: "Alto risco", color: T.coral };
}
function classifyWHtR(ratio) {
  if (ratio < 0.5) return { label: "Baixo risco", color: T.good };
  if (ratio < 0.55) return { label: "Moderado", color: T.gold };
  return { label: "Alto risco", color: T.coral };
}
function classifyWHR(ratio, sex) {
  const t = sex === "Feminino" ? 0.85 : 0.9;
  return ratio < t ? { label: "Adequado", color: T.good } : { label: "Inadequado", color: T.coral };
}
function classifyConicity(val, sex) {
  const t = sex === "Feminino" ? 1.18 : 1.25;
  return val < t ? { label: "Adequado", color: T.good } : { label: "Inadequado", color: T.coral };
}

function computeBodyReport(a, profile) {
  const weight = parseFloat(String(a.weight ?? profile.weight ?? "0").replace(",", ".")) || 0;
  const heightM = parseFloat(String(a.height ?? profile.height ?? "0").replace(",", ".")) || 0;
  const sex = profile.sex;
  const fatPercent = Number(a.fatPercent) || 0;
  const fatMass = weight * (fatPercent / 100);
  const leanMass = weight - fatMass;
  const bodyWater = leanMass * 0.723;
  const rmr = 500 + 22 * leanMass;
  const bmi = heightM ? weight / (heightM * heightM) : 0;
  const imm = heightM ? leanMass / (heightM * heightM) : 0;
  const img = heightM ? fatMass / (heightM * heightM) : 0;
  const waist = Number(a.waist) || 0;
  const hip = Number(a.hip) || 0;
  const whtr = heightM ? waist / (heightM * 100) : 0;
  const whr = hip ? waist / hip : 0;
  const conicity = weight && heightM ? waist / 100 / (0.109 * Math.sqrt(weight / heightM)) : 0;

  const fatClass = classifyFatPercent(fatPercent, sex);
  const bmiClass = classifyBMI(bmi);
  const immClass = classifyIMM(imm, sex);
  const imgClass = classifyIMG(img, sex);
  const waistClass = classifyWaist(waist, sex);
  const whtrClass = classifyWHtR(whtr);
  const whrClass = classifyWHR(whr, sex);
  const conicityClass = classifyConicity(conicity, sex);

  let score = 100;
  const penal = { "Alto risco": 15, Moderado: 8, Alto: 8, Baixo: 8, Inadequado: 10, "Baixo peso": 5, Sobrepeso: 8, Obesidade: 15, Atenção: 5 };
  [fatClass, bmiClass, immClass, imgClass, waistClass, whtrClass, whrClass, conicityClass].forEach((c) => {
    score -= penal[c.label] || 0;
  });
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    weight, heightM, fatPercent, fatMass, leanMass, bodyWater, rmr, bmi, imm, img,
    waist, hip, whtr, whr, conicity,
    fatClass, bmiClass, immClass, imgClass, waistClass, whtrClass, whrClass, conicityClass,
    score,
  };
}

function DonutChart({ fatPercent, size = 150 }) {
  const r = size / 2 - 13;
  const c = 2 * Math.PI * r;
  const fatLen = Math.max(0, Math.min(100, fatPercent)) / 100 * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.good} strokeOpacity="0.35" strokeWidth={13} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={T.coral}
        strokeWidth={13}
        strokeDasharray={`${fatLen} ${c - fatLen}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="47%" textAnchor="middle" fill={T.textPrimary} fontSize="24" fontFamily="Bebas Neue">
        {fatPercent.toFixed(1)}%
      </text>
      <text x="50%" y="61%" textAnchor="middle" fill={T.textMuted} fontSize="10" fontFamily="Inter">
        gordura
      </text>
    </svg>
  );
}

function GaugeBar({ label, value, unit = "", decimals = 1, domain, zones, resultLabel, resultColor, previous }) {
  const [min, max] = domain;
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
        <Label>{label}</Label>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <div style={{ fontFamily: "Bebas Neue", fontSize: 19, color: T.textPrimary }}>
            {value.toFixed(decimals)}
            {unit}
          </div>
          {previous != null && (
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 10.5, color: T.textMuted }}>
              (ant. {previous.toFixed(decimals)}
              {unit})
            </span>
          )}
        </div>
      </div>
      <div style={{ position: "relative", marginTop: 10 }}>
        <div style={{ height: 8, borderRadius: 4, overflow: "hidden", display: "flex" }}>
          {zones.map((z, i) => {
            const from = i === 0 ? min : zones[i - 1].to;
            const w = Math.max(0, ((Math.min(z.to, max) - from) / (max - min)) * 100);
            return <div key={i} style={{ width: `${w}%`, background: z.color }} />;
          })}
        </div>
        <div
          style={{
            position: "absolute",
            left: `${pct}%`,
            top: -3,
            transform: "translateX(-50%)",
            width: 2,
            height: 14,
            background: T.textPrimary,
          }}
        />
      </div>
      <div style={{ fontFamily: "Inter", fontSize: 11.5, fontWeight: 600, color: resultColor, marginTop: 6 }}>
        {resultLabel}
      </div>
    </div>
  );
}

function TrendMini({ label, unit = "", current, previous, decimals = 1 }) {
  const delta = current - previous;
  const minV = Math.min(previous, current);
  const maxV = Math.max(previous, current) || 1;
  const y = (v) => (maxV === minV ? 23 : 38 - ((v - minV) / (maxV - minV)) * 30);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Label>{label}</Label>
        <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: delta < 0 ? T.good : delta > 0 ? T.coral : T.textMuted }}>
          {delta > 0 ? "+" : ""}
          {delta.toFixed(decimals)}
          {unit}
        </span>
      </div>
      <svg width="100%" height="46" viewBox="0 0 120 46" preserveAspectRatio="none">
        <line x1="10" y1="23" x2="110" y2="23" stroke={T.border} strokeWidth="1" />
        <line x1="15" y1={y(previous)} x2="105" y2={y(current)} stroke={T.good} strokeWidth="2" />
        <circle cx="15" cy={y(previous)} r="3" fill={T.textMuted} />
        <circle cx="105" cy={y(current)} r="3.5" fill={T.coral} />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "JetBrains Mono", fontSize: 10, color: T.textMuted }}>
        <span>
          {previous.toFixed(decimals)}
          {unit}
        </span>
        <span style={{ color: T.textPrimary, fontWeight: 600 }}>
          {current.toFixed(decimals)}
          {unit}
        </span>
      </div>
    </div>
  );
}

function BodyReport({ assessment, previous, profile }) {
  const r = computeBodyReport(assessment, profile);
  const pr = previous ? computeBodyReport(previous, profile) : null;
  const age = assessment.ageAtAssessment ?? calcAge(profile.birthDate);
  const isFemale = profile.sex === "Feminino";
  const fatDomainMax = isFemale ? 45 : 35;
  const fatT = isFemale ? [14, 24, 32] : [6, 17, 25];
  const immT = isFemale ? [14, 17] : [17.8, 22.3];
  const imgT = isFemale ? [3.5, 5.9] : [2.2, 4.4];
  const whrT = isFemale ? 0.85 : 0.9;
  const conicityT = isFemale ? 1.18 : 1.25;

  return (
    <div id="pulso-report-print" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #pulso-report-print, #pulso-report-print * { visibility: visible !important; }
          #pulso-report-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          #pulso-report-print * {
            background: #ffffff !important;
            color: #111111 !important;
            border-color: #dddddd !important;
            box-shadow: none !important;
          }
          #pulso-report-print .no-print { display: none !important; }
          @page { margin: 14mm; }
        }
      `}</style>

      <Card style={{ background: `linear-gradient(135deg, ${T.surfaceAlt}, ${T.surface})` }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "Bebas Neue", fontSize: 22, color: T.textPrimary }}>{profile.name}</div>
            <div style={{ fontFamily: "Inter", fontSize: 12, color: T.textMuted }}>
              {profile.sex || "—"} · {age ? `${age} anos` : "idade —"} · {profile.height || "—"}m
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: T.textMuted }}>
              {new Date(assessment.date).toLocaleDateString("pt-BR")}
            </div>
            <Pill color={T.gold}>Avaliação por fotos</Pill>
            <div className="no-print" style={{ marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => window.print()} style={{ fontSize: 11.5, padding: "6px 12px" }}>
                Baixar PDF
              </Btn>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <Label>Análise global da composição corporal</Label>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <DonutChart fatPercent={r.fatPercent} />
          <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Label>Peso</Label>
              <div style={{ fontFamily: "Bebas Neue", fontSize: 19 }}>{r.weight.toFixed(1)} kg</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Label>Massa gorda</Label>
              <div style={{ fontFamily: "Bebas Neue", fontSize: 19, color: T.coral }}>{r.fatMass.toFixed(1)} kg</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Label>Massa magra</Label>
              <div style={{ fontFamily: "Bebas Neue", fontSize: 19, color: T.good }}>{r.leanMass.toFixed(1)} kg</div>
            </div>
            <PulseDivider height={12} color={T.border} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Label>Água corporal (estimada)</Label>
              <div style={{ fontFamily: "Inter", fontSize: 13 }}>{r.bodyWater.toFixed(1)} L</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Label>Gasto energético de repouso</Label>
              <div style={{ fontFamily: "Inter", fontSize: 13 }}>{Math.round(r.rmr)} kcal</div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          <GaugeBar
            label="IMC"
            value={r.bmi}
            unit=" kg/m²"
            domain={[10, 40]}
            zones={[
              { to: 18.5, color: T.steel },
              { to: 25, color: T.good },
              { to: 30, color: T.gold },
              { to: 40, color: T.coral },
            ]}
            resultLabel={r.bmiClass.label}
            resultColor={r.bmiClass.color}
            previous={pr ? pr.bmi : null}
          />
          <GaugeBar
            label="Percentual de gordura"
            value={r.fatPercent}
            unit="%"
            domain={[0, fatDomainMax]}
            zones={[
              { to: fatT[0], color: T.steel },
              { to: fatT[1], color: T.good },
              { to: fatT[2], color: T.gold },
              { to: fatDomainMax, color: T.coral },
            ]}
            resultLabel={r.fatClass.label}
            resultColor={r.fatClass.color}
            previous={pr ? pr.fatPercent : null}
          />
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          <GaugeBar
            label="Índice de massa magra"
            value={r.imm}
            unit=" kg/m²"
            domain={[10, 28]}
            zones={[
              { to: immT[0], color: T.steel },
              { to: immT[1], color: T.good },
              { to: 28, color: T.gold },
            ]}
            resultLabel={r.immClass.label}
            resultColor={r.immClass.color}
            previous={pr ? pr.imm : null}
          />
          <GaugeBar
            label="Índice de massa gorda"
            value={r.img}
            unit=" kg/m²"
            domain={[0, 10]}
            zones={[
              { to: imgT[0], color: T.good },
              { to: imgT[1], color: T.gold },
              { to: 10, color: T.coral },
            ]}
            resultLabel={r.imgClass.label}
            resultColor={r.imgClass.color}
            previous={pr ? pr.img : null}
          />
        </div>
      </Card>

      <Card>
        <Label>Medidas corporais (estimadas pela IA)</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: 12, marginTop: 10 }}>
          {[
            ["Cintura", r.waist],
            ["Quadril", r.hip],
            ["Braço", assessment.arm],
            ["Antebraço", assessment.forearm],
            ["Coxa", assessment.thigh],
            ["Panturrilha", assessment.calf],
          ].map(([label, val]) => (
            <div key={label} style={{ textAlign: "center", padding: "10px 6px", background: T.bgElevated, borderRadius: 8 }}>
              <div style={{ fontFamily: "Bebas Neue", fontSize: 21, color: T.textPrimary }}>
                {val ? Number(val).toFixed(1) : "—"}
              </div>
              <div style={{ fontFamily: "Inter", fontSize: 10.5, color: T.textMuted }}>{label} (cm)</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 20 }}>
          <GaugeBar
            label="Razão cintura-estatura"
            value={r.whtr}
            decimals={2}
            domain={[0.3, 0.7]}
            zones={[
              { to: 0.5, color: T.good },
              { to: 0.55, color: T.gold },
              { to: 0.7, color: T.coral },
            ]}
            resultLabel={r.whtrClass.label}
            resultColor={r.whtrClass.color}
            previous={pr ? pr.whtr : null}
          />
          <GaugeBar
            label="Razão cintura/quadril"
            value={r.whr}
            decimals={2}
            domain={[0.6, 1.1]}
            zones={[
              { to: whrT, color: T.good },
              { to: 1.1, color: T.coral },
            ]}
            resultLabel={r.whrClass.label}
            resultColor={r.whrClass.color}
            previous={pr ? pr.whr : null}
          />
          <GaugeBar
            label="Índice de conicidade"
            value={r.conicity}
            decimals={2}
            domain={[0.9, 1.5]}
            zones={[
              { to: conicityT, color: T.good },
              { to: 1.5, color: T.coral },
            ]}
            resultLabel={r.conicityClass.label}
            resultColor={r.conicityClass.color}
            previous={pr ? pr.conicity : null}
          />
        </div>
      </Card>

      <Card style={{ background: `linear-gradient(135deg, ${T.surfaceAlt}, ${T.surface})`, textAlign: "center" }}>
        <Label>Pulso Score</Label>
        <div style={{ fontFamily: "Bebas Neue", fontSize: 52, color: T.gold, lineHeight: 1.1 }}>
          {r.score}
          <span style={{ fontSize: 18, color: T.textMuted }}>/100</span>
        </div>
        <div style={{ fontFamily: "Inter", fontSize: 11.5, color: T.textMuted, maxWidth: 420, margin: "4px auto 0" }}>
          Score composto a partir dos indicadores acima. Use como complemento ao acompanhamento, não isoladamente.
        </div>
      </Card>

      {(assessment.muscleNote || assessment.postureNote || assessment.protocolIssues) && (
        <Card>
          <Label>Observações da IA</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {assessment.muscleNote && (
              <div style={{ fontFamily: "Inter", fontSize: 12.5 }}>
                <strong>Massa muscular:</strong> {assessment.muscleNote}
              </div>
            )}
            {assessment.postureNote && (
              <div style={{ fontFamily: "Inter", fontSize: 12.5 }}>
                <strong>Postura:</strong> {assessment.postureNote}
              </div>
            )}
            {assessment.protocolIssues && (
              <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.gold }}>
                <strong>Atenção ao protocolo:</strong> {assessment.protocolIssues}
              </div>
            )}
          </div>
        </Card>
      )}

      {pr && (
        <Card>
          <Label>Comparação com a avaliação anterior</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 18, marginTop: 10 }}>
            <TrendMini label="Peso" unit=" kg" current={r.weight} previous={pr.weight} />
            <TrendMini label="% gordura" unit="%" current={r.fatPercent} previous={pr.fatPercent} />
            <TrendMini label="Massa magra" unit=" kg" current={r.leanMass} previous={pr.leanMass} />
            <TrendMini label="Massa gorda" unit=" kg" current={r.fatMass} previous={pr.fatMass} />
          </div>
        </Card>
      )}
    </div>
  );
}

function FrontPoseIllustration({ size = 120 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 120 192" fill="none">
      <rect x="0" y="0" width="120" height="192" rx="10" fill={T.bgElevated} />
      {/* cabeça */}
      <circle cx="60" cy="30" r="14" fill="none" stroke={T.coral} strokeWidth="2.5" />
      {/* tronco */}
      <path d="M46 44 L44 108 L76 108 L74 44 Z" fill="none" stroke={T.coral} strokeWidth="2.5" strokeLinejoin="round" />
      {/* braços afastados, palmas para frente */}
      <line x1="46" y1="52" x2="14" y2="72" stroke={T.coral} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="74" y1="52" x2="106" y2="72" stroke={T.coral} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="11" cy="75" r="4" fill="none" stroke={T.gold} strokeWidth="2" />
      <circle cx="109" cy="75" r="4" fill="none" stroke={T.gold} strokeWidth="2" />
      {/* pernas afastadas */}
      <line x1="52" y1="108" x2="38" y2="176" stroke={T.coral} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="68" y1="108" x2="82" y2="176" stroke={T.coral} strokeWidth="2.5" strokeLinecap="round" />
      {/* setas indicando afastamento */}
      <line x1="20" y1="90" x2="42" y2="90" stroke={T.textMuted} strokeWidth="1.2" strokeDasharray="2 2" />
      <line x1="78" y1="90" x2="100" y2="90" stroke={T.textMuted} strokeWidth="1.2" strokeDasharray="2 2" />
    </svg>
  );
}

function SidePoseIllustration({ size = 120 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 120 192" fill="none">
      <rect x="0" y="0" width="120" height="192" rx="10" fill={T.bgElevated} />
      {/* cabeça de perfil */}
      <circle cx="55" cy="30" r="14" fill="none" stroke={T.coral} strokeWidth="2.5" />
      {/* tronco de perfil */}
      <path d="M48 44 L45 108 L62 108 L58 44 Z" fill="none" stroke={T.coral} strokeWidth="2.5" strokeLinejoin="round" />
      {/* braço direito erguido à frente */}
      <line x1="58" y1="54" x2="104" y2="46" stroke={T.coral} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="107" cy="45" r="4" fill="none" stroke={T.gold} strokeWidth="2" />
      {/* perna única visível (perfil) */}
      <line x1="52" y1="108" x2="48" y2="176" stroke={T.coral} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="48" y1="176" x2="66" y2="180" stroke={T.coral} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const BODY_PROTOCOL_STEPS = [
  {
    title: "Vestimenta",
    detail:
      "Mulheres: top e short justos ou biquíni. Homens: short justo ou sunga. Nada de roupa larga — ela distorce o resultado. Sem relógio, óculos, meias ou chinelo. Umbigo à mostra. Cabelo longo preso em coque atrás da cabeça.",
  },
  {
    title: "Foto de frente",
    detail:
      "Braços afastados do tronco, pernas afastadas na altura da virilha, palmas das mãos para frente, dedos unidos.",
  },
  {
    title: "Foto de lado (lado direito)",
    detail:
      "Apenas o braço direito erguido à frente, costas da mão para a câmera, dedos unidos. Perna e braço esquerdos não devem aparecer na foto.",
  },
  {
    title: "Câmera e ambiente",
    detail:
      "Câmera na altura do tronco, bem de frente, sem inclinar pra cima, pra baixo ou de lado. Apoie o celular em algum lugar e não o mova entre uma foto e outra. Luz clara, sem gerar sombra do corpo no fundo. Fundo neutro, sem quadros ou TV ligada atrás.",
  },
];

function AvaliacaoFisica({ athleteId, profile, core, updateCore }) {
  const [frontPreview, setFrontPreview] = useState(null);
  const [frontBase64, setFrontBase64] = useState(null);
  const [sidePreview, setSidePreview] = useState(null);
  const [sideBase64, setSideBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const frontRef = useRef(null);
  const sideRef = useRef(null);

  const assessments = core.bodyAssessments || [];
  const age = calcAge(profile.birthDate);

  async function handleFront(file) {
    if (!file) return;
    const resized = await fileToResizedBase64(file, 1000, 0.8);
    setFrontPreview(resized);
    setFrontBase64(resized.split(",")[1]);
  }
  async function handleSide(file) {
    if (!file) return;
    const resized = await fileToResizedBase64(file, 1000, 0.8);
    setSidePreview(resized);
    setSideBase64(resized.split(",")[1]);
  }

  async function analyze() {
    if (!frontBase64 || !sideBase64) {
      setError("Envie as duas fotos (frente e lado) seguindo o protocolo acima.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { assessment } = await api.ai.avaliacaoCorporal({
        profile: {
          name: profile.name,
          sex: profile.sex,
          weight: profile.weight,
          height: profile.height,
          modality: profile.modality,
          level: profile.level,
          birthDate: profile.birthDate,
        },
        frontImageBase64: frontBase64,
        sideImageBase64: sideBase64,
      });
      const entry = {
        id: "ba_" + Date.now(),
        date: new Date().toISOString(),
        ageAtAssessment: age,
        weight: profile.weight,
        height: profile.height,
        ...assessment,
      };
      updateCore({ ...core, bodyAssessments: [entry, ...assessments] });
      setSelectedIdx(0);
      setFrontPreview(null);
      setFrontBase64(null);
      setSidePreview(null);
      setSideBase64(null);
      if (frontRef.current) frontRef.current.value = "";
      if (sideRef.current) sideRef.current.value = "";
    } catch (e) {
      console.error(e);
      setError(`Não consegui analisar as fotos agora${e && e.message ? ` (${e.message})` : ""}. Tente novamente.`);
    } finally {
      setLoading(false);
    }
  }

  const sortedAssessments = [...assessments].sort((a, b) => new Date(b.date) - new Date(a.date));
  const selected = sortedAssessments[selectedIdx] || null;
  const previous = sortedAssessments[selectedIdx + 1] || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <Label>Protocolo para as fotos</Label>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", margin: "10px 0" }}>
          <div style={{ textAlign: "center" }}>
            <FrontPoseIllustration />
            <div style={{ fontFamily: "Inter", fontSize: 11.5, fontWeight: 600, color: T.textMuted, marginTop: 6 }}>Frente</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <SidePoseIllustration />
            <div style={{ fontFamily: "Inter", fontSize: 11.5, fontWeight: 600, color: T.textMuted, marginTop: 6 }}>Lado direito</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {BODY_PROTOCOL_STEPS.map((s) => (
            <div key={s.title} style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 6, borderRadius: 3, background: T.coral, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 13 }}>{s.title}</div>
                <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted, marginTop: 2 }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Label>Enviar fotos para análise</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <FrontPoseIllustration size={54} />
              <div style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 600 }}>Foto de frente</div>
            </div>
            <input ref={frontRef} type="file" accept="image/*" onChange={(e) => handleFront(e.target.files[0])} style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted }} />
            {frontPreview && (
              <img src={frontPreview} alt="frente" style={{ width: "100%", maxWidth: 180, marginTop: 8, borderRadius: 8, border: `1px solid ${T.border}` }} />
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <SidePoseIllustration size={54} />
              <div style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 600 }}>Foto de lado (direito)</div>
            </div>
            <input ref={sideRef} type="file" accept="image/*" onChange={(e) => handleSide(e.target.files[0])} style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted }} />
            {sidePreview && (
              <img src={sidePreview} alt="lado" style={{ width: "100%", maxWidth: 180, marginTop: 8, borderRadius: 8, border: `1px solid ${T.border}` }} />
            )}
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <Btn variant="gold" onClick={analyze} disabled={loading}>
            {loading ? "Analisando..." : "Analisar com IA"}
          </Btn>
        </div>
        {error && <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5, marginTop: 8 }}>{error}</div>}
      </Card>

      {sortedAssessments.length === 0 ? (
        <EmptyState title="Nenhuma avaliação ainda" hint="Envie as duas fotos seguindo o protocolo e clique em analisar." />
      ) : (
        <>
          {sortedAssessments.length > 1 && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {sortedAssessments.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedIdx(i)}
                  style={{
                    flexShrink: 0,
                    padding: "7px 12px",
                    borderRadius: 999,
                    border: `1px solid ${i === selectedIdx ? T.gold : T.border}`,
                    background: i === selectedIdx ? T.gold + "22" : "transparent",
                    color: i === selectedIdx ? T.gold : T.textMuted,
                    fontFamily: "JetBrains Mono",
                    fontSize: 11.5,
                    cursor: "pointer",
                  }}
                >
                  {new Date(a.date).toLocaleDateString("pt-BR")}
                </button>
              ))}
            </div>
          )}
          <BodyReport assessment={selected} previous={previous} profile={profile} />
        </>
      )}
    </div>
  );
}

function Evolucao({ athleteId, profile, core, updateCore }) {
  const [tab, setTab] = useState("fotos"); // "fotos" | "avaliacao"
  const [photos, setPhotos] = useState(null);
  const [notes, setNotes] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    api
      .listPhotos()
      .then(setPhotos)
      .catch((e) => {
        console.error(e);
        setPhotos([]);
      });
  }, [athleteId]);

  async function handleFile(file) {
    if (!file) return;
    const resized = await fileToResizedBase64(file, 900, 0.78);
    setPendingFile(file);
    setPendingPreview(resized);
  }

  async function savePhoto() {
    if (!pendingFile) return;
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("photo", pendingFile);
      formData.append("date", date);
      formData.append("notes", notes.trim());
      const photo = await api.uploadPhoto(formData);
      setPhotos([photo, ...(photos || [])]);
      setPendingFile(null);
      setPendingPreview(null);
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(`Não consegui salvar a foto agora${e && e.message ? ` (${e.message})` : ""}.`);
    } finally {
      setSaving(false);
    }
  }

  async function removePhoto(id) {
    const previous = photos || [];
    setPhotos(previous.filter((p) => p.id !== id));
    try {
      await api.deletePhoto(id);
    } catch (e) {
      console.error(e);
      setPhotos(previous);
    }
  }

  const sorted = photos ? [...photos].sort((a, b) => new Date(b.date) - new Date(a.date)) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 4, background: T.bgElevated, borderRadius: 8, padding: 3, maxWidth: 420 }}>
        <button
          onClick={() => setTab("fotos")}
          style={{
            flex: 1,
            padding: "9px 0",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontFamily: "Inter",
            fontWeight: 600,
            fontSize: 13,
            background: tab === "fotos" ? T.surface : "transparent",
            color: tab === "fotos" ? T.textPrimary : T.textMuted,
          }}
        >
          Fotos de evolução
        </button>
        <button
          onClick={() => setTab("avaliacao")}
          style={{
            flex: 1,
            padding: "9px 0",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontFamily: "Inter",
            fontWeight: 600,
            fontSize: 13,
            background: tab === "avaliacao" ? T.surface : "transparent",
            color: tab === "avaliacao" ? T.textPrimary : T.textMuted,
          }}
        >
          Avaliação corporal por IA
        </button>
      </div>

      {tab === "avaliacao" ? (
        <AvaliacaoFisica athleteId={athleteId} profile={profile} core={core} updateCore={updateCore} />
      ) : photos === null ? (
        <div style={{ color: T.textMuted, fontFamily: "Inter" }}>Carregando...</div>
      ) : (
        <>
          <Card>
            <Label>Nova foto de evolução</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
              <input ref={fileRef} type="file" accept="image/*" onChange={(e) => handleFile(e.target.files[0])} style={{ fontFamily: "Inter", fontSize: 13, color: T.textMuted }} />
            </div>
            {pendingPreview && (
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                <img src={pendingPreview} alt="preview" style={{ width: 140, borderRadius: 8, border: `1px solid ${T.border}` }} />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <TextArea rows={2} placeholder="Notas (peso, sensação, contexto)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <div style={{ marginTop: 8 }}>
                    <Btn variant="primary" onClick={savePhoto} disabled={saving}>
                      {saving ? "Salvando..." : "Salvar foto"}
                    </Btn>
                  </div>
                  {error && <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5, marginTop: 8 }}>{error}</div>}
                </div>
              </div>
            )}
          </Card>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 14,
            }}
          >
            {sorted.length === 0 ? (
              <EmptyState title="Nenhuma foto ainda" hint="Adicione a primeira foto acima para começar a linha do tempo." />
            ) : (
              sorted.map((p) => (
                <div key={p.id}>
                  <img
                    src={resolveMediaUrl(p.url)}
                    alt={p.date.slice(0, 10)}
                    style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8, border: `1px solid ${T.border}` }}
                  />
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 11.5, color: T.textMuted, marginTop: 5 }}>
                    {p.date.slice(0, 10)}
                  </div>
                  {p.notes && (
                    <div style={{ fontFamily: "Inter", fontSize: 11.5, color: T.textPrimary, marginTop: 2 }}>
                      {p.notes}
                    </div>
                  )}
                  <button
                    onClick={() => removePhoto(p.id)}
                    style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 11, padding: 0, marginTop: 3 }}
                  >
                    remover
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   ALIMENTOS (TACO)
============================================================= */
function normalizeSearch(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function TacoFoodRow({ food }) {
  const [grams, setGrams] = useState(100);
  const factor = grams > 0 ? grams / 100 : 0;
  const fmt = (v) => (v == null ? "—" : (v * factor).toFixed(1).replace(".", ","));

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        background: T.bgElevated,
        borderRadius: 7,
      }}
    >
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13 }}>{food.name}</div>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: T.textMuted, marginTop: 2 }}>
          {food.category}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          min="0"
          value={grams}
          onChange={(e) => setGrams(Number(e.target.value))}
          style={{
            width: 64,
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            padding: "5px 7px",
            color: T.textPrimary,
            fontFamily: "JetBrains Mono",
            fontSize: 12.5,
          }}
        />
        <span style={{ fontFamily: "Inter", fontSize: 12, color: T.textMuted }}>g</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, auto)",
          gap: 12,
          fontFamily: "JetBrains Mono",
          fontSize: 12,
        }}
      >
        <div>
          <span style={{ color: T.coral }}>{fmt(food.kcal)}</span>{" "}
          <span style={{ color: T.textMuted }}>kcal</span>
        </div>
        <div>
          <span style={{ color: T.gold }}>{fmt(food.protein)}</span>{" "}
          <span style={{ color: T.textMuted }}>P</span>
        </div>
        <div>
          <span style={{ color: T.steel }}>{fmt(food.carb)}</span>{" "}
          <span style={{ color: T.textMuted }}>C</span>
        </div>
        <div>
          <span style={{ color: T.good }}>{fmt(food.lipids)}</span>{" "}
          <span style={{ color: T.textMuted }}>G</span>
        </div>
        <div>
          <span style={{ color: T.textPrimary }}>{fmt(food.fiber)}</span>{" "}
          <span style={{ color: T.textMuted }}>fibra</span>
        </div>
      </div>
    </div>
  );
}

function Alimentos() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");

  const categories = ["Todas", ...Array.from(new Set(TACO_FOODS.map((f) => f.category))).sort()];

  const filtered = TACO_FOODS.filter((f) => {
    const matchesCategory = category === "Todas" || f.category === category;
    const matchesQuery = query.trim() === "" || normalizeSearch(f.name).includes(normalizeSearch(query));
    return matchesCategory && matchesQuery;
  }).slice(0, 60);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <Label>Tabela de Alimentos — TACO</Label>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted, marginBottom: 12 }}>
          Base da Tabela Brasileira de Composição de Alimentos, 4ª edição (NEPA/UNICAMP) — {TACO_FOODS.length}{" "}
          alimentos brasileiros. Valores por 100g de parte comestível; ajuste a quantidade em gramas para calcular
          a porção real.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <Input
            placeholder="Buscar alimento (ex: arroz, frango, banana)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <EmptyState title="Nenhum alimento encontrado" hint="Tente outro termo de busca ou categoria." />
        ) : (
          filtered.map((f) => <TacoFoodRow key={f.id} food={f} />)
        )}
        {filtered.length === 60 && (
          <div style={{ fontFamily: "Inter", fontSize: 11.5, color: T.textMuted, textAlign: "center", marginTop: 4 }}>
            Mostrando os primeiros 60 resultados — refine a busca para ver outros.
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   NUTRIÇÃO — montagem da dieta do atleta
============================================================= */
function computeItemMacros(item) {
  const factor = (Number(item.grams) || 0) / 100;
  return {
    kcal: (item.kcalPer100 || 0) * factor,
    protein: (item.proteinPer100 || 0) * factor,
    carb: (item.carbPer100 || 0) * factor,
    fat: (item.fatPer100 || 0) * factor,
  };
}

function sumMacros(meals) {
  const total = { kcal: 0, protein: 0, carb: 0, fat: 0 };
  meals.forEach((m) =>
    m.items.forEach((it) => {
      const v = computeItemMacros(it);
      total.kcal += v.kcal;
      total.protein += v.protein;
      total.carb += v.carb;
      total.fat += v.fat;
    })
  );
  return total;
}

function MacroBar({ label, value, target, color, unit }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Inter", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: T.textMuted, fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: "JetBrains Mono", color: T.textPrimary }}>
          {value.toFixed(0)}
          {unit} {target > 0 ? `/ ${target}${unit}` : ""}
        </span>
      </div>
      <div style={{ height: 7, background: T.bgElevated, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

function MealCard({ meal, core, updateCore }) {
  const [query, setQuery] = useState("");
  const [grams, setGrams] = useState(100);
  const suggestions =
    query.trim().length >= 2
      ? TACO_FOODS.filter((f) => normalizeSearch(f.name).includes(normalizeSearch(query))).slice(0, 8)
      : [];

  function updateMeal(fn) {
    updateCore({
      ...core,
      diet: {
        ...core.diet,
        meals: core.diet.meals.map((m) => (m.id === meal.id ? fn(m) : m)),
      },
    });
  }

  function addFood(food) {
    const item = {
      id: "it_" + Date.now(),
      name: food.name,
      grams,
      kcalPer100: food.kcal || 0,
      proteinPer100: food.protein || 0,
      carbPer100: food.carb || 0,
      fatPer100: food.lipids || 0,
    };
    updateMeal((m) => ({ ...m, items: [...m.items, item] }));
    setQuery("");
    setGrams(100);
  }

  function removeItem(itemId) {
    updateMeal((m) => ({ ...m, items: m.items.filter((it) => it.id !== itemId) }));
  }

  function updateItemGrams(itemId, g) {
    updateMeal((m) => ({ ...m, items: m.items.map((it) => (it.id === itemId ? { ...it, grams: g } : it)) }));
  }

  function removeMeal() {
    updateCore({ ...core, diet: { ...core.diet, meals: core.diet.meals.filter((m) => m.id !== meal.id) } });
  }

  const mealTotal = sumMacros([meal]);

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 14 }}>{meal.name}</div>
          {meal.time && <div style={{ fontFamily: "JetBrains Mono", fontSize: 11.5, color: T.textMuted }}>{meal.time}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: T.coral }}>{mealTotal.kcal.toFixed(0)} kcal</span>
          <button onClick={removeMeal} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 12 }}>
            remover refeição
          </button>
        </div>
      </div>

      {meal.items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {meal.items.map((it) => {
            const v = computeItemMacros(it);
            return (
              <div
                key={it.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: T.bgElevated,
                  borderRadius: 7,
                  padding: "8px 10px",
                }}
              >
                <div style={{ fontFamily: "Inter", fontSize: 12.5, flex: 1, minWidth: 140 }}>{it.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number"
                    min="0"
                    value={it.grams}
                    onChange={(e) => updateItemGrams(it.id, Number(e.target.value))}
                    style={{
                      width: 56,
                      background: T.bg,
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      padding: "4px 6px",
                      color: T.textPrimary,
                      fontFamily: "JetBrains Mono",
                      fontSize: 12,
                    }}
                  />
                  <span style={{ fontFamily: "Inter", fontSize: 11, color: T.textMuted }}>g</span>
                </div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 11.5, color: T.textMuted }}>
                  {v.kcal.toFixed(0)}kcal · P{v.protein.toFixed(0)} · C{v.carb.toFixed(0)} · G{v.fat.toFixed(0)}
                </div>
                <button onClick={() => removeItem(it.id)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 12 }}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Input
            placeholder="Buscar alimento na TACO para adicionar..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Input
            type="number"
            min="0"
            value={grams}
            onChange={(e) => setGrams(Number(e.target.value))}
            style={{ width: 80, flexShrink: 0 }}
          />
        </div>
        {suggestions.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 5,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 7,
              marginTop: 4,
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {suggestions.map((f) => (
              <button
                key={f.id}
                onClick={() => addFood(f)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  padding: "8px 12px",
                  cursor: "pointer",
                  color: T.textPrimary,
                  fontFamily: "Inter",
                  fontSize: 12.5,
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                {f.name} <span style={{ color: T.textMuted, fontFamily: "JetBrains Mono", fontSize: 11 }}>({f.kcal}kcal/100g)</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function QuestionnaireField({ label, placeholder, value, onChange }) {
  const len = (value || "").length;
  return (
    <div>
      <Label>{label}</Label>
      <TextArea
        rows={3}
        maxLength={2000}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div style={{ textAlign: "right", fontFamily: "JetBrains Mono", fontSize: 10.5, color: T.textMuted, marginTop: 2 }}>
        {len}/2000
      </div>
    </div>
  );
}

function Nutricao({ core, updateCore, profile }) {
  const diet = core.diet || { targetKcal: "", targetProtein: "", targetCarb: "", targetFat: "", meals: [] };
  const emptyQuestionnaire = { rotina: "", alimentacaoAtual: "", gosta: "", naoGosta: "", paladar: "", suplementos: "", observacoes: "" };
  const [questionnaire, setQuestionnaire] = useState({ ...emptyQuestionnaire, ...(diet.questionnaire || {}) });
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [newMealName, setNewMealName] = useState("");
  const [newMealTime, setNewMealTime] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  function updateDiet(patch) {
    updateCore({ ...core, diet: { ...diet, ...patch } });
  }

  function updateQuestionnaireField(field, value) {
    setQuestionnaire((prev) => ({ ...prev, [field]: value }));
  }

  function saveQuestionnaire() {
    updateDiet({ questionnaire });
  }

  function addMeal() {
    if (!newMealName.trim()) return;
    const meal = { id: "meal_" + Date.now(), name: newMealName.trim(), time: newMealTime, items: [] };
    updateDiet({ meals: [...diet.meals, meal] });
    setNewMealName("");
    setNewMealTime("");
  }

  function suggestTargets() {
    const w = parseFloat((profile.weight || "0").replace(",", "."));
    const h = parseFloat((profile.height || "0").replace(",", "."));
    const age = calcAge(profile.birthDate) || 30;
    if (!w || !h) return;
    // Mifflin-St Jeor
    const bmr = profile.sex === "Feminino" ? 10 * w + 6.25 * h * 100 - 5 * age - 161 : 10 * w + 6.25 * h * 100 - 5 * age + 5;
    const activityFactor = 1.6; // atleta em treino regular
    const tdee = bmr * activityFactor;
    const protein = w * 1.8;
    const fat = w * 0.9;
    const proteinKcal = protein * 4;
    const fatKcal = fat * 9;
    const carb = Math.max(0, (tdee - proteinKcal - fatKcal) / 4);
    updateDiet({
      targetKcal: Math.round(tdee).toString(),
      targetProtein: Math.round(protein).toString(),
      targetCarb: Math.round(carb).toString(),
      targetFat: Math.round(fat).toString(),
    });
  }

  async function generateWithAI() {
    setGenerating(true);
    setGenError("");
    try {
      const { meals: parsed } = await api.ai.gerarDieta({
        profile: {
          name: profile.name,
          sex: profile.sex,
          weight: profile.weight,
          height: profile.height,
          modality: profile.modality,
          level: profile.level,
        },
        diet: {
          targetKcal: diet.targetKcal,
          targetProtein: diet.targetProtein,
          targetCarb: diet.targetCarb,
          targetFat: diet.targetFat,
        },
        questionnaire,
      });

      const meals = parsed.map((m) => ({
        id: "meal_" + Math.random().toString(36).slice(2),
        name: m.meal,
        time: m.time || "",
        items: (m.items || []).map((it) => {
          const match = matchTacoFood(it.food);
          return {
            id: "it_" + Math.random().toString(36).slice(2),
            name: match ? match.name : `${it.food} (sem correspondência exata na TACO)`,
            grams: it.grams || 100,
            kcalPer100: match ? match.kcal || 0 : 0,
            proteinPer100: match ? match.protein || 0 : 0,
            carbPer100: match ? match.carb || 0 : 0,
            fatPer100: match ? match.lipids || 0 : 0,
          };
        }),
      }));

      updateDiet({ meals });
    } catch (e) {
      console.error(e);
      setGenError(`Não consegui gerar a sugestão agora${e && e.message ? ` (${e.message})` : ""}. Tente novamente.`);
    } finally {
      setGenerating(false);
    }
  }

  const totals = sumMacros(diet.meals);
  const targetKcal = Number(diet.targetKcal) || 0;
  const targetProtein = Number(diet.targetProtein) || 0;
  const targetCarb = Number(diet.targetCarb) || 0;
  const targetFat = Number(diet.targetFat) || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card style={{ background: `linear-gradient(135deg, ${T.surfaceAlt}, ${T.surface})` }}>
        <Label>Totais do dia</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          <MacroBar label="Calorias" value={totals.kcal} target={targetKcal} color={T.coral} unit="kcal" />
          <MacroBar label="Proteína" value={totals.protein} target={targetProtein} color={T.gold} unit="g" />
          <MacroBar label="Carboidrato" value={totals.carb} target={targetCarb} color={T.steel} unit="g" />
          <MacroBar label="Gordura" value={totals.fat} target={targetFat} color={T.good} unit="g" />
        </div>
      </Card>

      <Card>
        <Label>Metas diárias</Label>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted, marginBottom: 10 }}>
          Defina manualmente ou gere uma sugestão de ponto de partida com base no peso, altura, idade e sexo do atleta
          (fórmula de Mifflin-St Jeor + fator de atividade para treino regular).
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
          <Input placeholder="Kcal/dia" value={diet.targetKcal} onChange={(e) => updateDiet({ targetKcal: e.target.value })} />
          <Input placeholder="Proteína (g)" value={diet.targetProtein} onChange={(e) => updateDiet({ targetProtein: e.target.value })} />
          <Input placeholder="Carboidrato (g)" value={diet.targetCarb} onChange={(e) => updateDiet({ targetCarb: e.target.value })} />
          <Input placeholder="Gordura (g)" value={diet.targetFat} onChange={(e) => updateDiet({ targetFat: e.target.value })} />
        </div>
        <div style={{ marginTop: 10 }}>
          <Btn variant="ghost" onClick={suggestTargets}>
            Calcular sugestão automática
          </Btn>
        </div>
      </Card>

      <Card>
        <Label>Questionário para montar a dieta</Label>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted, marginBottom: 12 }}>
          Para que seu plano alimentar seja personalizado, individual, preencha as perguntas abaixo.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <QuestionnaireField
            label="Rotina diária"
            placeholder="Ex: acordo às 6h, treino às 7h, trabalho das 9h às 18h, durmo por volta das 23h..."
            value={questionnaire.rotina}
            onChange={(v) => updateQuestionnaireField("rotina", v)}
          />
          <QuestionnaireField
            label="Como é a alimentação atual"
            placeholder="Ex: no café da manhã como pão com ovo, no almoço arroz feijão e carne, à noite..."
            value={questionnaire.alimentacaoAtual}
            onChange={(v) => updateQuestionnaireField("alimentacaoAtual", v)}
          />
          <QuestionnaireField
            label="O que gosta de comer"
            placeholder="Ex: frango, batata-doce, frutas em geral, arroz..."
            value={questionnaire.gosta}
            onChange={(v) => updateQuestionnaireField("gosta", v)}
          />
          <QuestionnaireField
            label="O que não gosta ou não come"
            placeholder="Ex: não como peixe, não gosto de brócolis, evito leite..."
            value={questionnaire.naoGosta}
            onChange={(v) => updateQuestionnaireField("naoGosta", v)}
          />
          <QuestionnaireField
            label="Paladar e preferências (doce/salgado, quente/frio)"
            placeholder="Ex: prefiro comidas mais salgadas, gosto de comida bem quente, não curto muito doce..."
            value={questionnaire.paladar}
            onChange={(v) => updateQuestionnaireField("paladar", v)}
          />
          <QuestionnaireField
            label="Suplementação em uso (quais e quantidade)"
            placeholder="Ex: whey protein 30g pela manhã, creatina 5g por dia, multivitamínico 1x ao dia..."
            value={questionnaire.suplementos}
            onChange={(v) => updateQuestionnaireField("suplementos", v)}
          />
          <QuestionnaireField
            label="Outras considerações importantes"
            placeholder="Deixe aqui considerações que você ache importante em relação à sua nutrição, rotina alimentar ou referente ao seu novo plano alimentar..."
            value={questionnaire.observacoes}
            onChange={(v) => updateQuestionnaireField("observacoes", v)}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <Btn variant="primary" onClick={saveQuestionnaire}>
            Salvar respostas
          </Btn>
        </div>
      </Card>

      <Card>
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          onClick={() => setShowFoodSearch((v) => !v)}
        >
          <Label>Consultar tabela de alimentos (TACO)</Label>
          {showFoodSearch ? <ChevronDown size={18} color={T.textMuted} /> : <ChevronRight size={18} color={T.textMuted} />}
        </div>
        {showFoodSearch && (
          <div style={{ marginTop: 12 }}>
            <Alimentos />
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <Label>Montar dieta com IA</Label>
            <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted }}>
              Gera um dia alimentar completo (substitui as refeições atuais), usando as respostas do questionário
              acima e casando os alimentos com a base TACO sempre que possível.
            </div>
          </div>
          <Btn variant="gold" onClick={generateWithAI} disabled={generating}>
            {generating ? "Gerando..." : "Gerar dieta com IA"}
          </Btn>
        </div>
        {genError && <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5, marginTop: 8 }}>{genError}</div>}
      </Card>

      <Card>
        <Label>Nova refeição</Label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <Input placeholder="Nome (ex: Café da manhã)" value={newMealName} onChange={(e) => setNewMealName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <Input type="time" value={newMealTime} onChange={(e) => setNewMealTime(e.target.value)} style={{ width: 120 }} />
          <Btn variant="primary" onClick={addMeal} disabled={!newMealName.trim()}>
            Adicionar
          </Btn>
        </div>
      </Card>

      {diet.meals.length === 0 ? (
        <EmptyState title="Nenhuma refeição ainda" hint='Adicione uma refeição acima ou gere uma dieta completa com IA.' />
      ) : (
        diet.meals.map((meal) => <MealCard key={meal.id} meal={meal} core={core} updateCore={updateCore} />)
      )}
    </div>
  );
}

/* ============================================================
   SUPLEMENTOS
============================================================= */
function Suplementos({ core, updateCore, profile }) {
  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00");
  const [notes, setNotes] = useState("");
  const [sugLoading, setSugLoading] = useState(false);
  const [sugError, setSugError] = useState("");

  const suggestions = core.supplementSuggestions || [];

  function add() {
    if (!name.trim()) return;
    const s = { id: "su_" + Date.now(), name: name.trim(), time, notes: notes.trim() };
    updateCore({ ...core, supplements: [...core.supplements, s] });
    setName("");
    setNotes("");
  }
  function remove(id) {
    updateCore({ ...core, supplements: core.supplements.filter((s) => s.id !== id) });
  }
  function removeSuggestion(id) {
    updateCore({ ...core, supplementSuggestions: suggestions.filter((s) => s.id !== id) });
  }

  async function generateSuggestion() {
    setSugLoading(true);
    setSugError("");
    try {
      const nextGoal = [...core.goals]
        .filter((g) => daysUntil(g.targetDate) >= 0)
        .sort((a, b) => daysUntil(a.targetDate) - daysUntil(b.targetDate))[0];

      const { content } = await api.ai.sugestaoSuplementacao({
        profile: { name: profile.name, modality: profile.modality, level: profile.level },
        nextGoal: nextGoal
          ? {
              title: nextGoal.title,
              targetDate: nextGoal.targetDate,
              competitionType: nextGoal.competitionType,
              targetMetric: nextGoal.targetMetric,
            }
          : null,
      });

      const entry = {
        id: "ss_" + Date.now(),
        date: new Date().toISOString(),
        goalTitle: nextGoal ? nextGoal.title : "Sem prova cadastrada",
        content,
      };
      updateCore({ ...core, supplementSuggestions: [entry, ...suggestions] });
    } catch (e) {
      console.error(e);
      setSugError(`Não consegui gerar as sugestões agora${e && e.message ? ` (${e.message})` : ""}. Tente novamente.`);
    } finally {
      setSugLoading(false);
    }
  }

  const sorted = [...core.supplements].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card style={{ background: `linear-gradient(135deg, ${T.surfaceAlt}, ${T.surface})`, borderColor: T.gold + "33" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <Label>Sugestão de suplementação por IA</Label>
            <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted }}>
              Gera orientação para a fase de preparação e para o dia da prova, com base na modalidade e na próxima meta cadastrada.
            </div>
          </div>
          <Btn variant="gold" onClick={generateSuggestion} disabled={sugLoading}>
            {sugLoading ? "Gerando..." : "Gerar sugestão"}
          </Btn>
        </div>
        {sugError && <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5, marginTop: 8 }}>{sugError}</div>}
      </Card>

      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {suggestions.map((s) => (
            <Card key={s.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Pill color={T.gold}>{s.goalTitle}</Pill>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 11.5, color: T.textMuted }}>
                    {new Date(s.date).toLocaleString("pt-BR")}
                  </div>
                </div>
                <button onClick={() => removeSuggestion(s.id)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 12 }}>
                  remover
                </button>
              </div>
              <div style={{ fontFamily: "Inter", fontSize: 13.5, lineHeight: 1.6, color: T.textPrimary, whiteSpace: "pre-wrap" }}>
                {s.content}
              </div>
            </Card>
          ))}
        </div>
      )}

      <PulseDivider height={18} color={T.gold} />

      <Card>
        <Label>Novo suplemento / horário fixo</Label>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <Input placeholder="Nome (ex: Whey, Creatina, Cafeína)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div style={{ marginTop: 10 }}>
          <Input placeholder="Dose / observação (ex: 5g, com água)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div style={{ marginTop: 10 }}>
          <Btn variant="primary" onClick={add}>
            Adicionar
          </Btn>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.length === 0 ? (
          <EmptyState title="Nenhum suplemento cadastrado" hint="Adicione os horários do dia acima." />
        ) : (
          sorted.map((s) => (
            <Card key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    fontFamily: "Bebas Neue",
                    fontSize: 20,
                    color: T.gold,
                    minWidth: 58,
                  }}
                >
                  {s.time}
                </div>
                <div>
                  <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13.5 }}>{s.name}</div>
                  {s.notes && (
                    <div style={{ fontFamily: "Inter", fontSize: 12, color: T.textMuted }}>{s.notes}</div>
                  )}
                </div>
              </div>
              <button onClick={() => remove(s.id)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 12 }}>
                remover
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

/* ============================================================
   ANÁLISE IA — retrospecto de evolução
============================================================= */
function AnaliseIA({ core, updateCore, profile }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      const nextGoal = [...core.goals]
        .filter((g) => daysUntil(g.targetDate) >= 0)
        .sort((a, b) => daysUntil(a.targetDate) - daysUntil(b.targetDate))[0];

      const recent = core.trainings.slice(0, 20).map((t) => ({
        date: t.date,
        type: t.type,
        duration: t.duration,
        distance: t.distance,
        pace: t.pace,
        hrAvg: t.hrAvg,
        effort: t.effort,
      }));

      const { content } = await api.ai.analiseEvolucao({
        profile: { name: profile.name, modality: profile.modality, level: profile.level },
        nextGoal: nextGoal ? { title: nextGoal.title, targetDate: nextGoal.targetDate } : null,
        recentTrainings: recent,
      });

      const entry = { id: "an_" + Date.now(), date: new Date().toISOString(), content };
      updateCore({ ...core, analyses: [entry, ...core.analyses] });
    } catch (e) {
      console.error(e);
      setError(`Não consegui gerar a análise agora${e && e.message ? ` (${e.message})` : ""}. Tente novamente.`);
    } finally {
      setLoading(false);
    }
  }

  const sorted = [...core.analyses].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <Label>Retrospecto de evolução</Label>
            <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted }}>
              A IA analisa o histórico de treinos e diz se o atleta está evoluindo, estagnado ou regredindo.
            </div>
          </div>
          <Btn variant="gold" onClick={runAnalysis} disabled={loading || core.trainings.length === 0}>
            {loading ? "Analisando..." : "Analisar agora"}
          </Btn>
        </div>
        {core.trainings.length === 0 && (
          <div style={{ fontFamily: "Inter", fontSize: 12.5, color: T.textMuted, marginTop: 8 }}>
            Registre ao menos alguns treinos para gerar uma análise.
          </div>
        )}
        {error && <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5, marginTop: 8 }}>{error}</div>}
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.length === 0 ? (
          <EmptyState title="Nenhuma análise gerada ainda" hint='Clique em "Analisar agora" acima.' />
        ) : (
          sorted.map((a) => (
            <Card key={a.id}>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 11.5, color: T.textMuted, marginBottom: 8 }}>
                {new Date(a.date).toLocaleString("pt-BR")}
              </div>
              <div style={{ fontFamily: "Inter", fontSize: 13.5, lineHeight: 1.6, color: T.textPrimary, whiteSpace: "pre-wrap" }}>
                {a.content}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

/* ============================================================
   RELATÓRIOS — diário e semanal
============================================================= */
function Relatorios({ core, updateCore, profile }) {
  const [loading, setLoading] = useState(null); // "daily" | "weekly" | null
  const [error, setError] = useState("");

  async function generate(kind) {
    setLoading(kind);
    setError("");
    try {
      const now = new Date();
      const windowDays = kind === "daily" ? 1 : 7;
      const trainings = core.trainings.filter((t) => {
        const d = (now - new Date(t.date)) / 86400000;
        return d >= 0 && d < windowDays;
      });
      const supplementsToday = core.supplements;

      const { content } = await api.ai.relatorio({
        kind,
        profile: { name: profile.name, modality: profile.modality, level: profile.level },
        trainings: trainings.map((t) => ({ date: t.date, type: t.type, duration: t.duration, distance: t.distance, effort: t.effort })),
        supplementNames: supplementsToday.map((s) => s.name),
      });

      const entry = { id: "rp_" + Date.now(), date: new Date().toISOString(), type: kind, content };
      updateCore({ ...core, reports: [entry, ...core.reports] });
    } catch (e) {
      console.error(e);
      setError(`Não consegui gerar o relatório agora${e && e.message ? ` (${e.message})` : ""}. Tente novamente.`);
    } finally {
      setLoading(null);
    }
  }

  const sorted = [...core.reports].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <Label>Gerar relatório</Label>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Btn variant="primary" onClick={() => generate("daily")} disabled={loading !== null}>
            {loading === "daily" ? "Gerando..." : "Relatório diário"}
          </Btn>
          <Btn variant="steel" onClick={() => generate("weekly")} disabled={loading !== null}>
            {loading === "weekly" ? "Gerando..." : "Relatório semanal"}
          </Btn>
        </div>
        {error && <div style={{ color: T.danger, fontFamily: "Inter", fontSize: 12.5, marginTop: 8 }}>{error}</div>}
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.length === 0 ? (
          <EmptyState title="Nenhum relatório gerado ainda" hint="Gere o primeiro acima." />
        ) : (
          sorted.map((r) => (
            <Card key={r.id}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <Pill color={r.type === "daily" ? T.coral : T.steel}>
                  {r.type === "daily" ? "diário" : "semanal"}
                </Pill>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 11.5, color: T.textMuted }}>
                  {new Date(r.date).toLocaleString("pt-BR")}
                </div>
              </div>
              <div style={{ fontFamily: "Inter", fontSize: 13.5, lineHeight: 1.6, color: T.textPrimary, whiteSpace: "pre-wrap" }}>
                {r.content}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

/* ============================================================
   APP ROOT
============================================================= */
export default function App() {
  const [profile, setProfile] = useState(null);
  const [core, setCore] = useState(null);
  const [active, setActive] = useState("dashboard");
  const [checkingSession, setCheckingSession] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== "undefined" ? !!document.fullscreenElement : false
  );
  const isMobile = useIsMobile();
  const fullscreenSupported =
    typeof document !== "undefined" && !!document.documentElement.requestFullscreen;

  useEffect(() => {
    ensureFonts();
    ensureGlobalStyles();
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (!fullscreenSupported) return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  const handleLogout = useCallback(() => {
    api.logout().catch(() => {});
    setProfile(null);
    setCore(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(handleLogout);
  }, [handleLogout]);

  // Ao carregar, verifica se há uma sessão válida (cookie httpOnly já enviado pelo navegador)
  useEffect(() => {
    (async () => {
      try {
        const account = await api.me();
        setProfile(account);
      } catch {
        // sem sessão válida — permanece na tela de login
      } finally {
        setCheckingSession(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!profile) return;
    api
      .getCore()
      .then(setCore)
      .catch(() => setCore(emptyCore()));
  }, [profile]);

  const updateCore = useCallback(
    (next) => {
      setCore(next);
      if (profile) api.putCore(next).catch((e) => console.error("falha ao salvar dados do atleta", e));
    },
    [profile]
  );

  function handleEnter(account) {
    setProfile(account);
  }

  if (checkingSession) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.textMuted, fontFamily: "Inter", padding: 40 }}>
        Carregando...
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg }}>
        <ProfileGate onEnter={handleEnter} />
      </div>
    );
  }

  if (!core) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.textMuted, fontFamily: "Inter", padding: 40 }}>
        Carregando dados do atleta...
      </div>
    );
  }

  const content = (
    <>
      {active === "dashboard" && <Dashboard core={core} profile={profile} />}
      {active === "metas" && <Metas core={core} updateCore={updateCore} />}
      {active === "treinos" && <Treinos core={core} updateCore={updateCore} profile={profile} />}
      {active === "sincronia" && <Sincronia core={core} updateCore={updateCore} />}
      {active === "evolucao" && <Evolucao athleteId={profile.id} profile={profile} core={core} updateCore={updateCore} />}
      {active === "suplementos" && <Suplementos core={core} updateCore={updateCore} profile={profile} />}
      {active === "nutricao" && <Nutricao core={core} updateCore={updateCore} profile={profile} />}
      {active === "analise" && <AnaliseIA core={core} updateCore={updateCore} profile={profile} />}
      {active === "relatorios" && <Relatorios core={core} updateCore={updateCore} profile={profile} />}
    </>
  );

  if (isMobile) {
    return (
      <div className="pulso-app-bg" style={{ minHeight: "100vh", color: T.textPrimary }}>
        <MobileTopBar
          profile={profile}
          onOpenMenu={() => setDrawerOpen(true)}
          isFullscreen={isFullscreen}
          toggleFullscreen={toggleFullscreen}
          fullscreenSupported={fullscreenSupported}
        />
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          profile={profile}
          active={active}
          setActive={setActive}
          onSwitch={handleLogout}
        />
        <div style={{ padding: "16px 14px 60px" }}>{content}</div>
      </div>
    );
  }

  return (
    <div className="pulso-app-bg" style={{ minHeight: "100vh", color: T.textPrimary, display: "flex" }}>
      <Sidebar
        profile={profile}
        active={active}
        setActive={setActive}
        onSwitch={handleLogout}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        fullscreenSupported={fullscreenSupported}
      />
      <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
        <main style={{ flex: 1, minWidth: 0, padding: "28px 32px 60px", maxWidth: 900 }}>{content}</main>
        <RightRail core={core} profile={profile} />
      </div>
    </div>
  );
}
