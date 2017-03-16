/**
 * Utilities for interacting with the Router and getting location data
 * @module routeUtils
 */
import matchPath from 'react-router-dom/matchPath';

export const getNestedRoutes = ({ route, match }) =>
	match.isExact && route.indexRoute ?
		[route.indexRoute] :   // only render index route
		route.routes;          // pass along any defined nested routes

/**
 * find all routes from a given array of route config objects that match the
 * supplied `url`
 *
 * this function matches the signature of `react-router-config`'s `matchRoutes`
 * function, but interprets all `route.path` settings as nested
 *
 * @see {@link https://github.com/ReactTraining/react-router/tree/master/packages/react-router-config#matchroutesroutes-pathname}
 *
 * @param {Array} routes the routes to match
 * @param {String} url a URL path (no host) starting with `/`
 * @param {Array} matchedRoutes an array of [ route, match ] tuples
 * @param {String} matchedPath the part of the total path matched so far
 * @return {Array} an array of { route, match } objects
 */
export const matchRoutes = (routes=[], url='', matchedRoutes=[], matchedPath='') => {
	const route = routes.find(r => matchPath(url, `${matchedPath}${r.path || ''}`));  // take the first match
	if (!route) {
		return matchedRoutes;
	}

	// add the route and its `match` object to the array of matched routes
	const currentMatchedPath = `${matchedPath}${route.path || ''}`;
	const match = matchPath(url, currentMatchedPath);
	const currentMatchedRoutes = [ ...matchedRoutes, { route, match } ];

	// add any nested route matches
	const nestedRoutes = getNestedRoutes({ route, match }) || [];
	return matchRoutes(nestedRoutes, url, currentMatchedRoutes, currentMatchedPath);
};

/**
 * @param {Array} queries an array of query function results
 * @param {Object} matchedRoute a { route, match } object to inspect for query functions
 * @return {Array} an array of returned query objects
 */
export const matchedRouteQueriesReducer = (queries, { route, match }) => {
	if (!route.query) {
		return queries;
	}
	const routeQueryFns = route.query instanceof Array ?
		route.query :
		[route.query];

	const routeQueries = routeQueryFns
		.map(queryFn => queryFn(match))
		.filter(query => query);

	return [
		...queries,
		...routeQueries,
	];
};

/**
 * Get the queries from all currently-active routes at the requested url path
 * @param {Array} routes an array of route objects
 * @param {String} url the current URL path
 * @return {Array} the queries attached to the active routes
 */
export const activeRouteQueries = routes => url =>
	matchRoutes(routes, url).reduce(matchedRouteQueriesReducer, []);

