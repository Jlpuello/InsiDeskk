import { useEffect, useRef, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { X, Send, RotateCcw, CheckCircle2 } from 'lucide-react';
import { chatbotPublicApi } from '../api/chatbot-public.api.ts';
import { conversationPublicApi } from '../../conversations/api/conversation-public.api.ts';
import { publicTicketApi } from '../../tickets/api/public-ticket.api.ts';
import { aiChatPublicApi, type AiChatMessage } from '../../ai/api/ai-chat-public.api.ts';
import { connectContactSocket } from '../../../shared/realtime/socket.client.ts';
import { Turnstile } from '../../../shared/components/Turnstile.tsx';
import type { ChatbotTree, ChatbotTreeOption } from '../../chatbot/types/chatbot.types.ts';
import type { ConversationMessage, ConversationMessageEvent } from '../../conversations/types/conversation.types.ts';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400';
const labelClasses = 'mb-1 block text-sm font-medium text-slate-700';

// Mismo storage que usaba PublicChatWidget — un token guardado acá permite
// retomar la conversación aunque se cierre y reabra el widget (o se recargue
// la página). No se toca /chat: sigue siendo una entrada directa aparte,
// esto es solo la versión flotante embebida en /soporte.
const STORAGE_KEY = 'insidesk:chat:token';

interface TranscriptEntry {
  role: 'bot' | 'usuario';
  texto: string;
}

// 'nit' = pidiendo el NIT; 'nombre' = el NIT no matcheó ninguna empresa
// existente; 'form' = datos de contacto + primer mensaje.
type LiveStage = 'nit' | 'nombre' | 'form';

// 'nit' = pidiendo NIT (o "no tengo NIT"); 'form' = UNA sola pantalla con
// teléfono+nombre+correo+problema (corto a propósito, ver plan); 'done' =
// confirmación. A diferencia del flujo de chat en vivo, acá no hay stage
// "nombre" separado — si el NIT no matchea, el campo de nombre de empresa se
// suma DENTRO del mismo 'form', junto con la verificación de Turnstile.
type TicketStage = 'nit' | 'form' | 'done';

interface FloatingSupportWidgetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Fusiona lo que antes eran dos componentes separados (SupportBotPanel +
// PublicChatWidget) en un solo panel flotante, para que elegir "hablar con
// un agente" nunca navegue a otra página — la ventana flotante es la MISMA
// de principio a fin. /chat sigue existiendo aparte para quien tenga el link
// directo; acá se reimplementa esa lógica adaptada al panel angosto en vez
// de compartir el componente (el layout centrado a pantalla completa de
// PublicChatWidget no entra en un widget de 384px).
export function FloatingSupportWidget({ open, onOpenChange }: FloatingSupportWidgetProps) {
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState<'bot' | 'live' | 'ticket' | 'ai'>('bot');

  // ── Modo bot (árbol de decisiones) ────────────────────────────────────────
  const [tree, setTree] = useState<ChatbotTree | null | undefined>(undefined);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  // ── Modo live (chat en vivo, calcado de PublicChatWidget) ────────────────
  const [token, setToken] = useState<string | null>(null);
  const [contactoNombre, setContactoNombre] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [liveStage, setLiveStage] = useState<LiveStage>('nit');
  const [nit, setNit] = useState('');
  const [company, setCompany] = useState<{ id: string; nombre: string } | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formMensaje, setFormMensaje] = useState('');
  const [liveTurnstileToken, setLiveTurnstileToken] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  // ── Modo ticket (crear ticket sin salir del panel) ───────────────────────
  const [ticketStage, setTicketStage] = useState<TicketStage>('nit');
  const [ticketSinNit, setTicketSinNit] = useState(false);
  const [ticketNit, setTicketNit] = useState('');
  const [ticketCompany, setTicketCompany] = useState<{ id: string; nombre: string } | null>(null);
  const [ticketNombreEmpresa, setTicketNombreEmpresa] = useState('');
  const [ticketVerifying, setTicketVerifying] = useState(false);
  const [ticketVerifyError, setTicketVerifyError] = useState<string | null>(null);
  const [ticketNombre, setTicketNombre] = useState('');
  const [ticketTelefono, setTicketTelefono] = useState('');
  const [ticketEmail, setTicketEmail] = useState('');
  const [ticketProblema, setTicketProblema] = useState('');
  const [ticketTurnstileToken, setTicketTurnstileToken] = useState<string | null>(null);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSubmitError, setTicketSubmitError] = useState<string | null>(null);
  const [ticketCreatedId, setTicketCreatedId] = useState<string | null>(null);

  // ── Modo IA (chat libre, puede derivar a ticket/agente) ──────────────────
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiSending, setAiSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  function startFromRoot(t: ChatbotTree) {
    setCurrentNodeId(t.root);
    setTranscript([{ role: 'bot', texto: t.nodes[t.root].mensaje }]);
  }

  // Recién se inicializa la primera vez que se abre — así /soporte no le
  // pega a la API de chatbot/conversación antes de que el visitante haga
  // click en "Pedir soporte".
  useEffect(() => {
    if (!open || initialized) return;
    setInitialized(true);

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      chatbotPublicApi
        .getConfig()
        .then((config) => {
          setTree(config);
          if (config) startFromRoot(config);
        })
        .catch(() => setTree(null));
      return;
    }

    conversationPublicApi
      .getByToken(stored)
      .then(({ conversation, messages: msgs }) => {
        setMode('live');
        setToken(stored);
        setContactoNombre(conversation.contactoNombre);
        setMessages(msgs);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        chatbotPublicApi
          .getConfig()
          .then((config) => {
            setTree(config);
            if (config) startFromRoot(config);
          })
          .catch(() => setTree(null));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialized]);

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
  }, [transcript, messages]);

  function handleOption(opcion: ChatbotTreeOption) {
    setTranscript((prev) => [...prev, { role: 'usuario', texto: opcion.texto }]);

    if (opcion.accion === 'crear_ticket') {
      setMode('ticket');
      setTicketStage('nit');
      return;
    }
    if (opcion.accion === 'hablar_con_agente') {
      setMode('live');
      setLiveStage('nit');
      return;
    }
    if (opcion.accion === 'hablar_con_ia') {
      setMode('ai');
      setAiMessages([]);
      return;
    }
    if (opcion.accion === 'fin') {
      setCurrentNodeId(null);
      return;
    }
    if (opcion.siguienteId && tree) {
      setCurrentNodeId(opcion.siguienteId);
      setTranscript((prev) => [...prev, { role: 'bot', texto: tree.nodes[opcion.siguienteId!].mensaje }]);
    }
  }

  // Separado de handleVerify para poder llamarlo también desde el handoff de
  // la IA (ver handleAiToolCall), que ya tiene el NIT y no pasa por un submit
  // de formulario.
  async function runLiveVerify(nitValue: string) {
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await conversationPublicApi.verifyCompany(nitValue.trim());
      if (result.encontrada && result.company) {
        setCompany(result.company);
        setLiveStage('form');
      } else {
        setCompany(null);
        setLiveStage('nombre');
      }
    } catch {
      setVerifyError('No pudimos verificar el NIT. Verificá el dato e intentá de nuevo.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    await runLiveVerify(nit);
  }

  function handleConfirmNombre(e: FormEvent) {
    e.preventDefault();
    if (nombreEmpresa.trim().length < 2) return;
    setLiveStage('form');
  }

  function handleChangeCompany() {
    setLiveStage('nit');
    setCompany(null);
    setNombreEmpresa('');
    setLiveTurnstileToken(null);
  }

  async function handleStart(e: FormEvent) {
    e.preventDefault();
    if (!formEmail.trim() && !formTelefono.trim()) {
      setStartError('Dejá al menos un dato de contacto: email o teléfono');
      return;
    }
    if (!liveTurnstileToken) {
      setStartError('Completá la verificación de seguridad antes de enviar.');
      return;
    }

    setStarting(true);
    setStartError(null);
    try {
      const { token: newToken } = await conversationPublicApi.start({
        nit: nit.trim(),
        turnstileToken: liveTurnstileToken,
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
      // Mismo criterio que PublicChatWidget: el input queda con el texto
      // para reintentar, no vale la pena un banner acá.
    } finally {
      setSending(false);
    }
  }

  // Separado de handleTicketVerify para poder llamarlo también desde el
  // handoff de la IA (ver handleAiToolCall).
  async function runTicketVerify(nitValue: string) {
    setTicketVerifying(true);
    setTicketVerifyError(null);
    try {
      const result = await publicTicketApi.verifyCompany(nitValue.trim());
      setTicketCompany(result.encontrada ? result.company : null);
      setTicketStage('form');
    } catch {
      setTicketVerifyError('No pudimos verificar el NIT. Verificá el dato e intentá de nuevo.');
    } finally {
      setTicketVerifying(false);
    }
  }

  async function handleTicketVerify(e: FormEvent) {
    e.preventDefault();
    await runTicketVerify(ticketNit);
  }

  function handleTicketSinNit() {
    setTicketSinNit(true);
    setTicketCompany(null);
    setTicketStage('form');
  }

  function handleTicketChangeCompany() {
    setTicketStage('nit');
    setTicketSinNit(false);
    setTicketCompany(null);
    setTicketNombreEmpresa('');
    setTicketTurnstileToken(null);
  }

  async function handleTicketSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ticketEmail.trim() && !ticketTelefono.trim()) {
      setTicketSubmitError('Dejá al menos un dato de contacto: email o teléfono');
      return;
    }
    if (!ticketTurnstileToken) {
      setTicketSubmitError('Completá la verificación de seguridad antes de enviar');
      return;
    }

    setTicketSubmitting(true);
    setTicketSubmitError(null);
    try {
      const ticket = await publicTicketApi.create({
        ...(ticketSinNit
          ? { sinNit: true }
          : { nit: ticketNit.trim(), ...(!ticketCompany && { nombreEmpresa: ticketNombreEmpresa.trim() }) }),
        turnstileToken: ticketTurnstileToken,
        titulo: ticketProblema.slice(0, 80),
        descripcion: ticketProblema,
        reporterNombre: ticketNombre,
        reporterEmail: ticketEmail || undefined,
        reporterTelefono: ticketTelefono || undefined,
      });
      setTicketCreatedId(ticket.id);
      setTicketStage('done');
    } catch {
      setTicketSubmitError('No se pudo registrar el ticket. Intentá de nuevo en unos minutos.');
    } finally {
      setTicketSubmitting(false);
    }
  }

  // La IA nunca crea el ticket ni inicia el chat ella misma — solo precarga
  // el flujo que YA existe (con Turnstile/rate limiting incluidos) para que
  // el usuario revise y confirme. Si vino un NIT, se dispara la MISMA
  // verificación que si lo hubiera tipeado a mano.
  function handleAiToolCall(toolCall: { name: string; input: Record<string, unknown> }) {
    const nombreContacto = typeof toolCall.input.nombreContacto === 'string' ? toolCall.input.nombreContacto : '';
    const nitFromAi = typeof toolCall.input.nit === 'string' ? toolCall.input.nit : '';

    if (toolCall.name === 'preparar_ticket') {
      const resumen = typeof toolCall.input.resumenProblema === 'string' ? toolCall.input.resumenProblema : '';
      setTicketNombre(nombreContacto);
      setTicketProblema(resumen);
      setMode('ticket');
      if (nitFromAi) {
        setTicketNit(nitFromAi);
        void runTicketVerify(nitFromAi);
      } else {
        setTicketStage('nit');
      }
      return;
    }

    if (toolCall.name === 'derivar_a_agente') {
      setFormNombre(nombreContacto);
      setMode('live');
      if (nitFromAi) {
        setNit(nitFromAi);
        void runLiveVerify(nitFromAi);
      } else {
        setLiveStage('nit');
      }
    }
  }

  async function handleAiSend(e: FormEvent) {
    e.preventDefault();
    if (!aiInput.trim()) return;

    const newMessages: AiChatMessage[] = [...aiMessages, { role: 'user', content: aiInput.trim() }];
    setAiMessages(newMessages);
    setAiInput('');
    setAiSending(true);
    try {
      const result = await aiChatPublicApi.chat(newMessages);
      if (result.text) setAiMessages((prev) => [...prev, { role: 'assistant', content: result.text! }]);
      if (result.toolCall) handleAiToolCall(result.toolCall);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'No pude procesar tu mensaje — ¿querés que te derive con un agente humano?' },
      ]);
    } finally {
      setAiSending(false);
    }
  }

  if (!open) return null;

  const currentNode = currentNodeId ? tree?.nodes[currentNodeId] : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[32rem] sm:w-96 sm:rounded-xl sm:border sm:border-slate-200">
      <div className="flex shrink-0 items-center justify-between bg-blue-700 px-4 py-3 text-white sm:rounded-t-xl">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Soporte</p>
          {mode === 'live' && token && <p className="truncate text-xs text-blue-100">Hola, {contactoNombre}</p>}
        </div>
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Cerrar"
          className="shrink-0 rounded-md p-1 hover:bg-blue-800"
        >
          <X size={18} />
        </button>
      </div>

      {mode === 'bot' && (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {tree === undefined && <p className="text-sm text-slate-400">Cargando...</p>}
            {tree === null && (
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
                El chat automático no está disponible en este momento — usá &quot;Reportar directamente&quot; o
                escribinos por acá igual.
              </p>
            )}
            {transcript.map((entry, i) => (
              <div key={i} className={entry.role === 'usuario' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    entry.role === 'usuario'
                      ? 'max-w-[80%] rounded-lg bg-blue-700 px-3.5 py-2 text-sm text-white'
                      : 'max-w-[80%] rounded-lg bg-slate-100 px-3.5 py-2 text-sm text-slate-800'
                  }
                >
                  <p className="whitespace-pre-wrap break-words">{entry.texto}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {tree && (
            <div className="shrink-0 border-t border-slate-200 p-3">
              {currentNode ? (
                <div className="flex flex-wrap gap-2">
                  {currentNode.opciones.map((opcion, i) => (
                    <button
                      key={i}
                      onClick={() => handleOption(opcion)}
                      className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                    >
                      {opcion.texto}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => startFromRoot(tree)}
                  className="flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
                >
                  <RotateCcw size={14} /> Empezar de nuevo
                </button>
              )}
            </div>
          )}
        </>
      )}

      {mode === 'live' && token && (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div key={m.id} className={clsx('flex', m.remitenteTipo === 'contacto' ? 'justify-end' : 'justify-start')}>
                <div
                  className={clsx(
                    'max-w-[80%] rounded-lg px-3.5 py-2 text-sm',
                    m.remitenteTipo === 'contacto' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-800',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.contenido}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="flex shrink-0 items-center gap-2 border-t border-slate-200 p-3">
            <input
              type="text"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escribí un mensaje..."
              disabled={sending}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !reply.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
            >
              <Send size={15} />
            </button>
          </form>
        </>
      )}

      {mode === 'live' && !token && (
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {liveStage === 'nit' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm text-slate-500">Para empezar, dejanos el NIT de tu empresa.</p>
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
                className="w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {verifying ? 'Verificando...' : 'Continuar'}
              </button>
            </form>
          )}

          {liveStage === 'nombre' && (
            <form onSubmit={handleConfirmNombre} className="space-y-4">
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No encontramos una empresa registrada con ese NIT. Podés seguir igual — dejanos el nombre de tu
                empresa.
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
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={nombreEmpresa.trim().length < 2}
                  className="flex-1 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </form>
          )}

          {liveStage === 'form' && (
            <form onSubmit={handleStart} className="space-y-4">
              <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <span className="truncate">
                  Empresa: <span className="font-medium">{company?.nombre ?? nombreEmpresa}</span>
                </span>
                <button
                  type="button"
                  onClick={handleChangeCompany}
                  className="shrink-0 text-xs font-medium text-blue-700 underline hover:text-blue-900"
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

              <div>
                <label className={labelClasses}>Email</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Teléfono</label>
                <input type="tel" value={formTelefono} onChange={(e) => setFormTelefono(e.target.value)} className={inputClasses} />
              </div>
              <p className="-mt-2 text-xs text-slate-400">Dejá al menos uno de los dos.</p>

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

              <Turnstile onVerify={setLiveTurnstileToken} />

              {startError && <p className="text-sm text-red-600">{startError}</p>}

              <button
                type="submit"
                disabled={starting || formNombre.trim().length < 2 || !formMensaje.trim() || !liveTurnstileToken}
                className="w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {starting ? 'Iniciando...' : 'Iniciar chat'}
              </button>
            </form>
          )}
        </div>
      )}

      {mode === 'ticket' && (
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {ticketStage === 'nit' && (
            <form onSubmit={handleTicketVerify} className="space-y-4">
              <p className="text-sm text-slate-500">Para armar tu ticket, dejanos el NIT de tu empresa.</p>
              <div>
                <label className={labelClasses}>NIT de tu empresa</label>
                <input
                  type="text"
                  value={ticketNit}
                  onChange={(e) => setTicketNit(e.target.value)}
                  required
                  placeholder="900123456"
                  className={inputClasses}
                />
              </div>
              {ticketVerifyError && <p className="text-sm text-red-600">{ticketVerifyError}</p>}
              <button
                type="submit"
                disabled={ticketVerifying || ticketNit.trim().length < 3}
                className="w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {ticketVerifying ? 'Verificando...' : 'Continuar'}
              </button>
              <button
                type="button"
                onClick={handleTicketSinNit}
                className="w-full text-center text-xs font-medium text-slate-500 underline hover:text-slate-700"
              >
                No tengo NIT / soy particular
              </button>
            </form>
          )}

          {ticketStage === 'form' && (
            <form onSubmit={handleTicketSubmit} className="space-y-4">
              {ticketCompany ? (
                <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  <span className="truncate">
                    Empresa: <span className="font-medium">{ticketCompany.nombre}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleTicketChangeCompany}
                    className="shrink-0 text-xs font-medium text-blue-700 underline hover:text-blue-900"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {ticketSinNit
                    ? 'Soporte a un particular — completá tus datos y contanos el problema.'
                    : 'No encontramos una empresa registrada con ese NIT. Dejanos el nombre de tu empresa y contanos el problema.'}
                </p>
              )}

              {!ticketCompany && !ticketSinNit && (
                <div>
                  <label className={labelClasses}>Nombre de tu empresa</label>
                  <input
                    type="text"
                    value={ticketNombreEmpresa}
                    onChange={(e) => setTicketNombreEmpresa(e.target.value)}
                    required
                    minLength={2}
                    placeholder="Razón social o nombre comercial"
                    className={inputClasses}
                  />
                </div>
              )}

              <div>
                <label className={labelClasses}>Tu nombre</label>
                <input
                  type="text"
                  value={ticketNombre}
                  onChange={(e) => setTicketNombre(e.target.value)}
                  required
                  minLength={2}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>Teléfono</label>
                <input
                  type="tel"
                  value={ticketTelefono}
                  onChange={(e) => setTicketTelefono(e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>Correo (opcional)</label>
                <input
                  type="email"
                  value={ticketEmail}
                  onChange={(e) => setTicketEmail(e.target.value)}
                  className={inputClasses}
                />
              </div>
              <p className="-mt-2 text-xs text-slate-400">Dejá al menos un teléfono o correo.</p>

              <div>
                <label className={labelClasses}>Contanos qué pasa</label>
                <textarea
                  value={ticketProblema}
                  onChange={(e) => setTicketProblema(e.target.value)}
                  rows={3}
                  required
                  minLength={3}
                  placeholder="Describí brevemente el problema..."
                  className={inputClasses}
                />
              </div>

              <Turnstile onVerify={setTicketTurnstileToken} />

              {ticketSubmitError && <p className="text-sm text-red-600">{ticketSubmitError}</p>}

              <button
                type="submit"
                disabled={
                  ticketSubmitting ||
                  ticketNombre.trim().length < 2 ||
                  ticketProblema.trim().length < 3 ||
                  !ticketTurnstileToken
                }
                className="w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {ticketSubmitting ? 'Enviando...' : 'Crear ticket'}
              </button>
            </form>
          )}

          {ticketStage === 'done' && (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto text-green-600" size={32} />
              <p className="text-sm font-medium text-slate-900">¡Listo! Tu ticket quedó registrado.</p>
              {ticketCreatedId && <p className="font-mono text-xs text-slate-400">{ticketCreatedId.slice(0, 8)}</p>}
            </div>
          )}
        </div>
      )}

      {mode === 'ai' && (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {aiMessages.length === 0 && <p className="text-sm text-slate-400">Contame en qué te puedo ayudar.</p>}
            {aiMessages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[80%] rounded-lg bg-blue-700 px-3.5 py-2 text-sm text-white'
                      : 'max-w-[80%] rounded-lg bg-slate-100 px-3.5 py-2 text-sm text-slate-800'
                  }
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              </div>
            ))}
            {aiSending && <p className="text-xs text-slate-400">Escribiendo...</p>}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 border-t border-slate-200 p-3">
            <button
              type="button"
              onClick={() => {
                setMode('live');
                setLiveStage('nit');
              }}
              className="mb-2 block w-full text-center text-xs font-medium text-slate-500 underline hover:text-slate-700"
            >
              Hablar con un agente humano
            </button>
            <form onSubmit={handleAiSend} className="flex items-center gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Escribí tu consulta..."
                disabled={aiSending}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={aiSending || !aiInput.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
