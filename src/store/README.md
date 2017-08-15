# Store

The Redux `createStore` helpers for MWP applications - `store/browser` and
`store/server`. Both modules are implemented as 'getters' with a similar
signature - the main difference is that the `store/server` function takes an
additional `request` parameter corresponding to a Hapi request.

## Dependencies

- js-cookie
- rison
- rxjs (peer)
- mwp-api-proxy-plugin
- mwp-api-state
- mwp-tracking/util/clickWriter