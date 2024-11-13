import { AutoTokenizer, AutoModelForCausalLM, TextStreamer } from "@huggingface/transformers";

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
};

// Global state
let tokenizer = null;
let model = null;
let contexts = [];

function sendDebugInfo(level, message, details = null) {
  self.postMessage({
    status: 'debug',
    data: {
      level,
      message,
      details,
      timestamp: new Date().toISOString()
    }
  });
}

async function getTokenCount(text) {
  if (!tokenizer) {
    throw new Error("Tokenizer not initialized");
  }
  const tokens = await tokenizer.tokenize(text);
  return tokens.length;
}

async function selectRelevantContexts(query) {
  if (contexts.length === 0) return "";

  const queryTokens = await getTokenCount(query);
  let availableTokens = MAX_CONTEXT_LENGTH;

  // Sort contexts by creation date (most recent first)
  const sortedContexts = [...contexts].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
  );

  let selectedContexts = [];
  let totalTokens = 0;

  for (const context of sortedContexts) {
    if (totalTokens + context.tokens <= availableTokens) {
      selectedContexts.push(context);
      totalTokens += context.tokens;
    } else {
      break;
    }
  }

  return selectedContexts
      .map(ctx => ctx.text)
      .join('\n\n');
}

async function truncateMessages(messages, maxTokens) {
  const reversedMessages = [...messages].reverse();
  let totalTokens = 0;
  let truncatedMessages = [];

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

async function generate(messages) {
  if (!tokenizer || !model) {
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
    const inputs = tokenizer.apply_chat_template(contextualizedMessages, {
      add_generation_prompt: true,
      return_dict: true
    });

    // Set up streaming
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: output => {
        self.postMessage({ status: 'update', output });
      }
    });

    // Generate response
    const startTime = performance.now();
    await model.generate({
      ...inputs,
      ...GENERATION_CONFIG,
      streamer
    });

    const generateTime = performance.now() - startTime;
    sendDebugInfo('info', 'Generation completed', {
      generateTimeMs: Math.round(generateTime)
    });

  } catch (error) {
    sendDebugInfo('error', 'Generation failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

async function handleContextCommand(command, data, messageId) {
  try {
    let result;
    switch (command) {
      case 'add': {
        if (!tokenizer) {
          throw new Error("Tokenizer not initialized");
        }

        const tokenCount = await getTokenCount(data.text);
        if (tokenCount > MAX_CONTEXT_LENGTH) {
          throw new Error(`Context too long: ${tokenCount} tokens exceeds limit of ${MAX_CONTEXT_LENGTH}. Please use shorter text.`);
        }

        const existingTokens = contexts.reduce((sum, ctx) => sum + ctx.tokens, 0);
        if (existingTokens + tokenCount > MAX_TOTAL_LENGTH) {
          throw new Error(`Adding this context would exceed total token limit of ${MAX_TOTAL_LENGTH}. Please remove some existing contexts first.`);
        }

        contexts.push({
          id: data.id,
          text: data.text,
          tokens: tokenCount,
          metadata: data.metadata,
          createdAt: data.createdAt || new Date().toISOString()
        });

        result = {
          success: true,
          id: data.id,
          tokenCount,
          totalTokens: existingTokens + tokenCount
        };
        break;
      }

      case 'remove':
        contexts = contexts.filter(ctx => ctx.id !== data.id);
        result = {
          success: true,
          totalTokens: contexts.reduce((sum, ctx) => sum + ctx.tokens, 0)
        };
        break;

      case 'clear':
        contexts = [];
        result = { success: true, totalTokens: 0 };
        break;

      case 'list':
        result = contexts;
        break;

      default:
        throw new Error(`Unknown context command: ${command}`);
    }

    self.postMessage({
      status: 'success',
      messageId,
      data: result
    });
  } catch (error) {
    sendDebugInfo('error', `Context command failed: ${command}`, { error });
    self.postMessage({
      status: 'error',
      messageId,
      data: error.message
    });
  }
}

// Initialize section
async function checkWebGPU() {
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
    features: [...device.features].map(f => f.toString())
  });
}

async function initialize() {
  try {
    await checkWebGPU();
    sendDebugInfo('info', 'WebGPU initialized successfully');

    // Load tokenizer
    const tokenizerStartTime = performance.now();
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    sendDebugInfo('info', 'Tokenizer loaded successfully', {
      loadTimeMs: Math.round(performance.now() - tokenizerStartTime)
    });

    // Load model
    const modelStartTime = performance.now();
    model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
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
    sendDebugInfo('error', 'Initialization failed', { error });
    throw error;
  }
}

// Message handler
self.addEventListener("message", async ({ data: { type, command, data, messageId } }) => {
  try {
    sendDebugInfo('debug', `Received message: ${type}`);

    switch (type) {
      case "check":
        await checkWebGPU();
        break;

      case "load":
        await initialize();
        self.postMessage({ status: 'ready' });
        break;

      case "generate":
        await generate(data);
        break;

      case "context":
        await handleContextCommand(command, data, messageId);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    sendDebugInfo('error', 'Worker error handler', {
      type,
      error: error.message,
      stack: error.stack
    });

    self.postMessage({
      status: 'error',
      messageId,
      data: error.message
    });
  }
});
