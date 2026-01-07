#!/usr/bin/env node

/**
 * Strapi MCP Server
 * Version 2.6.0
 * 
 * Version History:
 * 2.6.0 - Enhanced Validation & Debugging Update
 * - Implemented structured error handling with McpError and ErrorCode
 * - Added comprehensive Zod validation for runtime type safety
 * - Integrated comprehensive logging system with request tracking
 * - Added debug mode configuration with environment variables
 * - Removed unused prompt handlers for cleaner codebase
 * - Updated all dependencies to latest versions
 * - Added DEBUGGING.md guide for development workflow
 * 
 * 2.5.1 - Documentation & Configuration Enhancement
 * - Added detailed project documentation to CLAUDE.md
 * - Expanded configuration options with version support
 * - Improved error messaging and troubleshooting guides
 * - Enhanced REST API documentation and examples
 * - Added best practices for content management
 * 
 * 2.2.0 - Security & Version Handling Update
 * - Added strict write protection policy
 * - Enhanced version format support (5.*, 4.1.5, v4, etc.)
 * - Integrated documentation into server capabilities
 * - Removed connect prompt (now in capabilities)
 * - Improved error handling and validation
 * 
 * 2.1.0 - Previous Release
 * - Basic Strapi integration
 * - Server configuration
 * - Content type handling
 * - Media upload support
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    McpError,
    ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import fetch, { Response, RequestInit } from 'node-fetch';
import FormData from 'form-data';
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import qs from 'qs';
import { z } from 'zod';
import { createHash, randomUUID } from 'crypto';

// ===========================================
// Comprehensive Logging and Debugging System
// ===========================================

/**
 * Log levels for structured logging
 */
enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
}

/**
 * Interface for log entry structure
 */
interface LogEntry {
    timestamp: string;
    level: string;
    requestId?: string;
    operation?: string;
    server?: string;
    endpoint?: string;
    method?: string;
    duration?: number;
    error?: boolean;
    message: string;
    context?: Record<string, any>;
    sanitized?: boolean;
}

/**
 * Configuration for the logging system
 */
interface LogConfig {
    level: LogLevel;
    enableRequestTracking: boolean;
    enablePerformanceMonitoring: boolean;
    sanitizeData: boolean;
    maxLogLength: number;
    includeStackTrace: boolean;
}

/**
 * Comprehensive logging class with structured output, request tracking, and performance monitoring
 */
class McpLogger {
    private config: LogConfig;
    private activeRequests: Map<string, { start: number; operation: string; server?: string }>;

    constructor() {
        this.config = this.loadConfig();
        this.activeRequests = new Map();
        
        // Log startup configuration
        this.info('Logger initialized', {
            level: LogLevel[this.config.level],
            requestTracking: this.config.enableRequestTracking,
            performanceMonitoring: this.config.enablePerformanceMonitoring,
            sanitization: this.config.sanitizeData
        });
    }

    /**
     * Load configuration from environment variables
     */
    private loadConfig(): LogConfig {
        const logLevelStr = process.env.MCP_LOG_LEVEL || 'INFO';
        const logLevel = LogLevel[logLevelStr.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO;
        
        return {
            level: logLevel,
            enableRequestTracking: process.env.MCP_ENABLE_REQUEST_TRACKING !== 'false',
            enablePerformanceMonitoring: process.env.MCP_ENABLE_PERFORMANCE_MONITORING !== 'false',
            sanitizeData: process.env.MCP_SANITIZE_DATA !== 'false',
            maxLogLength: parseInt(process.env.MCP_MAX_LOG_LENGTH || '10000'),
            includeStackTrace: process.env.MCP_INCLUDE_STACK_TRACE === 'true'
        };
    }

    /**
     * Generate a unique request ID
     */
    generateRequestId(): string {
        return randomUUID();
    }

    /**
     * Start tracking a request
     */
    startRequest(requestId: string, operation: string, server?: string): void {
        if (!this.config.enableRequestTracking) return;
        
        this.activeRequests.set(requestId, {
            start: Date.now(),
            operation,
            server
        });
        
        this.debug(`Request started: ${operation}`, {
            requestId,
            operation,
            server
        });
    }

    /**
     * End tracking a request and log performance metrics
     */
    endRequest(requestId: string, success: boolean = true, error?: Error): void {
        if (!this.config.enableRequestTracking) return;
        
        const requestData = this.activeRequests.get(requestId);
        if (!requestData) return;
        
        const duration = Date.now() - requestData.start;
        this.activeRequests.delete(requestId);
        
        const logData = {
            requestId,
            operation: requestData.operation,
            server: requestData.server,
            duration,
            success,
            error: !success
        };
        
        if (success) {
            this.info(`Request completed: ${requestData.operation}`, logData);
        } else {
            this.error(`Request failed: ${requestData.operation}`, logData, error);
        }
        
        // Log performance warning for slow requests
        if (this.config.enablePerformanceMonitoring && duration > 5000) {
            this.warn(`Slow request detected: ${requestData.operation} took ${duration}ms`, logData);
        }
    }

    /**
     * Log API call performance
     */
    logApiCall(
        requestId: string,
        method: string,
        endpoint: string,
        duration: number,
        status: number,
        server?: string
    ): void {
        if (!this.config.enablePerformanceMonitoring) return;
        
        const logData = {
            requestId,
            method,
            endpoint,
            duration,
            status,
            server,
            success: status >= 200 && status < 300
        };
        
        if (status >= 400) {
            this.warn(`API call failed: ${method} ${endpoint}`, logData);
        } else if (duration > 2000) {
            this.warn(`Slow API call: ${method} ${endpoint} took ${duration}ms`, logData);
        } else {
            this.debug(`API call: ${method} ${endpoint}`, logData);
        }
    }

    /**
     * Sanitize sensitive data from logs
     */
    private sanitizeData(data: any): any {
        if (!this.config.sanitizeData) return data;
        
        const sensitiveKeys = [
            'password', 'token', 'jwt', 'api_key', 'secret',
            'authorization', 'auth', 'credentials', 'key'
        ];
        
        const sanitize = (obj: any): any => {
            if (typeof obj !== 'object' || obj === null) return obj;
            
            if (Array.isArray(obj)) {
                return obj.map(item => sanitize(item));
            }
            
            const sanitized: any = {};
            for (const [key, value] of Object.entries(obj)) {
                const lowerKey = key.toLowerCase();
                if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
                    sanitized[key] = '[REDACTED]';
                } else if (typeof value === 'object' && value !== null) {
                    sanitized[key] = sanitize(value);
                } else {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        };
        
        return sanitize(data);
    }

    /**
     * Create a structured log entry
     */
    private createLogEntry(
        level: LogLevel,
        message: string,
        context?: Record<string, any>,
        error?: Error
    ): LogEntry {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: LogLevel[level],
            message: message.length > this.config.maxLogLength 
                ? message.substring(0, this.config.maxLogLength) + '...' 
                : message,
            sanitized: this.config.sanitizeData
        };
        
        if (context) {
            entry.context = this.sanitizeData(context);
            
            // Extract common fields for easier filtering
            if (context.requestId) entry.requestId = context.requestId;
            if (context.operation) entry.operation = context.operation;
            if (context.server) entry.server = context.server;
            if (context.endpoint) entry.endpoint = context.endpoint;
            if (context.method) entry.method = context.method;
            if (context.duration) entry.duration = context.duration;
            if (context.error) entry.error = context.error;
        }
        
        if (error) {
            entry.context = entry.context || {};
            entry.context.error = {
                name: error.name,
                message: error.message,
                ...(this.config.includeStackTrace && { stack: error.stack })
            };
            entry.error = true;
        }
        
        return entry;
    }

    /**
     * Output log entry to stderr (not stdout to avoid interfering with MCP protocol)
     */
    private output(entry: LogEntry): void {
        if (this.shouldLog(LogLevel[entry.level as keyof typeof LogLevel])) {
            process.stderr.write(JSON.stringify(entry) + '\n');
        }
    }

    /**
     * Check if we should log at the given level
     */
    private shouldLog(level: LogLevel): boolean {
        return level <= this.config.level;
    }

    /**
     * Log error message
     */
    error(message: string, context?: Record<string, any>, error?: Error): void {
        this.output(this.createLogEntry(LogLevel.ERROR, message, context, error));
    }

    /**
     * Log warning message
     */
    warn(message: string, context?: Record<string, any>): void {
        this.output(this.createLogEntry(LogLevel.WARN, message, context));
    }

    /**
     * Log info message
     */
    info(message: string, context?: Record<string, any>): void {
        this.output(this.createLogEntry(LogLevel.INFO, message, context));
    }

    /**
     * Log debug message
     */
    debug(message: string, context?: Record<string, any>): void {
        this.output(this.createLogEntry(LogLevel.DEBUG, message, context));
    }

    /**
     * Log trace message
     */
    trace(message: string, context?: Record<string, any>): void {
        this.output(this.createLogEntry(LogLevel.TRACE, message, context));
    }

    /**
     * Log validation errors with detailed context
     */
    logValidationError(toolName: string, error: z.ZodError, input: unknown, requestId?: string): void {
        const context = {
            requestId,
            toolName,
            input: this.sanitizeData(input),
            validationErrors: error.errors.map(err => ({
                path: err.path.join('.'),
                message: err.message,
                code: err.code,
                received: 'received' in err ? err.received : undefined
            }))
        };
        
        this.error(`Validation failed for tool: ${toolName}`, context);
    }

    /**
     * Log tool execution with timing
     */
    logToolExecution(
        toolName: string,
        args: unknown,
        requestId: string,
        duration: number,
        success: boolean,
        error?: Error
    ): void {
        const context = {
            requestId,
            toolName,
            args: this.sanitizeData(args),
            duration,
            success,
            error: !success
        };
        
        if (success) {
            this.info(`Tool executed successfully: ${toolName}`, context);
        } else {
            this.error(`Tool execution failed: ${toolName}`, context, error);
        }
    }

    /**
     * Get current configuration for debugging
     */
    getConfig(): LogConfig {
        return { ...this.config };
    }

    /**
     * Get active requests for debugging
     */
    getActiveRequests(): Array<{ requestId: string; operation: string; duration: number; server?: string }> {
        const now = Date.now();
        return Array.from(this.activeRequests.entries()).map(([requestId, data]) => ({
            requestId,
            operation: data.operation,
            duration: now - data.start,
            server: data.server
        }));
    }
}

// Create global logger instance
const logger = new McpLogger();

// Define version info type
type VersionInfo = {
    id_field: string;
    data_structure: string;
    attributes: string;
    auth_pattern: string;
    key_features: string[];
    breaking_changes: {
        database: string[];
        api: string[];
        configuration: string[];
        plugins: string[];
    };
    migration_flags: {
        rest_api: string;
        graphql: string;
    };
    compatibility_notes: string[];
};

type StrapiVersionDifferences = {
    v4: VersionInfo;
    v5: VersionInfo;
};

// Zod Schemas for Tool Input Validation
// ===========================================

// Base schema for server parameter
const ServerSchema = z.object({
    server: z.string().min(1, "Server name is required and cannot be empty")
});

// Schema for strapi_list_servers tool (no parameters)
const ListServersSchema = z.object({}).strict();

// Schema for strapi_get_content_types tool
const GetContentTypesSchema = z.object({
    server: z.string().min(1, "Server name is required and cannot be empty")
}).strict();

// Schema for strapi_get_components tool
const GetComponentsSchema = z.object({
    server: z.string().min(1, "Server name is required and cannot be empty"),
    page: z.union([
        z.number().int().min(1, "Page must be a positive integer"),
        z.string().transform((str, ctx) => {
            const num = parseInt(str);
            if (isNaN(num) || num < 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Page must be a positive integer"
                });
                return z.NEVER;
            }
            return num;
        })
    ]).optional().default(1),
    pageSize: z.union([
        z.number().int().min(1, "Page size must be a positive integer"),
        z.string().transform((str, ctx) => {
            const num = parseInt(str);
            if (isNaN(num) || num < 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Page size must be a positive integer"
                });
                return z.NEVER;
            }
            return num;
        })
    ]).optional().default(25)
}).strict();

