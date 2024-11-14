import { AutoTokenizer, AutoModelForCausalLM, TextStreamer } from "@huggingface/transformers";
import { addContext, removeContext, clearContexts, listContexts } from './services/contextHandler';
import type { WorkerMessage, WorkerResponse, Message } from './types';

// Configuration
const MODEL_ID = "onnx-community/Llama-3.2-1B-Instruct-q4f16";

// Token limits (reduced to avoid memory issues)
const MAX_CONTEXT_LENGTH = 256; // Maximum tokens per context
const MAX_TOTAL_LENGTH = 512;   // Maximum total sequence length
const MAX_MESSAGE_LENGTH = 128; // Maximum length for message history
const MAX_GENERATION_LENGTH = 128; // Maximum length for generated response

// Generation configuration
const GENERATION_CONFIG = {
  max_new_tokens: MAX_GENERATION_LENGTH,
  do_sample: true,
  temperature: 0.7,
  top_p: 0.9,
  stop_sequences: ["Human:", "Assistant:", "\n\n"]
} as const;

// Global state
interface WorkerState {
  tokenizer: any | null;
  model: any | null;
}

const state: WorkerState = {
  tokenizer: null,
  model: null
};

function sendDebugInfo(level: string, message: string, details: unknown = null): void {
  self.postMessage({
    status: 'debug',
    data: {
      level,
      message,
      details,
      timestamp: new Date().toISOString()
    }
  } as WorkerResponse);
}

async function getTokenCount(text: string): Promise<number> {
  if (!state.tokenizer) {
    throw new Error("Tokenizer not initialized");
  }
  const tokens = await state.tokenizer.tokenize(text);
  return tokens.length;
}

async function selectRelevantContexts(query: string): Promise<string> {
  const contexts = listContexts();
  if (contexts.length === 0) return "";

  const queryTokens = await getTokenCount(query);
  const availableTokens = MAX_CONTEXT_LENGTH;

  // Sort contexts by creation date (most recent first)
  const sortedContexts = [...contexts].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  let selectedContexts = [];
  let totalTokens = 0;

  for (const context of sortedContexts) {
    if (totalTokens + (context.tokens || 0) <= availableTokens) {
      selectedContexts.push(context);
      totalTokens += context.tokens || 0;
    } else {
      break;
    }
  }

  return selectedContexts
      .map(ctx => ctx.text)
      .join('\n\n');
}

async function truncateMessages(messages: Message[], maxTokens: number): Promise<Message[]> {
  const reversedMessages = [...messages].reverse();
  let totalTokens = 0;
  const truncatedMessages: Message[] = [];

  for (const message of reversedMessages) {
    const tokens = await getTokenCount(message.content);
    if (totalTokens + tokens <= maxTokens) {
      truncatedMessages.unshift(message);
      totalTokens += tokens;
    } else {
      break;
    }
  }

  return truncatedMessages;
}

async function generate(messages: Message[]): Promise<void> {
  if (!state.tokenizer || !state.model) {
    throw new Error("Model not initialized");
  }

  try {
    const lastMessage = messages[messages.length - 1];
    const relevantContexts = await selectRelevantContexts(lastMessage.content);

    // Calculate available tokens
    const contextTokenCount = await getTokenCount(relevantContexts);
    const availableTokens = MAX_MESSAGE_LENGTH;

    // Truncate messages to fit
    const truncatedMessages = await truncateMessages(messages, availableTokens);

    // Prepare messages with context
    let contextualizedMessages = truncatedMessages;
    if (relevantContexts) {
      contextualizedMessages = [
        {
          role: 'system',
          content: `Consider this context:\n\n${relevantContexts}\n\nRespond based on this context when relevant.`
        },
        ...truncatedMessages
      ];
    }

    sendDebugInfo('debug', 'Starting generation', {
      messageCount: messages.length,
      truncatedCount: truncatedMessages.length,
      contextTokens: contextTokenCount,
      totalMessages: contextualizedMessages.length
    });

    // Prepare input tokens
    const inputs = state.tokenizer.apply_chat_template(contextualizedMessages, {
      add_generation_prompt: true,
      return_dict: true
    });

    // Set up streaming
    const streamer = new TextStreamer(state.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (output: string) => {
        self.postMessage({ status: 'update', output } as WorkerResponse);
      }
    });

    // Generate response
    const startTime = performance.now();
    await state.model.generate({
      ...inputs,
      ...GENERATION_CONFIG,
      streamer
    });

    const generateTime = performance.now() - startTime;
    sendDebugInfo('info', 'Generation completed', {
      generateTimeMs: Math.round(generateTime)
    });

    self.postMessage({ status: 'success' } as WorkerResponse);

  } catch (error) {
    sendDebugInfo('error', 'Generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

async function handleContextCommand(command: string, data: unknown, messageId: number): Promise<void> {
  try {
    let result;
    switch (command) {
      case 'add':
        result = addContext(data, state.tokenizer, MAX_CONTEXT_LENGTH, MAX_TOTAL_LENGTH);
        break;

      case 'remove':
        result = removeContext(data as { id: string });
        break;

      case 'clear':
        result = clearContexts();
        break;

      case 'list':
        result = listContexts();
        break;

      default:
        throw new Error(`Unknown context command: ${command}`);
    }

    self.postMessage({
      status: 'success',
      messageId,
      data: result
    } as WorkerResponse);
  } catch (error) {
    sendDebugInfo('error', `Context command failed: ${command}`, { error });
    self.postMessage({
      status: 'error',
      messageId,
      data: error instanceof Error ? error.message : 'Unknown error'
    } as WorkerResponse);
  }
}

// Initialize section
async function checkWebGPU(): Promise<void> {
  sendDebugInfo('debug', 'Checking WebGPU support');

  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) {
    throw new Error("WebGPU not supported");
  }

  const device = await adapter.requestDevice();
  if (!device) {
    throw new Error("Failed to get WebGPU device");
  }

  sendDebugInfo('info', 'WebGPU device initialized', {
    adapter: adapter.name,
    features: Array.from(device.features).map(f => f.toString())
  });
}

async function initialize(): Promise<boolean> {
  try {
    await checkWebGPU();
    sendDebugInfo('info', 'WebGPU initialized successfully');

    // Load tokenizer
    const tokenizerStartTime = performance.now();
    state.tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    sendDebugInfo('info', 'Tokenizer loaded successfully', {
      loadTimeMs: Math.round(performance.now() - tokenizerStartTime)
    });

    // Load model
    const modelStartTime = performance.now();
    state.model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
      dtype: "q4f16",
      device: "webgpu",
      revision: "main",
      quantized: true,
      cache: true
    });

    sendDebugInfo('info', 'Model loaded successfully', {
      loadTimeMs: Math.round(performance.now() - modelStartTime)
    });

    return true;
  } catch (error) {
    sendDebugInfo('error', 'Initialization failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Message handler
self.addEventListener("message", async ({ data: { type, command, data, messageId } }: MessageEvent<WorkerMessage>) => {
  try {
    sendDebugInfo('debug', `Received message: ${type}`);

    switch (type) {
      case "check":
        await checkWebGPU();
        break;

      case "load":
        await initialize();
        self.postMessage({ status: 'ready' } as WorkerResponse);
        break;

      case "generate":
        await generate(data as Message[]);
        break;

      case "context":
        if (command) {
          await handleContextCommand(command, data, messageId || Date.now());
        }
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    sendDebugInfo('error', 'Worker error handler', {
      type,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    self.postMessage({
      status: 'error',
      messageId,
      data: error instanceof Error ? error.message : 'Unknown error'
    } as WorkerResponse);
  }
});
