/**
 * Structured result contract shared by every fallible operation in Cadence.
 *
 * Callers never receive a bare `null` for a failure. They receive a payload
 * naming the component that failed, the class of failure, and the root cause,
 * so a bug report can be filed from the console output alone.
 */

/** @typedef {'network'|'parse'|'validation'|'storage'|'not-found'|'unsupported'|'internal'} FailureType */

/**
 * @template T
 * @typedef {{ ok: true, value: T }} Success
 */

/**
 * @typedef {{
 *   ok: false,
 *   error: {
 *     component: string,
 *     failureType: FailureType,
 *     rootCause: string,
 *     context?: Record<string, unknown>
 *   }
 * }} Failure
 */

/**
 * @template T
 * @param {T} value
 * @returns {Success<T>}
 */
export function ok(value) {
  return { ok: true, value };
}

/**
 * @param {string} component  Module or subsystem that failed, e.g. 'corpus.load'.
 * @param {FailureType} failureType
 * @param {string} rootCause  Human-readable cause, specific enough to act on.
 * @param {Record<string, unknown>} [context]
 * @returns {Failure}
 */
export function fail(component, failureType, rootCause, context) {
  return {
    ok: false,
    error: context ? { component, failureType, rootCause, context } : { component, failureType, rootCause },
  };
}

/**
 * Wraps a thrown exception into a Failure, preserving the message as root cause.
 *
 * @param {string} component
 * @param {FailureType} failureType
 * @param {unknown} err
 * @param {Record<string, unknown>} [context]
 * @returns {Failure}
 */
export function failFrom(component, failureType, err, context) {
  const rootCause = err instanceof Error ? err.message : String(err);
  return fail(component, failureType, rootCause, context);
}

/**
 * Renders a Failure as a single log line.
 *
 * @param {Failure} failure
 * @returns {string}
 */
export function formatFailure(failure) {
  const { component, failureType, rootCause } = failure.error;
  return `[${component}] ${failureType}: ${rootCause}`;
}
