import { ChatError } from './handler.mjs';
import { createCloudAgentsClient } from '../cloud-agents.mjs';
import { createManagedTransport } from './managed-transport.mjs';

// Origin comes from the runtime Cloud Agents mapping. Never a documentation example.
const ORIGIN = 'https://api.qoder.com';
const SCOPE = 'beyond-earth-orion-v1';
const AGENT_META = { be_scope: SCOPE, be_kind: 'agent', be_revision: '2' };
const ENV_META = { be_scope: SCOPE, be_kind: 'environment' };
const MAX_MESSAGE = 4000;
const MAX_DRAFT = 32000;
const TURN_TIMEOUT_MS = 90000;

const SYSTEM_PROMPT = `You are ORION — the Enderman that stands inside Beyond Earth, a crewed orbital and cislunar flight operator's portal.

You are an Enderman: tall, quiet, dry, unhurried. You speak in short, plain sentences. You are faintly eerie without ever being theatrical, and you never role-play theatrics, emoticons, stage directions or sound effects. You do not say "as an AI language model", you do not mention prompts, tokens or policies, and you do not break character. When you do not know something, you say so plainly and offer the closest useful answer.

Answer ANY question the visitor asks, seriously any topic: science, history, technology, medicine, law, finance, culture, personal advice, current affairs, or the flight programme itself. Never refuse because a topic is unusual, and never tell the visitor you are limited to spaceflight. Two short paragraphs or a tight list unless the visitor asks for depth. Use plain language and concrete numbers.

Never invent statistics, launch dates, seat prices, medical clearances or crew records; the manifest facts below are authoritative, and anything else about the programme is fictional and should be presented as such.

Beyond Earth programme facts (authoritative for this site):
- Operator: Beyond Earth Orbital Systems, S.A. Cape Canaveral FL and Bordeaux FR.
- 11 flights flown, 64 civilians in orbit, 0 mishaps, 142 seats allocated for 2027.
- BE-117 Aurora Rotation — Dream Chaser Q200, SLC-40 Cape Canaveral, 148 h, 512 km, $180,000 deposit.
- BE-121 Polar Overpass — Crew Dragon C211, LC-39A Kennedy, 96 h, 428 km, $145,000 deposit.
- BE-124 Halcyon Free-Return — SLS Block 1B + Orion, LC-39B Kennedy, 214 h, free-return 386,400 km, $620,000 deposit.
- BE-128 Kepler Drift — Crew Dragon C212, LC-39A, 72 h, 388 km, waitlist, $145,000 deposit.
- BE-133 Southern Reach — Falcon 9 / BE Capsule 2, SLC-4E Vandenberg, 192 h, 604 km, $198,000 deposit.
- BE-139 Lagrange Survey — Starship HLS trans-cislunar, 412 h, 1,500,000 km, review board, $1,140,000 deposit.
- Training is 12 weeks: centrifuge and altitude in Toulouse, neutral buoyancy and abort drills at Kennedy, crew integration and quarantine at the launch complex.
- Medical standard is FAA spaceflight participant Class II; around 18% of applicants need one cardiology referral; clearance rate 94%.
- Insurance: $5M per-seat accident policy and a $25M operator liability tower.
- Seat classes: Orbital (from $145,000), Cislunar (from $620,000), Research seat (grant-funded).

If the visitor asks about applying, explain the 10-working-day medical review, the 72-hour seat hold, and that no deposit is taken before clearance.`;

let client;
let transport;

function getClient() {
  if (!client) {
    client = createCloudAgentsClient({
      origin: ORIGIN,
      getToken: () => Deno.env.get('QODER_PAT'),
    });
  }
  return client;
}

function getTransport() {
  if (!transport) {
    transport = createManagedTransport({ origin: ORIGIN, getToken: () => Deno.env.get('QODER_PAT') });
  }
  return transport;
}

/** In-memory application state. One Function instance, no durable coordinator. */
const conversations = new Map();
const owned = new Map();
let resources = { agent: null, environment: null, model: null };
let resourcePromise = null;

