import { AutoTokenizer, AutoModelForCausalLM, TextStreamer } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/Llama-3.2-1B-Instruct-q4f16";
let tokenizer, model;

// Add debugging helper
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

  // Log device info
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

async function initialize() {
  try {
    sendDebugInfo('debug', 'Starting initialization');
    await checkWebGPU();

    sendDebugInfo('info', 'Loading tokenizer');
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    sendDebugInfo('debug', 'Tokenizer loaded', {
      vocab_size: tokenizer.vocab_size,
      model_max_length: tokenizer.model_max_length
    });

    sendDebugInfo('info', 'Loading model');
    const startTime = performance.now();
    model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
      dtype: "q4f16",
      device: "webgpu",
      revision: "main",
      cache: true
    });
    const loadTime = performance.now() - startTime;

    sendDebugInfo('info', 'Model loaded successfully', {
      loadTimeMs: Math.round(loadTime),
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

async function generate(messages) {
  if (!tokenizer || !model) {
    sendDebugInfo('error', 'Model not initialized');
    throw new Error("Model not initialized");
  }

  try {
    sendDebugInfo('debug', 'Starting generation', { messages });

    const inputs = tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      return_dict: true
    });

    sendDebugInfo('debug', 'Input tokens prepared', {
      inputLength: inputs.input_ids.length,
      truncated: inputs.input_ids.length >= tokenizer.model_max_length
    });

    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: output => {
        self.postMessage({ status: 'update', output });
      }
    });

    const startTime = performance.now();
    await model.generate({
      ...inputs,
      max_new_tokens: 1024,
      do_sample: true,
      temperature: 0.7,
      top_p: 0.9,
      streamer,
      stop_sequences: ["Human:", "Assistant:", "\n\n"]
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

self.addEventListener("message", async ({ data: { type, data } }) => {
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
      data: error.message || 'An unknown error occurred'
    });
  }
});
