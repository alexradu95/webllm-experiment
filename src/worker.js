import { AutoTokenizer, AutoModelForCausalLM, TextStreamer } from "@huggingface/transformers";
import { ContextService } from "./services/contextService";

const MODEL_ID = "onnx-community/Llama-3.2-1B-Instruct-q4f16";
let tokenizer, model, contextService;

// ... (previous debug helper code) ...

async function initialize() {
  try {
    sendDebugInfo('debug', 'Starting initialization');
    await checkWebGPU();

    // Initialize context service
    sendDebugInfo('info', 'Initializing context service');
    contextService = new ContextService();
    await contextService.initialize();
    sendDebugInfo('debug', 'Context service initialized');

    // Initialize model and tokenizer
    sendDebugInfo('info', 'Loading tokenizer');
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);

    sendDebugInfo('info', 'Loading model');
    model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
      dtype: "q4f16",
      device: "webgpu",
      revision: "main",
      cache: true
    });

    return true;
  } catch (error) {
    sendDebugInfo('error', 'Initialization failed', { error });
    throw error;
  }
}

async function generate(messages, query) {
  if (!tokenizer || !model || !contextService) {
    throw new Error("Services not initialized");
  }

  try {
    sendDebugInfo('debug', 'Starting generation', { messages, query });

    // Find relevant contexts
    const relevantContexts = await contextService.findRelevantContexts(query);
    sendDebugInfo('debug', 'Found relevant contexts', { contexts: relevantContexts });

    // Prepare system message with contexts
    let systemMessage = "You are a helpful AI assistant. ";
    if (relevantContexts.length > 0) {
      systemMessage += "Use the following context to help answer the question:\n\n";
      relevantContexts.forEach((ctx, i) => {
        systemMessage += `Context ${i + 1}:\n${ctx.text}\n\n`;
      });
    }

    // Add system message to the conversation
    const conversationWithContext = [
      { role: "system", content: systemMessage },
      ...messages
    ];

    const inputs = tokenizer.apply_chat_template(conversationWithContext, {
      add_generation_prompt: true,
      return_dict: true
    });

    sendDebugInfo('debug', 'Input prepared', {
      inputLength: inputs.input_ids.length,
      systemMessage,
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
      streamer
    });

    const generateTime = performance.now() - startTime;
    sendDebugInfo('info', 'Generation completed', {
      generateTimeMs: Math.round(generateTime),
      contextsUsed: relevantContexts.length
    });

  } catch (error) {
    sendDebugInfo('error', 'Generation failed', { error });
    throw error;
  }
}

// Add context management commands
async function handleContextCommand(type, data) {
  if (!contextService) {
    throw new Error("Context service not initialized");
  }

  switch (type) {
    case "add":
      const id = await contextService.addContext(data.id, data.text, data.metadata);
      return { id };

    case "remove":
      const removed = contextService.removeContext(data.id);
      return { removed };

    case "clear":
      contextService.clearContexts();
      return { cleared: true };

    case "list":
      return { contexts: contextService.getAllContexts() };

    default:
      throw new Error(`Unknown context command: ${type}`);
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
        await generate(data.messages, data.query);
        break;

      case "context":
        const result = await handleContextCommand(data.command, data.data);
        self.postMessage({
          status: 'context_update',
          data: result
        });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    sendDebugInfo('error', 'Worker error handler', { error });
    self.postMessage({
      status: 'error',
      data: error.message || 'An unknown error occurred'
    });
  }
});
