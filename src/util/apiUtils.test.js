import Rx from 'rxjs';

import {
	mockQueryBadType,
	mockQuery,
	MOCK_API_PROBLEM,
	MOCK_AUTH_HEADER,
	MOCK_RENDERPROPS,
	MOCK_RENDERPROPS_UTF8,
} from 'meetup-web-mocks/lib/app';

import {
	MOCK_DUOTONE_URLS,
	MOCK_GROUP,
	MOCK_MEMBER,
} from 'meetup-web-mocks/lib/api';

import * as authUtils from '../util/authUtils';

import {
	apiResponseToQueryResponse,
	apiResponseDuotoneSetter,
	buildRequestArgs,
	logApiResponse,
	makeApiRequest$,
	makeExternalApiRequest,
	parseRequest,
	parseApiResponse,
	parseLoginAuth,
	queryToApiConfig,
	groupDuotoneSetter,
} from './apiUtils';

describe('makeExternalApiRequest', () => {
	it('calls externalRequest with requestOpts', () => {
		const spyable = {
			externalRequest$: () => Rx.Observable.of(1),
		};
		spyOn(spyable, 'externalRequest$').and.callThrough();
		const requestOpts = {
			foo: 'bar',
		};
		return makeExternalApiRequest({}, 5000, spyable.externalRequest$)(requestOpts)
			.toPromise()
			.then(() => spyable.externalRequest$.calls.mostRecent().args[0])
			.then(arg => expect(arg).toBe(requestOpts));
	});
	it('throws an error when the API times out', () => {
		const timeout = 100;
		const spyable = {
			externalRequest$: () => Rx.Observable.of(1).delay(timeout + 100),
		};
		spyOn(spyable, 'externalRequest$').and.callThrough();
		const requestOpts = {
			foo: 'bar',
		};
		return makeExternalApiRequest({}, timeout, spyable.externalRequest$)(requestOpts)
			.toPromise()
			.then(
				() => expect(true).toBe(false),  // should not be called
				err => expect(err).toEqual(jasmine.any(Error))
			);
	});
});

describe('parseApiResponse', () => {
	const MOCK_RESPONSE = {
		headers: {},
		statusCode: 200
	};
	it('converts valid JSON into an equivalent object', () => {
		const validJSON = JSON.stringify(MOCK_GROUP);
		expect(parseApiResponse('http://example.com')([MOCK_RESPONSE, validJSON]).value).toEqual(jasmine.any(Object));
		expect(parseApiResponse('http://example.com')([MOCK_RESPONSE, validJSON]).value).toEqual(MOCK_GROUP);
	});
	it('returns an object with a string "error" value for invalid JSON', () => {
		const invalidJSON = 'not valid';
		expect(parseApiResponse('http://example.com')([MOCK_RESPONSE, invalidJSON]).value.error).toEqual(jasmine.any(String));
	});
	it('returns an object with a string "error" value for API response with "problem"', () => {
		const responeWithProblem = JSON.stringify(MOCK_API_PROBLEM);
		expect(parseApiResponse('http://example.com')([MOCK_RESPONSE, responeWithProblem]).value.error).toEqual(jasmine.any(String));
	});
	it('returns an object with a string "error" value for a not-ok response', () => {
		const badStatus = {
			ok: false,
			statusCode: 500,
			statusMessage: 'Problems',
		};
		const nonOkReponse = { ...MOCK_RESPONSE, ...badStatus };
		expect(parseApiResponse('http://example.com')([nonOkReponse, '{}']).value.error).toEqual(badStatus.statusMessage);
	});
	it('returns the flags set in the X-Meetup-Flags header', () => {
		const headers = {
			'x-meetup-flags': 'foo=true,bar=false',
		};
		const flaggedResponse = { ...MOCK_RESPONSE, headers };
		expect(parseApiResponse('http://example.com')([flaggedResponse, '{}']).meta.flags.foo).toBe(true);
		expect(parseApiResponse('http://example.com')([flaggedResponse, '{}']).meta.flags.bar).toBe(false);
	});
	it('returns the requestId set in the X-Meetup-Request-Id header', () => {
		const requestId = '1234';
		const headers = {
			'x-meetup-request-id': requestId,
		};
		const flaggedResponse = { ...MOCK_RESPONSE, headers };
		expect(parseApiResponse('http://example.com')([flaggedResponse, '{}']).meta.requestId).toEqual(requestId);
	});
});