// Schema for strapi_rest tool
const RestSchema = z.object({
    server: z.string().min(1, "Server name is required and cannot be empty"),
    endpoint: z.string().min(1, "Endpoint is required and cannot be empty"),
    method: z.enum(["GET", "POST", "PUT", "DELETE"], {
        errorMap: () => ({ message: "Method must be one of: GET, POST, PUT, DELETE" })
    }).optional().default("GET"),
    params: z.union([
        z.record(z.any()),
        z.string().transform((str, ctx) => {
            try {
                return JSON.parse(str);
            } catch (e) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Params must be a valid JSON object or object"
                });
                return z.NEVER;
            }
        })
    ]).optional(),
    body: z.union([
        z.record(z.any()),
        z.string().transform((str, ctx) => {
            try {
                return JSON.parse(str);
            } catch (e) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Body must be a valid JSON object or object"
                });
                return z.NEVER;
            }
        })
    ]).optional(),
    userAuthorized: z.union([
        z.boolean(),
        z.string().transform((str, ctx) => {
            if (str === "true") return true;
            if (str === "false") return false;
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "userAuthorized must be boolean true/false or string 'true'/'false'"
            });
            return z.NEVER;
        })
    ]).optional().default(false)
}).strict().refine(
    (data) => {
        // For write operations, ensure userAuthorized is explicitly set to true
        if (["POST", "PUT", "DELETE"].includes(data.method) && !data.userAuthorized) {
            return false;
        }
        return true;
    },
    {
        message: "Write operations (POST, PUT, DELETE) require explicit user authorization (userAuthorized: true)",
        path: ["userAuthorized"]
    }
);

// Schema for media metadata
const MediaMetadataSchema = z.object({
    name: z.string().optional(),
    caption: z.string().optional(),
    alternativeText: z.string().optional(),
    description: z.string().optional()
}).strict();

// Schema for strapi_upload_media tool
const UploadMediaSchema = z.object({
    server: z.string().min(1, "Server name is required and cannot be empty"),
    url: z.string().url("Must be a valid URL"),
    format: z.enum(["jpeg", "png", "webp", "original"], {
        errorMap: () => ({ message: "Format must be one of: jpeg, png, webp, original" })
    }).optional().default("original"),
    quality: z.union([
        z.number().int().min(1, "Quality must be between 1 and 100").max(100, "Quality must be between 1 and 100"),
        z.string().transform((str, ctx) => {
            const num = parseInt(str);
            if (isNaN(num) || num < 1 || num > 100) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Quality must be between 1 and 100"
                });
                return z.NEVER;
            }
            return num;
        })
    ]).optional().default(80),
    metadata: MediaMetadataSchema.optional(),
    userAuthorized: z.union([
        z.boolean(),
        z.string().transform((str, ctx) => {
            if (str === "true") return true;
            if (str === "false") return false;
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "userAuthorized must be boolean true/false or string 'true'/'false'"
            });
            return z.NEVER;
        })
    ]).optional().default(false)
}).strict().refine(
    (data) => {
        // Media upload requires explicit user authorization
        if (!data.userAuthorized) {
            return false;
        }
        return true;
    },
    {
        message: "Media upload operations require explicit user authorization (userAuthorized: true)",
        path: ["userAuthorized"]
    }
);

// Reserved field names in Strapi
const STRAPI_RESERVED_NAMES = [
    'id', 'document_id', 'documentId',
    'created_at', 'createdAt', 'updated_at', 'updatedAt',
    'published_at', 'publishedAt',
    'created_by_id', 'createdById', 'updated_by_id', 'updatedById',
    'created_by', 'createdBy', 'updated_by', 'updatedBy',
    'entry_id', 'entryId', 'status',
    'localizations', 'meta', 'locale',
    '__component', '__contentType'
];

// Function to check if a field name is reserved
function isReservedFieldName(name: string): boolean {
    // Check exact matches
    if (STRAPI_RESERVED_NAMES.includes(name.toLowerCase())) {
        return true;
    }
    // Check patterns: strapi*, _strapi*, __strapi*
    const lowerName = name.toLowerCase();
    if (lowerName.startsWith('strapi') || 
        lowerName.startsWith('_strapi') || 
        lowerName.startsWith('__strapi')) {
        return true;
    }
    return false;
}

// Detailed Attribute Schema for Content Types
const AttributeTypeSchema = z.enum([
    "string", "text", "richtext", "email", "password", "uid", 
    "date", "time", "datetime", "timestamp", 
    "integer", "biginteger", "float", "decimal", 
    "boolean", "json", "media", "relation", "component", "dynamiczone", "enumeration"
]).describe("The type of the attribute");

const BaseAttributeSchema = z.object({
    type: AttributeTypeSchema,
    required: z.boolean().optional().describe("If true, this field is mandatory"),
    unique: z.boolean().optional().describe("If true, field value must be unique"),
    configurable: z.boolean().optional().default(true),
    private: z.boolean().optional().describe("If true, removed from API responses"),
    pluginOptions: z.record(z.any()).optional().describe("e.g., i18n localization settings"),
    default: z.any().optional().describe("Default value")
});

const StringAttributeSchema = BaseAttributeSchema.extend({
    type: z.enum(["string", "text", "richtext", "email", "password", "uid"]),
    minLength: z.number().int().optional(),
    maxLength: z.number().int().optional(),
    regex: z.string().optional(),
    targetField: z.string().optional().describe("For UID type: field to generate from")
});

const NumberAttributeSchema = BaseAttributeSchema.extend({
    type: z.enum(["integer", "biginteger", "float", "decimal"]),
    min: z.number().optional(),
    max: z.number().optional()
});

const EnumerationAttributeSchema = BaseAttributeSchema.extend({
    type: z.literal("enumeration"),
    enum: z.array(z.string()).describe("List of allowed values")
});

const RelationAttributeSchema = BaseAttributeSchema.extend({
    type: z.literal("relation"),
    relation: z.enum(["oneToOne", "oneToMany", "manyToOne", "manyToMany"]),
    target: z.string().describe("Target content type UID (e.g. 'api::article.article')"),
    inversedBy: z.string().optional(),
    mappedBy: z.string().optional()
});

const ComponentAttributeSchema = BaseAttributeSchema.extend({
    type: z.literal("component"),
    repeatable: z.boolean(),
    component: z.string().describe("Component UID (e.g. 'default.seo')")
});

const AttributeSchema = z.union([
    StringAttributeSchema,
    NumberAttributeSchema,
    EnumerationAttributeSchema,
    RelationAttributeSchema,
    ComponentAttributeSchema,
    BaseAttributeSchema // Fallback for other types
]).describe("Attribute definition");

