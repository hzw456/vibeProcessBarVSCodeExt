"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPClient = void 0;
class HTTPClient {
    async post(url, data, headers = {}, timeout = 30000, retryCount = 3, retryDelay = 1000) {
        const requestHeaders = {
            'User-Agent': HTTPClient.USER_AGENT,
            ...headers
        };
        let lastError;
        let attemptCount = 0;
        while (attemptCount <= retryCount) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                const response = await fetch(url, {
                    method: 'POST',
                    headers: requestHeaders,
                    body: JSON.stringify(data),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (response.ok) {
                    return {
                        success: true,
                        statusCode: response.status,
                        error: undefined,
                        retryCount: attemptCount
                    };
                }
                else {
                    lastError = `HTTP ${response.status}: ${response.statusText}`;
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    if (error.name === 'AbortError') {
                        lastError = 'Request timeout';
                    }
                    else {
                        lastError = error.message;
                    }
                }
                else {
                    lastError = 'Unknown error occurred';
                }
            }
            attemptCount++;
            if (attemptCount <= retryCount) {
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                retryDelay *= 2; // Exponential backoff
            }
        }
        return {
            success: false,
            statusCode: undefined,
            error: lastError || 'Unknown error',
            retryCount: attemptCount - 1
        };
    }
    async get(url, headers = {}, timeout = 30000) {
        const requestHeaders = {
            'User-Agent': HTTPClient.USER_AGENT,
            ...headers
        };
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(url, {
                method: 'GET',
                headers: requestHeaders,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                return {
                    success: true,
                    statusCode: response.status,
                    error: undefined,
                    retryCount: 0
                };
            }
            else {
                return {
                    success: false,
                    statusCode: response.status,
                    error: `HTTP ${response.status}: ${response.statusText}`,
                    retryCount: 0
                };
            }
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    return {
                        success: false,
                        statusCode: undefined,
                        error: 'Request timeout',
                        retryCount: 0
                    };
                }
                else {
                    return {
                        success: false,
                        statusCode: undefined,
                        error: error.message,
                        retryCount: 0
                    };
                }
            }
            else {
                return {
                    success: false,
                    statusCode: undefined,
                    error: 'Unknown error occurred',
                    retryCount: 0
                };
            }
        }
    }
    async testEndpoint(url, timeout = 5000) {
        const response = await this.get(url, {}, timeout);
        return response.success;
    }
}
exports.HTTPClient = HTTPClient;
HTTPClient.USER_AGENT = 'AI-Status-Transmission/1.0.0';
//# sourceMappingURL=httpClient.js.map