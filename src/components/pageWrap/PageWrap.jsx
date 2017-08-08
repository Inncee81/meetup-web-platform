import React from 'react';
import Helmet from 'react-helmet';
import PropTypes from 'prop-types';

import { polyfillServiceUrl } from './browserPolyfill';

/*
 * This just imports a blob of JS that New Relic give us so we can track usage/errors from real
 * users. We should only need to upgrade it in the event New Relic makes a major change, which
 * they'll let us know about.
 */
import { newrelicBrowserJS } from './newrelicBrowser';

/**
 * This component wraps all pages on the website, and through [Helmet](https://github.com/nfl/react-helmet/)
 * sets up base CSS, favicons, javascript, and our New Relic RUM/error reporting (see `newrelicBrowserJS` above).
 *
 * @module PageWrap
 */
class PageWrap extends React.Component {
	/**
	 * This method ensures important app state props passed
	 * from `AppContainer` are passed to children (feature containers)
	 *
	 * @method renderChildren
	 * @returns {Array} Children with mapped props
	 */
	renderChildren() {
		const { self, localeCode, location } = this.props;

		return React.Children.map(this.props.children, (child, key) =>
			React.cloneElement(child, { self, localeCode, location, key })
		);
	}

	renderHeadLinks(assets) {
		return assets.map((props, index) =>
			<link key={`${props.rel}-${index}`} {...props} />
		);
	}

	/**
	 * @return {React.element} the page wrapping component
	 */
	render() {
		const { localeCode, css, iconSprite, swarmLogos } = this.props;

		// Parse localeCode for ISO 639-1 languages code.
		// (ie. 'en', 'it', etc)
		// @see https://github.com/meetup/swarm-sasstools/blob/master/scss/utils/helpers/_i18n.scss
		const lang = localeCode.substring(0, 2);

		return (
			<div
				id="root"
				className={`column lang_${lang}`}
				style={{ minHeight: '100vh' }}
			>
				<Helmet defaultTitle="Meetup" titleTemplate="%s - Meetup">
					{css && this.renderHeadLinks(css)}

					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
					<meta http-equiv="X-UA-Compatible" content="IE=edge" />
					<meta name="robots" content="index,follow" />
					<meta
						name="verify-v1"
						content="h5EhuAEkLFlZmMxwpH5wnRaoDEmqYCCEUE+FLcrRNvE="
					/>

					{swarmLogos && this.renderHeadLinks(swarmLogos)}

					<script type="text/javascript" src={polyfillServiceUrl(localeCode)} />
					<script type="text/javascript">
						{newrelicBrowserJS}
					</script>
				</Helmet>

				{iconSprite &&
					<div
						style={{ display: 'none' }}
						dangerouslySetInnerHTML={{ __html: iconSprite }}
					/>}

				{this.renderChildren()}
			</div>
		);
	}
}

PageWrap.propTypes = {
	css: PropTypes.array,
	iconSprite: PropTypes.string,
	localeCode: PropTypes.string.isRequired,
	location: PropTypes.object.isRequired,
	self: PropTypes.object.isRequired,
	swarmLogos: PropTypes.array,
};

export default PageWrap;