const ContentTypeDefinitionSchema = z.object({
    displayName: z.string().min(1).describe("Human readable name (required at top level)"),
    singularName: z.string().min(1).describe("kebab-case singular name, no hyphens (e.g. 'article', not 'test-article')"),
    pluralName: z.string().min(1).describe("kebab-case plural name, no hyphens (e.g. 'articles', must differ from singularName)"),
    description: z.string().optional().describe("Optional description"),
    kind: z.enum(["collectionType", "singleType"]).default("collectionType").describe("Kind of content type"),
    collectionName: z.string().optional().describe("Database table name"),
    options: z.object({
        draftAndPublish: z.boolean().optional().default(false),
        populateCreatorFields: z.boolean().optional()
    }).optional(),
    pluginOptions: z.record(z.any()).optional(),
    attributes: z.record(AttributeSchema).describe("Map of attribute names to their definitions")
}).refine(
    (data) => {
        // Validate that no attribute uses reserved field names
        const reservedFieldsUsed = Object.keys(data.attributes).filter(key => isReservedFieldName(key));
        if (reservedFieldsUsed.length > 0) {
            return false;
        }
        return true;
    },
    (data) => {
        const reservedFieldsUsed = Object.keys(data.attributes).filter(key => isReservedFieldName(key));
        return {
            message: `INVALID FIELD NAMES: The following attribute names are reserved by Strapi and cannot be used: ${reservedFieldsUsed.join(', ')}.\n\n` +
                `Reserved names include: id, document_id, created_at, updated_at, published_at, created_by_id, updated_by_id, created_by, updated_by, entry_id, status, localizations, meta, locale, __component, __contentType, and any name starting with 'strapi', '_strapi', or '__strapi'.\n\n` +
                `Please rename these fields to something else (e.g., 'userId' instead of 'id', 'itemStatus' instead of 'status').`,
            path: ["attributes"]
        };
    }
);

// Schema for strapi_content_types_get_all tool
const ContentTypesGetAllSchema = z.object({
    server: z.string().min(1, "Server name is required and cannot be empty")
}).strict();

// Schema for strapi_content_types_get_one tool
const ContentTypesGetOneSchema = z.object({
    server: z.string().min(1, "Server name is required and cannot be empty"),
    uid: z.string().min(1, "UID is required (e.g., api::cat.cat)")
}).strict();

// Schema for strapi_content_types_create tool
const ContentTypesCreateSchema = z.object({
    server: z.string().min(1, "Server name is required and cannot be empty"),
    contentType: ContentTypeDefinitionSchema,
    userAuthorized: z.union([
        z.boolean(),
        z.string().transform((str, ctx) => {
            if (str === "true") return true;
            if (str === "false") return false;
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "userAuthorized must be boolean true/false or string 'true'/'false'"
            });
            return z.NEVER;
        })
    ]).optional().default(false)
}).strict().refine(
    (data) => {
        if (!data.userAuthorized) {
            return false;
        }
        return true;
    },
    {
        message: "Content type creation requires explicit user authorization (userAuthorized: true)",
        path: ["userAuthorized"]
    }
);

// Schema for strapi_content_types_update tool
const ContentTypesUpdateSchema = z.object({
    server: z.string().min(1, "Server name is required and cannot be empty"),
    uid: z.string().min(1, "UID is required (e.g., api::cat.cat)"),
    contentType: ContentTypeDefinitionSchema,
    userAuthorized: z.union([
        z.boolean(),
        z.string().transform((str, ctx) => {
            if (str === "true") return true;
            if (str === "false") return false;
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "userAuthorized must be boolean true/false or string 'true'/'false'"
            });
            return z.NEVER;
        })
    ]).optional().default(false)
}).strict().refine(
    (data) => {
        if (!data.userAuthorized) {
            return false;
        }
        return true;
    },
    {
        message: "Content type update requires explicit user authorization (userAuthorized: true)",
        path: ["userAuthorized"]
    }
);

// Schema for strapi_content_types_delete tool
const ContentTypesDeleteSchema = z.object({
    server: z.string().min(1, "Server name is required and cannot be empty"),
    uid: z.string().min(1, "UID is required (e.g., api::cat.cat)"),
    userAuthorized: z.union([
        z.boolean(),
        z.string().transform((str, ctx) => {
            if (str === "true") return true;
            if (str === "false") return false;
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "userAuthorized must be boolean true/false or string 'true'/'false'"
            });
            return z.NEVER;
        })
    ]).optional().default(false)
}).strict().refine(
    (data) => {
        if (!data.userAuthorized) {
            return false;
        }
        return true;
    },
    {
        message: "Content type deletion requires explicit user authorization (userAuthorized: true)",
        path: ["userAuthorized"]
    }
);

// Schema for strapi_content_types_batch_update tool
const ContentTypesBatchActionSchema = z.object({
    server: z.string().min(1, "Server name is required and cannot be empty"),
    actions: z.array(z.object({
        action: z.enum(["create", "update", "delete"]),
        uid: z.string().optional().describe("Required for update/delete"),
        contentType: ContentTypeDefinitionSchema.optional().describe("Required for create/update")
    })).min(1, "At least one action is required"),
    userAuthorized: z.union([
        z.boolean(),
        z.string().transform((str, ctx) => {
            if (str === "true") return true;
            if (str === "false") return false;
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "userAuthorized must be boolean true/false or string 'true'/'false'"
            });
            return z.NEVER;
        })
    ]).optional().default(false)
}).strict().refine(
    (data) => {
        if (!data.userAuthorized) {
            return false;
        }
        return true;
    },
    {
        message: "Batch operations require explicit user authorization (userAuthorized: true)",
        path: ["userAuthorized"]
    }
);

// Collection of all schemas for easy access
const ToolSchemas = {
    strapi_list_servers: ListServersSchema,
    strapi_get_content_types: GetContentTypesSchema,
    strapi_get_components: GetComponentsSchema,
    strapi_rest: RestSchema,
    strapi_upload_media: UploadMediaSchema,
    strapi_content_types_get_all: ContentTypesGetAllSchema,
    strapi_content_types_get_one: ContentTypesGetOneSchema,
    strapi_content_types_create: ContentTypesCreateSchema,
    strapi_content_types_update: ContentTypesUpdateSchema,
    strapi_content_types_delete: ContentTypesDeleteSchema,
    strapi_content_types_batch: ContentTypesBatchActionSchema
} as const;

// TypeScript types derived from Zod schemas
type ListServersInput = z.infer<typeof ListServersSchema>;
type GetContentTypesInput = z.infer<typeof GetContentTypesSchema>;
type GetComponentsInput = z.infer<typeof GetComponentsSchema>;
type RestInput = z.infer<typeof RestSchema>;
type UploadMediaInput = z.infer<typeof UploadMediaSchema>;

// Validation helper function
function validateToolInput<T extends keyof typeof ToolSchemas>(
    toolName: T,
    input: unknown,
    requestId?: string
): z.infer<typeof ToolSchemas[T]> {
    const schema = ToolSchemas[toolName];
    try {
        logger.debug(`Validating input for tool: ${toolName}`, {
            requestId,
            toolName,
            inputType: typeof input,
            hasInput: input !== undefined
        });
        
        const result = schema.parse(input);
        
        logger.debug(`Validation successful for tool: ${toolName}`, {
            requestId,
            toolName
        });
        
        return result;
    } catch (error) {
        if (error instanceof z.ZodError) {
            logger.logValidationError(toolName, error, input, requestId);
            
            const errorMessages = error.errors.map(err => {
                const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
                return `${path}${err.message}`;
            });
            throw new Error(`Validation failed for ${toolName}:\n${errorMessages.join('\n')}`);
        }
        
        logger.error(`Unexpected validation error for tool: ${toolName}`, {
            requestId,
            toolName,
            errorType: error instanceof Error ? error.constructor.name : typeof error
        }, error instanceof Error ? error : undefined);
        
        throw error;
    }
}

// Helper function to convert Zod schema to JSON schema for MCP compatibility
function zodToJsonSchema(schema: z.ZodSchema): any {
    // This is a simplified conversion - in production, you might want to use a library like zod-to-json-schema
    if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        const properties: any = {};
        const required: string[] = [];
        
        for (const [key, value] of Object.entries(shape)) {
            if (value instanceof z.ZodString) {
                properties[key] = { type: "string" };
                if (value._def.checks?.some((check: any) => check.kind === 'min' && check.value > 0)) {
                    properties[key].minLength = 1;
                }
            } else if (value instanceof z.ZodNumber) {
                properties[key] = { type: "number" };
                const checks = value._def.checks || [];
                for (const check of checks) {
                    if (check.kind === 'min') properties[key].minimum = check.value;
                    if (check.kind === 'max') properties[key].maximum = check.value;
                    if (check.kind === 'int') properties[key].type = "integer";
                }
            } else if (value instanceof z.ZodBoolean) {
                properties[key] = { type: "boolean" };
            } else if (value instanceof z.ZodEnum) {
                properties[key] = { type: "string", enum: value._def.values };
            } else if (value instanceof z.ZodOptional) {
                const innerSchema = value._def.innerType;
                if (innerSchema instanceof z.ZodString) {
                    properties[key] = { type: "string" };
                } else if (innerSchema instanceof z.ZodNumber) {
                    properties[key] = { type: "number" };
                } else if (innerSchema instanceof z.ZodBoolean) {
                    properties[key] = { type: "boolean" };
                } else if (innerSchema instanceof z.ZodEnum) {
                    properties[key] = { type: "string", enum: innerSchema._def.values };
                } else {
                    properties[key] = { type: "object", additionalProperties: true };
                }
            } else {
                properties[key] = { type: "object", additionalProperties: true };
            }
            
            if (!(value instanceof z.ZodOptional)) {
                required.push(key);
            }
        }
        
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties,
            required,
            additionalProperties: false
        };
    }
    
    return {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false
    };
}

