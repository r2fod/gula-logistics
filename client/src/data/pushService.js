export async function subscribeToPush(workerName) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications no soportadas');
  }

  const registration = await navigator.serviceWorker.ready;
  
  // Obtenemos la llave pública
  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID public key no configurada');

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  // Enviar suscripción al backend
  const apiUrl = import.meta.env.VITE_API_URL;
  const res = await fetch(`${apiUrl}/notifications/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerName, subscription })
  });

  if (!res.ok) {
    throw new Error('Error al guardar la suscripción en el servidor');
  }

  return true;
}

export async function sendPushNotification(title, body) {
  const { getStoredAdminToken } = await import('./apiService');
  const adminToken = getStoredAdminToken();
  const apiUrl = import.meta.env.VITE_API_URL;
  const res = await fetch(`${apiUrl}/notifications/notify`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ title, body })
  });
  if (!res.ok) {
    throw new Error('Error al enviar notificaciones');
  }
  return res.json();
}
