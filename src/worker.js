import { AutoTokenizer, AutoModelForCausalLM, TextStreamer } from "@huggingface/transformers";

// Configuration
const MODEL_ID = "onnx-community/Llama-3.2-1B-Instruct-q4f16";
const MAX_TOTAL_TOKENS = 2048; // Maximum total tokens to prevent memory issues
const MAX_CONTEXT_TOKENS = 512; // Maximum tokens for context
const GENERATION_CONFIG = {
  max_new_tokens: 512,
  do_sample: true,
  temperature: 0.7,
  top_p: 0.9,
  stop_sequences: ["Human:", "Assistant:", "\n\n"]
};

// Global state
let tokenizer = null;
let model = null;
let contexts = [];

/**
 * Sends debug information back to the main thread
 */
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

/**
 * Checks WebGPU availability and initializes the device
 */
async function checkWebGPU() {
  sendDebugInfo('debug', 'Checking WebGPU support');

  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) {
    sendDebugInfo('error', 'WebGPU adapter not found');
    throw new Error("WebGPU not supported");
  }

  const device = await adapter.requestDevice();
  if (!device) {
    sendDebugInfo('error', 'Failed to get WebGPU device');
    throw new Error("Failed to get WebGPU device");
  }

  const info = {
    adapter: adapter.name,
    features: [...device.features].map(f => f.toString()),
    limits: Object.fromEntries(
        Object.entries(device.limits)
            .filter(([, value]) => typeof value !== 'function')
    )
  };

  sendDebugInfo('info', 'WebGPU device initialized', info);
  return device;
}

/**
 * Initializes the model and tokenizer
 */
async function initialize() {
  try {
    sendDebugInfo('info', 'Starting initialization');

    // Initialize WebGPU
    sendDebugInfo('info', 'Loading WebGPU');
    await checkWebGPU();
    sendDebugInfo('info', 'WebGPU initialized successfully');

    // Load tokenizer
    sendDebugInfo('info', 'Loading tokenizer');
    const tokenizerStartTime = performance.now();
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    const tokenizerTime = performance.now() - tokenizerStartTime;
    sendDebugInfo('info', 'Tokenizer loaded successfully', {
      loadTimeMs: Math.round(tokenizerTime),
      vocab_size: tokenizer.vocab_size,
      model_max_length: tokenizer.model_max_length
    });

    // Load model
    sendDebugInfo('info', 'Loading model');
    const modelStartTime = performance.now();

    // Progress tracking
    let lastProgress = 0;
    const progressInterval = setInterval(() => {
      lastProgress = Math.min(lastProgress + 2, 99);
      sendDebugInfo('info', 'Loading model progress', {
        loadTimeMs: performance.now() - modelStartTime,
        estimatedProgress: lastProgress
      });
    }, 1000);

    model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
      dtype: "q4f16",
      device: "webgpu",
      revision: "main",
      quantized: true,
      cache: true,
      progress_callback: (progress) => {
        sendDebugInfo('info', 'Model loading progress', {
          loadTimeMs: performance.now() - modelStartTime,
          progress: progress * 100
        });
      }
    });

    clearInterval(progressInterval);
    const modelLoadTime = performance.now() - modelStartTime;

    sendDebugInfo('info', 'Model loaded successfully', {
      loadTimeMs: Math.round(modelLoadTime),
      config: model.config
    });

    return true;
  } catch (error) {
    sendDebugInfo('error', 'Initialization failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Handles context-related commands
 */
async function handleContextCommand(command, data, messageId) {
  try {
    let result;
    switch (command) {
      case 'add': {
        const tokens = await tokenizer.tokenize(data.text);
        if (tokens.length > MAX_CONTEXT_TOKENS) {
          throw new Error(`Context too long: ${tokens.length} tokens exceeds limit of ${MAX_CONTEXT_TOKENS}`);
        }

        contexts.push({
          id: data.id,
          text: data.text,
          tokens: tokens.length,
          metadata: data.metadata,
          createdAt: data.createdAt || new Date().toISOString()
        });
        result = { success: true, id: data.id };
        break;
      }

      case 'remove':
        contexts = contexts.filter(ctx => ctx.id !== data.id);
        result = { success: true };
        break;

      case 'clear':
        contexts = [];
        result = { success: true };
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

/**
 * Selects relevant contexts while staying within token limits
 */
async function selectRelevantContexts(query) {
  if (contexts.length === 0) return "";

  const queryTokens = (await tokenizer.tokenize(query)).length;
  let availableTokens = MAX_CONTEXT_TOKENS;

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

  sendDebugInfo('debug', 'Selected contexts', {
    contextCount: selectedContexts.length,
    totalTokens,
    queryTokens
  });

  return selectedContexts
      .map(ctx => ctx.text)
      .join('\n\n');
}

/**
 * Truncates messages to fit within token limits
 */
async function truncateMessages(messages, maxTokens) {
  const reversedMessages = [...messages].reverse();
  let totalTokens = 0;
  let truncatedMessages = [];

  for (const message of reversedMessages) {
    const tokens = await tokenizer.tokenize(message.content);
    if (totalTokens + tokens.length <= maxTokens) {
      truncatedMessages.unshift(message);
      totalTokens += tokens.length;
    } else {
      break;
    }
  }

  return truncatedMessages;
}

/**
 * Generates a response based on the input messages and available context
 */
async function generate(messages) {
  if (!tokenizer || !model) {
    sendDebugInfo('error', 'Model not initialized');
    throw new Error("Model not initialized");
  }

  try {
    const lastMessage = messages[messages.length - 1];

    // Get relevant contexts
    const relevantContexts = await selectRelevantContexts(lastMessage.content);

    // Calculate available tokens for messages
    const contextTokens = await tokenizer.tokenize(relevantContexts);
    const availableTokens = MAX_TOTAL_TOKENS - contextTokens.length - GENERATION_CONFIG.max_new_tokens;

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
      contextLength: contextTokens.length,
      totalInputLength: contextualizedMessages.reduce((acc, msg) => acc + msg.content.length, 0)
    });

    // Prepare input tokens
    const inputs = tokenizer.apply_chat_template(contextualizedMessages, {
      add_generation_prompt: true,
      return_dict: true
    });

    sendDebugInfo('debug', 'Input tokens prepared', {
      inputLength: inputs.input_ids.length,
      truncated: inputs.input_ids.length >= tokenizer.model_max_length
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

/**
 * Main message handler
 */
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
      data: error.message || 'An unknown error occurred'
    });
  }
});