describe('parseLoginAuth', () => {
	it('calls applyAuthState for login responses', () => {
		spyOn(authUtils, 'applyAuthState').and.returnValue(() => {});
		const request = { plugins: { requestAuth: {} } };
		const query = { type: 'login' };
		const loginResponse = { type: 'login', value: {} };
		parseLoginAuth(request, query)(loginResponse);
		expect(authUtils.applyAuthState).toHaveBeenCalled();
	});
	it('does not call applyAuthState for non-login responses', () => {
		spyOn(authUtils, 'applyAuthState').and.returnValue(() => {});
		const request = { plugins: { requestAuth: {} } };
		const query = { type: 'member' };
		const apiResponse = { type: 'member', value: {} };
		const returnVal = parseLoginAuth(request, query)(apiResponse);
		expect(authUtils.applyAuthState).not.toHaveBeenCalled();
		expect(returnVal).toBe(apiResponse);
	});
	it('does not call applyAuthState when request.plugins does not exist', () => {
		spyOn(authUtils, 'applyAuthState').and.returnValue(() => {});
		const request = { plugins: {} };
		const query = { type: 'login' };
		const loginResponse = { type: 'login', value: {} };
		const returnVal = parseLoginAuth(request, query)(loginResponse);
		expect(authUtils.applyAuthState).not.toHaveBeenCalled();
		expect(returnVal).toBe(loginResponse);
	});
});

describe('queryToApiConfig', () => {
	it('returns endpoint, params, flags unchanged when endpoint is present', () => {
		const query = {
			endpoint: 'foo',
			type: 'bar',
			params: {
				foo: 'bar',
			},
			flags: ['asdf'],
		};
		const expectedApiConfig = {
			endpoint: query.endpoint,
			params: query.params,
			flags: query.flags,
		};
		expect(queryToApiConfig(query)).toEqual(expectedApiConfig);
	});
	it('transforms a query of known type to an object for API consumption', () => {
		const testQueryResults = mockQuery(MOCK_RENDERPROPS);
		expect(queryToApiConfig(testQueryResults)).toEqual(jasmine.any(Object));
		expect(queryToApiConfig(testQueryResults).endpoint).toEqual(jasmine.any(String));
	});

	it('throws a reference error when no API handler available for query type', () => {
		const testBadQueryResults = mockQueryBadType(MOCK_RENDERPROPS);
		expect(() => queryToApiConfig(testBadQueryResults)).toThrow(jasmine.any(ReferenceError));
	});
});

describe('buildRequestArgs', () => {
	const testQueryResults = mockQuery(MOCK_RENDERPROPS);
	const apiConfig = queryToApiConfig(testQueryResults);
	const url = 'http://example.com';
	const options = {
		url,
		headers: {
			authorization: 'Bearer testtoken'
		},
		mode: 'no-cors'
	};

	it('Converts an api config to arguments for a node-request call', () => {
		let method = 'get';
		const getArgs = buildRequestArgs({ ...options, method })(apiConfig);
		method = 'post';
		const postArgs = buildRequestArgs({ ...options, method })(apiConfig);
		expect(getArgs).toEqual(jasmine.any(Object));
		expect(getArgs.url).toMatch(/\?.+/);  // get requests will add querystring
		expect(getArgs.hasOwnProperty('body')).toBe(false);  // get requests will not have a body
		expect(postArgs.url).not.toMatch(/\?.+/);  // post requests will not add querystring
		expect(postArgs.body).toEqual(jasmine.any(String));  // post requests will add body string
		// post requests will add body string
		expect(postArgs.headers['content-type']).toEqual('application/x-www-form-urlencoded');

	});

	it('Sets X-Meetup-Request-Flags header when query has flags', () => {
		const query = {
			endpoint: 'foo',
			type: 'bar',
			params: {
				foo: 'bar',
			},
			flags: ['asdf'],
		};
		const apiConfig = queryToApiConfig(query);
		const getArgs = buildRequestArgs({ ...options, method: 'get' })(apiConfig);
		expect(getArgs.headers['X-Meetup-Request-Flags']).not.toBeUndefined();
		const postArgs = buildRequestArgs({ ...options, method: 'post' })(apiConfig);
		expect(postArgs.headers['X-Meetup-Request-Flags']).not.toBeUndefined();
	});

	const testQueryResults_utf8 = mockQuery(MOCK_RENDERPROPS_UTF8);
	const apiConfig_utf8 = queryToApiConfig(testQueryResults_utf8);

	it('Properly encodes the URL', () => {
		const method = 'get';
		const getArgs = buildRequestArgs({ ...options, method })(apiConfig_utf8);
		const { pathname } = require('url').parse(getArgs.url);
		expect(/^[\x00-\xFF]*$/.test(pathname)).toBe(true);  // eslint-disable-line no-control-regex
	});

});

