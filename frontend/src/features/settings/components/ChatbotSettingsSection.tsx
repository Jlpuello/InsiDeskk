import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import { chatbotApi } from '../../chatbot/api/chatbot.api.ts';
import { settingsApi } from '../api/settings.api.ts';
import { companyApi } from '../../companies/api/company.api.ts';
import type { ChatbotTreeOption } from '../../chatbot/types/chatbot.types.ts';
import type { Company } from '../../companies/types/company.types.ts';

interface EditableNode {
  id: string;
  mensaje: string;
  opciones: ChatbotTreeOption[];
}

const ACCIONES: { value: NonNullable<ChatbotTreeOption['accion']>; label: string }[] = [
  { value: 'crear_ticket', label: 'Crear ticket' },
  { value: 'hablar_con_agente', label: 'Hablar con un agente' },
  // Solo tiene efecto si la IA está habilitada en la pestaña "IA" — si no,
  // el botón queda ahí pero el widget muestra "no disponible" al elegirlo.
  { value: 'hablar_con_ia', label: 'Hablar con un asistente (IA)' },
  { value: 'fin', label: 'Finalizar conversación' },
];

// "destino" de una opción, colapsado a un solo <select> — o va a otro nodo,
// o dispara una acción terminal (ver ChatbotTreeOption). El valor del
// select es el id del nodo, o el string de la acción con un prefijo para
// no confundirse si algún día un id de nodo coincidiera con el nombre de
// una acción.
function destinoValue(opcion: ChatbotTreeOption): string {
  return opcion.siguienteId ? `nodo:${opcion.siguienteId}` : `accion:${opcion.accion}`;
}

function applyDestino(opcion: ChatbotTreeOption, destino: string): ChatbotTreeOption {
  const [tipo, valor] = destino.split(':');
  if (tipo === 'nodo') return { texto: opcion.texto, siguienteId: valor };
  return { texto: opcion.texto, accion: valor as ChatbotTreeOption['accion'] };
}

