import React from 'react';
import PropTypes from 'prop-types';
import StaticRouter from 'react-router-dom/StaticRouter';
import PlatformApp from '../shared/PlatformApp';

/**
 * A simple component to wrap the base PlatformApp with a StaticRouter
 */
class ServerApp extends React.Component {
	render() {
		const { basename, location, staticContext, store, routes } = this.props;
		return (
			<StaticRouter
				basename={basename}
				location={location}
				context={staticContext}
			>
				<PlatformApp store={store} routes={routes} />
			</StaticRouter>
		);
	}
}

ServerApp.propTypes = {
	routes: PropTypes.array.isRequired,
	store: PropTypes.object.isRequired,
	basename: PropTypes.string.isRequired,
	location: PropTypes.string.isRequired,
	staticContext: PropTypes.object.isRequired,
};
ServerApp.defaultProps = {
	basename: '',
};

export default ServerApp;
