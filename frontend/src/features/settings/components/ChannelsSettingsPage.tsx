import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft } from 'lucide-react';
import { WhatsappSettingsSection } from './WhatsappSettingsSection.tsx';
import { ChatbotSettingsSection } from './ChatbotSettingsSection.tsx';
import { AiSettingsSection } from './AiSettingsSection.tsx';

type ChannelTab = 'whatsapp' | 'chatbot' | 'ia';

const TABS: { id: ChannelTab; label: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'chatbot', label: 'Chatbot' },
  { id: 'ia', label: 'IA' },
];

// Se separó de SettingsPage (que se estaba llenando de pestañas que no
// tienen que ver con reglas de tickets) — WhatsApp/Chatbot/IA son
// específicamente "cómo se comporta el canal de mensajería", así que viven
// acá, a un clic del engranaje en Mensajes, en vez de mezcladas con
// Categorías/SLA/Plantillas. Email se queda en Configuración a propósito
// (decisión explícita del usuario, no un descuido).
export function ChannelsSettingsPage() {
  const [tab, setTab] = useState<ChannelTab>('whatsapp');

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link to="/inbox" className="mb-3 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={15} /> Volver a Mensajes
      </Link>
      <h1 className="mb-1 text-2xl font-semibold">Configuración de mensajería</h1>
      <p className="mb-6 text-sm text-gray-500">WhatsApp, chatbot e IA del canal de mensajes. Aplica globalmente.</p>

      <div className="mb-4 flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'whatsapp' && <WhatsappSettingsSection />}
      {tab === 'chatbot' && <ChatbotSettingsSection />}
      {tab === 'ia' && <AiSettingsSection />}
    </div>
  );
}