// Define version differences for reference
const STRAPI_VERSION_DIFFERENCES: StrapiVersionDifferences = {
    "v4": {
        "id_field": "id",
        "data_structure": "Uses data wrapper structure",
        "attributes": "Nested under attributes object",
        "auth_pattern": "Classic JWT pattern",
        "key_features": [
            "Numeric IDs",
            "Nested attribute structure",
            "Data wrapper in responses",
            "Traditional REST patterns",
            "External i18n plugin"
        ],
        "breaking_changes": {
            "database": [],
            "api": [],
            "configuration": [],
            "plugins": []
        },
        "migration_flags": {
            "rest_api": "N/A",
            "graphql": "N/A"
        },
        "compatibility_notes": [
            "Uses SQLite3 for SQLite support",
            "Supports MySQL v5",
            "Uses traditional lifecycle hooks",
            "External i18n plugin required"
        ]
    },
    "v5": {
        "id_field": "documentId",
        "data_structure": "Direct access without wrapper",
        "attributes": "Direct access at root level",
        "auth_pattern": "Enhanced JWT with improved security",
        "key_features": [
            "Document-based IDs",
            "Flat data structure",
            "Direct attribute access",
            "Improved REST patterns",
            "Better error handling",
            "Integrated i18n support",
            "New Document Service API",
            "Enhanced database support"
        ],
        "breaking_changes": {
            "database": [
                "Only better-sqlite3 supported for SQLite",
                "Only mysql2 supported for MySQL",
                "MySQL v5 no longer supported",
                "New lifecycle hooks system"
            ],
            "api": [
                "New REST API response format",
                "Updated GraphQL schema and responses",
                "New Document Service API replaces Entity Service"
            ],
            "configuration": [
                "New server configuration for env variables",
                "Stricter custom configuration requirements"
            ],
            "plugins": [
                "helper-plugin removed",
                "i18n integrated into core"
            ]
        },
        "migration_flags": {
            "rest_api": "Set 'Strapi-Response-Format: v4' header for v4 compatibility",
            "graphql": "Set v4CompatibilityMode: true in graphql.config for v4 compatibility"
        },
        "compatibility_notes": [
            "Uses better-sqlite3 for improved SQLite support",
            "Requires MySQL v8+ for MySQL support",
            "New Document Service API for data operations",
            "Built-in i18n support",
            "New lifecycle hooks system with Document Service Middlewares",
            "Environment variables now handled by server configuration"
        ]
    }
};

// Read config file
const CONFIG_PATH = join(homedir(), '.mcp', 'strapi-mcp-server.config.json');

// Server config can use either api_key OR email+password
type ServerConfig = {
    api_url: string;
    version?: string;
} & (
    | { api_key: string; email?: never; password?: never }
    | { email: string; password: string; api_key?: never }
);

let config: Record<string, ServerConfig>;
const jwtCache: Map<string, { jwt: string; expiresAt: number }> = new Map();

try {
    const configContent = readFileSync(CONFIG_PATH, 'utf-8');
    config = JSON.parse(configContent);

    if (Object.keys(config).length === 0) {
        throw new McpError(ErrorCode.InvalidParams, 'Config file exists but is empty');
    }
    
    logger.info('Configuration loaded successfully', {
        configPath: CONFIG_PATH,
        serverCount: Object.keys(config).length,
        servers: Object.keys(config)
    });
} catch (error) {
    logger.error('Error reading config file', {
        configPath: CONFIG_PATH,
        errorType: error instanceof Error ? error.constructor.name : typeof error
    }, error instanceof Error ? error : undefined);
    config = {};
}

// Create server instance
const server = new Server(
    {
        name: "strapi-mcp",
        version: "2.7.1",
    },
    {
        capabilities: {
            tools: {},
            strapi: {
                security: {
                    write_protection: {
                        policy: "STRICT_USER_AUTHORIZATION_REQUIRED",
                        description: "No write operations without explicit user authorization",
                        protected_operations: [
                            "POST /api/* (Create)",
                            "PUT /api/* (Update)",
                            "DELETE /api/* (Delete)",
                            "POST /api/upload (Media Upload)"
                        ],
                        requirements: [
                            "Explicit user authorization for each write operation",
                            "No automatic updates or deletions",
                            "User confirmation for each data change",
                            "Logging of all write operations"
                        ],
                        validation_steps: [
                            "Verification of user authorization",
                            "Validation of data to be modified",
                            "User confirmation of operation",
                            "Logging of changes with user reference"
                        ]
                    }
                },
                versions: STRAPI_VERSION_DIFFERENCES,
                defaultVersion: "v5",
                supportedVersions: ["v4", "v5"],
                migrationGuides: {
                    "v4_to_v5": {
                        steps: [
                            "Update database (better-sqlite3, mysql2)",
                            "Replace id with documentId",
                            "Remove data wrapper structure",
                            "Update lifecycle hooks",
                            "Check plugin compatibility"
                        ],
                        compatibilityFlags: {
                            rest: "Strapi-Response-Format: v4",
                            graphql: "v4CompatibilityMode: true"
                        }
                    }
                },
                documentation: {
                    schema_conventions: {
                        description: "Schema & naming conventions for Content Types",
                        examples: {
                            schema: {
                                singularName: "article",
                                pluralName: "articles",
                                collectionName: "articles"
                            },
                            endpoints: {
                                rest: "api/articles",
                                graphql_collection: "query { articles }",
                                graphql_single: "query { article }"
                            }
                        }
                    },
                    api_patterns: {
                        rest: {
                            collection: "GET /api/{pluralName}",
                            single: "GET /api/{pluralName}/{id}",
                            create: "POST /api/{pluralName}",
                            update: "PUT /api/{pluralName}/{id}",
                            delete: "DELETE /api/{pluralName}/{id}"
                        },
                        graphql: {
                            collection: "query { pluralName(pagination: { page: 1, pageSize: 100 }) { data { id attributes } } }",
                            single: "query { singularName(id: 1) { data { id attributes } } }",
                            create: "mutation { createPluralName(data: { field: value }) { data { id } } }",
                            update: "mutation { updatePluralName(id: 1, data: { field: value }) { data { id } } }"
                        }
                    },
                    media_handling: {
                        upload_steps: [
                            "Upload via strapi_upload_media",
                            "Provide metadata (name, caption, alternativeText)",
                            "Choose format (jpeg, png, webp)",
                            "Get image ID from response"
                        ],
                        linking_steps: [
                            "Use PUT request",
                            "Include complete data structure",
                            "Use documentId for v5",
                            "Images as array"
                        ],
                        example: {
                            upload: {
                                url: "https://example.com/image.jpg",
                                metadata: {
                                    name: "article-name",
                                    caption: "Article Caption",
                                    alternativeText: "Article Alt Text"
                                }
                            },
                            link: {
                                method: "PUT",
                                endpoint: "api/articles/{documentId}",
                                body: {
                                    data: {
                                        images: ["imageId"]
                                    }
                                }
                            }
                        }
                    },
                    common_errors: {
                        "404": [
                            "Numerical ID used instead of documentId",
                            "Incorrect plural/singular form in endpoint",
                            "DocumentId missing"
                        ],
                        "405": ["Incorrect endpoint (/article instead of /articles)"],
                        "400": ["Data-Wrapper missing"]
                    },
                    best_practices: [
                        "Always check schema first",
                        "When using URLs, first validate the content with webtools",
                        "Always use documentId for IDs",
                        "Always use data-Wrapper for updates",
                        "Always use pluralName for collections",
                        "Check if singular/plural applies based on API type",
                        "In Strapi 5: Direct attribute query without data-Wrapper",
                        "Use documentId instead of id"
                    ],
                    debugging_guide: {
                        steps: [
                            "When 404: Check if plural/singular form is correct",
                            "When 400: Check if data-Wrapper is present",
                            "When errors in URLs: First validate with webtools",
                            "When ID problems: Check on documentId",
                            "Check schema and configuration in Strapi"
                        ]
                    },
                    graphql_tips: {
                        pagination: {
                            example: `query {
                                articles(pagination: { page: 1, pageSize: 10 }) {
                                    documentId
                                    name
                                }
                            }`
                        },
                        best_practices: [
                            "Complete attribute specification",
                            "No pagination parameter for simple queries",
                            "Precise attribute writing"
                        ]
                    },
                    initialization_steps: [
                        "Get schema and analyze",
                        "Capture Content Types and structures",
                        "Remember endpoint names (pluralName/singularName)",
                        "Document fields and types",
                        "Identify relations",
                        "Consider required fields and validations"
                    ]
                }
            }
        },
    }
);

// Helper function to login with email/password and get JWT
async function loginWithCredentials(apiUrl: string, email: string, password: string): Promise<string> {
    const loginUrl = `${apiUrl}/admin/login`;
    
    logger.debug('Attempting admin login with email/password', {
        apiUrl,
        email
    });
    
    try {
        const response = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new McpError(
                ErrorCode.InvalidParams,
                `Admin login failed: ${response.statusText}. ${errorText}`
            );
        }
        
        const data = await response.json() as any;
        if (!data.data || !data.data.token) {
            throw new McpError(
                ErrorCode.InternalError,
                'Login successful but no admin token received'
            );
        }
        
        logger.info('Admin login successful', { email });
        return data.data.token;
    } catch (error) {
        logger.error('Admin login failed', {
            apiUrl,
            email,
            errorType: error instanceof Error ? error.constructor.name : typeof error
        }, error instanceof Error ? error : undefined);
        throw error;
    }
}

