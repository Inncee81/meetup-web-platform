// @flow
import AWS from 'aws-sdk';
import LaunchDarkly from 'launchdarkly-node-server-sdk';
import getRoute from './route';

function fetchLaunchDarklySdkKey(): Promise<string> {
	const secretsManager = new AWS.SecretsManager({ region: 'us-east-1' });

	return secretsManager
		.getSecretValue({ SecretId: 'LaunchDarkly' })
		.promise()
		.then(({ SecretString }) => {
			return SecretString === undefined
				? ''
				: JSON.parse(SecretString).apiAccessToken;
		});
}

// Only fetch from the param store once, wait for the promise to resolve in the reigster fn
const ldSdkKeyPromise = fetchLaunchDarklySdkKey();

console.log('Fetching SDK key from AWS')

/*
 * The server app route plugin - this applies a wildcard catch-all route that
 * will call the server app rendering function for the correct request language.
 */
export function register(
	server: HapiServer,
	options: {
		languageRenderers: { [string]: LanguageRenderer },
		ldkey?: string,
	}
): Promise<any> {
	server.route(getRoute(options.languageRenderers));

	return ldSdkKeyPromise.then(launchDarklySdkKey => {
		console.log(`Using fetched key ${launchDarklySdkKey.substring(0,5)}`)
		const ldClient = LaunchDarkly.init(options.ldkey || launchDarklySdkKey, {
			offline: process.env.NODE_ENV === 'test',
		});
		server.expose('getFlags', (user: LaunchDarklyUser) => {
			return ldClient.allFlagsState(user).then(
				state => state.allValues(),
				err => {
					server.app.logger.error({
						err,
						member: user,
					});
					return {}; // return empty flags on error
				}
			);
		});

		// set up launchdarkly instance before continuing
		server.events.on('stop', ldClient.close);

		// https://github.com/launchdarkly/node-client/issues/96
		// use waitForInitialization to catch launch darkly failures
		return ldClient.waitForInitialization().catch(error => {
			console.error(error);
		});
	});
}

export const plugin = {
	register,
	name: 'mwp-app-route',
	version: '1.0.0',
	dependencies: [
		'mwp-language-plugin', // provides `request.getPrefixedPath` and `request.getLanguage`
		'electrode-csrf-jwt', // sets CSRF jwt on initial request
	],
};
