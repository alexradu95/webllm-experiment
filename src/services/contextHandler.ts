let contexts = [];

export function addContext(data, tokenizer, MAX_CONTEXT_LENGTH, MAX_TOTAL_LENGTH) {
    if (!tokenizer) {
        throw new Error("Tokenizer not initialized");
    }

    const tokenCount = tokenizer.tokenize(data.text).length;
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

    return {
        success: true,
        id: data.id,
        tokenCount,
        totalTokens: existingTokens + tokenCount
    };
}

export function removeContext(id) {
    contexts = contexts.filter(ctx => ctx.id !== id);
    return {
        success: true,
        totalTokens: contexts.reduce((sum, ctx) => sum + ctx.tokens, 0)
    };
}

export function clearContexts() {
    contexts = [];
    return { success: true, totalTokens: 0 };
}

export function listContexts() {
    return contexts;
}
