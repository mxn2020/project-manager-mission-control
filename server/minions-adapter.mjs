/**
 * Minions Adapter for Mission Control Express Server.
 * 
 * Provides CRUD operations using the Minions SDK with YamlFileStorageAdapter.
 * MinionType definitions are inlined from the bundle SDKs.
 * 
 * Usage:
 *   import { initMinions, mc } from './minions-adapter.mjs';
 *   await initMinions('/path/to/.minions');
 *   const projects = await mc.listMinions({ type: 'bundle-portfolio-project' });
 */

import { Minions, TypeRegistry } from 'minions-sdk';
import { YamlFileStorageAdapter } from 'minions-sdk/node';

// ─── MinionType Definitions (from bundle SDKs) ─────────────────────────────

// Portfolio Bundle
const portfolioTypes = [
    {
        id: 'bundle-portfolio-category',
        name: 'Category',
        slug: 'category',
        description: 'High-level grouping mechanism',
        icon: '📁',
        schema: [
            { name: 'name', type: 'string', label: 'name' },
            { name: 'description', type: 'string', label: 'description' },
        ],
    },
    {
        id: 'bundle-portfolio-ecosystem',
        name: 'Ecosystem',
        slug: 'ecosystem',
        description: 'A collection of related projects',
        icon: '🌐',
        schema: [
            { name: 'name', type: 'string', label: 'name' },
            { name: 'categoryId', type: 'string', label: 'categoryId' },
            { name: 'description', type: 'string', label: 'description' },
        ],
    },
    {
        id: 'bundle-portfolio-project',
        name: 'Project',
        slug: 'project',
        description: 'A concrete implementation or initiative',
        icon: '🚀',
        schema: [
            { name: 'name', type: 'string', label: 'name' },
            { name: 'ecosystemId', type: 'string', label: 'ecosystemId' },
            { name: 'tier', type: 'select', label: 'tier', options: ['idea', 'prototype', 'building', 'shipped', 'maintaining', 'archived'] },
            { name: 'lane', type: 'string', label: 'lane' },
            { name: 'priority', type: 'select', label: 'priority', options: ['low', 'medium', 'high', 'critical'] },
            { name: 'stack', type: 'tags', label: 'stack' },
            { name: 'oss', type: 'boolean', label: 'oss' },
            { name: 'repoUrl', type: 'string', label: 'repoUrl' },
            { name: 'deployUrl', type: 'string', label: 'deployUrl' },
            { name: 'lastActive', type: 'date', label: 'lastActive' },
            { name: 'notes', type: 'textarea', label: 'notes' },
            { name: 'path', type: 'string', label: 'path' },
            { name: 'yamlPath', type: 'string', label: 'yamlPath' },
            { name: 'healthScore', type: 'number', label: 'healthScore' },
        ],
    },
];

// Execution Bundle (slug prefixed with 'mc-' to avoid collision with built-in 'task')
const executionTypes = [
    {
        id: 'bundle-execution-task',
        name: 'MCTask',
        slug: 'mc-task',
        description: 'Granular unit of work',
        icon: '✅',
        schema: [
            { name: 'projectId', type: 'string', label: 'projectId' },
            { name: 'targetDate', type: 'date', label: 'targetDate' },
            { name: 'isTop3Today', type: 'boolean', label: 'isTop3Today' },
        ],
    },
    {
        id: 'bundle-execution-dailySprint',
        name: 'DailySprint',
        slug: 'mc-dailySprint',
        description: 'A focused daily work session',
        icon: '🏃',
        schema: [
            { name: 'date', type: 'date', label: 'date' },
            { name: 'notes', type: 'textarea', label: 'notes' },
        ],
    },
];

// Content Bundle
const contentTypes = [
    {
        id: 'bundle-content-contentBrief',
        name: 'ContentBrief',
        slug: 'contentBrief',
        description: 'Instructions and goals for a new piece of content',
        icon: '📝',
        schema: [
            { name: 'topic', type: 'string', label: 'topic' },
            { name: 'targetAudience', type: 'string', label: 'targetAudience' },
            { name: 'keywords', type: 'tags', label: 'keywords' },
            { name: 'dueDate', type: 'date', label: 'dueDate' },
        ],
    },
    {
        id: 'bundle-content-draft',
        name: 'Draft',
        slug: 'draft',
        description: 'A work-in-progress piece of content',
        icon: '📄',
        schema: [
            { name: 'briefId', type: 'string', label: 'briefId' },
            { name: 'body', type: 'textarea', label: 'body' },
            { name: 'wordCount', type: 'number', label: 'wordCount' },
        ],
    },
    {
        id: 'bundle-content-channel',
        name: 'Channel',
        slug: 'channel',
        description: 'A distribution platform (blog, youtube, twitter)',
        icon: '📢',
        schema: [
            { name: 'name', type: 'string', label: 'name' },
            { name: 'url', type: 'string', label: 'url' },
        ],
    },
    {
        id: 'bundle-content-campaign',
        name: 'Campaign',
        slug: 'campaign',
        description: 'A marketing push grouping multiple pieces of content',
        icon: '🎯',
        schema: [
            { name: 'name', type: 'string', label: 'name' },
            { name: 'startDate', type: 'date', label: 'startDate' },
            { name: 'endDate', type: 'date', label: 'endDate' },
        ],
    },
];

