import React from 'react';
import Link from 'react-router/lib/Link';
import TestUtils from 'react-addons-test-utils';
import LogoutLink from './LogoutLink';

const renderer = TestUtils.createRenderer();
const MOCK_LOGOUT_TO_QUERY = {
	logout: true
};

describe('LogoutLink', function() {
	let tree;

	it('exists', function() {
		renderer.render(<LogoutLink />);
		tree = renderer.getRenderOutput();
		expect(tree).not.toBeNull();
	});

	xit('creates a Link element to current URL with logout param', function() {
		renderer.render(<LogoutLink />);
		tree = renderer.getRenderOutput();

		expect(tree.type).toEqual(Link);
		expect(tree.props.to.pathname).toEqual('/');
		expect(tree.props.to.query).toEqual(MOCK_LOGOUT_TO_QUERY);
	});

	it('create a Link element using the to property with a logout param', function() {
		renderer.render(<LogoutLink to='/' />);
		tree = renderer.getRenderOutput();

		expect(tree.type).toEqual(Link);
		expect(tree.props.to.pathname).toEqual('/');
		expect(tree.props.to.query).toEqual(MOCK_LOGOUT_TO_QUERY);
	});
});
