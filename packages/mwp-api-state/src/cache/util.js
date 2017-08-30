// @flow
/**
 * This function performs feature sniffing to determine whether the preferred
 * IndexedDB cache is available, otherwise it falls back to a simple
 * plain-object-based cache that will only survive as long as the request.
 *
 * The cache object methods are thin wrappers around their IndexedDB
 * ObjectStore equivalents
 *
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore}
 *
 * @returns {Object} an object with Promise-based `get`, `set`, `delete`, and
 * `clear` methods
 */
type Cache = {
	get: string => Promise<QueryResponse>,
	set: (string, QueryResponse) => Promise<true>,
	delete: string => Promise<true>,
	clear: () => Promise<true>,
};
export function makeCache(): Cache {
	if (typeof window === 'undefined' || !window.indexedDB) {
		const _data = {};
		return {
			get(key) {
				return Promise.resolve(_data[key]);
			},
			set(key, val) {
				_data[key] = val;
				return Promise.resolve(true);
			},
			delete(key) {
				delete _data[key];
				return Promise.resolve(true);
			},
			clear() {
				Object.keys(_data).forEach(key => delete _data[key]);
				return Promise.resolve(true);
			},
		};
	}

	return require('idb-keyval');
}

/**
 * Generates a function that can read queries and return hits in the supplied cache
 *
 * @param {Object} cache the persistent cache containing query-able data
 * @param {Object} query query for app data
 * @return {Promise} resolves with cache hit, otherwise rejects
 */
export const cacheReader = (cache: Cache) => (
	query: Query
): Promise<QueryState> =>
	cache
		.get(JSON.stringify(query))
		.then((response: QueryResponse) => ({ query, response }))
		.catch(err => ({ query, response: null })); // errors don't matter - just return null

/**
 * Generates a function that can write query-response values into cache
 *
 * @param {Object} cache the persistent cache containing query-able data
 * @param {Object} query query for app data
 * @param {Object} response plain object API response for the query
 * @return {Promise}
 */
export const cacheWriter = (cache: Cache) => (
	query: Query,
	response: QueryResponse
) => {
	const method = (query.meta || {}).method || 'get';
	if (method.toLowerCase() !== 'get') {
		return Promise.resolve(true);
	}
	return cache.set(JSON.stringify(query), response);
};
