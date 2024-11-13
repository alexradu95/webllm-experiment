import { AutoTokenizer, AutoModelForCausalLM, TextStreamer } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/Llama-3.2-1B-Instruct-q4f16";
let tokenizer, model;

async function initialize() {
  tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
    dtype: "q4f16",
    device: "webgpu"
  });
}

async function generate(messages) {
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
    do_sample: false,
    streamer
  });
}

self.addEventListener("message", async ({ data: { type, data } }) => {
  try {
    switch (type) {
      case "check":
        const adapter = await navigator.gpu?.requestAdapter();
        if (!adapter) throw new Error("WebGPU not supported");
        break;

      case "load":
        await initialize();
        self.postMessage({ status: 'ready' });
        break;

      case "generate":
        await generate(data);
        break;
    }
  } catch (error) {
    self.postMessage({ status: 'error', data: error.message });
  }
});
