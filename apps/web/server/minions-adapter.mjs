/**
 * Minions Adapter for Mission Control Express Server.
 * 
 * Provides CRUD operations using the Minions SDK with YamlFileStorageAdapter.
 * Uses directoryMode: true for multi-file per UUID support.
 * 
 * Usage:
 *   import { initMinions, createMinion, listByType } from './minions-adapter.mjs';
 *   await initMinions('/path/to/.minions');
 *   const task = await createMinion('mc-task', { title: 'My Task', ... });
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
        description: 'Index entry pointing to a disk-based project',
        icon: '🚀',
        schema: [
            { name: 'path', type: 'string', label: 'path' },
            { name: 'yamlPath', type: 'string', label: 'yamlPath' },
            { name: 'accountsPath', type: 'string', label: 'accountsPath' },
            { name: 'lastSyncedAt', type: 'date', label: 'lastSyncedAt' },
            { name: 'syncStatus', type: 'select', label: 'syncStatus', options: ['synced', 'orphaned', 'new'] },
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
            { name: 'projectPath', type: 'string', label: 'projectPath' },
            { name: 'taskType', type: 'select', label: 'taskType', options: ['feature', 'bug', 'chore', 'research', 'infra'] },
            { name: 'effort', type: 'select', label: 'effort', options: ['XS', 'S', 'M', 'L', 'XL'] },
            { name: 'dueDate', type: 'date', label: 'dueDate' },
            { name: 'isTop3Today', type: 'boolean', label: 'isTop3Today' },
            { name: 'githubIssueUrl', type: 'string', label: 'githubIssueUrl' },
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
        id: 'bundle-content-contentPlan',
        name: 'ContentPlan',
        slug: 'contentPlan',
        description: 'A release-based content plan with items',
        icon: '📋',
        schema: [
            { name: 'projectPath', type: 'string', label: 'projectPath' },
            { name: 'releaseTag', type: 'string', label: 'releaseTag' },
            { name: 'releaseTitle', type: 'string', label: 'releaseTitle' },
            { name: 'releaseNotes', type: 'textarea', label: 'releaseNotes' },
            { name: 'releaseDate', type: 'date', label: 'releaseDate' },
            { name: 'items', type: 'textarea', label: 'items' }, // JSON array of content items
        ],
    },
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

// Workflow Bundle
const workflowTypes = [
    {
        id: 'bundle-workflow-workflow',
        name: 'MCWorkflow',
        slug: 'mc-workflow',
        description: 'A reusable workflow with ordered steps',
        icon: '🔄',
        schema: [
            { name: 'category', type: 'select', label: 'category', options: ['project-setup', 'content-loop', 'daily-routine', 'blog-posting', 'content-generation', 'update-cycle', 'custom'] },
            { name: 'steps', type: 'textarea', label: 'steps' }, // JSON array [{id,title,description,order,done}]
            { name: 'linkedProjects', type: 'tags', label: 'linkedProjects' },
            { name: 'isTemplate', type: 'boolean', label: 'isTemplate' },
            { name: 'schedule', type: 'string', label: 'schedule' }, // cron expression or null
            { name: 'lastRunAt', type: 'date', label: 'lastRunAt' },
        ],
    },
];

// Ideas / Brainstorming Bundle
const mcIdeaTypes = [
    {
        id: 'bundle-mcidea-idea',
        name: 'MCIdea',
        slug: 'mc-idea',
        description: 'A brainstorming idea with potential score',
        icon: '💡',
        schema: [
            { name: 'body', type: 'textarea', label: 'body' },
            { name: 'category', type: 'select', label: 'category', options: ['product', 'feature', 'content', 'business', 'research', 'experiment', 'other'] },
            { name: 'score', type: 'number', label: 'score' }, // 1-10 potential
            { name: 'linkedIdeas', type: 'tags', label: 'linkedIdeas' },
            { name: 'linkedProjects', type: 'tags', label: 'linkedProjects' },
            { name: 'archived', type: 'boolean', label: 'archived' },
        ],
    },
];

// Standards / Wiki Bundle
const wikiTypes = [
    {
        id: 'bundle-wiki-article',
        name: 'MCWikiArticle',
        slug: 'mc-wiki-article',
        description: 'A knowledge base article or standard',
        icon: '📖',
        schema: [
            { name: 'body', type: 'textarea', label: 'body' }, // markdown
            { name: 'category', type: 'select', label: 'category', options: ['standard', 'pattern', 'knowhow', 'setup-guide', 'coding-pattern', 'reference', 'checklist'] },
            { name: 'scope', type: 'select', label: 'scope', options: ['frontend', 'backend', 'devops', 'design', 'general'] },
            { name: 'relatedArticles', type: 'tags', label: 'relatedArticles' },
            { name: 'linkedProjects', type: 'tags', label: 'linkedProjects' },
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
    ...workflowTypes,
    ...mcIdeaTypes,
    ...wikiTypes,
];

// ─── Initialization ─────────────────────────────────────────────────────────

/** @type {Minions | null} */
let mc = null;