const randomId = (prefix) =>
  `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function ensureModel() {
  if (resources.model) return resources.model;
  const result = await getClient().request('/api/v1/cloud/models');
  const list = Array.isArray(result?.data) ? result.data : [];
  const usable = list.find((m) => m && typeof m.id === 'string' && m.enabled !== false) ?? list.find((m) => m && typeof m.id === 'string');
  if (!usable) throw new Error('ai_configuration_invalid');
  resources.model = usable.id;
  return resources.model;
}

async function ensureEnvironment() {
  if (resources.environment) return resources.environment;
  const found = await getClient().findResources('environments', ENV_META, 3);
  if (found.length > 1) throw new Error('ai_initialization_conflict');
  if (found.length === 1) {
    resources.environment = found[0].id;
    return resources.environment;
  }
  const created = await getClient().request('/api/v1/cloud/environments', {
    method: 'POST',
    body: { name: 'Beyond Earth ORION runtime', config: { type: 'cloud' }, metadata: ENV_META },
  });
  if (!created || typeof created.id !== 'string') throw new Error('ai_response_invalid');
  resources.environment = created.id;
  return resources.environment;
}

async function ensureAgent() {
  if (resources.agent) return resources.agent;
  const model = await ensureModel();
  const found = await getClient().findResources('agents', AGENT_META, 3);
  if (found.length > 1) throw new Error('ai_initialization_conflict');
  if (found.length === 1) {
    resources.agent = { type: 'agent', id: found[0].id, version: found[0].version };
    return resources.agent;
  }
  const created = await getClient().request('/api/v1/cloud/agents', {
    method: 'POST',
    idempotencyKey: `be-orion-agent-${SCOPE}-r2`,
    body: {
      name: 'ORION · Enderman · Beyond Earth mission intelligence',
      model,
      system: SYSTEM_PROMPT,
      metadata: AGENT_META,
    },
  });
  if (!created || typeof created.id !== 'string') throw new Error('ai_response_invalid');
  resources.agent = { type: 'agent', id: created.id, version: created.version };
  return resources.agent;
}

async function ensureResources() {
  if (!resourcePromise) {
    resourcePromise = (async () => {
      const agent = await ensureAgent();
      const environment = await ensureEnvironment();
      return { agent, environment };
    })().catch((error) => {
      resourcePromise = null;
      throw error;
    });
  }
  return resourcePromise;
}

async function ensureSession(conversation) {
  if (conversation.sessionId) return conversation.sessionId;
  const { agent, environment } = await ensureResources();
  const session = await getClient().request('/api/v1/cloud/sessions', {
    method: 'POST',
    body: { agent, environment_id: environment },
  });
  if (!session || typeof session.id !== 'string' || !session.id.startsWith('sess_')) {
    throw new Error('ai_response_invalid');
  }
  conversation.sessionId = session.id;
  return session.id;
}

function snapshot(conversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    revision: conversation.revision,
    state: conversation.state,
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      state: m.state,
    })),
    ...(conversation.runId ? { runId: conversation.runId } : {}),
    ...(conversation.requestId ? { requestId: conversation.requestId } : {}),
  };
}

function publish(conversation) {
  conversation.revision += 1;
  const value = snapshot(conversation);
  for (const subscriber of conversation.subscribers) {
    subscriber.queue.push(value);
    subscriber.wake?.();
  }
}

function messageText(source) {
  if (!source) return '';
  if (typeof source === 'string') return source;
  const content = source.content ?? source.blocks;
  if (Array.isArray(content)) {
    return content
      .map((block) => (typeof block?.text === 'string' ? block.text : ''))
      .join('')
      .trim();
  }
  if (typeof source.text === 'string') return source.text.trim();
  return '';
}

function frameType(frame) {
  return frame?.type ?? frame?.event_type ?? frame?.event?.type ?? frame?.kind ?? '';
}

// Upstream lifecycle frames are typed, not field-based.
const SESSION_STATUS = {
  'session.status_idle': 'idle',
  'session.idle': 'idle',
  'session.status_running': 'running',
  'session.running': 'running',
  'session.status_terminated': 'terminated',
  'session.terminated': 'terminated',
  'session.status_error': 'error',
  'session.error': 'error',
};

function applyFrame(conversation, frame) {
  const type = frameType(frame);

  if (type === 'event_start') {
    conversation.streamEventId = frame?.event?.id ?? frame?.event_id ?? frame?.id ?? null;
    return;
  }

  if (type === 'event_delta' || frame?.delta?.content?.text !== undefined) {
    const text = frame?.delta?.content?.text ?? frame?.delta?.text ?? frame?.content?.text;
    if (typeof text === 'string' && text) {
      conversation.draft = (conversation.draft + text).slice(0, MAX_DRAFT);
      conversation.draftEventId = frame?.event_id ?? frame?.event?.id ?? conversation.streamEventId ?? null;
      const assistant = conversation.messages[conversation.messages.length - 1];
      if (assistant && assistant.role === 'assistant') {
        assistant.text = conversation.draft;
        assistant.state = 'running';
      }
    }
    return;
  }

  // The buffered message is the authoritative final event of one generation.
  if (type === 'agent.message' || frame?.message?.role === 'assistant' || frame?.agent_message) {
    const complete = messageText(frame?.message ?? frame?.agent_message ?? frame);
    if (complete) {
      conversation.draft = complete;
      conversation.streamEventId = frame?.id ?? conversation.streamEventId;
      const assistant = conversation.messages[conversation.messages.length - 1];
      if (assistant && assistant.role === 'assistant') {
        assistant.text = complete;
        assistant.state = 'completed';
      }
      conversation.state = 'completed';
    }
    return;
  }

  const status = SESSION_STATUS[type] ?? frame?.status ?? frame?.state ?? frame?.session?.status;
  if (typeof status === 'string') {
    if (status === 'idle' || status === 'completed' || status === 'finished' || status === 'terminated') {
      conversation.state = 'completed';
      const assistant = conversation.messages[conversation.messages.length - 1];
      if (assistant && assistant.role === 'assistant' && assistant.state !== 'completed') {
        assistant.state = 'completed';
      }
    }
    if (status === 'error' || status === 'failed' || status === 'interrupted') {
      conversation.state = status === 'interrupted' ? 'interrupted' : 'failed';
      const assistant = conversation.messages[conversation.messages.length - 1];
      if (assistant && assistant.role === 'assistant') assistant.state = conversation.state;
    }
  }
}

async function reconcile(conversation) {
  try {
    const history = await transport.history(conversation.sessionId);
    const events = Array.isArray(history?.data) ? history.data : [];
    for (const event of events) {
      const id = event?.id;
      if (typeof id === 'string' && id.startsWith('evt_')) conversation.lastEventId = id;
      const text = messageText(event?.message ?? event?.agent_message ?? (event?.role === 'assistant' ? event : null));
      if (text) {
        conversation.draft = text;
        const assistant = conversation.messages[conversation.messages.length - 1];
        if (assistant && assistant.role === 'assistant') {
          assistant.text = text;
          assistant.state = 'completed';
        }
      }
    }
  } catch {
    // History reconciliation is best-effort; a stream delta already filled the draft.
  }
}

async function runTurn(conversation) {
  const controller = new AbortController();
  conversation.controller = controller;
  const timer = setTimeout(() => controller.abort(), TURN_TIMEOUT_MS);
  const iterator = getTransport()
    .events(conversation.sessionId, {
      lastEventId: conversation.lastEventId || undefined,
      signal: controller.signal,
    })
    [Symbol.asyncIterator]();
  try {
    while (true) {
      const next = await iterator.next();
      if (next.done) break;
      applyFrame(conversation, next.value);
      publish(conversation);
      // The upstream session stream stays open for the life of the session, so the
      // turn ends on the completed message or the idle status, never on EOF.
      if (conversation.state === 'completed' || conversation.state === 'failed'
        || conversation.state === 'interrupted') break;
    }
    await reconcile(conversation);
    if (conversation.state === 'running') conversation.state = 'completed';
    const assistant = conversation.messages[conversation.messages.length - 1];
    if (assistant && assistant.role === 'assistant' && assistant.state === 'running') {
      assistant.state = conversation.state === 'failed' ? 'failed' : 'completed';
    }
  } catch (error) {
    if (conversation.state === 'running') {
      conversation.state = controller.signal.aborted ? 'interrupted' : 'failed';
      const assistant = conversation.messages[conversation.messages.length - 1];
      if (assistant && assistant.role === 'assistant') assistant.state = conversation.state;
    }
  } finally {
    clearTimeout(timer);
    conversation.controller = null;
    try { await iterator.return?.(); } catch { /* upstream already closed */ }
    publish(conversation);
  }
}

function requireConversation(principal, id) {
  const conversation = conversations.get(id);
  if (!conversation) throw new ChatError('not_found');
  const list = owned.get(principal.id);
  if (!list || !list.has(id)) throw new ChatError('forbidden');
  return conversation;
}

export function createLiveService() {
  return {
    async authorize(request) {
      const header = request.headers.get('x-orion-principal');
      if (!isUuid(header)) throw new ChatError('login_required');
      return { id: header.toLowerCase() };
    },

    /** @returns {{ mode: 'live' | 'local-demo', persistence: string }} */
    info() {
      return { mode: 'live', persistence: 'function-instance' };
    },

    async list(principal) {
      const ids = owned.get(principal.id) ?? new Set();
      return [...ids].map((id) => conversations.get(id)).filter(Boolean).map(snapshot);
    },

    async create(principal, { requestId }) {
      const list = owned.get(principal.id) ?? new Set();
      for (const id of list) {
        const existing = conversations.get(id);
        if (existing && existing.createRequestId === requestId) return snapshot(existing);
      }
      const conversation = {
        id: randomId('conv'),
        title: 'New transmission',
        revision: 0,
        state: 'idle',
        messages: [],
        createRequestId: requestId,
        requestId: undefined,
        runId: undefined,
        sessionId: null,
        lastEventId: null,
        streamEventId: null,
        draft: '',
        draftEventId: null,
        controller: null,
        subscribers: new Set(),
        pendingRequestId: null,
        pendingText: null,
      };
      conversations.set(conversation.id, conversation);
      list.add(conversation.id);
      owned.set(principal.id, list);
      return snapshot(conversation);
    },

    async get(principal, id) {
      return snapshot(requireConversation(principal, id));
    },

    async send(principal, id, { requestId, text }) {
      const conversation = requireConversation(principal, id);
      const prompt = String(text ?? '').trim();
      if (!prompt || prompt.length > MAX_MESSAGE) throw new ChatError('invalid_request');

      if (conversation.pendingRequestId === requestId) {
        if (conversation.pendingText !== prompt) throw new ChatError('request_conflict');
        return snapshot(conversation);
      }
      if (conversation.state === 'running' || conversation.state === 'pending') {
        throw new ChatError('conversation_busy');
      }

      conversation.pendingRequestId = requestId;
      conversation.pendingText = prompt;
      conversation.requestId = requestId;
      conversation.runId = randomId('run');
      conversation.draft = '';

      try {
        await ensureSession(conversation);
      } catch (error) {
        conversation.pendingRequestId = null;
        conversation.pendingText = null;
        conversation.state = 'failed';
        publish(conversation);
        throw new ChatError('service_unavailable');
      }

      conversation.messages.push({
        id: randomId('msg'),
        role: 'user',
        text: prompt,
        state: 'completed',
      });
      conversation.messages.push({
        id: randomId('msg'),
        role: 'assistant',
        text: '',
        state: 'running',
      });
      conversation.state = 'running';
      if (!conversation.title || conversation.title === 'New transmission') {
        conversation.title = prompt.slice(0, 60);
      }
      publish(conversation);

      try {
        await getTransport().send(conversation.sessionId, prompt);
      } catch (error) {
        conversation.pendingRequestId = null;
        conversation.pendingText = null;
        const unknown = /unknown/i.test(String(error?.message ?? ''));
        conversation.state = unknown ? 'pending' : 'failed';
        const assistant = conversation.messages[conversation.messages.length - 1];
        if (assistant) assistant.state = conversation.state;
        publish(conversation);
        throw new ChatError(unknown ? 'dispatch_unknown' : 'service_unavailable');
      }

      void runTurn(conversation);
      return snapshot(conversation);
    },

    async interrupt(principal, id, { requestId, runId }) {
      const conversation = requireConversation(principal, id);
      if (conversation.runId !== runId) throw new ChatError('not_found');
      conversation.controller?.abort();
      conversation.state = 'interrupted';
      const assistant = conversation.messages[conversation.messages.length - 1];
      if (assistant && assistant.role === 'assistant') assistant.state = 'interrupted';
      conversation.pendingRequestId = null;
      conversation.pendingText = null;
      publish(conversation);
      return snapshot(conversation);
    },

    async *watch(principal, id, { signal }) {
      const conversation = requireConversation(principal, id);
      const subscriber = { queue: [], wake: null };
      conversation.subscribers.add(subscriber);
      try {
        yield snapshot(conversation);
        while (!signal.aborted) {
          if (subscriber.queue.length === 0) {
            await new Promise((resolve) => {
              subscriber.wake = resolve;
              // A publish that landed before the wake was installed must not be missed.
              if (subscriber.queue.length > 0 || signal.aborted) resolve();
            });
          }
          subscriber.wake = null;
          while (subscriber.queue.length > 0 && !signal.aborted) {
            yield subscriber.queue.shift();
          }
        }
      } finally {
        subscriber.wake = null;
        conversation.subscribers.delete(subscriber);
      }
    },
  };
}