// Empresa a la que quedan los tickets creados desde el bot cuando quien
// reporta indica que no tiene NIT (soporte a un particular) — evita
// autoprovisionar una Company nueva por cada persona sin empresa (ver
// public-ticket.controller.ts). Guardado aparte del árbol: es una
// configuración propia, con su propio botón de guardar.
function DefaultCompanySection() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([settingsApi.getDefaultCompany(), companyApi.list()])
      .then(([defaultCompany, companyList]) => {
        setCompanies(companyList.filter((c) => c.activo));
        setCompanyId(defaultCompany.id ?? '');
      })
      .catch(() => setError('No se pudo cargar la configuración'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      await settingsApi.updateDefaultCompany(companyId || null);
      setSavedMessage('Configuración guardada');
    } catch {
      setError('No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando configuración...</p>;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Empresa por defecto (clientes sin NIT)</h2>
      <p className="mb-4 text-xs text-gray-400">
        Cuando alguien reporta un problema desde el bot indicando que no tiene NIT (soporte a un particular), el
        ticket queda asociado a esta empresa — solo para llevar control, no se crea una empresa nueva por persona.
        Sin esto configurado, ese camino queda deshabilitado.
      </p>

      <select
        value={companyId}
        onChange={(e) => setCompanyId(e.target.value)}
        className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">Sin configurar</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {savedMessage && <p className="mb-3 text-sm text-green-700">{savedMessage}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );
}

// Editor de lista de nodos (no canvas/drag-and-drop — fuera de alcance v1,
// ver plan). Un solo árbol activo a la vez.
export function ChatbotSettingsSection() {
  const [activo, setActivo] = useState(false);
  const [root, setRoot] = useState('');
  const [nodes, setNodes] = useState<EditableNode[]>([]);
  const [newNodeId, setNewNodeId] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    chatbotApi
      .getConfig()
      .then((config) => {
        setActivo(config.activo);
        setRoot(config.arbol.root);
        setNodes(Object.entries(config.arbol.nodes).map(([id, node]) => ({ id, ...node })));
        setUpdatedAt(config.updatedAt);
      })
      .catch(() => setError('No se pudo cargar la configuración'))
      .finally(() => setLoading(false));
  }, []);

  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);

  // Nodos que alguna opción usa como destino — no se pueden borrar sin antes
  // reapuntar esa opción, si no el árbol queda con una referencia rota.
  const referencedNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const node of nodes) {
      for (const opcion of node.opciones) {
        if (opcion.siguienteId) set.add(opcion.siguienteId);
      }
    }
    return set;
  }, [nodes]);

  function addNode() {
    const id = newNodeId.trim().toLowerCase().replace(/\s+/g, '-');
    if (!id || !/^[a-z0-9_-]+$/.test(id)) {
      setError('El id del nodo solo puede tener letras minúsculas, números, "-" y "_"');
      return;
    }
    if (nodeIds.includes(id)) {
      setError(`Ya existe un nodo "${id}"`);
      return;
    }
    setError(null);
    setNodes((prev) => [...prev, { id, mensaje: '', opciones: [] }]);
    if (!root) setRoot(id);
    setNewNodeId('');
  }

  function removeNode(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    if (root === id) setRoot('');
  }

  function updateNode(id: string, patch: Partial<EditableNode>) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function addOption(nodeId: string) {
    updateNode(nodeId, {
      opciones: [...(nodes.find((n) => n.id === nodeId)?.opciones ?? []), { texto: '', accion: 'fin' }],
    });
  }

  // siguienteId y accion son excluyentes (el backend rechaza una opción que
  // traiga los dos, ver ChatbotConfigController). Un merge ingenuo
  // ({...o, ...patch}) dejaba los dos campos conviviendo al cambiar el
  // destino de una opción de "acción" a "ir a nodo" (o viceversa): el patch
  // de applyDestino solo trae el campo nuevo, el merge no borraba el viejo.
  function updateOption(nodeId: string, index: number, patch: Partial<ChatbotTreeOption>) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const opciones = node.opciones.map((o, i) => {
      if (i !== index) return o;
      const merged: ChatbotTreeOption = { ...o, ...patch };
      if (patch.siguienteId !== undefined) delete merged.accion;
      if (patch.accion !== undefined) delete merged.siguienteId;
      return merged;
    });
    updateNode(nodeId, { opciones });
  }

  function removeOption(nodeId: string, index: number) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    updateNode(nodeId, { opciones: node.opciones.filter((_, i) => i !== index) });
  }

  async function handleSave() {
    setError(null);
    setSavedMessage(null);

    if (!root) return setError('Elegí qué nodo es el inicio de la conversación');
    if (nodes.length === 0) return setError('Agregá al menos un nodo');
    for (const node of nodes) {
      if (!node.mensaje.trim()) return setError(`El nodo "${node.id}" necesita un mensaje`);
      if (node.opciones.length === 0) return setError(`El nodo "${node.id}" necesita al menos una opción`);
      for (const opcion of node.opciones) {
        if (!opcion.texto.trim()) return setError(`Una opción del nodo "${node.id}" no tiene texto`);
      }
    }

    setSaving(true);
    try {
      const arbol = {
        root,
        nodes: Object.fromEntries(nodes.map(({ id, ...node }) => [id, node])),
      };
      const updated = await chatbotApi.updateConfig(activo, arbol);
      setUpdatedAt(updated.updatedAt);
      setSavedMessage('Configuración guardada');
    } catch (err) {
      // El backend ya devuelve un mensaje puntual (Joi, o la validación de
      // consistencia del árbol) — mostrarlo tal cual en vez de adivinar,
      // que las últimas veces terminó ocultando la causa real.
      const backendMessage = axios.isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
      setError(backendMessage ?? 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando configuración...</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <DefaultCompanySection />

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Árbol de decisiones del chatbot</h2>
            <p className="mt-1 text-xs text-gray-400">
              Guía la conversación del bot en la landing de soporte — cada opción lleva a otro nodo o dispara una
              acción (crear ticket, derivar a un agente, o finalizar).
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="rounded" />
            Activo
          </label>
        </div>

        {nodes.length > 0 && (
          <>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nodo inicial</label>
            <select
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Elegir...</option>
              {nodeIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {nodes.map((node) => (
        <div key={node.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">
              {node.id}
              {root === node.id && <span className="ml-1.5 font-sans text-blue-600">· inicio</span>}
            </span>
            <button
              type="button"
              onClick={() => removeNode(node.id)}
              disabled={referencedNodeIds.has(node.id)}
              title={referencedNodeIds.has(node.id) ? 'No se puede borrar: otra opción apunta acá' : 'Borrar nodo'}
              className="text-gray-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <label className="mb-1 block text-sm font-medium text-gray-700">Mensaje del bot</label>
          <textarea
            value={node.mensaje}
            onChange={(e) => updateNode(node.id, { mensaje: e.target.value })}
            rows={2}
            className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">Opciones</label>
          <div className="space-y-2">
            {node.opciones.map((opcion, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opcion.texto}
                  onChange={(e) => updateOption(node.id, index, { texto: e.target.value })}
                  placeholder="Texto del botón"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
                <select
                  value={destinoValue(opcion)}
                  onChange={(e) => updateOption(node.id, index, applyDestino(opcion, e.target.value))}
                  className="w-56 shrink-0 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <optgroup label="Ir a nodo">
                    {nodeIds
                      .filter((id) => id !== node.id)
                      .map((id) => (
                        <option key={id} value={`nodo:${id}`}>
                          {id}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Acción">
                    {ACCIONES.map((a) => (
                      <option key={a.value} value={`accion:${a.value}`}>
                        {a.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  onClick={() => removeOption(node.id, index)}
                  className="shrink-0 text-gray-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => addOption(node.id)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus size={13} /> Agregar opción
          </button>
        </div>
      ))}

      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newNodeId}
            onChange={(e) => setNewNodeId(e.target.value)}
            placeholder="id-del-nuevo-nodo (ej: pedir-nit)"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={addNode}
            className="flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            <Plus size={14} /> Agregar nodo
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedMessage && <p className="text-sm text-green-700">{savedMessage}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        {updatedAt && (
          <p className="text-xs text-gray-400">Última actualización: {new Date(updatedAt).toLocaleString('es-ES')}</p>
        )}
      </div>
    </div>
  );
}