/** @type {TypeRegistry | null} */
let registry = null;

/**
 * Initialize the Minions client with YamlFileStorageAdapter.
 * Uses directoryMode for multi-file per UUID support.
 * @param {string} rootDir - Path to the .minions data directory
 */
export async function initMinions(rootDir) {
    const storage = await YamlFileStorageAdapter.create(rootDir, {
        directoryMode: true,
    });

    registry = new TypeRegistry();
    for (const t of ALL_TYPES) {
        registry.register(t);
    }

    mc = new Minions({ storage });

    // Register types with the client's internal registry too
    for (const t of ALL_TYPES) {
        mc.registry.register(t);
    }

    console.log(`📦 Minions initialized: ${ALL_TYPES.length} types, root=${rootDir}, directoryMode=true`);
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
 * Check if Minions is ready.
 * @returns {boolean}
 */
export function isMinionsReady() {
    return mc !== null;
}

/**
 * Get the TypeRegistry.
 * @returns {TypeRegistry}
 */
export function getRegistry() {
    if (!registry) throw new Error('Minions not initialized. Call initMinions() first.');
    return registry;
}

// ─── CRUD Helpers ───────────────────────────────────────────────────────────

/**
 * List all minions of a given type slug.
 * @param {string} typeSlug - e.g. 'mc-task', 'contentPlan', 'expense'
 */
export async function listByType(typeSlug) {
    const client = getMinions();
    const type = getRegistry().getBySlug(typeSlug);
    if (!type) throw new Error(`Unknown type: ${typeSlug}`);
    const all = await client.listMinions({ minionTypeId: type.id });
    // SDK filter is unreliable — post-filter by minionTypeId
    return all.filter(m => m.minionTypeId === type.id);
}

/**
 * Create a new minion of the given type.
 * @param {string} typeSlug - e.g. 'mc-task'
 * @param {object} data - { title, description, status, priority, tags, ...fields }
 * @returns {object} flat minion object
 */
export async function createMinion(typeSlug, data) {
    const client = getMinions();
    const type = getRegistry().getBySlug(typeSlug);
    if (!type) throw new Error(`Unknown type: ${typeSlug}`);

    const { title, description, status, priority, tags, ...fields } = data;
    const wrapper = await client.create(typeSlug, {
        title: title || 'Untitled',
        description: description || '',
        status: status || 'active',
        priority: priority || 'medium',
        tags: Array.isArray(tags) ? tags : [],
        fields,
    });
    await client.save(wrapper.data);

    return minionToFlat(wrapper.data);
}

/**
 * Get a single minion by ID.
 * @param {string} id - Minion UUID
 * @returns {object|null} flat minion object
 */
export async function getMinion(id) {
    const client = getMinions();
    try {
        const minion = await client.load(id);
        return minion ? minionToFlat(minion) : null;
    } catch { return null; }
}

/**
 * Update a minion by ID.
 * @param {string} id - Minion UUID
 * @param {object} updates - Partial update data
 * @returns {object} updated flat minion
 */
export async function updateMinion(id, updates) {
    const client = getMinions();
    const existing = await client.load(id);
    if (!existing) throw new Error(`Minion not found: ${id}`);

    const { title, description, status, priority, tags, ...fields } = updates;

    const patch = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (status !== undefined) patch.status = status;
    if (priority !== undefined) patch.priority = priority;
    if (tags !== undefined) patch.tags = tags;
    if (Object.keys(fields).length > 0) patch.fields = fields;

    const wrapper = await client.update(existing, patch);
    await client.save(wrapper.data);
    return minionToFlat(wrapper.data);
}

/**
 * Delete a minion by ID.
 * @param {string} id - Minion UUID
 */
export async function deleteMinion(id) {
    const client = getMinions();
    const existing = await client.load(id);
    if (!existing) throw new Error(`Minion not found: ${id}`);
    await client.remove(existing);
}

/**
 * Convert a Minion to a flat object for API responses (merges fields + meta).
 * @param {import('minions-sdk').Minion} minion
 */
export function minionToFlat(minion) {
    return {
        id: minion.id,
        type: minion.minionTypeId,
        minionTypeId: minion.minionTypeId,
        name: minion.title,
        title: minion.title,
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
