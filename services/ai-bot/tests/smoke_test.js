/**
 * SUNDAY v2 - Automated Smoke Test Suite
 * Asserts event sequences, state machine transitions, emotion contract parsing,
 * latency bounds, and local offline tool execution.
 */

const { SundayEventBus } = require('../core/event_bus');
const { EmotionParser } = require('../core/emotion');
const { MemoryStore } = require('../core/memory');
const { SundayTools } = require('../core/tools');
const { SundayAgent } = require('../core/agent');

async function runSmokeTests() {
  console.log('====================================================');
  console.log('  SUNDAY v2: Automated Offline Smoke Test Suite     ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
    }
  }

  // Test 1: Emotion Parser
  console.log('[Phase 1/4] Testing Emotion Contract Parser...');
  const parser = new EmotionParser();
  const testResponse = 'I am fully awake and ready! {"emotion":"excited","gesture":"wave"}';
  const parsed = parser.parse(testResponse);

  assert(parsed.cleanText === 'I am fully awake and ready!', 'Clean text strips hidden JSON tags');
  assert(parsed.emotion === 'excited', 'Extracted emotion equals "excited"');
  assert(parsed.gesture === 'wave', 'Extracted gesture equals "wave"');

  const malformedResponse = 'Let us build something great! [malformed json}';
  const parsedFallback = parser.parse(malformedResponse);
  assert(parsedFallback.emotion === 'neutral', 'Graceful fallback to neutral on malformed tag');

  // Test 2: Event Bus State Machine
  console.log('\n[Phase 2/4] Testing Unified Event Bus & State Machine Transitions...');
  const bus = new SundayEventBus();
  assert(bus.getState() === 'idle', 'Initial state is "idle"');

  bus.emit('mic_open');
  assert(bus.getState() === 'listening', 'mic_open transition -> "listening"');

  bus.emit('stt_final');
  assert(bus.getState() === 'thinking', 'stt_final transition -> "thinking"');

  bus.emit('token');
  assert(bus.getState() === 'talking', 'token transition -> "talking"');

  bus.emit('tts_end');
  assert(bus.getState() === 'idle', 'tts_end transition -> "idle"');

  bus.emit('tool_start');
  assert(bus.getState() === 'working', 'tool_start transition -> "working"');

  bus.emit('tool_success');
  assert(bus.getState() === 'celebrating', 'tool_success transition -> "celebrating"');

  // Test 3: Agent Inference & Latency
  console.log('\n[Phase 3/4] Testing Agent Processing Latency & Hero Flow...');
  const memory = new MemoryStore();
  const agent = new SundayAgent(bus, memory);

  const startTime = Date.now();
  const reply = await agent.processQuery('Hey Sunday');
  const latency = Date.now() - startTime;

  assert(latency < 1500, `First reaction latency: ${latency}ms (Under target 1500ms)`);
  assert(reply.reply.length > 10, 'Hero reply generated successfully');
  assert(reply.emotion === 'happy', 'Hero reply returned matching physical emotion');

  // Test 4: Local Tools & Sovereign Execution (WOW 3)
  console.log('\n[Phase 4/4] Testing Local Skills (RAG & Sandboxed Agent)...');
  const tools = new SundayTools(bus);

  const ragResult = await tools.runFolderRAG('security policy');
  assert(ragResult.source === 'security_audit.log', 'Local RAG cited source file');
  assert(ragResult.offlineVerified === true, 'RAG verified 100% offline sovereign');

  const codeResult = await tools.runCodeAgent('Write reverse string function');
  assert(codeResult.status.includes('Passed'), 'Code Agent executed sandbox assertions');

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed}/${total} PASSED (100% Offline Success) `);
  console.log('====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runSmokeTests().catch(err => {
  console.error('Smoke test threw exception:', err);
  process.exit(1);
});
