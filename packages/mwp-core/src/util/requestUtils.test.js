import { getRemoteIp, getRemoteGeoLocation } from './requestUtils';

const REQUEST_MOCK = {
	info: {},
	headers: {},
	query: {},
};

describe('getRemoteIp', () => {
	it('returns an IP address from a query string parameter', () => {
		const request = {
			...REQUEST_MOCK,
			info: {
				remoteAddress: '127.0.0.1',
			},
			headers: {
				'fastly-client-ip': '192.168.0.1',
			},
			query: {
				__set_geoip: '89.22.50.79',
			},
		};

		expect(getRemoteIp(request)).toEqual('89.22.50.79');
	});

	it('returns an IP address from Fastly header', () => {
		const request = {
			...REQUEST_MOCK,
			info: {
				remoteAddress: '127.0.0.1',
			},
			headers: {
				'fastly-client-ip': '192.168.0.1',
			},
			query: {},
		};

		expect(getRemoteIp(request)).toEqual('192.168.0.1');
	});

	it('returns an IP address from a request remote address', () => {
		const request = {
			...REQUEST_MOCK,
			info: {
				remoteAddress: '127.0.0.1',
			},
			headers: {},
			query: {},
		};

		expect(getRemoteIp(request)).toEqual('127.0.0.1');
	});

	it('returns nothing if none of the methods above yielded a result', () => {
		const request = {
			...REQUEST_MOCK,
			info: {},
			headers: {},
			query: {},
		};

		expect(getRemoteIp(request)).toBeUndefined();
	});
});

describe('getRemoteGeoLocation', () => {
	it.each([
		['empty object for empty geo headers', {}, {}],
		[
			'region and country for full x-region',
			{ 'x-region': 'us/ny' },
			{ country: 'us', region: 'ny' },
		],
		[
			'country only for country-only x-region',
			{ 'x-region': 'us/' },
			{ country: 'us' },
		],
		[
			'region ony for region-only x-region',
			{ 'x-region': '/ny' },
			{ region: 'ny' },
		],
		['city for x-geo-city', { 'x-geo-city': 'nyc' }, { city: 'nyc' }],
		[
			'latlon for x-geo-latlon',
			{ 'x-geo-latlon': '1.2345,2.3456' },
			{ latlon: [1.2345, 2.3456] },
		],
	])('%s', (_, headers, expected) => {
		expect(getRemoteGeoLocation({ ...REQUEST_MOCK, headers })).toEqual(expected);
	});
});
