// ---------------------------------------------------------------------------
// container.js — Lightweight Dependency Injection Container
// ---------------------------------------------------------------------------
// Provides transient resolution, singleton caching, optional child scopes,
// and descriptive errors for missing registrations or circular dependencies.
//
// Exports: register, registerInstance, resolve, createScope (as named exports)
// ---------------------------------------------------------------------------

/** @type {Map<string, { factory: Function, dependencies: string[] }>} */
const registry = new Map();

/** @type {Map<string, *>} */
const instances = new Map();

/** @type {Set<string>} */
const resolving = new Set();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a transient factory with named dependencies.
 * Each call to {@link resolve} will create a **new** instance and cache it as
 * a singleton – further resolutions return the same cached value.  For true
 * per-request transience use a child scope created via {@link createScope}.
 *
 * @param {string} name          - Unique key used to resolve this dependency.
 * @param {Function} factory      - Factory function invoked as
 *                                  `factory(...resolvedDeps)`.  Must return
 *                                  the fully constructed instance.
 * @param {string[]} [dependencies=[]] - Names of other registrations this
 *                                       factory depends on (resolved in order).
 * @throws {Error} If `name` is already registered.
 */
export function register(name, factory, dependencies = []) {
  if (registry.has(name)) {
    throw new Error(
      `[Container] "${name}" is already registered. ` +
        `Use a different name or un-register the existing entry first.`
    );
  }
  registry.set(name, { factory, dependencies });
  // Clear any singleton cache so a fresh factory is used on next resolve.
  instances.delete(name);
}

/**
 * Register a pre-created instance directly (e.g. an already-initialised
 * Supabase client).  Subsequent calls to {@link resolve} return this exact
 * object.
 *
 * @param {string} name - Unique key used to resolve this dependency.
 * @param {*} instance   - The object to store.
 * @throws {Error} If `name` is already registered as a factory.
 */
export function registerInstance(name, instance) {
  if (registry.has(name)) {
    throw new Error(
      `[Container] "${name}" is already registered as a factory. ` +
        `Call registerInstance before register, or use a different name.`
    );
  }
  instances.set(name, instance);
}

/**
 * Resolve a dependency by name.
 *
 * - If the dependency was registered via {@link registerInstance}, the stored
 *   instance is returned immediately.
 * - If registered via {@link register}, the factory is invoked (with its
 *   dependencies recursively resolved) **once** – the result is cached as a
 *   singleton for subsequent resolutions.
 *
 * @template T
 * @param {string} name - The name of the dependency to resolve.
 * @returns {T} The fully resolved instance.
 * @throws {Error} If no registration exists for `name` or a circular
 *                 dependency is detected.
 */
export function resolve(name) {
  // 1. Instance already cached / registered directly?
  if (instances.has(name)) {
    return instances.get(name);
  }

  // 2. Factory registered?
  const entry = registry.get(name);
  if (!entry) {
    throw new Error(
      `[Container] "${name}" has not been registered. ` +
        `Did you forget to call register() or registerInstance()?`
    );
  }

  // 3. Circular-dependency guard
  if (resolving.has(name)) {
    const chain = [...resolving, name].join(' → ');
    throw new Error(`[Container] Circular dependency detected: ${chain}`);
  }

  // 4. Build
  resolving.add(name);
  try {
    const resolvedDeps = entry.dependencies.map((dep) => resolve(dep));
    const instance = entry.factory(...resolvedDeps);
    instances.set(name, instance);
    return instance;
  } finally {
    resolving.delete(name);
  }
}

/**
 * Create a **child** container that inherits all registrations from the
 * parent but maintains its own singleton cache.  Useful for short-lived
 * scopes (e.g. per-request or per-route).
 *
 * The child exposes the same API shape: `register`, `registerInstance`,
 * `resolve`, and `createScope`.  Registrations made on the child **do not**
 * affect the parent.
 *
 * @returns {{ register: Function, registerInstance: Function, resolve: Function, createScope: Function }}
 */
export function createScope() {
  // Create copies of the parent's registries *at this point in time* so
  // the scope is isolated.
  const parentRegistry = new Map(registry);
  const parentInstances = new Map(instances);

  // Export a closure-based child container with the same shape.
  return {
    register(name, factory, dependencies = []) {
      if (parentRegistry.has(name)) {
        throw new Error(
          `[Container:scope] "${name}" is already registered on the parent.`
        );
      }
      parentRegistry.set(name, { factory, dependencies });
      parentInstances.delete(name);
    },

    registerInstance(name, instance) {
      if (parentRegistry.has(name)) {
        throw new Error(
          `[Container:scope] "${name}" is already registered as a factory on the parent.`
        );
      }
      parentInstances.set(name, instance);
    },

    resolve(name) {
      // Reuse the same logic but operate on the scope-local maps
      return resolveInScope(name, parentRegistry, parentInstances, new Set());
    },

    createScope() {
      // Scopes can nest further if needed
      return createScope.call({
        registry: parentRegistry,
        instances: parentInstances,
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolution logic scoped to a specific registry / instance map pair.
 *
 * @param {string} name
 * @param {Map} reg
 * @param {Map} inst
 * @param {Set<string>} resolvingSet
 * @returns {*}
 */
function resolveInScope(name, reg, inst, resolvingSet) {
  if (inst.has(name)) {
    return inst.get(name);
  }

  const entry = reg.get(name);
  if (!entry) {
    throw new Error(
      `[Container:scope] "${name}" has not been registered in this scope.`
    );
  }

  if (resolvingSet.has(name)) {
    const chain = [...resolvingSet, name].join(' → ');
    throw new Error(
      `[Container:scope] Circular dependency detected: ${chain}`
    );
  }

  resolvingSet.add(name);
  try {
    const resolvedDeps = entry.dependencies.map((dep) =>
      resolveInScope(dep, reg, inst, resolvingSet),
    );
    const instance = entry.factory(...resolvedDeps);
    inst.set(name, instance);
    return instance;
  } finally {
    resolvingSet.delete(name);
  }
}
