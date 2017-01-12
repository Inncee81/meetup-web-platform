import Rx from 'rxjs';
import Boom from 'boom';
import chalk from 'chalk';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import RouterContext from 'react-router/lib/RouterContext';
import { useBasename } from 'history';
import match from 'react-router/lib/match';
import { Provider } from 'react-redux';

import { createServerStore } from '../util/createStore';
import Dom from '../components/dom';
import NotFound from '../components/NotFound';
import { polyfillNodeIntl } from '../util/localizationUtils';

import {
	configureApiUrl,
} from '../actions/configActionCreators';

// Ensure global Intl for use with FormatJS
polyfillNodeIntl();

const DOCTYPE = '<!DOCTYPE html>';

/**
 * An async module that renders the full app markup for a particular URL/location
 * using [ReactDOMServer]{@link https://facebook.github.io/react/docs/top-level-api.html#reactdomserver}
 *
 * @module ServerRender
 */

function getHtml(baseUrl, assetPublicPath, clientFilename, initialState={}, appMarkup='') {
	const htmlMarkup = ReactDOMServer.renderToString(
		<Dom
			baseUrl={baseUrl}
			assetPublicPath={assetPublicPath}
			clientFilename={clientFilename}
			initialState={initialState}
			appMarkup={appMarkup}
		/>
	);
	return `${DOCTYPE}${htmlMarkup}`;
}

/**
 * Using the current route information and Redux store, render the app to an
 * HTML string and server response code.
 *
 * There are three parts to the render:
 *
 * 1. `appMarkup`, which corresponds to the markup that will be rendered
 * on the client by React. This string is built before the full markup because
 * it sets the data needed by other parts of the DOM, such as `<head>`.
 * 2. `htmlMarkup`, which wraps `appMarkup` with the remaining DOM markup.
 * 3. `doctype`, which is just the doctype element that is a sibling of `<html>`
 *
 * @param {Object} renderProps
 * @param {ReduxStore} store the store containing the initial state of the app
 * @return {Object} the statusCode and result used by Hapi's `reply` API
 *   {@link http://hapijs.com/api#replyerr-result}
 */
const getRouterRenderer = (store, baseUrl, clientFilename, assetPublicPath) =>
	([ redirectLocation, renderProps ]) => {
		// pre-render the app-specific markup, this is the string of markup that will
		// be managed by React on the client.
		//
		// **IMPORTANT**: this string is built separately from `<Dom />` because it
		// initializes page-specific state that `<Dom />` needs to render, e.g.
		// `<head>` contents
		const initialState = store.getState();
		let appMarkup;
		let result;
		let statusCode;

		try {
			renderProps.router.history = useBasename(() => renderProps.router.history)({ basename: baseUrl });
			appMarkup = ReactDOMServer.renderToString(
				<Provider store={store}>
					<RouterContext {...renderProps} />
				</Provider>
			);

			// all the data for the full `<html>` element has been initialized by the app
			// so go ahead and assemble the full response body
			result = getHtml(
				baseUrl,
				assetPublicPath,
				clientFilename,
				initialState,
				appMarkup
			);
			statusCode = NotFound.rewind() ||  // if NotFound is mounted, return 404
				renderProps.routes.pop().statusCode ||
				200;
		} catch(e) {
			// log the error stack here because Observable logs not great
			console.error(e.stack);
			if (process.env.NODE_ENV === 'production') {
				throw e;
			}
			const { RedBoxError } = require('redbox-react');
			appMarkup = ReactDOMServer.renderToString(<RedBoxError error={e} />);
			result = `${DOCTYPE}<html><body>${appMarkup}</body></html>`;
			statusCode = 500;
		}

		return {
			statusCode,
			result
		};
	};

/**
 * dispatch the actions necessary to set up the initial state of the app
 *
 * @param {Store} store Redux store for this request
 * @param {Object} config that initializes app (auth tokens, e.g. oauth_token)
 */
const dispatchConfig = (store, { apiUrl, log=console.log }) => {
	log(['app', 'info'], chalk.green(`Configuring apiUrl: ${apiUrl}`));
	store.dispatch(configureApiUrl(apiUrl));
};

/**
 * Curry a function that takes a Hapi request and returns an observable
 * that will emit the rendered HTML
 *
 * The outer function takes app-specific information about the routes,
 * reducer, and optional additional middleware
 *
 * @param {Object} routes the React Router routes object
 * @param {Function} reducer the root Redux reducer for the app
 * @param {Function} middleware (optional) any app-specific middleware that
 *   should be applied to the store
 *
 * @return {Function}
 *
 * -- Returned Fn --
 * @param {Request} request The request to render - must already have an
 * `oauth_token` in `state`
 * @return {Observable}
 */
const makeRenderer = (
	routes,
	reducer,
	clientFilename,
	assetPublicPath,
	middleware=[],
	baseUrl='/'
) => request => {

	middleware = middleware || [];
	request.log(['info'], chalk.green(`Rendering ${request.url.href}`));
	const {
		connection,
		headers,
		info,
		log,
		path,
	} = request;

	const appLocation = path.replace(`${baseUrl}/`, '/');
	// request protocol might be different from original request that hit proxy
	// we want to use the proxy's protocol
	const requestProtocol = headers['x-forwarded-proto'] || connection.info.protocol;
	const apiUrl = `${requestProtocol}://${info.host}/api`;

	// create the store
	const store = createServerStore(routes, reducer, {}, middleware, request);
	// load initial config
	dispatchConfig(store, { apiUrl, log: log.bind(request) });

	// render skeleton if requested - the store is ready
	if ('skeleton' in request.query) {
		return Rx.Observable.of({
			result: getHtml(baseUrl, assetPublicPath, clientFilename, store.getState()),
			statusCode: 200
		});
	}

	// otherwise render using the API and React router
	const storeIsReady$ = Rx.Observable.create(obs => {
		obs.next(store.getState());
		return store.subscribe(() => obs.next(store.getState()));
	})
	.first(state => state.preRenderChecklist.every(isReady => isReady));  // take the first ready state

	request.log(['app', 'info'], `Finding route for path: '${appLocation}'`);
	return Rx.Observable.bindNodeCallback(match)({ location: appLocation, routes })
		.do(([redirectLocation, renderProps]) => {
			if (!redirectLocation && !renderProps) {
				throw Boom.notFound();
			}
		})
		.do(() => {
			request.log(['app', 'info'], 'Found app route, dispatching RENDER');
		})
		.do(([redirectLocation, renderProps]) =>
			store.dispatch({
				type: '@@server/RENDER',
				payload: renderProps.location
			})
		)
		.flatMap(args => storeIsReady$.map(() => args))  // `sample` appears not to work - this is equivalent
		.map(getRouterRenderer(store, baseUrl, clientFilename, assetPublicPath));
};

export default makeRenderer;