// Finance Bundle
const financeTypes = [
    {
        id: 'bundle-finance-budget',
        name: 'Budget',
        slug: 'budget',
        description: 'Allocated funds for a specific period or project',
        icon: '🧮',
        schema: [
            { name: 'name', type: 'string', label: 'name' },
            { name: 'amount', type: 'number', label: 'amount' },
            { name: 'currency', type: 'string', label: 'currency' },
            { name: 'periodStart', type: 'date', label: 'periodStart' },
            { name: 'periodEnd', type: 'date', label: 'periodEnd' },
        ],
    },
    {
        id: 'bundle-finance-expense',
        name: 'Expense',
        slug: 'expense',
        description: 'A record of money spent',
        icon: '💳',
        schema: [
            { name: 'budgetId', type: 'string', label: 'budgetId' },
            { name: 'amount', type: 'number', label: 'amount' },
            { name: 'currency', type: 'string', label: 'currency' },
            { name: 'date', type: 'date', label: 'date' },
            { name: 'category', type: 'select', label: 'category', options: ['hosting', 'saas', 'api', 'domain', 'other'] },
            { name: 'receiptUrl', type: 'string', label: 'receiptUrl' },
        ],
    },
];

// Ideation Bundle
const ideationTypes = [
    {
        id: 'bundle-ideation-idea',
        name: 'Idea',
        slug: 'idea',
        description: 'An unstructured thought or brainstorm',
        icon: '💡',
        schema: [
            { name: 'rawNotes', type: 'textarea', label: 'rawNotes' },
        ],
    },
    {
        id: 'bundle-ideation-featureSpec',
        name: 'FeatureSpec',
        slug: 'featureSpec',
        description: 'A detailed requirement document for a specific feature',
        icon: '📝',
        schema: [
            { name: 'ideaId', type: 'string', label: 'ideaId' },
            { name: 'requirements', type: 'textarea', label: 'requirements' },
            { name: 'constraints', type: 'textarea', label: 'constraints' },
        ],
    },
    {
        id: 'bundle-ideation-roadmapDoc',
        name: 'RoadmapDoc',
        slug: 'roadmapDoc',
        description: 'A timeline and goal-oriented planning document',
        icon: '🗺️',
        schema: [
            { name: 'ideaId', type: 'string', label: 'ideaId' },
            { name: 'timeline', type: 'textarea', label: 'timeline' },
            { name: 'goals', type: 'textarea', label: 'goals' },
        ],
    },
];

// All types combined
const ALL_TYPES = [
    ...portfolioTypes,
    ...executionTypes,
    ...contentTypes,
    ...financeTypes,
    ...ideationTypes,
];

// ─── Initialization ─────────────────────────────────────────────────────────

/** @type {Minions | null} */
let mc = null;

/** @type {TypeRegistry | null} */
let registry = null;

/**
 * Initialize the Minions client with YamlFileStorageAdapter.
 * @param {string} rootDir - Path to the .minions data directory
 */
export async function initMinions(rootDir) {
    const storage = await YamlFileStorageAdapter.create(rootDir);

    registry = new TypeRegistry();
    for (const t of ALL_TYPES) {
        registry.register(t);
    }

    mc = new Minions({ storage });

    // Register types with the client's internal registry too
    for (const t of ALL_TYPES) {
        mc.registry.register(t);
    }

    console.log(`📦 Minions initialized: ${ALL_TYPES.length} types, root=${rootDir}`);
    return mc;
}

/**
 * Get the Minions client. Throws if not initialized.
 * @returns {Minions}
 */
export function getMinions() {
    if (!mc) throw new Error('Minions not initialized. Call initMinions() first.');
    return mc;
}

/**
 * Get the TypeRegistry.
 * @returns {TypeRegistry}
 */
export function getRegistry() {
    if (!registry) throw new Error('Minions not initialized. Call initMinions() first.');
    return registry;
}

// ─── Convenience Helpers ────────────────────────────────────────────────────

/**
 * List all minions of a given type slug.
 * @param {string} typeSlug - e.g. 'project', 'task', 'expense'
 */
export async function listByType(typeSlug) {
    const client = getMinions();
    const type = getRegistry().getBySlug(typeSlug);
    if (!type) throw new Error(`Unknown type: ${typeSlug}`);
    const all = await client.listMinions({ type: type.id });
    return all;
}

/**
 * Convert a Minion to a flat object for API responses (merges fields + meta).
 * @param {import('minions-sdk').Minion} minion
 */
export function minionToFlat(minion) {
    return {
        id: minion.id,
        name: minion.title,
        description: minion.description || '',
        status: minion.status || 'active',
        priority: minion.priority || 'medium',
        tags: minion.tags || [],
        createdAt: minion.createdAt,
        updatedAt: minion.updatedAt,
        ...minion.fields,
    };
}

/**
 * Convert a flat project object to Minion create input.
 * @param {object} flat - The flat project from PROJECT.yaml  
 * @param {string} typeSlug - The MinionType slug
 */
export function flatToMinionInput(flat, typeSlug) {
    // Separate core Minion fields from custom fields
    const { name, title, description, status, priority, tags, ...rest } = flat;
    return {
        title: name || title || 'Untitled',
        description: description || '',
        status: status || 'active',
        priority: priority || 'medium',
        tags: Array.isArray(tags) ? tags : [],
        fields: rest,
    };
}

// Export types for reference
export { ALL_TYPES, portfolioTypes, executionTypes, contentTypes, financeTypes, ideationTypes };
