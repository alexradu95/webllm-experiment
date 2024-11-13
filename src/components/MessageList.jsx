export function MessageList({ messages }) {
    return (
        <section className="flex-1 overflow-auto p-4 space-y-4">
            {messages.map((msg, i) => (
                <article
                    key={i}
                    className={`max-w-[80%] p-4 rounded-lg ${
                        msg.role === 'user'
                            ? 'ml-auto bg-blue-50'
                            : 'mr-auto bg-gray-50'
                    }`}
                >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </article>
            ))}
        </section>
    );
}
