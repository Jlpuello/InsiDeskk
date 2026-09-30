import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import { Send } from 'lucide-react';
import { conversationPublicApi } from '../api/conversation-public.api.ts';
import { connectContactSocket } from '../../../shared/realtime/socket.client.ts';
import { Turnstile } from '../../../shared/components/Turnstile.tsx';
import type { ConversationMessage, ConversationMessageEvent } from '../types/conversation.types.ts';

const inputClasses =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';
const labelClasses = 'mb-1 block text-sm font-medium text-gray-700';

// Guardado en el navegador del visitante — es la única forma de "volver al
// mismo chat" sin login (ver conversation-public.api.ts). Nunca se manda a
// ningún lado más que a este mismo dominio.
const STORAGE_KEY = 'insidesk:chat:token';

// Landing page sin AppLayout (mismo nivel que /reportar) — para gente de una
// empresa cliente sin acceso al portal. Dos etapas: verificar NIT + dejar un
// primer mensaje (calcado de PublicTicketForm), y después el chat en vivo
// (Socket.IO, namespace /conversations, autenticado por el token de ESTA
// conversación — ver conversation-realtime.service.ts en el backend).
// 'nit' = pidiendo el NIT; 'nombre' = el NIT no matcheó ninguna empresa
// existente, pide el nombre para darla de alta; 'form' = resto del chat.
type Stage = 'nit' | 'nombre' | 'form';