describe('apiResponseToQueryResponse', () => {
	beforeEach(function() {
		this.refs = ['foo', 'bar'];
		this.queries = this.refs.map(ref => ({ ref }));
		// mock api response is just a map of refs to empty objects
		this.MOCK_API_RESPONSES = this.refs.map(ref => ({ ref }));
	});

	it('transforms an API response object to an object for State consumption', function() {
		this.MOCK_API_RESPONSES
			.map((apiResponse, i) => apiResponseToQueryResponse(this.queries[i])(apiResponse))
			.forEach((queryResponse, i)=> {
				expect(queryResponse).toEqual(jasmine.any(Object));
				expect(queryResponse[this.refs[i]]).toEqual(jasmine.any(Object));
			});
	});
});

describe('groupDuotoneSetter', () => {
	it('adds duotone url to group object', () => {
		const group = { ...MOCK_GROUP };
		const modifiedGroup = groupDuotoneSetter(MOCK_DUOTONE_URLS)(group);
		const { duotoneUrl } = modifiedGroup;
		const expectedUrl = MOCK_DUOTONE_URLS.dtaxb;
		expect(duotoneUrl.startsWith(expectedUrl)).toBe(true);
	});
});

describe('apiResponseDuotoneSetter', () => {
	it('adds duotone url to type: "group" api response', () => {
		const group = { ...MOCK_GROUP };
		const { ref, type } = mockQuery({});
		expect(group.duotoneUrl).toBeUndefined();
		const groupApiResponse = {
			[ref]: {
				type,
				value: group
			}
		};
		const modifiedResponse = apiResponseDuotoneSetter(MOCK_DUOTONE_URLS)(groupApiResponse);
		const { duotoneUrl } = modifiedResponse[ref].value;
		const expectedUrl = MOCK_DUOTONE_URLS.dtaxb;
		expect(duotoneUrl.startsWith(expectedUrl)).toBe(true);
	});
	it('adds duotone url to type: "home" api response', () => {
		// this is an awkward test because we have to mock the deeply-nested
		// self/home endpoint and then look for a property deep inside it
		const group = { ...MOCK_GROUP };
		expect(group.duotoneUrl).toBeUndefined();
		const homeApiResponse = {
			memberHome: {
				type: 'home',
				value: {
					rows: [{
						items: [{
							type: 'group',
							group
						}],
					}]
				}
			}
		};
		// run the function - rely on side effect in group
		apiResponseDuotoneSetter(MOCK_DUOTONE_URLS)(homeApiResponse);
		const expectedUrl = MOCK_DUOTONE_URLS.dtaxb;
		expect(group.duotoneUrl.startsWith(expectedUrl)).toBe(true);
	});
	it('returns object unmodified when it doesn\'t need duotones', () => {
		const member = { ...MOCK_MEMBER };
		const memberResponse = {
			self: {
				type: 'member',
				value: member,
			}
		};
		apiResponseDuotoneSetter(MOCK_DUOTONE_URLS)(memberResponse);
		expect(member).toEqual(MOCK_MEMBER);
	});
	it('returns object unmodified when it contains errors', () => {
		const errorResponse = {
			self: {
				type: 'member',
				value: {
					error: new Error(),
				},
			}
		};
		const errorExpectedResponse = { ...errorResponse };
		apiResponseDuotoneSetter(MOCK_DUOTONE_URLS)(errorResponse);
		expect(errorResponse).toEqual(errorExpectedResponse);
	});
});

