import JSCookie from 'js-cookie';
import cookie from 'cookie';
import rison from 'rison';


const BrowserCookies = JSCookie.withConverter({
	read: (value, name) => value,
	write: (value, name) =>
		encodeURIComponent(value)
			.replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16)}`),
});

/**
 * A module for middleware that would like to make external calls through `fetch`
 * @module fetchUtils
 */

export const CSRF_HEADER = 'x-csrf-jwt';
export const CSRF_HEADER_COOKIE = 'x-csrf-jwt-header';

export const parseQueryResponse = queries => ({ responses, error, message }) => {
	if (error) {
		throw new Error(JSON.stringify({ error, message }));  // treat like an API error
	}
	responses = responses || [];
	if (queries.length !== responses.length) {
		throw new Error('Responses do not match requests');
	}

	return responses.reduce((categorized, response, i) => {
		const targetArray = response.error ? categorized.errors : categorized.successes;
		targetArray.push({ response, query: queries[i] });
		return categorized;
	}, { successes: [], errors: [] });
};

/**
 * Wrapper around `fetch` to send an array of queries to the server. It ensures
 * that the request will have the required OAuth and CSRF credentials and constructs
 * the `fetch` call arguments based on the request method. It also records the
 * CSRF header value in a cookie for use as a CSRF header in future fetches.
 *
 * **IMPORTANT**: This function should _only_ be called from the browser. The
 * server should never need to call itself over HTTP
 *
 * @param {String} apiUrl the general-purpose endpoint for API calls to the
 *   application server
 * @param {Object} options {
 *     method: "get", "post", "delete", or "patch",
 *   }
 * @return {Promise} resolves with a `{queries, responses}` object
 */
export const fetchQueries = (apiUrl, options) => (queries, meta) => {
	if (
		typeof window === 'undefined' &&  // not in browser
		typeof test === 'undefined'  // not in testing env
	) {
		throw new Error('fetchQueries was called on server - cannot continue');
	}
	options.method = options.method || 'GET';
	const {
		method,
		headers={},
	} = options;

	const isPost = method.toLowerCase() === 'post';
	const isDelete = method.toLowerCase() === 'delete';

	const fetchUrl = new URL(apiUrl);
	fetchUrl.searchParams.append('queries', rison.encode_array(queries));

	if (meta) {
		const {
			clickTracking,
			logout,
			...metadata
		} = meta;
		BrowserCookies.set(
			'click-track',
			JSON.stringify(clickTracking),
			{ domain: '.meetup.com' }
		);

		// special logout param
		if (logout) {
			fetchUrl.searchParams.append('logout', true);
		}

		// send other metadata in searchParams
		fetchUrl.searchParams.append('metadata', rison.encode_object(metadata));

	}
	const fetchConfig = {
		method,
		headers: {
			...headers,
			'content-type': isPost ? 'application/x-www-form-urlencoded' : 'text/plain',
			[CSRF_HEADER]: (isPost || isDelete) ? BrowserCookies.get(CSRF_HEADER_COOKIE) : '',
		},
		credentials: 'same-origin'  // allow response to set-cookies
	};
	if (isPost) {
		fetchConfig.body = fetchUrl.searchParams.toString();
	}
	return fetch(
		isPost ? apiUrl : fetchUrl.toString(),
		fetchConfig
	)
	.then(queryResponse => queryResponse.json())
	.then(queryJSON => ({
		...parseQueryResponse(queries)(queryJSON),
	}))
	.catch(err => {
		console.error(JSON.stringify({
			err: err.stack,
			message: 'App server API fetch error',
			context: fetchConfig,
		}));
		throw err;  // handle the error upstream
	});
};

/**
 * Attempt to JSON parse a Response object from a fetch call
 *
 * @param {String} reqUrl the URL that was requested
 * @param {Response} response the fetch Response object
 * @return {Promise} a Promise that resolves with the JSON-parsed text
 */
export const tryJSON = reqUrl => response => {
	const { status, statusText } = response;
	if (status >= 400) {  // status always 200: bugzilla #52128
		return Promise.reject(
			new Error(`Request to ${reqUrl} responded with error code ${status}: ${statusText}`)
		);
	}
	return response.text().then(text => JSON.parse(text));
};

/**
 * Convert an object of cookie name-value pairs into a 'Cookie' header. This
 * is different than the serialization offered by the 'cookie' and
 * 'tough-cookie' packages, which write cookie values in the form of a
 * 'Set-Cookie' header, which contains more info
 *
 * @param {Object} cookies a name-value mapping of cookies, e.g. from
 *   `cookie.parse`
 * @return {String} a 'Cookie' header string
 */
export const stringifyCookies = cookies =>
	Object.keys(cookies)
		.map(name => `${name}=${cookies[name]}`)
		.join('; ');

/**
 * @param {String} rawCookieHeader a 'cookie' header string
 * @param {Object} newCookies an object of name-value cookies to inject
 */
export const mergeCookies = (rawCookieHeader, newCookies) => {
	// request.state has _parsed_ cookies, but we need to send raw cookies
	// _except_ when the incoming request has been back-populated with new 'raw' cookies
	const oldCookies = cookie.parse(rawCookieHeader);
	const mergedCookies = {
		...oldCookies,
		...newCookies,
	};
	return stringifyCookies(mergedCookies);
};

