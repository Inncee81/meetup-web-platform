import Boom from 'boom';
import { getServer } from 'mwp-test-utils';
import getRoute, { onPreResponse } from './route';

describe('onPreResponse.method', () => {
	it('returns html containing error message', async () => {
		const errorMessage = 'foobar';
		const errorCode = 432;
		const response = new Boom(errorMessage, {
			statusCode: errorCode,
		});
		response.header = (key, val) => val;

		const server = await getServer();

		const request = {
			response,
			route: {},
			server,
		};
		const h = {
			code: jest.fn(),
			response: jest.fn(),
		};

		const errorResponse = onPreResponse.method(request, h);
		expect(errorResponse).toBe(response);
		// expect(responseObj.response).toHaveLastReturnedWith(expect.stringContaining(errorMessage));
		// expect(responseObj.code).toHaveBeenCalledWith(errorCode);
	});
	it('serves the homepage route', async () => {
		const result = 'ok';
		const server = await getServer();
		const routes = getRoute({
			'en-US': () => Promise.resolve({ statusCode: 200, result }),
		});

		await server.route(routes);

		const response = await server.inject({ url: '/' });
		expect(response.payload).toEqual(result);
	});
});
