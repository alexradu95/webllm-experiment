import { AutoTokenizer, AutoModelForCausalLM, TextStreamer } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/Llama-3.2-1B-Instruct-q4f16";
let tokenizer, model;

async function checkWebGPU() {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) {
    throw new Error("WebGPU not supported");
  }
  const device = await adapter.requestDevice();
  if (!device) {
    throw new Error("Failed to get WebGPU device");
  }
  return device;
}

async function initialize() {
  try {
    await checkWebGPU();

    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
      dtype: "q4f16",
      device: "webgpu",
      revision: "main",
      cache: true
    });

    return true;
  } catch (error) {
    console.error("Initialization error:", error);
    throw error;
  }
}

async function generate(messages) {
  if (!tokenizer || !model) {
    throw new Error("Model not initialized");
  }

  try {
    const inputs = tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      return_dict: true
    });

    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: output => {
        self.postMessage({ status: 'update', output });
      }
    });

    await model.generate({
      ...inputs,
      max_new_tokens: 1024,
      do_sample: true,
      temperature: 0.7,
      top_p: 0.9,
      streamer
    });
  } catch (error) {
    console.error("Generation error:", error);
    throw error;
  }
}

self.addEventListener("message", async ({ data: { type, data } }) => {
  try {
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
    self.postMessage({
      status: 'error',
      data: error.message || 'An unknown error occurred'
    });
  }
});
