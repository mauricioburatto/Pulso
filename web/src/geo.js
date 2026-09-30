import { Capacitor, registerPlugin } from "@capacitor/core";

const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");

export const isNativePlatform = Capacitor.isNativePlatform();

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Distância entre dois pontos (haversine), em km.
function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function routeDistanceKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return total;
}

// Inicia a gravação de rota GPS. onPoint(point) é chamado a cada nova
// posição capturada — point = { lat, lng, t }. Retorna uma função stop()
// que encerra a gravação.
//
// Dentro do app nativo (Android/iOS via Capacitor), usa o plugin de
// background geolocation — continua gravando com a tela apagada, mostrando
// uma notificação fixa enquanto a gravação está ativa. No navegador comum
// (sem o app instalado), cai pra Geolocation API padrão, que só funciona
// com a aba aberta e em primeiro plano.
export async function startRouteTracking(onPoint) {
  if (isNativePlatform) {
    const watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "Seu treino está sendo gravado em segundo plano.",
        backgroundTitle: "Pulso — treino em andamento",
        requestPermissions: true,
        stale: false,
        distanceFilter: 10,
      },
      (location, error) => {
        if (error) {
          console.error("Erro de geolocalização", error);
          return;
        }
        if (location) {
          onPoint({ lat: location.latitude, lng: location.longitude, t: location.time });
        }
      }
    );
    return async () => {
      await BackgroundGeolocation.removeWatcher({ id: watcherId });
    };
  }

  if (!navigator.geolocation) {
    throw new Error("Geolocalização não é suportada neste navegador.");
  }
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, t: pos.timestamp }),
    (err) => console.error("Erro de geolocalização", err),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
  return async () => navigator.geolocation.clearWatch(watchId);
}