// Helper function to get server config
async function getServerConfig(serverName: string, useAdminAuth: boolean = false): Promise<{ API_URL: string, JWT: string }> {
    if (Object.keys(config).length === 0) {
        const exampleConfig1 = {
            "myserver": {
                "api_url": "http://localhost:1337",
                "api_key": "your-jwt-token-from-strapi-admin"
            }
        };
        
        const exampleConfig2 = {
            "myserver": {
                "api_url": "http://localhost:1337",
                "email": "your-email@example.com",
                "password": "your-password"
            }
        };

        throw new McpError(
            ErrorCode.InvalidParams,
            `No server configuration found!\n\n` +
            `Please create a configuration file at:\n` +
            `${CONFIG_PATH}\n\n` +
            `Example configuration (Option 1 - API Key):\n` +
            `${JSON.stringify(exampleConfig1, null, 2)}\n\n` +
            `Example configuration (Option 2 - Email/Password):\n` +
            `${JSON.stringify(exampleConfig2, null, 2)}\n\n` +
            `Steps to set up:\n` +
            `1. Create the .mcp directory: mkdir -p ~/.mcp\n` +
            `2. Create the config file: touch ~/.mcp/strapi-mcp-server.config.json\n` +
            `3. Add your server configuration using one of the examples above\n` +
            `4. For API Key method: Get your JWT token from Strapi Admin Panel > Settings > API Tokens\n` +
            `5. For Email/Password method: Use your Strapi user credentials\n` +
            `6. Make sure the file permissions are secure: chmod 600 ~/.mcp/strapi-mcp-server.config.json`
        );
    }

    const serverConfig = config[serverName];
    if (!serverConfig) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `Server "${serverName}" not found in config.\n\n` +
            `Available servers: ${Object.keys(config).join(', ')}\n\n` +
            `To add a new server, edit:\n` +
            `${CONFIG_PATH}\n\n` +
            `Example configuration (with API key):\n` +
            `{\n` +
            `  "${serverName}": {\n` +
            `    "api_url": "http://localhost:1337",\n` +
            `    "api_key": "your-jwt-token-from-strapi-admin"\n` +
            `  }\n` +
            `}\n\n` +
            `Or with email/password:\n` +
            `{\n` +
            `  "${serverName}": {\n` +
            `    "api_url": "http://localhost:1337",\n` +
            `    "email": "your-email@example.com",\n` +
            `    "password": "your-password"\n` +
            `  }\n` +
            `}`
        );
    }
    
    // Determine which authentication to use
    const hasApiKey = 'api_key' in serverConfig && serverConfig.api_key;
    const hasEmailPassword = 'email' in serverConfig && serverConfig.email && serverConfig.password;
    
    // For admin endpoints (content-type-builder, etc.), prefer email/password
    if (useAdminAuth && hasEmailPassword) {
        const cached = jwtCache.get(serverName + ':admin');
        const now = Date.now();
        
        // Use cached JWT if valid (expires in 30 days, refresh if less than 1 day remaining)
        if (cached && cached.expiresAt > now + 24 * 60 * 60 * 1000) {
            logger.debug('Using cached admin JWT', { server: serverName });
            return {
                API_URL: serverConfig.api_url,
                JWT: cached.jwt
            };
        }
        
        // Login to get new admin JWT
        const jwt = await loginWithCredentials(
            serverConfig.api_url,
            serverConfig.email,
            serverConfig.password
        );
        
        // Cache the JWT (expires in 30 days)
        jwtCache.set(serverName + ':admin', {
            jwt,
            expiresAt: now + 30 * 24 * 60 * 60 * 1000
        });
        
        return {
            API_URL: serverConfig.api_url,
            JWT: jwt
        };
    }
    
    // For regular API endpoints (/api/*), prefer api_key
    if (!useAdminAuth && hasApiKey) {
        return {
            API_URL: serverConfig.api_url,
            JWT: serverConfig.api_key
        };
    }
    
    // Fallback: If only one auth method is available, use it
    if (hasApiKey) {
        return {
            API_URL: serverConfig.api_url,
            JWT: serverConfig.api_key
        };
    }
    
    if (hasEmailPassword) {
        const cached = jwtCache.get(serverName + ':admin');
        const now = Date.now();
        
        if (cached && cached.expiresAt > now + 24 * 60 * 60 * 1000) {
            logger.debug('Using cached admin JWT (fallback)', { server: serverName });
            return {
                API_URL: serverConfig.api_url,
                JWT: cached.jwt
            };
        }
        
        const jwt = await loginWithCredentials(
            serverConfig.api_url,
            serverConfig.email,
            serverConfig.password
        );
        
        jwtCache.set(serverName + ':admin', {
            jwt,
            expiresAt: now + 30 * 24 * 60 * 60 * 1000
        });
        
        return {
            API_URL: serverConfig.api_url,
            JWT: jwt
        };
    }
    
    throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid configuration for server "${serverName}". ` +
        `Must provide either "api_key" OR both "email" and "password", or both for dual authentication.`
    );
}

// Helper function to wait for Strapi restart
async function waitForStrapiRestart(serverName: string, timeoutMs: number = 60000): Promise<boolean> {
    logger.debug(`Waiting for Strapi restart on ${serverName}...`);
    const start = Date.now();
    
    // Initial wait to allow Strapi to start restarting
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    while (Date.now() - start < timeoutMs) {
        try {
            // We try to fetch content-types (public or authenticated) to check health
            // Re-fetching config each time to ensure fresh token if needed (though config is static usually)
            const config = await getServerConfig(serverName, false);
            
            // Using node-fetch
            const response = await fetch(`${config.API_URL}/api/upload/files?pagination[pageSize]=1`, { // A simple lightweight query
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.JWT}`
                }
            });
            
            // If we get any response (even 403 Forbidden), the server is up. 
            // 502/503/Connection Refused means it's down.
            if (response.status >= 200 && response.status < 500) {
                logger.debug('Strapi server is back online');
                return true;
            }
        } catch (error) {
            // Ignore connection errors
        }
        
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    logger.warn('Strapi restart wait timed out');
    return false;
}


// Helper function for making Strapi API requests
async function makeStrapiRequest(
    serverName: string, 
    endpoint: string, 
    params?: Record<string, string>, 
    requestId?: string
): Promise<any> {
    const serverConfig = await getServerConfig(serverName, true);
    let url = `${serverConfig.API_URL}${endpoint}`;
    if (params) {
        const queryString = new URLSearchParams(params).toString();
        url = `${url}?${queryString}`;
    }

    const headers = {
        'Authorization': `Bearer ${serverConfig.JWT}`,
        'Content-Type': 'application/json',
    };

    const startTime = Date.now();
    
    logger.debug(`Making API request to Strapi`, {
        requestId,
        server: serverName,
        endpoint,
        method: 'GET',
        hasParams: !!params,
        url: url.replace(serverConfig.JWT, '[REDACTED]')
    });

    try {
        const response = await fetch(url, { headers });
        const duration = Date.now() - startTime;
        
        logger.logApiCall(
            requestId || 'unknown',
            'GET',
            endpoint,
            duration,
            response.status,
            serverName
        );
        
        return await handleStrapiError(response, `Request to ${endpoint}`, requestId);
    } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error("Error making Strapi request", {
            requestId,
            server: serverName,
            endpoint,
            method: 'GET',
            duration,
            errorType: error instanceof Error ? error.constructor.name : typeof error
        }, error instanceof Error ? error : undefined);
        
        throw error;
    }
}

// Helper function to download image as buffer
async function downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new McpError(ErrorCode.InternalError, `Failed to download image: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
}

// Helper function to process image with Sharp
async function processImage(buffer: Buffer, format: string, quality: number): Promise<Buffer> {
    let sharpInstance = sharp(buffer);

    if (format !== 'original') {
        switch (format) {
            case 'jpeg':
                sharpInstance = sharpInstance.jpeg({ quality });
                break;
            case 'png':
                // PNG quality is 0-100 for zlib compression level
                sharpInstance = sharpInstance.png({
                    compressionLevel: Math.floor((100 - quality) / 100 * 9)
                });
                break;
            case 'webp':
                sharpInstance = sharpInstance.webp({ quality });
                break;
        }
    }

    return sharpInstance.toBuffer();
}

// Update uploadMedia with server config and authorization check
async function uploadMedia(serverName: string, imageBuffer: Buffer, fileName: string, format: string, metadata?: Record<string, any>, userAuthorized: boolean = false, requestId?: string): Promise<any> {
    // Check for explicit user authorization for this upload operation
    if (!userAuthorized) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `AUTHORIZATION REQUIRED: Media upload operations require explicit user authorization.\n\n` +
            `IMPORTANT: The client MUST:\n` +
            `1. Ask the user for explicit permission before uploading this media\n` +
            `2. Show the user what media will be uploaded\n` +
            `3. Receive clear confirmation from the user\n` +
            `4. Set userAuthorized=true when making the request\n\n` +
            `This is a security measure to prevent unauthorized uploads.`
        );
    }

    const serverConfig = await getServerConfig(serverName);
    const formData = new FormData();

    // Update filename extension if format is changed
    if (format !== 'original') {
        fileName = fileName.replace(/\.[^/.]+$/, '') + '.' + format;
    }

    // Add the file
    formData.append('files', imageBuffer, {
        filename: fileName,
        contentType: `image/${format === 'original' ? 'jpeg' : format}` // Default to jpeg for original
    });

    // Add metadata if provided
    if (metadata) {
        formData.append('fileInfo', JSON.stringify(metadata));
    }

    const url = `${serverConfig.API_URL}/api/upload`;
    const startTime = Date.now();
    
    logger.debug(`Uploading media to Strapi`, {
        requestId,
        server: serverName,
        fileName,
        format,
        hasMetadata: !!metadata,
        bufferSize: imageBuffer.length,
        userAuthorized
    });
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serverConfig.JWT}`,
            ...formData.getHeaders()
        },
        body: formData
    });

    const duration = Date.now() - startTime;
    
    logger.logApiCall(
        requestId || 'unknown',
        'POST',
        '/api/upload',
        duration,
        response.status,
        serverName
    );

    return handleStrapiError(response, 'Media upload', requestId);
}

