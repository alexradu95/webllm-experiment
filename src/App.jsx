// App.jsx
import { useEffect, useState, useRef } from 'react';

export default function App() {
  const worker = useRef(null);
  const [status, setStatus] = useState('idle');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      worker.current.postMessage({ type: 'check' });
    }

    worker.current.addEventListener('message', ({ data }) => {
      switch (data.status) {
        case 'ready':
          setStatus('ready');
          break;
        case 'error':
          setError(data.data);
          break;
        case 'update':
          setMessages(prev => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            lastMessage.content += data.output;
            return updated;
          });
          break;
      }
    });
  }, []);

  const handleSubmit = (userMessage) => {
    if (!userMessage.trim()) return;

    const updatedMessages = [
      ...messages,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: '' }
    ];

    setMessages(updatedMessages);
    setInput('');

    worker.current.postMessage({
      type: 'generate',
      data: updatedMessages.slice(0, -1)
    });
  };

  if (!navigator.gpu) {
    return <main><h1>WebGPU not supported</h1></main>;
  }

  return (
      <main style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <section style={{ flex: 1, overflow: 'auto' }}>
          {messages.map((msg, i) => (
              <article key={i} style={{
                margin: '1rem',
                marginLeft: msg.role === 'user' ? 'auto' : '1rem',
                marginRight: msg.role === 'assistant' ? 'auto' : '1rem',
                maxWidth: '80%',
                padding: '0.5rem',
                background: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5',
                borderRadius: '0.5rem'
              }}>
                <p>{msg.content}</p>
              </article>
          ))}
        </section>

        <footer style={{ padding: '1rem', borderTop: '1px solid #eee' }}>
          {error && <p style={{ color: 'red' }}>{error}</p>}

          {status === 'idle' && (
              <button
                  onClick={() => {
                    setStatus('loading');
                    worker.current.postMessage({ type: 'load' });
                  }}
                  style={{ width: '100%', padding: '0.5rem' }}
              >
                Load Model
              </button>
          )}

          {status === 'ready' && (
              <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit(input);
                  }}
                  style={{ display: 'flex', gap: '0.5rem' }}
              >
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(input);
                      }
                    }}
                    placeholder="Type message..."
                    style={{ flex: 1, padding: '0.5rem' }}
                />
                <button type="submit">Send</button>
              </form>
          )}

          {status === 'loading' && <p>Loading model...</p>}
        </footer>
      </main>
  );
}

// worker.js
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
