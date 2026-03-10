/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as aiChat from "../aiChat.js";
import type * as aiConfig from "../aiConfig.js";
import type * as aiLogs from "../aiLogs.js";
import type * as aiPersonas from "../aiPersonas.js";
import type * as aiVoice from "../aiVoice.js";
import type * as aiVoiceConfig from "../aiVoiceConfig.js";
import type * as auth from "../auth.js";
import type * as chatSessions from "../chatSessions.js";
import type * as chatbots from "../chatbots.js";
import type * as content from "../content.js";
import type * as costs from "../costs.js";
import type * as focusGroups from "../focusGroups.js";
import type * as github from "../github.js";
import type * as http from "../http.js";
import type * as ideas from "../ideas.js";
import type * as marketing from "../marketing.js";
import type * as minionsStorage from "../minionsStorage.js";
import type * as organizations from "../organizations.js";
import type * as projects from "../projects.js";
import type * as seed from "../seed.js";
import type * as tasks from "../tasks.js";
import type * as webhooks from "../webhooks.js";
import type * as wiki from "../wiki.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  aiChat: typeof aiChat;
  aiConfig: typeof aiConfig;
  aiLogs: typeof aiLogs;
  aiPersonas: typeof aiPersonas;
  aiVoice: typeof aiVoice;
  aiVoiceConfig: typeof aiVoiceConfig;
  auth: typeof auth;
  chatSessions: typeof chatSessions;
  chatbots: typeof chatbots;
  content: typeof content;
  costs: typeof costs;
  focusGroups: typeof focusGroups;
  github: typeof github;
  http: typeof http;
  ideas: typeof ideas;
  marketing: typeof marketing;
  minionsStorage: typeof minionsStorage;
  organizations: typeof organizations;
  projects: typeof projects;
  seed: typeof seed;
  tasks: typeof tasks;
  webhooks: typeof webhooks;
  wiki: typeof wiki;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