describe('logApiResponse', () => {
	const MOCK_HAPI_REQUEST = {
		log: () => {},
	};
	const MOCK_INCOMINGMESSAGE_GET = {
		elapsedTime: 1234,
		request: {
			uri: {
				query: 'foo=bar',
				pathname: '/foo',
			},
			method: 'get',
		},
	};
	const MOCK_INCOMINGMESSAGE_POST = {
		elapsedTime: 2345,
		request: {
			uri: {
				pathname: '/foo',
			},
			method: 'post'
		},
	};
	it('emits parsed request and response data for GET request', () => {
		spyOn(MOCK_HAPI_REQUEST, 'log');
		logApiResponse(MOCK_HAPI_REQUEST)([MOCK_INCOMINGMESSAGE_GET, 'foo']);
		expect(MOCK_HAPI_REQUEST.log).toHaveBeenCalled();
		const loggedObject = JSON.parse(MOCK_HAPI_REQUEST.log.calls.mostRecent().args[1]);
		expect(loggedObject).toEqual({
			request: {
				query: { foo: 'bar' },
				pathname: MOCK_INCOMINGMESSAGE_GET.request.uri.pathname,
				method: MOCK_INCOMINGMESSAGE_GET.request.method,
			},
			response: {
				elapsedTime: MOCK_INCOMINGMESSAGE_GET.elapsedTime,
				body: jasmine.any(String),
			},
		});
	});
	it('emits parsed request and response data for POST request', () => {
		spyOn(MOCK_HAPI_REQUEST, 'log');
		logApiResponse(MOCK_HAPI_REQUEST)([MOCK_INCOMINGMESSAGE_POST, 'foo']);
		expect(MOCK_HAPI_REQUEST.log).toHaveBeenCalled();
		const loggedObject = JSON.parse(MOCK_HAPI_REQUEST.log.calls.mostRecent().args[1]);
		expect(loggedObject).toEqual({
			request: {
				query: {},
				pathname: MOCK_INCOMINGMESSAGE_POST.request.uri.pathname,
				method: MOCK_INCOMINGMESSAGE_POST.request.method,
			},
			response: {
				elapsedTime: MOCK_INCOMINGMESSAGE_POST.elapsedTime,
				body: jasmine.any(String),
			},
		});
	});
	it('handles multiple querystring vals for GET request', () => {
		spyOn(MOCK_HAPI_REQUEST, 'log');
		const response = {
			...MOCK_INCOMINGMESSAGE_GET,
			request: {
				...MOCK_INCOMINGMESSAGE_GET.request,
				uri: {
					query: 'foo=bar&baz=boodle',
					pathname: '/foo',
				},
			},
		};
		logApiResponse(MOCK_HAPI_REQUEST)([response, 'foo']);
		expect(MOCK_HAPI_REQUEST.log).toHaveBeenCalled();
		const loggedObject = JSON.parse(MOCK_HAPI_REQUEST.log.calls.mostRecent().args[1]);
		expect(loggedObject.request.query).toEqual({
			foo: 'bar',
			baz: 'boodle',
		});
	});
	it('returns the full body of the response if less than 256 characters', () => {
		const body = 'foo';
		spyOn(MOCK_HAPI_REQUEST, 'log');
		logApiResponse(MOCK_HAPI_REQUEST)([MOCK_INCOMINGMESSAGE_GET, body]);
		expect(MOCK_HAPI_REQUEST.log).toHaveBeenCalled();
		const loggedObject = JSON.parse(MOCK_HAPI_REQUEST.log.calls.mostRecent().args[1]);
		expect(loggedObject.response.body).toEqual(body);
	});
	it('returns a truncated response body if more than 256 characters', () => {
		const body300 = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean egestas viverra sem vel congue. Cras vitae malesuada justo. Fusce ut finibus felis, at sagittis leo. Morbi nec velit dignissim, viverra tellus at, pretium nisi. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla turpis duis.';
		spyOn(MOCK_HAPI_REQUEST, 'log');
		logApiResponse(MOCK_HAPI_REQUEST)([MOCK_INCOMINGMESSAGE_GET, body300]);
		expect(MOCK_HAPI_REQUEST.log).toHaveBeenCalled();
		const loggedObject = JSON.parse(MOCK_HAPI_REQUEST.log.calls.mostRecent().args[1]);
		expect(loggedObject.response.body.startsWith(body300.substr(0, 256))).toBe(true);
		expect(loggedObject.response.body.startsWith(body300)).toBe(false);
	});
});

describe('parseRequest', () => {
	const headers = { authorization: MOCK_AUTH_HEADER };
	const queries = [mockQuery(MOCK_RENDERPROPS)];
	it('extracts the queries provided in GET requests', () => {
		const data = { queries: JSON.stringify(queries) };
		const getRequest = {
			headers,
			method: 'get',
			query: data,
			state: {
				oauth_token: 'foo',
			},
		};
		expect(parseRequest(getRequest, 'http://dummy.api.meetup.com').queries).toEqual(queries);
	});
	it('extracts the queries provided in POST requests', () => {
		const data = { queries: JSON.stringify(queries) };
		const postRequest = {
			headers,
			method: 'post',
			payload: data,
			state: {
				oauth_token: 'foo',
			},
		};
		expect(parseRequest(postRequest, 'http://dummy.api.meetup.com').queries).toEqual(queries);
	});
	it('throws an error for mal-formed queries', () => {
		const notAQuery = { foo: 'bar' };
		const data = { queries: JSON.stringify([notAQuery]) };
		const getRequest = {
			headers,
			method: 'get',
			query: data,
			state: {
				oauth_token: 'foo',
			},
		};
		expect(() => parseRequest(getRequest, 'http://dummy.api.meetup.com')).toThrow();
	});
});

describe('makeApiRequest$', () => {
	const endpoint = 'foo';
	it('makes a GET request', () => {

	});
	it('makes a POST request', () => {
	});
	it('responds with query.mockResponse when set', () => {
		const mockResponse = { foo: 'bar' };
		const query = { ...mockQuery(MOCK_RENDERPROPS), mockResponse };
		const expectedResponse = {
			[query.ref]: {
				meta: {
					flags: {},
					requestId: 'mock request',
					endpoint
				},
				type: query.type,
				value: mockResponse,
			}
		};
		return makeApiRequest$({ log: () => {} }, 5000, {})([{ url: endpoint }, query])
			.toPromise()
			.then(response => expect(response).toEqual(expectedResponse));
	});
});