export function PublicChatWidget() {
  const [checkingStoredToken, setCheckingStoredToken] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [contactoNombre, setContactoNombre] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const [stage, setStage] = useState<Stage>('nit');
  const [nit, setNit] = useState('');
  const [company, setCompany] = useState<{ id: string; nombre: string } | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [formNombre, setFormNombre] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formMensaje, setFormMensaje] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Al montar, intenta retomar una conversación guardada — si el token ya
  // no es válido (conversación borrada, dato corrupto), se descarta y cae al
  // formulario de siempre en vez de trabar la pantalla.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setCheckingStoredToken(false);
      return;
    }
    conversationPublicApi
      .getByToken(stored)
      .then(({ conversation, messages: msgs }) => {
        setToken(stored);
        setContactoNombre(conversation.contactoNombre);
        setMessages(msgs);
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setCheckingStoredToken(false));
  }, []);

  useEffect(() => {
    if (!token) return;
    const socket = connectContactSocket(token);
    socket.on('message', (payload: ConversationMessageEvent) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.messageId)) return prev;
        return [
          ...prev,
          {
            id: payload.messageId,
            conversationId: payload.conversationId,
            remitenteTipo: payload.remitenteTipo,
            remitenteUserId: null,
            remitenteUser: null,
            contenido: payload.contenido,
            createdAt: payload.createdAt,
          },
        ];
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await conversationPublicApi.verifyCompany(nit.trim());
      if (result.encontrada && result.company) {
        setCompany(result.company);
        setStage('form');
      } else {
        // NIT válido pero sin empresa registrada — no es un error, se puede
        // seguir igual (ver companyService.resolveOrProvisionByNit).
        setCompany(null);
        setStage('nombre');
      }
    } catch {
      setVerifyError('No pudimos verificar el NIT. Verificá el dato e intentá de nuevo.');
    } finally {
      setVerifying(false);
    }
  }

  function handleConfirmNombre(e: FormEvent) {
    e.preventDefault();
    if (nombreEmpresa.trim().length < 2) return;
    setStage('form');
  }

  function handleChangeCompany() {
    setStage('nit');
    setCompany(null);
    setNombreEmpresa('');
  }

  async function handleStart(e: FormEvent) {
    e.preventDefault();
    if (!formEmail.trim() && !formTelefono.trim()) {
      setStartError('Dejá al menos un dato de contacto: email o teléfono');
      return;
    }
    if (!turnstileToken) {
      setStartError('Completá la verificación de seguridad antes de enviar.');
      return;
    }

    setStarting(true);
    setStartError(null);
    try {
      const { token: newToken } = await conversationPublicApi.start({
        nit: nit.trim(),
        turnstileToken,
        ...(!company && { nombreEmpresa: nombreEmpresa.trim() }),
        contactoNombre: formNombre,
        contactoEmail: formEmail || undefined,
        contactoTelefono: formTelefono || undefined,
        mensaje: formMensaje,
      });
      localStorage.setItem(STORAGE_KEY, newToken);
      setToken(newToken);
      setContactoNombre(formNombre);
      setMessages([
        {
          id: 'local-first',
          conversationId: '',
          remitenteTipo: 'contacto',
          remitenteUserId: null,
          remitenteUser: null,
          contenido: formMensaje,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setStartError('No se pudo iniciar el chat. Intentá de nuevo en unos minutos.');
    } finally {
      setStarting(false);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!token || !reply.trim()) return;

    setSending(true);
    try {
      const message = await conversationPublicApi.postMessage(token, reply.trim());
      setMessages((prev) => [...prev, message]);
      setReply('');
    } catch {
      // El input queda con el texto para reintentar — no vale la pena un
      // banner de error acá, es un chat, se nota solo si no aparece el mensaje.
    } finally {
      setSending(false);
    }
  }

  if (checkingStoredToken) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50" />;
  }

  // ── Chat en vivo (ya identificado, con o sin recargar la página) ─────────
  if (token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="flex h-[70vh] w-full max-w-md flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Chat de soporte</p>
            <p className="text-xs text-gray-400">Hola, {contactoNombre}</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m) => (
              <div key={m.id} className={clsx('flex', m.remitenteTipo === 'contacto' ? 'justify-end' : 'justify-start')}>
                <div
                  className={clsx(
                    'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                    m.remitenteTipo === 'contacto' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.contenido}</p>
                  <p
                    className={clsx(
                      'mt-1 text-[10px]',
                      m.remitenteTipo === 'contacto' ? 'text-blue-100' : 'text-gray-400',
                    )}
                  >
                    {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: es })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-gray-100 p-3">
            <input
              type="text"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escribí un mensaje..."
              disabled={sending}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !reply.trim()}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Paso 1: verificar NIT / Paso 2: dejar el primer mensaje ──────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-gray-900">Chat de soporte</h1>
        <p className="mb-6 text-sm text-gray-500">Sin necesidad de cuenta — dejanos tus datos de contacto.</p>

        {stage === 'nit' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className={labelClasses}>NIT de tu empresa</label>
              <input
                type="text"
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                required
                placeholder="900123456"
                className={inputClasses}
              />
            </div>

            {verifyError && <p className="text-sm text-red-600">{verifyError}</p>}

            <button
              type="submit"
              disabled={verifying || nit.trim().length < 3}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {verifying ? 'Verificando...' : 'Continuar'}
            </button>
          </form>
        )}

        {stage === 'nombre' && (
          <form onSubmit={handleConfirmNombre} className="space-y-4">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No encontramos una empresa registrada con ese NIT. Podés seguir igual — dejanos el nombre de tu
              empresa y nuestro equipo la vincula del lado de acá.
            </p>
            <div>
              <label className={labelClasses}>Nombre de tu empresa</label>
              <input
                type="text"
                value={nombreEmpresa}
                onChange={(e) => setNombreEmpresa(e.target.value)}
                required
                minLength={2}
                placeholder="Razón social o nombre comercial"
                className={inputClasses}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleChangeCompany}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={nombreEmpresa.trim().length < 2}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          </form>
        )}

        {stage === 'form' && (
          <form onSubmit={handleStart} className="space-y-4">
            <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
              <span>
                Empresa: <span className="font-medium">{company?.nombre ?? nombreEmpresa}</span>
              </span>
              <button
                type="button"
                onClick={handleChangeCompany}
                className="text-xs font-medium text-blue-700 underline hover:text-blue-900"
              >
                Cambiar
              </button>
            </div>

            <div>
              <label className={labelClasses}>Tu nombre</label>
              <input
                type="text"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                required
                minLength={2}
                className={inputClasses}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>Email</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Teléfono</label>
                <input type="tel" value={formTelefono} onChange={(e) => setFormTelefono(e.target.value)} className={inputClasses} />
              </div>
            </div>
            <p className="-mt-2 text-xs text-gray-400">Dejá al menos uno de los dos.</p>

            <div>
              <label className={labelClasses}>¿En qué te podemos ayudar?</label>
              <textarea
                value={formMensaje}
                onChange={(e) => setFormMensaje(e.target.value)}
                rows={3}
                required
                minLength={1}
                placeholder="Contanos qué necesitás..."
                className={inputClasses}
              />
            </div>

            <Turnstile onVerify={setTurnstileToken} />

            {startError && <p className="text-sm text-red-600">{startError}</p>}

            <button
              type="submit"
              disabled={starting || formNombre.trim().length < 2 || !formMensaje.trim() || !turnstileToken}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {starting ? 'Iniciando...' : 'Iniciar chat'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
