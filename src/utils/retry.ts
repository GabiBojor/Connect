/**
 * Retries an async operation with exponential backoff.
 * @param operation The async function to execute.
 * @param maxRetries Maximum number of retries (default: 3).
 * @param baseDelay Base delay in ms (default: 1000).
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            // Check if it's a rate limit error (429) or other retryable error
            const isRateLimit = error?.response?.status === 429 || error?.status === 429;
            const isServerErr = error?.response?.status >= 500 || error?.status >= 500;

            // If simulated error string contains "429", treat as rate limit
            const isSimulated429 = typeof error === 'string' && error.includes("429");
            const isSimulatedError = error instanceof Error && error.message.includes("429");

            if (attempt < maxRetries && (isRateLimit || isServerErr || isSimulated429 || isSimulatedError)) {
                const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
                // Add jitter
                const jitter = Math.random() * 100;
                console.warn(`Attempt ${attempt + 1} failed. Retrying in ${delay + jitter}ms... Reason: ${error.message || error}`);
                await new Promise(resolve => setTimeout(resolve, delay + jitter));
                continue;
            }

            // If we shouldn't retry, throw immediately
            if (!(isRateLimit || isServerErr || isSimulated429 || isSimulatedError)) {
                throw error;
            }
        }
    }

    throw lastError;
}
