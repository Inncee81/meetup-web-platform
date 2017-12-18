// @flow
import fs from 'fs';
import { duotones, getDuotoneUrls } from './util/duotone';
import getApiProxyRoutes from './routes';
import proxyApi$ from './proxy';

import { API_ROUTE_PATH, API_PROXY_PLUGIN_NAME } from './config';
export { API_ROUTE_PATH } from './config';

export const setPluginState = (request: HapiRequest, reply: HapiReply) => {
	request.plugins[API_PROXY_PLUGIN_NAME] = {
		setState: reply.state, // allow plugin to proxy cookies from API
	};

	return reply.continue();
};

export default function register(
	server: Object,
	options: void,
	next: () => void
) {
	// supply duotone urls through `server.plugins['mwp-api-proxy-plugin'].duotoneUrls`
	server.expose(
		'duotoneUrls',
		getDuotoneUrls(duotones, server.settings.app.photo_scaler_salt)
	);

	// add a method to the `request` object that can call REST API
	server.decorate('request', 'proxyApi$', proxyApi$, { apply: true });
	// plugin state must be available to all routes that use `request.proxyApi$`
	server.ext('onRequest', setPluginState);

	// add a route that will receive query requests as querystring params
	const routes = getApiProxyRoutes(API_ROUTE_PATH);
	server.route(routes);

	next();
}

register.attributes = {
	name: API_PROXY_PLUGIN_NAME,
	version: '1.0.0',
	dependencies: [
		'mwp-auth', // provides request.auth.credentials ({ memberCookie, csrfToken })
		'tracking', // provides request.trackActivity()
		'electrode-csrf-jwt', // provides csrf protection for POST
	],
};
