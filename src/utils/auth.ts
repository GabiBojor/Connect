import { Request, Response, NextFunction } from 'express';

export const validateBearerToken = (token: string): boolean => {
    const validToken = process.env.MCP_API_KEY;
    if (!validToken) {
        console.warn('MCP_API_KEY is not set in environment variables. Authentication is disabled (NOT RECOMMENDED).');
        return true; // Use with caution; in production this should be false
    }
    return token === validToken;
};