// List available tools 
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "strapi_list_servers",
                description: "List all available Strapi servers from the configuration.",
                inputSchema: zodToJsonSchema(ToolSchemas.strapi_list_servers),
            },
            {
                name: "strapi_get_content_types",
                description: "Get all content types from Strapi. Returns the complete schema of all content types.",
                inputSchema: {
                    ...zodToJsonSchema(ToolSchemas.strapi_get_content_types),
                    properties: {
                        ...zodToJsonSchema(ToolSchemas.strapi_get_content_types).properties,
                        server: {
                            ...zodToJsonSchema(ToolSchemas.strapi_get_content_types).properties.server,
                            description: "The name of the server to connect to"
                        }
                    }
                },
            },
            {
                name: "strapi_get_components",
                description: "Get all components from Strapi with pagination support. Returns both component data and pagination metadata (page, pageSize, total, pageCount).",
                inputSchema: {
                    ...zodToJsonSchema(ToolSchemas.strapi_get_components),
                    properties: {
                        ...zodToJsonSchema(ToolSchemas.strapi_get_components).properties,
                        server: {
                            ...zodToJsonSchema(ToolSchemas.strapi_get_components).properties.server,
                            description: "The name of the server to connect to"
                        },
                        page: {
                            ...zodToJsonSchema(ToolSchemas.strapi_get_components).properties.page,
                            description: "Page number (starts at 1)",
                            default: 1
                        },
                        pageSize: {
                            ...zodToJsonSchema(ToolSchemas.strapi_get_components).properties.pageSize,
                            description: "Number of items per page",
                            default: 25
                        }
                    }
                },
            },
            {
                name: "strapi_rest",
                description: "Execute REST API requests against Strapi endpoints. IMPORTANT: All write operations (POST, PUT, DELETE) require explicit user authorization via the userAuthorized parameter.\n\n" +
                    "1. Reading components:\n" +
                    "params: { populate: ['SEO'] } // Populate a component\n" +
                    "params: { populate: { SEO: { fields: ['Title', 'seoDescription'] } } } // With field selection\n\n" +
                    "2. Updating components (REQUIRES USER AUTHORIZATION):\n" +
                    "body: {\n" +
                    "  data: {\n" +
                    "    // For single components:\n" +
                    "    componentName: {\n" +
                    "      Title: 'value',\n" +
                    "      seoDescription: 'value'\n" +
                    "    },\n" +
                    "    // For repeatable components:\n" +
                    "    componentName: [\n" +
                    "      { field: 'value' }\n" +
                    "    ]\n" +
                    "  }\n" +
                    "}\n" +
                    "userAuthorized: true // Must set this to true for POST/PUT/DELETE after getting user permission\n\n" +
                    "3. Other parameters:\n" +
                    "- fields: Select specific fields\n" +
                    "- filters: Filter results\n" +
                    "- sort: Sort results\n" +
                    "- pagination: Page through results",
                inputSchema: {
                    ...zodToJsonSchema(ToolSchemas.strapi_rest),
                    properties: {
                        ...zodToJsonSchema(ToolSchemas.strapi_rest).properties,
                        server: {
                            ...zodToJsonSchema(ToolSchemas.strapi_rest).properties.server,
                            description: "The name of the server to connect to"
                        },
                        endpoint: {
                            ...zodToJsonSchema(ToolSchemas.strapi_rest).properties.endpoint,
                            description: "The API endpoint (e.g., 'api/articles')"
                        },
                        method: {
                            ...zodToJsonSchema(ToolSchemas.strapi_rest).properties.method,
                            description: "HTTP method to use",
                            default: "GET"
                        },
                        params: {
                            ...zodToJsonSchema(ToolSchemas.strapi_rest).properties.params,
                            description: "Optional query parameters for GET requests. For components, use populate: ['componentName'] or populate: { componentName: { fields: ['field1'] } }"
                        },
                        body: {
                            ...zodToJsonSchema(ToolSchemas.strapi_rest).properties.body,
                            description: "Request body for POST/PUT requests. For components, use: { data: { componentName: { field: 'value' } } } for single components or { data: { componentName: [{ field: 'value' }] } } for repeatable components"
                        },
                        userAuthorized: {
                            ...zodToJsonSchema(ToolSchemas.strapi_rest).properties.userAuthorized,
                            description: "REQUIRED for POST/PUT/DELETE operations. Client MUST obtain explicit user authorization before setting this to true.",
                            default: false
                        }
                    }
                },
            },
            {
                name: "strapi_upload_media",
                description: "Upload media to Strapi's media library from a URL with format conversion, quality control, and metadata options. IMPORTANT: This is a write operation that REQUIRES explicit user authorization via the userAuthorized parameter.",
                inputSchema: {
                    ...zodToJsonSchema(ToolSchemas.strapi_upload_media),
                    properties: {
                        ...zodToJsonSchema(ToolSchemas.strapi_upload_media).properties,
                        server: {
                            ...zodToJsonSchema(ToolSchemas.strapi_upload_media).properties.server,
                            description: "The name of the server to connect to"
                        },
                        url: {
                            ...zodToJsonSchema(ToolSchemas.strapi_upload_media).properties.url,
                            description: "URL of the image to upload"
                        },
                        format: {
                            ...zodToJsonSchema(ToolSchemas.strapi_upload_media).properties.format,
                            description: "Target format for the image. Use 'original' to keep the source format.",
                            default: "original"
                        },
                        quality: {
                            ...zodToJsonSchema(ToolSchemas.strapi_upload_media).properties.quality,
                            description: "Image quality (1-100). Only applies when converting formats.",
                            default: 80
                        },
                        metadata: {
                            type: "object",
                            properties: {
                                name: {
                                    type: "string",
                                    description: "Name of the file"
                                },
                                caption: {
                                    type: "string",
                                    description: "Caption for the image"
                                },
                                alternativeText: {
                                    type: "string",
                                    description: "Alternative text for accessibility"
                                },
                                description: {
                                    type: "string",
                                    description: "Detailed description of the image"
                                }
                            },
                            additionalProperties: false
                        },
                        userAuthorized: {
                            ...zodToJsonSchema(ToolSchemas.strapi_upload_media).properties.userAuthorized,
                            description: "REQUIRED for media upload operations. Client MUST obtain explicit user authorization before setting this to true.",
                            default: false
                        }
                    }
                }
            },
            {
                name: "strapi_content_types_get_all",
                description: "Get all content types (tables) from Strapi Content-Type Builder. Returns all table structures including system tables.",
                inputSchema: {
                    ...zodToJsonSchema(ToolSchemas.strapi_content_types_get_all),
                    properties: {
                        ...zodToJsonSchema(ToolSchemas.strapi_content_types_get_all).properties,
                        server: {
                            ...zodToJsonSchema(ToolSchemas.strapi_content_types_get_all).properties.server,
                            description: "The name of the server to connect to"
                        }
                    }
                },
            },
            {
                name: "strapi_content_types_get_one",
                description: "Get detailed structure of a specific content type (table) by UID. Example UID: api::cat.cat",
                inputSchema: {
                    ...zodToJsonSchema(ToolSchemas.strapi_content_types_get_one),
                    properties: {
                        ...zodToJsonSchema(ToolSchemas.strapi_content_types_get_one).properties,
                        server: {
                            ...zodToJsonSchema(ToolSchemas.strapi_content_types_get_one).properties.server,
                            description: "The name of the server to connect to"
                        },
                        uid: {
                            ...zodToJsonSchema(ToolSchemas.strapi_content_types_get_one).properties.uid,
                            description: "The UID of the content type (e.g., api::cat.cat)"
                        }
                    }
                },
            },
            {
                name: "strapi_content_types_create",
                description: "Create a new content type (table) in Strapi. IMPORTANT: This is a write operation that REQUIRES explicit user authorization via the userAuthorized parameter.",
                inputSchema: {
                    ...zodToJsonSchema(ToolSchemas.strapi_content_types_create),
                    properties: {
                        ...zodToJsonSchema(ToolSchemas.strapi_content_types_create).properties,
                        server: {
                            ...zodToJsonSchema(ToolSchemas.strapi_content_types_create).properties.server,
                            description: "The name of the server to connect to"
                        },
                        contentType: {
                            type: "object",
                            description: "The content type schema definition",
                            additionalProperties: true
                        },
                        userAuthorized: {
                            ...zodToJsonSchema(ToolSchemas.strapi_content_types_create).properties.userAuthorized,
                            description: "REQUIRED for creating content types. Client MUST obtain explicit user authorization before setting this to true.",
                            default: false
                        }
                    }
                },
            },
            {
                name: "strapi_content_types_update",
                description: "Update an existing content type (table) structure. Completely replaces the old structure. IMPORTANT: This is a write operation that REQUIRES explicit user authorization via the userAuthorized parameter.",
                inputSchema: {
                    ...zodToJsonSchema(ToolSchemas.strapi_content_types_update),
                    properties: {
                        ...zodToJsonSchema(ToolSchemas.strapi_content_types_update).properties,
                        server: {
                            ...zodToJsonSchema(ToolSchemas.strapi_content_types_update).properties.server,
                            description: "The name of the server to connect to"
                        },
                        uid: {
                            ...zodToJsonSchema(ToolSchemas.strapi_content_types_update).properties.uid,
                            description: "The UID of the content type to update (e.g., api::cat.cat)"
                        },
                        contentType: {
                            type: "object",
                            description: "The new content type schema definition (complete replacement)",
                            additionalProperties: true
                        },
                        userAuthorized: {
                            ...zodToJsonSchema(ToolSchemas.strapi_content_types_update).properties.userAuthorized,
                            description: "REQUIRED for updating content types. Client MUST obtain explicit user authorization before setting this to true.",
                            default: false
                        }
                    }
                },
            },
            {
                name: "strapi_content_types_delete",
                description: "Delete a content type (table) and ALL its data. IMPORTANT: This is a destructive write operation that REQUIRES explicit user authorization via the userAuthorized parameter.",
                inputSchema: {
                    ...zodToJsonSchema(ToolSchemas.strapi_content_types_delete),
                    properties: {
                        ...zodToJsonSchema(ToolSchemas.strapi_content_types_delete).properties,
                        server: {
                            ...zodToJsonSchema(ToolSchemas.strapi_content_types_delete).properties.server,
                            description: "The name of the server to connect to"
                        },
                        uid: {
                            ...zodToJsonSchema(ToolSchemas.strapi_content_types_delete).properties.uid,
                            description: "The UID of the content type to delete (e.g., api::cat.cat)"
                        },
                        userAuthorized: {
                            ...zodToJsonSchema(ToolSchemas.strapi_content_types_delete).properties.userAuthorized,
                            description: "REQUIRED for deleting content types. Client MUST obtain explicit user authorization before setting this to true. WARNING: This will delete all data.",
                            default: false
                        }
                    }
                },
            }
        ],
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const requestId = logger.generateRequestId();
    const startTime = Date.now();
    
    logger.startRequest(requestId, name);
    
    let success = false;
    let result: any;
    
    try {
        if (name === "strapi_list_servers") {
            // Validate input using Zod
            const validatedArgs = validateToolInput("strapi_list_servers", args, requestId);
            if (Object.keys(config).length === 0) {
                const exampleConfig = {
                    "myserver": {
                        "api_url": "http://localhost:1337",
                        "api_key": "your-jwt-token-from-strapi-admin",
                        "version": "5.*"
                    }
                };

                result = {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                error: "No servers configured",
                                help: {
                                    message: "No server configuration found. Please create a configuration file.",
                                    config_path: CONFIG_PATH,
                                    example_config: exampleConfig,
                                    setup_steps: [
                                        "Create the .mcp directory: mkdir -p ~/.mcp",
                                        "Create the config file: touch ~/.mcp/strapi-mcp-server.config.json",
                                        "Add your server configuration using the example above",
                                        "Get your JWT token from Strapi Admin Panel > Settings > API Tokens",
                                        "Make sure the file permissions are secure: chmod 600 ~/.mcp/strapi-mcp-server.config.json"
                                    ]
                                }
                            }, null, 2),
                        },
                    ],
                };
            }

            const servers = Object.keys(config).map(serverName => {
                const serverConfig = config[serverName];
                const version = serverConfig.version || "v4"; // Default to v4 if not specified

                // Extract major version from different formats: "5.*", "4.1.5", "v4", "4.*"
                let majorVersion: keyof StrapiVersionDifferences;
                if (version.includes('*')) {
                    // Handle "5.*" or "4.*" format
                    majorVersion = version.split('.')[0] as keyof StrapiVersionDifferences;
                } else if (version.startsWith('v')) {
                    // Handle "v4" or "v5" format
                    majorVersion = version.substring(1) as keyof StrapiVersionDifferences;
                } else {
                    // Handle "4.1.5" or plain "4" format
                    majorVersion = version.split('.')[0] as keyof StrapiVersionDifferences;
                }

                return {
                    name: serverName,
                    api_url: serverConfig.api_url,
                    version: serverConfig.version,
                    version_details: STRAPI_VERSION_DIFFERENCES[majorVersion]
                };
            });

            result = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            servers,
                            config_path: CONFIG_PATH,
                            help: "To add more servers, edit the configuration file at the path shown above.",
                            version_differences: STRAPI_VERSION_DIFFERENCES,
                            user_action_required: {
                                message: "Please specify which server you want to work with by providing the server name in your next command.",
                                example: "For example: 'I want to work with the server \"myserver\"' or 'Use server \"myserver\" for the next operations'",
                                available_servers: servers.map(s => s.name),
                                warning: "Only use servers that are listed in available_servers. Do not attempt to access servers that are not properly configured."
                            },
                            security: {
                                note: "For security reasons, only servers listed in the configuration file can be accessed.",
                                requirement: "Each server must be properly configured with valid credentials before use."
                            }
                        }, null, 2),
                    },
                ],
            };
        } else if (name === "strapi_get_content_types") {
            // Validate input using Zod
            const validatedArgs = validateToolInput("strapi_get_content_types", args, requestId);
            const { server } = validatedArgs;
            logger.startRequest(requestId, name, server);
            const data = await makeStrapiRequest(server, "/content-type-builder/content-types", undefined, requestId);

            // Add helpful usage information to the response
            const response = {
                data: data,
                usage_guide: {
                    naming_conventions: {
                        rest_api: "Use pluralName for REST API endpoints (e.g., 'api/articles' for pluralName: 'articles')",
                        graphql: {
                            collections: "Use pluralName for collections (e.g., 'query { articles { data { id } } }')",
                            single_items: "Use singularName for single items (e.g., 'query { article(id: 1) { data { id } } }')"
                        }
                    },
                    examples: {
                        rest: {
                            collection: "GET /api/{pluralName}",
                            single: "GET /api/{pluralName}/{id}",
                            create: "POST /api/{pluralName}",
                            update: "PUT /api/{pluralName}/{id}",
                            delete: "DELETE /api/{pluralName}/{id}"
                        },
                        graphql: {
                            collection: "query { pluralName(pagination: { page: 1, pageSize: 100 }) { data { id attributes } } }",
                            single: "query { singularName(id: 1) { data { id attributes } } }",
                            create: "mutation { createPluralName(data: { field: value }) { data { id } } }",
                            update: "mutation { updatePluralName(id: 1, data: { field: value }) { data { id } } }"
                        }
                    },
                    important_notes: [
                        "Always check singularName and pluralName in the schema for correct endpoint/query names",
                        "REST endpoints always start with 'api/'",
                        "Include pagination in GraphQL collection queries",
                        "For updates, always fetch current data first and include ALL fields in the update"
                    ]
                }
            };

            result = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response, null, 2),
                    },
                ],
            };
        } else if (name === "strapi_get_components") {
            // Validate input using Zod (with defaults applied)
            const validatedArgs = validateToolInput("strapi_get_components", args, requestId);
            const { server, page, pageSize } = validatedArgs;
            logger.startRequest(requestId, name, server);
            const params = {
                'pagination[page]': page.toString(),
                'pagination[pageSize]': pageSize.toString(),
            };

            const data = await makeStrapiRequest(server, "/api/content-type-builder/components", params, requestId);

            // Add pagination metadata to the response
            const response = {
                data: data,
                pagination: {
                    page,
                    pageSize,
                    total: data.length,
                    pageCount: Math.ceil(data.length / pageSize),
                },
            };

            result = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response, null, 2),
                    },
                ],
            };
        } else if (name === "strapi_rest") {
            // Validate input using Zod (includes authorization check)
            const validatedArgs = validateToolInput("strapi_rest", args, requestId);
            const { server, endpoint, method, params, body, userAuthorized } = validatedArgs;
            logger.startRequest(requestId, name, server);

            const data = await makeRestRequest(server, endpoint, method, params, body, userAuthorized, requestId);
            result = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(data, null, 2),
                    },
                ],
            };
        } else if (name === "strapi_upload_media") {
            // Validate input using Zod (includes authorization check)
            const validatedArgs = validateToolInput("strapi_upload_media", args, requestId);
            const { server, url, format, quality, metadata, userAuthorized } = validatedArgs;
            logger.startRequest(requestId, name, server);

            // Extract filename from URL
            const fileName = url.split('/').pop() || 'image';

            // Download the image
            const imageBuffer = await downloadImage(url);

            // Process the image if format conversion is requested
            const processedBuffer = await processImage(imageBuffer, format, quality);

            // Upload to Strapi with metadata (with authorization check)
            const data = await uploadMedia(server, processedBuffer, fileName, format, metadata, userAuthorized, requestId);

            // Format response with helpful usage information
            const response = {
                success: true,
                data: data,
                image_info: {
                    format: format === 'original' ? 'original (unchanged)' : format,
                    quality: format === 'original' ? 'original (unchanged)' : quality,
                    filename: data[0].name,
                    size: data[0].size,
                    mime: data[0].mime
                },
                usage_guide: {
                    file_id: data[0].id,
                    url: data[0].url,
                    how_to_use: {
                        rest_api: "Use the file ID in your content type's media field",
                        graphql: "Use the file ID in your GraphQL mutations",
                        examples: {
                            rest: "PUT /api/content-type/1 with body: { data: { image: " + data[0].id + " } }",
                            graphql: "mutation { updateContentType(id: 1, data: { image: " + data[0].id + " }) { data { id } } }"
                        }
                    }
                }
            };

            result = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response, null, 2)
                    }
                ]
            };
        } else if (name === "strapi_content_types_get_all") {
            // Validate input using Zod
            const validatedArgs = validateToolInput("strapi_content_types_get_all", args, requestId);
            const { server } = validatedArgs;
            logger.startRequest(requestId, name, server);
            const data = await makeStrapiRequest(server, "/content-type-builder/content-types", undefined, requestId);

            result = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            data: data,
                            note: "返回所有表结构，包括系统表"
                        }, null, 2),
                    },
                ],
            };
        } else if (name === "strapi_content_types_get_one") {
            // Validate input using Zod
            const validatedArgs = validateToolInput("strapi_content_types_get_one", args, requestId);
            const { server, uid } = validatedArgs;
            logger.startRequest(requestId, name, server);
            const data = await makeStrapiRequest(server, `/content-type-builder/content-types/${uid}`, undefined, requestId);

            result = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            data: data,
                            note: `获取到表 ${uid} 的详细结构`
                        }, null, 2),
                    },
                ],
            };
        } else if (name === "strapi_content_types_create") {
            // Validate input using Zod (includes authorization check)
            const validatedArgs = validateToolInput("strapi_content_types_create", args, requestId);
            const { server, contentType, userAuthorized } = validatedArgs;
            logger.startRequest(requestId, name, server);

            const data = await makeRestRequest(
                server, 
                "content-type-builder/content-types", 
                "POST", 
                undefined, 
                { contentType }, 
                userAuthorized, 
                requestId
            );
            
            // Wait for Strapi to restart
            const restarted = await waitForStrapiRestart(server);

            result = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            data: data,
                            note: "新表创建成功",
                            serverRestarted: restarted,
                            warning: "Strapi server has restarted to apply schema changes."
                        }, null, 2),
                    },
                ],
            };
        } else if (name === "strapi_content_types_update") {
            // Validate input using Zod (includes authorization check)
            const validatedArgs = validateToolInput("strapi_content_types_update", args, requestId);
            const { server, uid, contentType, userAuthorized } = validatedArgs;
            logger.startRequest(requestId, name, server);

            const data = await makeRestRequest(
                server, 
                `content-type-builder/content-types/${uid}`, 
                "PUT", 
                undefined, 
                { contentType }, 
                userAuthorized, 
                requestId
            );

            // Wait for Strapi to restart
            const restarted = await waitForStrapiRestart(server);

            result = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            data: data,
                            note: `表 ${uid} 更新成功，已全量覆盖旧结构`,
                            serverRestarted: restarted,
                            warning: "Strapi server has restarted to apply schema changes."
                        }, null, 2),
                    },
                ],
            };
        } else if (name === "strapi_content_types_delete") {
            // Validate input using Zod (includes authorization check)
            const validatedArgs = validateToolInput("strapi_content_types_delete", args, requestId);
            const { server, uid, userAuthorized } = validatedArgs;
            logger.startRequest(requestId, name, server);

            const data = await makeRestRequest(
                server, 
                `content-type-builder/content-types/${uid}`, 
                "DELETE", 
                undefined, 
                undefined, 
                userAuthorized, 
                requestId
            );

            // Wait for Strapi to restart
            const restarted = await waitForStrapiRestart(server);

            result = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            data: data,
                            warning: `表 ${uid} 及其所有数据已被删除。Strapi server has restarted.`,
                            serverRestarted: restarted
                        }, null, 2),
                    },
                ],
            };
        } else if (name === "strapi_content_types_batch") {
            const validatedArgs = validateToolInput("strapi_content_types_batch", args, requestId);
            const { server, actions, userAuthorized } = validatedArgs;
            logger.startRequest(requestId, name, server);

            const results = [];
            for (const action of actions) {
                try {
                    let data;
                    if (action.action === "create") {
                        if (!action.contentType) throw new Error("contentType required for create");
                        data = await makeRestRequest(server, "content-type-builder/content-types", "POST", undefined, { contentType: action.contentType }, userAuthorized, requestId);
                    } else if (action.action === "update") {
                        if (!action.uid || !action.contentType) throw new Error("uid and contentType required for update");
                        data = await makeRestRequest(server, `content-type-builder/content-types/${action.uid}`, "PUT", undefined, { contentType: action.contentType }, userAuthorized, requestId);
                    } else if (action.action === "delete") {
                        if (!action.uid) throw new Error("uid required for delete");
                        data = await makeRestRequest(server, `content-type-builder/content-types/${action.uid}`, "DELETE", undefined, undefined, userAuthorized, requestId);
                    }
                    
                    // Wait for restart after every modifying action
                    const restarted = await waitForStrapiRestart(server);
                    results.push({ 
                        action: action.action, 
                        uid: action.uid, 
                        success: true, 
                        data,
                        serverRestarted: restarted 
                    });
                    
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    results.push({ action: action.action, uid: action.uid, success: false, error: errorMsg });
                    // Continue to next action? 
                    // Probably safer to stop or continue. Let's continue but log it.
                    logger.error(`Batch action failed: ${action.action} ${action.uid}`, { error: errorMsg });
                }
            }

            result = {
                content: [{
                    type: "text",
                    text: JSON.stringify({ 
                        success: true, 
                        results, 
                        note: "Batch processing complete. Server restarts were handled." 
                    }, null, 2)
                }]
            };
        } else {
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
        
        success = true;
        return result;
    } catch (error: unknown) {
        const duration = Date.now() - startTime;
        logger.endRequest(requestId, false, error instanceof Error ? error : undefined);
        logger.logToolExecution(name, args, requestId, duration, false, error instanceof Error ? error : undefined);
        
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${errorMessage}`,
                },
            ],
        };
    } finally {
        if (success) {
            const duration = Date.now() - startTime;
            logger.endRequest(requestId, true);
            logger.logToolExecution(name, args, requestId, duration, true);
        }
    }
});

// Enhanced REST request function
async function makeRestRequest(
    serverName: string,
    endpoint: string,
    method: string = 'GET',
    params?: Record<string, any>,
    body?: Record<string, any>,
    userAuthorized: boolean = false,
    requestId?: string
): Promise<any> {
    // Check for write operations that require explicit user authorization
    if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && !userAuthorized) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `AUTHORIZATION REQUIRED: ${method} operations require explicit user authorization.\n\n` +
            `IMPORTANT: The client MUST:\n` +
            `1. Ask the user for explicit permission before making this request\n` +
            `2. Show the user exactly what data will be modified\n` +
            `3. Receive clear confirmation from the user\n` +
            `4. Set userAuthorized=true when making the request\n\n` +
            `This is a security measure to prevent unauthorized data modifications.`
        );
    }

    // Determine auth type based on endpoint
    const useAdminAuth = endpoint.startsWith('content-type-builder') || endpoint.startsWith('admin/');
    const serverConfig = await getServerConfig(serverName, useAdminAuth);
    let url = `${serverConfig.API_URL}/${endpoint}`;

    // Parse query parameters if provided
    if (params) {
        const queryString = qs.stringify(params, {
            encodeValuesOnly: true
        });
        if (queryString) {
            url = `${url}?${queryString}`;
        }
    }

    const headers = {
        'Authorization': `Bearer ${serverConfig.JWT}`,
        'Content-Type': 'application/json',
    };

    const requestOptions: RequestInit = {
        method,
        headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
        requestOptions.body = JSON.stringify(body);
    }

    const startTime = Date.now();
    
    logger.debug(`Making REST request to Strapi`, {
        requestId,
        server: serverName,
        endpoint,
        method,
        hasParams: !!params,
        hasBody: !!body,
        userAuthorized,
        url: url.replace(serverConfig.JWT, '[REDACTED]')
    });

    try {
        const response = await fetch(url, requestOptions);
        const duration = Date.now() - startTime;
        
        logger.logApiCall(
            requestId || 'unknown',
            method,
            endpoint,
            duration,
            response.status,
            serverName
        );
        
        return await handleStrapiError(response, `REST request to ${endpoint}`, requestId);
    } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error(`REST request to ${endpoint} failed`, {
            requestId,
            server: serverName,
            endpoint,
            method,
            duration,
            errorType: error instanceof Error ? error.constructor.name : typeof error
        }, error instanceof Error ? error : undefined);
        
        throw error;
    }
}

// Update error handler to be more generic and helpful
async function handleStrapiError(response: Response, context: string, requestId?: string): Promise<any> {
    if (!response.ok) {
        let errorMessage = `${context} failed with status: ${response.status}`;
        let errorData: any = null;
        
        try {
            errorData = await response.json() as any;
            if (errorData && typeof errorData === 'object' && 'error' in errorData) {
                errorMessage += ` - ${errorData.error?.message || JSON.stringify(errorData.error)}`;

                // Add helpful hints based on status
                if (response.status === 400) {
                    errorMessage += "\nHINT: Check the request structure matches Strapi's expectations. For v4/v5 differences, refer to Strapi's migration guide.";
                } else if (response.status === 404) {
                    errorMessage += "\nHINT: Check the endpoint path and ID are correct.";
                }
            }
        } catch {
            errorMessage += ` - ${response.statusText}`;
        }
        
        logger.error(`Strapi API error: ${context}`, {
            requestId,
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            errorData: errorData,
            context
        });
        
        throw new McpError(ErrorCode.InternalError, errorMessage);
    }
    
    logger.debug(`Strapi API success: ${context}`, {
        requestId,
        status: response.status,
        url: response.url
    });
    
    return response.json();
}

// Start the server
async function main() {
    try {
        logger.info("Starting Strapi MCP Server", {
            version: "2.7.1",
            configuredServers: Object.keys(config).length,
            logLevel: LogLevel[logger.getConfig().level]
        });
        
        const transport = new StdioServerTransport();
        await server.connect(transport);
        
        logger.info("Strapi MCP Server started successfully", {
            transport: "stdio",
            hasCapabilities: true
        });
        
        // Use stderr for compatibility message (not stdout which interferes with MCP protocol)
        process.stderr.write("Strapi MCP Server running on stdio\n");
    } catch (error) {
        logger.error("Failed to start Strapi MCP Server", {
            errorType: error instanceof Error ? error.constructor.name : typeof error
        }, error instanceof Error ? error : undefined);
        throw error;
    }
}

main().catch((error: unknown) => {
    logger.error("Fatal error in main()", {
        errorType: error instanceof Error ? error.constructor.name : typeof error
    }, error instanceof Error ? error : undefined);
    process.exit(1);
}); 